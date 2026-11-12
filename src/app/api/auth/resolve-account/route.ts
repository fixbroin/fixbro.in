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

    // 1. Check if caller already has a complete users document
    const usersCol = adminDb.collection('users');
    const directUserDoc = await usersCol.doc(callerUid).get();
    if (directUserDoc.exists) {
      const existingData = directUserDoc.data();
      if (existingData?.displayName && (existingData?.mobileNumber || existingData?.email)) {
        return NextResponse.json({
          success: true,
          resolved: true,
          isAlreadySetup: true,
          user: existingData
        });
      }
    }

    // 2. Search for an admin-created user by verified phone number or verified email
    let matchingDoc: any = null;

    if (verifiedPhone) {
      const snapByPhone = await usersCol.where('mobileNumber', '==', verifiedPhone).limit(1).get();
      if (!snapByPhone.empty && snapByPhone.docs[0].id !== callerUid) {
        matchingDoc = snapByPhone.docs[0];
      } else {
        const raw10 = verifiedPhone.startsWith('+91') ? verifiedPhone.slice(3) : verifiedPhone.replace('+', '');
        const snapByRaw = await usersCol.where('mobileNumber', '==', raw10).limit(1).get();
        if (!snapByRaw.empty && snapByRaw.docs[0].id !== callerUid) {
          matchingDoc = snapByRaw.docs[0];
        }
      }
    }

    if (!matchingDoc && verifiedEmail) {
      const snapByEmail = await usersCol.where('email', '==', verifiedEmail).limit(1).get();
      if (!snapByEmail.empty && snapByEmail.docs[0].id !== callerUid) {
        matchingDoc = snapByEmail.docs[0];
      }
    }

    // 3. If matching existing user is found, link/migrate records to callerUid
    if (matchingDoc) {
      const sourceUid = matchingDoc.id;
      const sourceData = matchingDoc.data();

      const mergedUserData = {
        ...sourceData,
        uid: callerUid,
        mobileNumber: verifiedPhone || sourceData.mobileNumber,
        email: verifiedEmail || sourceData.email,
        linkedFromAdminUid: sourceUid,
        lastLoginAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Set users/{callerUid}
      await usersCol.doc(callerUid).set(mergedUserData, { merge: true });

      // If provider, also migrate/link providerApplications
      if (sourceData.role === 'provider') {
        const provAppsCol = adminDb.collection('providerApplications');
        const sourceProvDoc = await provAppsCol.doc(sourceUid).get();
        if (sourceProvDoc.exists) {
          const provData = sourceProvDoc.data();
          await provAppsCol.doc(callerUid).set({
            ...provData,
            id: callerUid,
            userId: callerUid,
            linkedFromAdminUid: sourceUid,
            updatedAt: Timestamp.now(),
          }, { merge: true });
        }
      }

      // Mark the placeholder source user doc as merged so it doesn't collide
      await usersCol.doc(sourceUid).set({
        isArchived: true,
        mergedIntoUid: callerUid,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      return NextResponse.json({
        success: true,
        resolved: true,
        linked: true,
        user: mergedUserData
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
