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
    let phoneMatchDoc: any = null;
    let emailMatchDoc: any = null;

    if (effectivePhone) {
      const raw10 = effectivePhone.startsWith('+91') ? effectivePhone.slice(3) : effectivePhone.replace('+', '');
      const fullPhone = effectivePhone.startsWith('+') ? effectivePhone : `+${effectivePhone}`;

      const snapByPhone = await usersCol.where('mobileNumber', '==', fullPhone).limit(5).get();
      for (const d of snapByPhone.docs) {
        if (d.id !== callerUid && !d.data()?.isArchived && !d.data()?.mergedIntoUid) {
          phoneMatchDoc = d;
          break;
        }
      }

      if (!phoneMatchDoc) {
        const snapByRaw = await usersCol.where('mobileNumber', '==', raw10).limit(5).get();
        for (const d of snapByRaw.docs) {
          if (d.id !== callerUid && !d.data()?.isArchived && !d.data()?.mergedIntoUid) {
            phoneMatchDoc = d;
            break;
          }
        }
      }
    }

    if (effectiveEmail) {
      const snapByEmail = await usersCol.where('email', '==', effectiveEmail).limit(5).get();
      for (const d of snapByEmail.docs) {
        if (d.id !== callerUid && !d.data()?.isArchived && !d.data()?.mergedIntoUid) {
          emailMatchDoc = d;
          break;
        }
      }
    }

    // Check for double conflict: phone matches User 1, but email matches User 2
    if (phoneMatchDoc && emailMatchDoc && phoneMatchDoc.id !== emailMatchDoc.id) {
      return NextResponse.json({
        success: false,
        conflict: 'multiple_accounts',
        error: 'This mobile number and email belong to two different accounts.'
      }, { status: 409 });
    }

    const matchingDoc = phoneMatchDoc || emailMatchDoc;

    // 3. Conflict validation on matching user
    if (matchingDoc) {
      const existingData = matchingDoc.data() || {};
      const existingEmail = existingData.email ? existingData.email.toLowerCase().trim() : null;
      const existingPhone = existingData.mobileNumber ? normalizePhoneNumber(existingData.mobileNumber) : null;

      // Conflict 1: Caller matched by phone, but caller has a different email than existing account
      if (effectiveEmail && existingEmail && effectiveEmail !== existingEmail) {
        return NextResponse.json({
          success: false,
          conflict: 'phone_already_used',
          error: 'This mobile number is already linked to another account.'
        }, { status: 409 });
      }

      // Conflict 2: Caller matched by email, but caller has a different phone than existing account
      if (effectivePhone && existingPhone && effectivePhone !== existingPhone) {
        return NextResponse.json({
          success: false,
          conflict: 'email_already_used',
          error: 'This email address is already linked to another account.'
        }, { status: 409 });
      }

      // Legitimate match -> Proceed with unification under primaryUid
      const existingUid = matchingDoc.id;

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
      if (verifiedPhone) {
        updateData.mobileNumberVerified = true;
      }
      if (effectiveEmail && !primaryData.email) {
        updateData.email = effectiveEmail;
      }
      if (verifiedEmail) {
        updateData.emailVerified = true;
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

      // Clean up the secondary callerUid completely so no ghost/skeleton user is ever kept
      if (callerUid !== primaryUid) {
        // Transfer any FCM tokens from callerUid to primaryUid
        try {
          const callerSnap = await usersCol.doc(callerUid).get();
          if (callerSnap.exists) {
            const callerDocData = callerSnap.data() || {};
            if (callerDocData.fcmTokens && typeof callerDocData.fcmTokens === 'object') {
              const primarySnap = await usersCol.doc(primaryUid).get();
              const primaryDataCurrent = primarySnap.data() || {};
              const mergedTokens = { ...(primaryDataCurrent.fcmTokens || {}), ...callerDocData.fcmTokens };
              await usersCol.doc(primaryUid).set({ fcmTokens: mergedTokens, updatedAt: Timestamp.now() }, { merge: true });
            }
          }
        } catch (_) {}

        // Delete secondary document from MySQL users table
        await usersCol.doc(callerUid).delete().catch(() => {});

        // Delete temporary secondary user from Firebase Auth
        try {
          await adminAuth.deleteUser(callerUid);
        } catch (_) {}
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
      if (verifiedPhone && !callerData.mobileNumberVerified) {
        await usersCol.doc(callerUid).set({ mobileNumberVerified: true }, { merge: true });
        callerData.mobileNumberVerified = true;
      }
      if (verifiedEmail && !callerData.emailVerified) {
        await usersCol.doc(callerUid).set({ emailVerified: true }, { merge: true });
        callerData.emailVerified = true;
      }
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
