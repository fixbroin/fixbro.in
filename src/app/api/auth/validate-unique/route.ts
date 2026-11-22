import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/mysql';

export async function POST(request: NextRequest) {
  try {
    const { email, mobileNumber, currentUid } = await request.json();

    const pool = await getPool();

    // 1. Check email uniqueness across active users
    if (email) {
      const cleanEmail = String(email).toLowerCase().trim();
      const [emailRows]: any = await pool.query(`
        SELECT id, JSON_UNQUOTE(JSON_EXTRACT(data, '$.displayName')) as name
        FROM \`users\`
        WHERE LOWER(JSON_UNQUOTE(JSON_EXTRACT(data, '$.email'))) = ?
          AND id != ?
          AND (JSON_UNQUOTE(JSON_EXTRACT(data, '$.isArchived')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.isArchived')) != 'true')
          AND (JSON_UNQUOTE(JSON_EXTRACT(data, '$.mergedIntoUid')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.mergedIntoUid')) = '')
        LIMIT 1
      `, [cleanEmail, currentUid || '']);

      if (emailRows && emailRows.length > 0) {
        return NextResponse.json({
          success: false,
          field: 'email',
          error: 'This email address is already linked to another account.'
        }, { status: 409 });
      }
    }

    // 2. Check mobile number uniqueness across active users
    if (mobileNumber) {
      const raw = String(mobileNumber).trim();
      const cleaned = raw.replace(/[\s\-()]/g, '');
      const raw10 = cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
      const fullPhone = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
      const with91 = `+91${raw10}`;

      const [phoneRows]: any = await pool.query(`
        SELECT id, JSON_UNQUOTE(JSON_EXTRACT(data, '$.displayName')) as name
        FROM \`users\`
        WHERE (
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.mobileNumber')) = ? OR
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.mobileNumber')) = ? OR
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.mobileNumber')) = ? OR
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.mobileNumber')) = ? OR
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.phoneNumber')) = ? OR
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.phoneNumber')) = ? OR
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.phoneNumber')) = ? OR
          JSON_UNQUOTE(JSON_EXTRACT(data, '$.phoneNumber')) = ?
        )
        AND id != ?
        AND (JSON_UNQUOTE(JSON_EXTRACT(data, '$.isArchived')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.isArchived')) != 'true')
        AND (JSON_UNQUOTE(JSON_EXTRACT(data, '$.mergedIntoUid')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.mergedIntoUid')) = '')
        LIMIT 1
      `, [cleaned, raw10, fullPhone, with91, cleaned, raw10, fullPhone, with91, currentUid || '']);

      if (phoneRows && phoneRows.length > 0) {
        return NextResponse.json({
          success: false,
          field: 'mobileNumber',
          error: 'This mobile number is already linked to another account.'
        }, { status: 409 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in validate-unique API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
