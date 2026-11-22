import { verifyRequest, isUserAdmin } from '@/lib/dbSecurity';
import { NextRequest, NextResponse } from 'next/server';
import { getPool, getDocsInternal, updateDocInternal, deleteDocInternal, getDocInternal } from '@/lib/mysql';
import { adminAuth } from '@/lib/firebaseAdmin';
import { deleteStorageFiles } from '@/lib/serverStorageUtils';

export async function GET(request: NextRequest) {
  const user = await verifyRequest(request);
  if (!user || !isUserAdmin(user)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const rawProviders = await getDocsInternal(pool, 'providerApplications', []);
    const providers = rawProviders.map((p: any) => ({ id: p.id, ...p.data }));
    return NextResponse.json({ success: true, providers });
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
    await updateDocInternal(pool, 'providerApplications', id, data);
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

    // 1. Collect all related provider applications and user documents
    const appsToDelete: any[] = [];
    const directAppDoc = await getDocInternal(pool, 'providerApplications', id);
    if (directAppDoc?.exists && directAppDoc?.data) {
      appsToDelete.push({ id, ...directAppDoc.data });
    }

    try {
      const appsByUser = await getDocsInternal(pool, 'providerApplications', [
        { field: 'userId', operator: '==', value: id }
      ]);
      for (const a of appsByUser) {
        if (!appsToDelete.some(existing => existing.id === a.id)) {
          appsToDelete.push({ id: a.id, ...a.data });
        }
      }
    } catch (e) {}

    const usersToDelete: any[] = [];
    const directUserDoc = await getDocInternal(pool, 'users', id);
    if (directUserDoc?.exists && directUserDoc?.data) {
      usersToDelete.push({ id, ...directUserDoc.data });
    }

    for (const app of appsToDelete) {
      if (app.userId && !usersToDelete.some(u => u.id === app.userId)) {
        try {
          const uDoc = await getDocInternal(pool, 'users', app.userId);
          if (uDoc?.exists && uDoc?.data) {
            usersToDelete.push({ id: app.userId, ...uDoc.data });
          }
        } catch (e) {}
      }
    }

    // 2. Collect all uploaded images/files to delete from disk and storage
    const filesToDelete: string[] = [];
    for (const app of appsToDelete) {
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
    for (const u of usersToDelete) {
      if (u.photoURL) filesToDelete.push(u.photoURL);
    }

    // Purge files from disk and remote storage
    if (filesToDelete.length > 0) {
      await deleteStorageFiles(filesToDelete).catch(err => {
        console.warn('Error purging provider files:', err);
      });
    }

    // 3. Delete database records
    const uidsToPurge = new Set<string>([id]);
    const emailsToPurge = new Set<string>();
    const phonesToPurge = new Set<string>();

    for (const app of appsToDelete) {
      if (app.id) uidsToPurge.add(app.id);
      if (app.userId) uidsToPurge.add(app.userId);
      if (app.email) emailsToPurge.add(String(app.email).toLowerCase().trim());
      if (app.mobileNumber) phonesToPurge.add(String(app.mobileNumber).trim());
      if (app.phoneNumber) phonesToPurge.add(String(app.phoneNumber).trim());
      await deleteDocInternal(pool, 'providerApplications', app.id).catch(() => {});
    }

    for (const u of usersToDelete) {
      if (u.id) uidsToPurge.add(u.id);
      if (u.email) emailsToPurge.add(String(u.email).toLowerCase().trim());
      if (u.mobileNumber) phonesToPurge.add(String(u.mobileNumber).trim());
      await deleteDocInternal(pool, 'users', u.id).catch(() => {});
      await deleteDocInternal(pool, 'userCarts', u.id).catch(() => {});
    }

    await deleteDocInternal(pool, 'providerApplications', id).catch(() => {});
    await deleteDocInternal(pool, 'users', id).catch(() => {});
    await deleteDocInternal(pool, 'userCarts', id).catch(() => {});
    await deleteDocInternal(pool, 'providerIdCards', id).catch(() => {});

    // 4. Delete Firebase Auth users (by UID, Email, and Phone)
    for (const uid of uidsToPurge) {
      try {
        await adminAuth.deleteUser(uid);
      } catch (authErr: any) {
        if (authErr?.code !== 'auth/user-not-found') {
          console.warn('Could not delete Firebase Auth user by UID:', uid, authErr);
        }
      }
    }

    for (const email of emailsToPurge) {
      try {
        const authUser = await adminAuth.getUserByEmail(email);
        if (authUser?.uid) {
          await adminAuth.deleteUser(authUser.uid);
        }
      } catch (e) {}
    }

    for (const phone of phonesToPurge) {
      try {
        const fullPhone = phone.startsWith('+') ? phone : `+${phone}`;
        const authUser = await adminAuth.getUserByPhoneNumber(fullPhone);
        if (authUser?.uid) {
          await adminAuth.deleteUser(authUser.uid);
        }
      } catch (e) {}
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
