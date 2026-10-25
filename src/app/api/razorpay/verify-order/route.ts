import { type NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { adminDb } from '@/lib/firebaseAdmin';
import { assignNewBookingNumber } from '@/lib/webServerUtils';
import { Timestamp } from '@/lib/mysqlDbAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, bookingDocId: incomingBookingDocId } = body;

    if (!orderId || typeof orderId !== 'string' || !orderId.startsWith('order_')) {
      return NextResponse.json(
        { success: false, paid: false, error: 'Valid Razorpay orderId is required.' },
        { status: 400 }
      );
    }

    const appConfigSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
    const appConfig = appConfigSnap.exists ? (appConfigSnap.data() as any) : null;

    const razorpayKeyId = appConfig?.razorpayKeyId || process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = appConfig?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('Razorpay API keys not configured on server.');
      return NextResponse.json(
        { success: false, paid: false, error: 'Payment gateway not configured on server.' },
        { status: 500 }
      );
    }

    const instance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    // 1. Authoritative Razorpay Order Fetch
    let order: any = null;
    try {
      order = await instance.orders.fetch(orderId);
    } catch (orderErr: any) {
      console.error(`Error fetching Razorpay order ${orderId}:`, orderErr);
      return NextResponse.json(
        { success: false, paid: false, error: orderErr?.error?.description || 'Order not found on Razorpay.' },
        { status: 404 }
      );
    }

    // 2. Resolve associated booking document
    let resolvedBookingDocId = incomingBookingDocId || order?.notes?.bookingId;

    if (!resolvedBookingDocId) {
      const snap = await adminDb
        .collection('bookings')
        .where('razorpayOrderId', '==', orderId)
        .limit(1)
        .get();
      if (!snap.empty) {
        resolvedBookingDocId = snap.docs[0].id;
      }
    }

    if (!resolvedBookingDocId) {
      return NextResponse.json(
        { success: false, paid: false, error: 'Booking association not found for this order.' },
        { status: 404 }
      );
    }

    const bookingRef = adminDb.collection('bookings').doc(resolvedBookingDocId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return NextResponse.json(
        { success: false, paid: false, error: 'Booking record not found in database.' },
        { status: 404 }
      );
    }

    const bookingData = bookingSnap.data() as any;

    // 3. Handle Cancellation Fee Payment
    if (order?.notes?.type === 'cancellation_fee') {
      const payments = await instance.orders.fetchPayments(orderId);
      const paymentItems = Array.isArray(payments?.items) ? payments.items : [];
      const successfulPayment = paymentItems.find(
        (p: any) => p && (p.status === 'captured' || p.status === 'authorized')
      );

      if (successfulPayment) {
        const feeAmount = Number(order.notes?.amount) || bookingData.cancellationFeePaid || 0;
        await bookingRef.update({
          status: 'Cancelled',
          cancellationFeePaid: feeAmount,
          cancellationPaymentId: successfulPayment.id,
          updatedAt: Timestamp.now(),
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        fetch(`${appUrl}/api/bookings/post-process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingDocId: resolvedBookingDocId, cancelledBy: 'user' }),
        }).catch((err) => console.error('Error triggering post-process after cancellation fee:', err));

        return NextResponse.json({
          success: true,
          paid: true,
          isCancellation: true,
          bookingId: bookingData.bookingId,
          bookingDocId: resolvedBookingDocId,
        });
      }

      return NextResponse.json({
        success: true,
        paid: false,
        isCancellation: true,
        status: order.status,
        message: 'Cancellation payment is not yet captured.',
      });
    }

    // 4. Idempotency Check: if already Confirmed or Completed, return existing booking without duplicates
    if (bookingData.status === 'Confirmed' || bookingData.status === 'Completed') {
      return NextResponse.json({
        success: true,
        paid: true,
        alreadyConfirmed: true,
        bookingId: bookingData.bookingId,
        bookingDocId: resolvedBookingDocId,
        booking: { ...bookingData, id: resolvedBookingDocId },
      });
    }

    // 5. Authoritative Currency Verification
    const configuredCurrency = (appConfig?.currencyCode || 'INR').toUpperCase();
    if (order.currency && order.currency.toUpperCase() !== configuredCurrency) {
      return NextResponse.json(
        { success: false, paid: false, error: `Currency mismatch. Expected ${configuredCurrency}, got ${order.currency}.` },
        { status: 400 }
      );
    }

    // 6. Authoritative Amount Verification (allow max 1 INR / 100 paise margin for roundings)
    const expectedPaise = Math.round(Number(bookingData.totalAmount) * 100);
    const actualOrderPaise = Number(order.amount || 0);
    const actualPaidPaise = Number(order.amount_paid || 0);

    // 7. Authoritative Payment Status Check from Razorpay
    const payments = await instance.orders.fetchPayments(orderId);
    const paymentItems = Array.isArray(payments?.items) ? payments.items : [];
    const successfulPayment = paymentItems.find(
      (p: any) => p && (p.status === 'captured' || p.status === 'authorized')
    );

    if (!successfulPayment) {
      return NextResponse.json({
        success: true,
        paid: false,
        status: order.status || 'created',
        attempts: paymentItems.length,
        message: 'Payment has not been completed or captured yet.',
      });
    }

    if (actualPaidPaise > 0 && actualPaidPaise < expectedPaise - 100) {
      return NextResponse.json(
        { success: false, paid: false, error: 'Paid amount is less than authoritative booking total.' },
        { status: 400 }
      );
    }

    // 8. Atomic Confirmation Update
    // Guard again right before update
    const freshBookingSnap = await bookingRef.get();
    const freshData = freshBookingSnap.data() as any;
    if (freshData?.status === 'Confirmed' || freshData?.status === 'Completed') {
      return NextResponse.json({
        success: true,
        paid: true,
        alreadyConfirmed: true,
        bookingId: freshData.bookingId,
        bookingDocId: resolvedBookingDocId,
        booking: { ...freshData, id: resolvedBookingDocId },
      });
    }

    const nextBookingNumber = await assignNewBookingNumber();

    await bookingRef.update({
      status: 'Confirmed',
      bookingNumber: nextBookingNumber,
      paymentMethod: 'Online',
      razorpayPaymentId: successfulPayment.id,
      razorpayOrderId: orderId,
      paymentDetails: {
        method: successfulPayment.method || 'upi',
        bank: successfulPayment.bank || null,
        wallet: successfulPayment.wallet || null,
        vpa: successfulPayment.vpa || null,
        capturedAt: successfulPayment.created_at || null,
      },
      confirmedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // 9. Independent Asynchronous Notification & Auto-Dispatch Trigger (Safeguard 6)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    fetch(`${appUrl}/api/bookings/post-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingDocId: resolvedBookingDocId, triggerSource: 'verify_order' }),
    }).catch((err) => console.error('Error triggering post-process from verify-order:', err));

    return NextResponse.json({
      success: true,
      paid: true,
      bookingId: bookingData.bookingId,
      bookingDocId: resolvedBookingDocId,
      bookingNumber: nextBookingNumber,
    });
  } catch (error: any) {
    console.error('Unhandled error in verify-order route:', error);
    return NextResponse.json(
      { success: false, paid: false, error: error?.message || 'Internal server error verifying order.' },
      { status: 500 }
    );
  }
}
