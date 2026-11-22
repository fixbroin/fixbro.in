import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyRequest } from '@/lib/dbSecurity';
import { Timestamp } from '@/lib/timestamp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, userId, platform, appVariant } = body;

    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return NextResponse.json({ success: false, error: 'Invalid or missing FCM token.' }, { status: 400 });
    }

    const verification = await verifyRequest(request);
    // The target UID is either the verified caller or the passed userId parameter
    const targetUid = (verification.uid && verification.uid !== 'guest') 
      ? verification.uid 
      : (userId || null);

    if (!targetUid || targetUid === 'guest') {
      return NextResponse.json({ 
        success: false, 
        error: 'No target user ID provided or authenticated.' 
      }, { status: 400 });
    }

    const cleanToken = token.trim();
    let effectiveTargetUid = targetUid;
    let userDocRef = adminDb.collection('users').doc(effectiveTargetUid);
    let userDoc = await userDocRef.get();

    // If document doesn't exist under this UID, check if the verified user has an email or phone matching an existing primary user:
    if (!userDoc.exists) {
      if (verification?.email) {
        const snapEmail = await adminDb.collection('users').where('email', '==', verification.email.toLowerCase().trim()).limit(1).get();
        if (!snapEmail.empty) {
          effectiveTargetUid = snapEmail.docs[0].id;
          userDocRef = adminDb.collection('users').doc(effectiveTargetUid);
          userDoc = await userDocRef.get();
        }
      }
      if (!userDoc.exists && (verification as any)?.phone_number) {
        const cleanPhone = ((verification as any).phone_number || '').trim();
        const raw10 = cleanPhone.slice(-10);
        const snapPhone = await adminDb.collection('users').where('mobileNumber', '==', cleanPhone).limit(1).get();
        if (!snapPhone.empty) {
          effectiveTargetUid = snapPhone.docs[0].id;
          userDocRef = adminDb.collection('users').doc(effectiveTargetUid);
          userDoc = await userDocRef.get();
        } else {
          const snapPhoneRaw = await adminDb.collection('users').where('mobileNumber', '==', raw10).limit(1).get();
          if (!snapPhoneRaw.empty) {
            effectiveTargetUid = snapPhoneRaw.docs[0].id;
            userDocRef = adminDb.collection('users').doc(effectiveTargetUid);
            userDoc = await userDocRef.get();
          }
        }
      }
    }

    if (userDoc.exists) {
      const data = userDoc.data() || {};
      const existingTokens = data.fcmTokens && typeof data.fcmTokens === 'object' ? { ...data.fcmTokens } : {};
      existingTokens[cleanToken] = Timestamp.now();

      await userDocRef.update({
        fcmTokens: existingTokens,
        lastDeviceToken: cleanToken,
        lastAppPlatform: platform || 'android',
        lastAppVariant: appVariant || 'customer',
        lastTokenSyncedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    } else {
      // Only create if we have actual identity (email, phone, or name) so no blank skeleton is created
      const email = verification?.email || null;
      const phone = (verification as any)?.phone_number || null;
      const name = (verification as any)?.name || null;

      if (email || phone || name) {
        await userDocRef.set({
          id: effectiveTargetUid,
          email,
          mobileNumber: phone,
          displayName: name,
          fcmTokens: {
            [cleanToken]: Timestamp.now()
          },
          lastDeviceToken: cleanToken,
          lastAppPlatform: platform || 'android',
          lastAppVariant: appVariant || 'customer',
          lastTokenSyncedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }, { merge: true });
      }
    }

    // Also sync to admin document if an admin document exists for this user
    try {
      const adminDocRef = adminDb.collection('admins').doc(targetUid);
      const adminDoc = await adminDocRef.get();
      if (adminDoc.exists) {
        const adminData = adminDoc.data() || {};
        const adminTokens = adminData.fcmTokens && typeof adminData.fcmTokens === 'object' ? { ...adminData.fcmTokens } : {};
        adminTokens[cleanToken] = Timestamp.now();
        await adminDocRef.update({
          fcmTokens: adminTokens,
          lastDeviceToken: cleanToken,
          updatedAt: Timestamp.now()
        });
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      userId: targetUid,
      syncedToken: cleanToken.substring(0, 15) + '...'
    });
  } catch (error: any) {
    console.error("Error in sync-fcm-token API:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
