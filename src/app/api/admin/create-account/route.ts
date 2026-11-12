import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest, isUserAdmin } from '@/lib/dbSecurity';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from '@/lib/mysqlDbAdmin';

function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  const cleaned = rawPhone.trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  // Default to +91 if 10 digits
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  return `+${cleaned}`;
}

export async function POST(request: NextRequest) {
  try {
    const requestUser = await verifyRequest(request);
    if (!requestUser || !isUserAdmin(requestUser)) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      accountType, // 'customer' | 'provider'
      name, 
      email, 
      mobileNumber, 
      password, 
      address, 
      initialStatus 
    } = body;

    // 1. Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Full name is required.' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
    }

    if (!mobileNumber || typeof mobileNumber !== 'string') {
      return NextResponse.json({ success: false, error: 'Mobile number is required.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const formattedPhone = normalizePhoneNumber(mobileNumber);
    const rawTenDigit = formattedPhone.startsWith('+91') ? formattedPhone.slice(3) : formattedPhone.replace('+', '');
    const cleanName = name.trim();
    const cleanType = accountType === 'provider' ? 'provider' : 'customer';

    // 2. Check if Email already exists in Firebase Auth
    try {
      const existingUser = await adminAuth.getUserByEmail(cleanEmail);
      if (existingUser) {
        return NextResponse.json({ 
          success: false, 
          error: `An account with email "${cleanEmail}" already exists in the system.` 
        }, { status: 409 });
      }
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') {
        console.error('Error checking user by email:', e);
      }
    }

    // 3. Check if Mobile already exists in Firestore users
    const usersCol = adminDb.collection('users');
    const existingByPhone = await usersCol.where('mobileNumber', '==', formattedPhone).get();
    if (!existingByPhone.empty) {
      return NextResponse.json({ 
        success: false, 
        error: `An account with mobile number "${formattedPhone}" already exists.` 
      }, { status: 409 });
    }

    // Also check raw 10-digit variant
    if (rawTenDigit !== formattedPhone) {
      const existingByRaw = await usersCol.where('mobileNumber', '==', rawTenDigit).get();
      if (!existingByRaw.empty) {
        return NextResponse.json({ 
          success: false, 
          error: `An account with mobile number "${rawTenDigit}" already exists.` 
        }, { status: 409 });
      }
    }

    // 4. Create in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: cleanEmail,
        password: password,
        displayName: cleanName,
        phoneNumber: formattedPhone,
      });
    } catch (authError: any) {
      // If phone number collision occurred in auth records, fallback to creating with email & password
      if (authError.code === 'auth/phone-number-already-exists' || authError.code === 'auth/invalid-phone-number') {
        userRecord = await adminAuth.createUser({
          email: cleanEmail,
          password: password,
          displayName: cleanName,
        });
      } else {
        console.error('Firebase Auth user creation error:', authError);
        return NextResponse.json({ 
          success: false, 
          error: authError.message || 'Failed to create user in authentication system.' 
        }, { status: 400 });
      }
    }

    const uid = userRecord.uid;

    // 5. Generate sequential userNumber
    const statsRef = adminDb.collection('appConfiguration').doc('stats');
    const statsDoc = await statsRef.get();
    let nextUserNumber = 1000;
    if (statsDoc.exists) {
      nextUserNumber = (statsDoc.data()?.totalUsers || 0) + 1001;
    }

    // 6. Create record in 'users' collection
    const userDocRef = usersCol.doc(uid);
    const userPayload: any = {
      uid,
      displayName: cleanName,
      email: cleanEmail,
      mobileNumber: formattedPhone,
      role: cleanType,
      userNumber: nextUserNumber,
      isActive: true,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      walletBalance: 0,
      createdByAdmin: true,
      createdByUserEmail: requestUser.email || 'admin',
    };

    if (address && (address.street || address.city)) {
      userPayload.addresses = [{
        id: `addr_${Date.now()}`,
        name: cleanName,
        mobileNumber: formattedPhone,
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        pincode: address.pincode || '',
        isDefault: true,
      }];
    }

    await userDocRef.set(userPayload, { merge: true });
    await statsRef.set({ totalUsers: FieldValue.increment(1) }, { merge: true });

    // 7. If Provider: Initialize 'providerApplications' document
    if (cleanType === 'provider') {
      const providerDocRef = adminDb.collection('providerApplications').doc(uid);
      const appStatus = initialStatus || 'approved';
      const providerPayload: any = {
        id: uid,
        userId: uid,
        fullName: cleanName,
        email: cleanEmail,
        mobileNumber: formattedPhone,
        status: appStatus,
        isOnline: true,
        applicationDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        approvedAt: appStatus === 'approved' ? Timestamp.now() : null,
        createdByAdmin: true,
      };

      await providerDocRef.set(providerPayload, { merge: true });
    }

    return NextResponse.json({
      success: true,
      message: `${cleanType === 'provider' ? 'Provider' : 'Customer'} account created successfully.`,
      user: {
        uid,
        name: cleanName,
        email: cleanEmail,
        mobileNumber: formattedPhone,
        password: password,
        accountType: cleanType,
        userNumber: nextUserNumber,
        status: cleanType === 'provider' ? (initialStatus || 'approved') : 'active'
      }
    });

  } catch (error: any) {
    console.error('Error in /api/admin/create-account:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred while creating the account.' 
    }, { status: 500 });
  }
}
