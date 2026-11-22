import { verifyRequest, isUserAdmin } from '@/lib/dbSecurity';
import { NextRequest, NextResponse } from 'next/server';
import { getPool, getDocsInternal, updateDocInternal, deleteDocInternal } from '@/lib/mysql';

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
    await deleteDocInternal(pool, 'users', id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
