import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getPool, getDocInternal, deleteDocInternal, updateDocInternal, Timestamp } from '@/lib/mysql';
import { deleteStorageFiles } from '@/lib/serverStorageUtils';

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Invalid token.' }, { status: 401 });
    }

    const pool = await getPool();
    const userDoc = await getDocInternal(pool, 'users', uid);
    const userData = userDoc?.data || {};
    const userEmail = userData.email || decodedToken.email;
    const userPhone = userData.mobileNumber || decodedToken.phone_number;

    const filesToDelete: string[] = [];
    if (userData.photoURL) filesToDelete.push(userData.photoURL);

    // Check if user had provider application files
    try {
      const appDoc = await getDocInternal(pool, 'providerApplications', uid);
      if (appDoc?.exists && appDoc?.data) {
        const app = appDoc.data;
        if (app.profilePhotoUrl) filesToDelete.push(app.profilePhotoUrl);
        if (app.bankDetails?.cancelledChequeUrl) filesToDelete.push(app.bankDetails.cancelledChequeUrl);
        if (app.signatureUrl) filesToDelete.push(app.signatureUrl);
        if (app.aadhaar?.frontImageUrl) filesToDelete.push(app.aadhaar.frontImageUrl);
        if (app.aadhaar?.backImageUrl) filesToDelete.push(app.aadhaar.backImageUrl);
        if (app.pan?.frontImageUrl) filesToDelete.push(app.pan.frontImageUrl);
        if (app.pan?.backImageUrl) filesToDelete.push(app.pan.backImageUrl);
        if (app.idCardUrl) filesToDelete.push(app.idCardUrl);
      }
    } catch (e) {}

    if (filesToDelete.length > 0) {
      await deleteStorageFiles(filesToDelete).catch(err => {
        console.warn('Error purging user files:', err);
      });
    }

    // Delete database records
    await deleteDocInternal(pool, 'users', uid);
    await deleteDocInternal(pool, 'providerApplications', uid).catch(() => {});
    await deleteDocInternal(pool, 'userCarts', uid).catch(() => {});
    await deleteDocInternal(pool, 'providerIdCards', uid).catch(() => {});

    // Delete Firebase Auth user by UID
    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr: any) {
      if (authErr?.code !== 'auth/user-not-found') {
        console.warn('Could not delete Firebase Auth user by UID:', authErr);
      }
    }

    // Delete secondary Firebase Auth user by Email
    if (userEmail) {
      try {
        const authUserByEmail = await adminAuth.getUserByEmail(userEmail);
        if (authUserByEmail?.uid && authUserByEmail.uid !== uid) {
          await adminAuth.deleteUser(authUserByEmail.uid);
        }
      } catch (e) {}
    }

    // Delete secondary Firebase Auth user by Phone
    if (userPhone) {
      try {
        const fullPhone = userPhone.startsWith('+') ? userPhone : `+${userPhone}`;
        const authUserByPhone = await adminAuth.getUserByPhoneNumber(fullPhone);
        if (authUserByPhone?.uid && authUserByPhone.uid !== uid) {
          await adminAuth.deleteUser(authUserByPhone.uid);
        }
      } catch (e) {}
    }

    // Update stats counter to current max active userNumber
    try {
      const [maxRows]: any = await pool.query(`
        SELECT MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.userNumber')) AS UNSIGNED)) as maxNum,
               COUNT(*) as totalActive
        FROM \`users\`
        WHERE (JSON_UNQUOTE(JSON_EXTRACT(data, '$.isArchived')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.isArchived')) != 'true')
          AND (JSON_UNQUOTE(JSON_EXTRACT(data, '$.mergedIntoUid')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.mergedIntoUid')) = '')
      `);
      const maxNum = Number(maxRows?.[0]?.maxNum) || 0;
      const totalActive = Number(maxRows?.[0]?.totalActive) || 0;
      await updateDocInternal(pool, 'appConfiguration', 'stats', {
        lastUserNumber: maxNum,
        totalUsers: totalActive,
        updatedAt: Timestamp.now()
      }).catch(() => {});
    } catch (e) {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in delete-account API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
