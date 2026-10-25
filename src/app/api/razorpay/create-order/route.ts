import { type NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { nanoid } from 'nanoid';

import { adminDb } from '@/lib/firebaseAdmin';
import { calculateServerBookingTotal } from '@/lib/bookingPricingServer';
import { generateBookingId } from '@/lib/bookingUtils';
import { Timestamp } from '@/lib/mysqlDbAdmin';
import { verifyRequest } from '@/lib/dbSecurity';
import { getPool, getDocsInternal } from '@/lib/mysql';

function calculateServerCancellationFee(bookingData: any, appConfig: any) {
  if (!appConfig?.enableCancellationPolicy) {
    return 0;
  }

  // 1. Calculate time difference
  if (!bookingData.scheduledDate || !bookingData.scheduledTimeSlot) {
    const feeValue = appConfig?.cancellationFeeValue || 0;
    const feeType = appConfig?.cancellationFeeType || 'fixed';
    return feeType === 'percentage' ? (feeValue / 100) * (bookingData.totalAmount || 0) : feeValue;
  }

  const [year, month, day] = bookingData.scheduledDate.split('-').map(Number);
  const serviceDate = new Date(year, month - 1, day);

  const slotTime = bookingData.scheduledTimeSlot;
  const timeMatch = slotTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) {
    const feeValue = appConfig?.cancellationFeeValue || 0;
    const feeType = appConfig?.cancellationFeeType || 'fixed';
    return feeType === 'percentage' ? (feeValue / 100) * (bookingData.totalAmount || 0) : feeValue;
  }

  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const period = timeMatch[3].toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  const serviceStartTime = new Date(serviceDate);
  serviceStartTime.setHours(hours, minutes, 0, 0);

  const now = new Date();
  const diffMs = serviceStartTime.getTime() - now.getTime();

  // 2. Check final restricted window (e.g., 3 hours)
  const finalHours = appConfig?.finalCancellationHours || 0;
  const finalMinutes = appConfig?.finalCancellationMinutes || 0;
  const totalFinalWindowMs = ((finalHours * 60) + finalMinutes) * 60 * 1000;

  if (appConfig?.enableFinalCancellationWindow && diffMs < totalFinalWindowMs) {
    // Within final window -> 100% cancellation charge
    return bookingData.totalAmount || 0;
  }

  // 3. Check free cancellation window
  const freeWindowDays = appConfig?.freeCancellationDays || 0;
  const freeWindowHours = appConfig?.freeCancellationHours || 0;
  const freeWindowMinutes = appConfig?.freeCancellationMinutes || 0;
  const totalFreeWindowMs = ((freeWindowDays * 24 * 60) + (freeWindowHours * 60) + freeWindowMinutes) * 60 * 1000;

  if (diffMs >= totalFreeWindowMs) {
    return 0; // Free cancellation
  }

  // 4. Standard fee
  const feeValue = appConfig?.cancellationFeeValue || 0;
  const feeType = appConfig?.cancellationFeeType || 'fixed';
  return feeType === 'percentage' ? (feeValue / 100) * (bookingData.totalAmount || 0) : feeValue;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      amount,
      currency = 'INR',
      notes,
      cartEntries: bodyCartEntries,
      promoCode: bodyPromoCode,
      categoryId: bodyCategoryId,
      customerInfo,
      schedule,
      userId,
    } = body;

    if (!amount || typeof amount !== 'number' || amount < 100) { // Razorpay minimum is 1 INR (100 paise)
      return NextResponse.json({ success: false, error: 'Invalid amount provided.' }, { status: 400 });
    }

    const appConfigSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
    const appConfig = appConfigSnap.exists ? appConfigSnap.data() as any : null;

    const type = notes?.type || 'booking';
    const existingBookingId = notes?.bookingId;
    const providerId = notes?.providerId;
    const rawCartEntries = bodyCartEntries || notes?.cartEntries;
    const rawPromoCode = bodyPromoCode ?? notes?.promoCode;
    const rawCategoryId = bodyCategoryId ?? notes?.categoryId;

    let reconciledBaseAmount = amount / 100;
    let resolvedBookingDocId: string | null = existingBookingId || null;
    let createdBookingHumanId: string | null = null;

    // 1. Existing Booking / Cancellation Fee Handling
    if (existingBookingId && (type === 'booking' || type === 'cancellation_fee')) {
      const bookingDoc = await adminDb.collection('bookings').doc(existingBookingId).get();
      if (!bookingDoc.exists) {
        return NextResponse.json({ success: false, error: 'Booking not found.' }, { status: 404 });
      }
      const bookingData = bookingDoc.data() as any;
      createdBookingHumanId = bookingData.bookingId || null;

      if (type === 'booking') {
        const cartEntries = (bookingData.services || []).map((s: any) => ({
          serviceId: s.serviceId || s.id,
          quantity: s.quantity || 1,
        }));

        if (cartEntries.length > 0) {
          const calculation = await calculateServerBookingTotal({
            cartEntries,
            promoCode: bookingData.discountCode,
            categoryId: bookingData.workCategoryId,
          });
          reconciledBaseAmount = calculation.totalAmount;

          // Sync pending booking document with authoritative calculated figures
          await adminDb.collection('bookings').doc(existingBookingId).update({
            subTotal: calculation.subTotal,
            visitingCharge: calculation.visitingCharge,
            taxAmount: calculation.taxAmount,
            totalAmount: calculation.totalAmount,
            platformFeeTotal: calculation.platformFeeTotal,
            appliedPlatformFees: calculation.appliedPlatformFees,
            discountAmount: calculation.discountAmount,
            services: calculation.services,
            updatedAt: Timestamp.now(),
          });
        } else {
          reconciledBaseAmount = bookingData.totalAmount;
        }
      } else if (type === 'cancellation_fee') {
        reconciledBaseAmount = calculateServerCancellationFee(bookingData, appConfig);
      }
    }
    // 2. Safeguard 1: Pre-create Pending Booking on Server before Razorpay Order Initiation
    else if (type === 'booking' && rawCartEntries) {
      try {
        const parsedCart = typeof rawCartEntries === 'string' ? JSON.parse(rawCartEntries) : rawCartEntries;
        if (Array.isArray(parsedCart) && parsedCart.length > 0) {
          const calculation = await calculateServerBookingTotal({
            cartEntries: parsedCart,
            promoCode: rawPromoCode,
            categoryId: rawCategoryId,
          });
          reconciledBaseAmount = calculation.totalAmount;

          // User Resolution:
          let resolvedUserId: string | undefined = typeof userId === 'string' && userId.trim() ? userId.trim() : undefined;
          if (!resolvedUserId) {
            try {
              const caller = await verifyRequest(req);
              if (caller && caller.uid && caller.uid !== 'guest' && caller.uid !== 'server') {
                resolvedUserId = caller.uid;
              }
            } catch (authErr) {
              // ignore guest tokens
            }
          }

          const emailToMatch = (customerInfo?.email || '').toLowerCase().trim();
          if (!resolvedUserId && emailToMatch) {
            try {
              const pool = await getPool();
              const matchingUsers = await getDocsInternal(pool, 'users', [
                { type: 'where', field: 'email', op: '==', value: emailToMatch },
                { type: 'limit', value: 1 }
              ]);
              if (matchingUsers && matchingUsers.length > 0) {
                resolvedUserId = matchingUsers[0].id;
              }
            } catch (dbErr) {
              console.warn("Could not match user by email in create-order:", dbErr);
            }
          }

          const newBookingId = generateBookingId();
          createdBookingHumanId = newBookingId;

          const newBookingData = {
            bookingId: newBookingId,
            bookingNumber: 0,
            ...(resolvedUserId && { userId: resolvedUserId }),
            customerName: customerInfo?.fullName || customerInfo?.name || 'Guest User',
            customerEmail: customerInfo?.email || '',
            customerPhone: customerInfo?.phone || 'N/A',
            addressLine1: customerInfo?.addressLine1 || 'N/A',
            ...(customerInfo?.addressLine2 && { addressLine2: customerInfo?.addressLine2 }),
            city: customerInfo?.city || 'N/A',
            state: customerInfo?.state || 'N/A',
            pincode: customerInfo?.pincode || 'N/A',
            ...(customerInfo?.latitude !== undefined && customerInfo?.latitude !== null && { latitude: customerInfo.latitude }),
            ...(customerInfo?.longitude !== undefined && customerInfo?.longitude !== null && { longitude: customerInfo.longitude }),
            scheduledDate: schedule?.scheduledDate || new Date().toISOString().split('T')[0],
            scheduledTimeSlot: schedule?.scheduledTimeSlot || '10:00 AM',
            ...(schedule?.estimatedEndTime && { estimatedEndTime: schedule.estimatedEndTime }),
            interveningBreaks: schedule?.interveningBreaks || [],
            dailyTimeline: schedule?.dailyTimeline || [],
            services: calculation.services,
            subTotal: calculation.subTotal,
            ...(calculation.visitingCharge > 0 && { visitingCharge: calculation.visitingCharge }),
            taxAmount: calculation.taxAmount,
            totalAmount: calculation.totalAmount,
            platformFeeTotal: calculation.platformFeeTotal,
            ...(calculation.appliedPlatformFees?.length > 0 && { appliedPlatformFees: calculation.appliedPlatformFees }),
            ...(calculation.discountCode && { discountCode: calculation.discountCode }),
            ...(calculation.discountAmount > 0 && { discountAmount: calculation.discountAmount }),
            paymentMethod: 'Online',
            status: 'Pending Payment',
            createdAt: Timestamp.now(),
            isReviewedByCustomer: false,
            ...(rawCategoryId && { workCategoryId: rawCategoryId }),
          };

          const docRef = await adminDb.collection('bookings').add(newBookingData);
          resolvedBookingDocId = docRef.id;
        }
      } catch (err) {
        console.error('Error pre-creating pending booking in Razorpay order creation:', err);
      }
    } else if (type === 'wallet_topup' && providerId) {
      const minDeposit = appConfig?.minDepositAmount || 500;
      const maxDeposit = appConfig?.maxDepositAmount || 10000;
      if ((amount / 100) < minDeposit || (amount / 100) > maxDeposit) {
        return NextResponse.json({ success: false, error: `Deposit must be between ${minDeposit} and ${maxDeposit}.` }, { status: 400 });
      }
    }

    const reconciledAmountPaise = Math.round(reconciledBaseAmount * 100);

    const razorpayKeyId = appConfig?.razorpayKeyId || process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = appConfig?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("Razorpay API keys are not set in database settings or environment variables.");
      return NextResponse.json({ success: false, error: 'Payment gateway not configured on server.' }, { status: 500 });
    }

    const instance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const sanitizedNotes: Record<string, string> = {};
    if (notes && typeof notes === 'object') {
      for (const [k, v] of Object.entries(notes)) {
        if (k === 'cartEntries' || v === undefined || v === null) continue;
        sanitizedNotes[k] = String(v).slice(0, 250);
      }
    }
    sanitizedNotes.type = type;
    sanitizedNotes.amount = reconciledBaseAmount.toString();
    if (resolvedBookingDocId) {
      sanitizedNotes.bookingId = resolvedBookingDocId;
    }
    if (createdBookingHumanId) {
      sanitizedNotes.humanReadableBookingId = createdBookingHumanId;
    }

    const options = {
      amount: reconciledAmountPaise, // amount in the smallest currency unit (paise)
      currency: currency,
      receipt: `receipt_${nanoid()}`,
      notes: sanitizedNotes,
    };

    const order = await instance.orders.create(options);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Failed to create order with Razorpay.' }, { status: 500 });
    }

    // Attach order ID to the pending booking document so it is bound both ways
    if (resolvedBookingDocId) {
      await adminDb.collection('bookings').doc(resolvedBookingDocId).update({
        razorpayOrderId: order.id,
        updatedAt: Timestamp.now(),
      }).catch((updateErr) => console.error("Error attaching razorpayOrderId to pending booking:", updateErr));
    }
    
    return NextResponse.json({
      success: true,
      ...order,
      ...(resolvedBookingDocId && { bookingDocId: resolvedBookingDocId }),
      ...(createdBookingHumanId && { bookingId: createdBookingHumanId }),
    });

  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
}
