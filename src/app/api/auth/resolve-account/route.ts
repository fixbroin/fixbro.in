import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from '@/lib/mysqlDbAdmin';

function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  const cleaned = rawPhone.trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return `+${cleaned}`;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const callerUid = decodedToken.uid;
    const verifiedPhone = decodedToken.phone_number ? normalizePhoneNumber(decodedToken.phone_number) : null;
    const verifiedEmail = decodedToken.email ? decodedToken.email.toLowerCase().trim() : null;

    if (!callerUid) {
      return NextResponse.json({ success: false, error: 'Invalid token.' }, { status: 401 });
    }

    const usersCol = adminDb.collection('users');
    const directUserDoc = await usersCol.doc(callerUid).get();
    const callerData = directUserDoc.exists ? directUserDoc.data() : null;

    const effectivePhone = verifiedPhone || (callerData?.mobileNumber ? normalizePhoneNumber(callerData.mobileNumber) : null);
    const effectiveEmail = verifiedEmail || (callerData?.email ? callerData.email.toLowerCase().trim() : null);

    // If caller has mergedIntoUid, immediately switch session to the primary account
    if (callerData?.mergedIntoUid && callerData.mergedIntoUid !== callerUid) {
      const targetUid = callerData.mergedIntoUid;
      const targetDoc = await usersCol.doc(targetUid).get();
      if (targetDoc.exists) {
        const customToken = await adminAuth.createCustomToken(targetUid);
        return NextResponse.json({
          success: true,
          resolved: true,
          unified: true,
          customToken,
          primaryUid: targetUid,
          user: targetDoc.data()
        });
      }
    }

    // 2. Search for existing user with matching phone or email
    let matchingDoc: any = null;

    if (effectivePhone) {
      const raw10 = effectivePhone.startsWith('+91') ? effectivePhone.slice(3) : effectivePhone.replace('+', '');
      const fullPhone = effectivePhone.startsWith('+') ? effectivePhone : `+${effectivePhone}`;

      const snapByPhone = await usersCol.where('mobileNumber', '==', fullPhone).limit(5).get();
      for (const d of snapByPhone.docs) {
        if (d.id !== callerUid && !d.data()?.isArchived) {
          matchingDoc = d;
          break;
        }
      }

      if (!matchingDoc) {
        const snapByRaw = await usersCol.where('mobileNumber', '==', raw10).limit(5).get();
        for (const d of snapByRaw.docs) {
          if (d.id !== callerUid && !d.data()?.isArchived) {
            matchingDoc = d;
            break;
          }
        }
      }
    }

    if (!matchingDoc && effectiveEmail) {
      const snapByEmail = await usersCol.where('email', '==', effectiveEmail).limit(5).get();
      for (const d of snapByEmail.docs) {
        if (d.id !== callerUid && !d.data()?.isArchived) {
          matchingDoc = d;
          break;
        }
      }
    }

    // 3. If matching existing user is found, unify under primaryUid
    if (matchingDoc) {
      const existingUid = matchingDoc.id;
      const existingData = matchingDoc.data();

      // The primary UID is the existing account (or whichever has mergedIntoUid)
      const primaryUid = (existingData?.mergedIntoUid && existingData.mergedIntoUid !== callerUid)
        ? existingData.mergedIntoUid 
        : existingUid;

      const primaryDoc = primaryUid === existingUid ? matchingDoc : await usersCol.doc(primaryUid).get();
      const primaryData = primaryDoc.data() || existingData;

      // Update primary user with verified phone/email if missing
      const updateData: any = {
        updatedAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
      };
      if (effectivePhone && !primaryData.mobileNumber) {
        updateData.mobileNumber = effectivePhone;
      }
      if (effectiveEmail && !primaryData.email) {
        updateData.email = effectiveEmail;
      }
      if (!primaryData.displayName && callerData?.displayName) {
        updateData.displayName = callerData.displayName;
      }
      if (!primaryData.photoURL && callerData?.photoURL) {
        updateData.photoURL = callerData.photoURL;
      }

      await usersCol.doc(primaryUid).set(updateData, { merge: true });

      // Migrate all bookings to primaryUid
      const bookingsCol = adminDb.collection('bookings');
      
      // A) Bookings under callerUid
      const snapCallerBookings = await bookingsCol.where('userId', '==', callerUid).get();
      for (const b of snapCallerBookings.docs) {
        await bookingsCol.doc(b.id).update({
          userId: primaryUid,
          updatedAt: Timestamp.now()
        });
      }

      // B) Bookings matching phone number
      if (effectivePhone) {
        const raw10 = effectivePhone.startsWith('+91') ? effectivePhone.slice(3) : effectivePhone.replace('+', '');
        const snapBPhone1 = await bookingsCol.where('customerPhone', '==', effectivePhone).get();
        for (const b of snapBPhone1.docs) {
          if (b.data()?.userId !== primaryUid) {
            await bookingsCol.doc(b.id).update({ userId: primaryUid, updatedAt: Timestamp.now() });
          }
        }
        const snapBPhone2 = await bookingsCol.where('customerPhone', '==', raw10).get();
        for (const b of snapBPhone2.docs) {
          if (b.data()?.userId !== primaryUid) {
            await bookingsCol.doc(b.id).update({ userId: primaryUid, updatedAt: Timestamp.now() });
          }
        }
      }

      // C) Bookings matching email
      if (effectiveEmail) {
        const snapBEmail = await bookingsCol.where('customerEmail', '==', effectiveEmail).get();
        for (const b of snapBEmail.docs) {
          if (b.data()?.userId !== primaryUid) {
            await bookingsCol.doc(b.id).update({ userId: primaryUid, updatedAt: Timestamp.now() });
          }
        }
      }

      // Migrate cart if secondary had items
      const cartsCol = adminDb.collection('userCarts');
      const secCart = await cartsCol.doc(callerUid).get();
      if (secCart.exists) {
        const secCartData = secCart.data();
        await cartsCol.doc(primaryUid).set({
          ...secCartData,
          userId: primaryUid,
          id: primaryUid,
          updatedAt: Timestamp.now()
        }, { merge: true });
        await cartsCol.doc(callerUid).delete().catch(() => {});
      }

      // Delete/archive the secondary callerUid document in users so no duplicate row is ever kept
      if (callerUid !== primaryUid) {
        await usersCol.doc(callerUid).delete().catch(() => {});
        adminAuth.deleteUser(callerUid).catch(() => {});
      }

      // Mint custom token for primaryUid so the client session runs on the SAME primary user ID
      const customToken = await adminAuth.createCustomToken(primaryUid);

      return NextResponse.json({
        success: true,
        resolved: true,
        unified: true,
        customToken,
        primaryUid,
        user: { ...primaryData, ...updateData, id: primaryUid, uid: primaryUid }
      });
    }

    // 4. No other account matched — standalone user
    if (callerData && callerData.displayName && (callerData.mobileNumber || callerData.email)) {
      return NextResponse.json({
        success: true,
        resolved: true,
        isAlreadySetup: true,
        user: callerData
      });
    }

    return NextResponse.json({
      success: true,
      resolved: false,
      message: 'No existing account found to link.'
    });

  } catch (error: any) {
    console.error('Error in /api/auth/resolve-account:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
