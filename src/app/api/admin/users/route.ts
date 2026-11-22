import { verifyRequest, isUserAdmin } from '@/lib/dbSecurity';
import { NextRequest, NextResponse } from 'next/server';
import { getPool, getDocsInternal, updateDocInternal, deleteDocInternal, getDocInternal, Timestamp } from '@/lib/mysql';
import { adminAuth } from '@/lib/firebaseAdmin';
import { deleteStorageFiles } from '@/lib/serverStorageUtils';

export async function GET(request: NextRequest) {
  const user = await verifyRequest(request);
  if (!user || !isUserAdmin(user)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const rawUsers = await getDocsInternal(pool, 'users', []);
    const allUsers = rawUsers
      .map((u: any) => ({ id: u.id, ...u.data }))
      .filter((u: any) => !u.isArchived && !u.mergedIntoUid);

    // Deduplicate so duplicate accounts for the same email or mobile number never appear twice
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const users: any[] = [];

    for (const u of allUsers) {
      const email = (u.email || '').toLowerCase().trim();
      const phone = (u.mobileNumber || '').trim().replace(/[\s\-()]/g, '');
      const raw10 = phone.startsWith('+91') ? phone.slice(3) : phone.replace('+', '');

      if (email && seenEmails.has(email)) continue;
      if (raw10 && (seenPhones.has(raw10) || seenPhones.has(`+91${raw10}`))) continue;

      if (email) seenEmails.add(email);
      if (raw10) {
        seenPhones.add(raw10);
        seenPhones.add(`+91${raw10}`);
      }
      users.push(u);
    }

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await verifyRequest(request);
  if (!user || !isUserAdmin(user)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id, data } = await request.json();
    const pool = await getPool();
    await updateDocInternal(pool, 'users', id, data);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await verifyRequest(request);
  if (!user || !isUserAdmin(user)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    const pool = await getPool();

    // 1. Fetch user doc to get email, phone, and photos before deletion
    let userEmail: string | null = null;
    let userPhone: string | null = null;
    const filesToDelete: string[] = [];

    try {
      const userDoc = await getDocInternal(pool, 'users', id);
      if (userDoc?.exists && userDoc?.data) {
        userEmail = (userDoc.data.email || '').toLowerCase().trim();
        userPhone = (userDoc.data.mobileNumber || '').trim();
        if (userDoc.data.photoURL) filesToDelete.push(userDoc.data.photoURL);
      }
    } catch (e) {}

    // Check if this user had a provider application
    try {
      const appDoc = await getDocInternal(pool, 'providerApplications', id);
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
        if (Array.isArray(app.additionalDocuments)) {
          for (const doc of app.additionalDocuments) {
            if (doc?.frontImageUrl) filesToDelete.push(doc.frontImageUrl);
            if (doc?.backImageUrl) filesToDelete.push(doc.backImageUrl);
          }
        }
      }
    } catch (e) {}

    // Purge files if any
    if (filesToDelete.length > 0) {
      await deleteStorageFiles(filesToDelete).catch(err => {
        console.warn('Error purging user files:', err);
      });
    }

    // 2. Delete database records
    await deleteDocInternal(pool, 'users', id);
    await deleteDocInternal(pool, 'providerApplications', id).catch(() => {});
    await deleteDocInternal(pool, 'userCarts', id).catch(() => {});
    await deleteDocInternal(pool, 'providerIdCards', id).catch(() => {});

    // 3. Delete Firebase Auth user by UID
    try {
      await adminAuth.deleteUser(id);
    } catch (authErr: any) {
      if (authErr?.code !== 'auth/user-not-found') {
        console.warn('Could not delete Firebase Auth user by UID:', authErr);
      }
    }

    // 4. Also delete any secondary Firebase Auth user matching email
    if (userEmail) {
      try {
        const authUserByEmail = await adminAuth.getUserByEmail(userEmail);
        if (authUserByEmail?.uid) {
          await adminAuth.deleteUser(authUserByEmail.uid);
        }
      } catch (e) {}
    }

    // 5. Also delete any secondary Firebase Auth user matching phone
    if (userPhone) {
      try {
        const fullPhone = userPhone.startsWith('+') ? userPhone : `+${userPhone}`;
        const authUserByPhone = await adminAuth.getUserByPhoneNumber(fullPhone);
        if (authUserByPhone?.uid) {
          await adminAuth.deleteUser(authUserByPhone.uid);
        }
      } catch (e) {}
    }

    // 6. Update stats counter to current max active userNumber
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
