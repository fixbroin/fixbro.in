import { type NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { adminDb } from '@/lib/firebaseAdmin';
import { getTimestampMillis } from '@/lib/utils';
import { assignNewBookingNumber } from '@/lib/webServerUtils';
import { Timestamp } from '@/lib/mysqlDbAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bookingId, sweepStale } = body;

    let deletedCount = 0;
    let reconciledCount = 0;

    // Helper: Safely inspect Razorpay order before any deletion
    const checkRazorpayPaid = async (orderId: string): Promise<boolean> => {
      try {
        const appConfigSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
        const appConfig = appConfigSnap.exists ? (appConfigSnap.data() as any) : null;
        const razorpayKeyId = appConfig?.razorpayKeyId || process.env.RAZORPAY_KEY_ID;
        const razorpayKeySecret = appConfig?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;
        if (!razorpayKeyId || !razorpayKeySecret) return false;

        const instance = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
        const payments = await instance.orders.fetchPayments(orderId);
        const paymentItems = Array.isArray(payments?.items) ? payments.items : [];
        return paymentItems.some((p: any) => p && (p.status === 'captured' || p.status === 'authorized'));
      } catch (err) {
        console.warn(`Could not check Razorpay status for ${orderId}:`, err);
        return false;
      }
    };

    // 1. Delete a specific pending online booking if requested (e.g., on cart abandonment)
    if (bookingId && typeof bookingId === 'string') {
      const docRef = adminDb.collection('bookings').doc(bookingId);
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data() as any;
        const isOnline = (data?.paymentMethod || '').toLowerCase().trim() === 'online';
        const isPending = data?.status === 'Pending Payment';

        if (isOnline && isPending) {
          // Safeguard 5: If it has a Razorpay Order ID, verify before deleting
          if (data?.razorpayOrderId) {
            const isPaid = await checkRazorpayPaid(data.razorpayOrderId);
            if (isPaid) {
              // Instead of deleting, confirm the booking!
              const nextBookingNumber = await assignNewBookingNumber();
              await docRef.update({
                status: 'Confirmed',
                bookingNumber: nextBookingNumber,
                confirmedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
              });
              reconciledCount++;
              return NextResponse.json({ success: true, reconciled: true });
            }

            // If created within the last 60 minutes, keep it for reconciliation
            const createdMs = getTimestampMillis(data?.createdAt) || 0;
            if (createdMs && Date.now() - createdMs < 60 * 60 * 1000) {
              return NextResponse.json({ success: true, preservedForReconciliation: true });
            }
          }

          const hasNoPaymentIds =
            !data?.razorpayPaymentId &&
            !data?.stripePaymentIntent &&
            !data?.stripeSessionId;

          if (hasNoPaymentIds) {
            await docRef.delete();
            deletedCount++;
          }
        }
      }
    }

    // 2. Sweep abandoned unpaid Online bookings
    if (sweepStale) {
      const pendingSnap = await adminDb
        .collection('bookings')
        .where('status', '==', 'Pending Payment')
        .get();

      const now = Date.now();
      // Keep online bookings for at least 60 minutes for potential UPI / Webhook reconciliation
      const STALE_THRESHOLD_MS = 60 * 60 * 1000;

      for (const docSnap of pendingSnap.docs) {
        const data = docSnap.data() as any;
        const isOnline = (data?.paymentMethod || '').toLowerCase().trim() === 'online';
        const hasNoPaymentId =
          !data?.razorpayPaymentId &&
          !data?.stripePaymentIntent &&
          !data?.stripeSessionId;
        const isUnassigned = !data?.providerId && (!data?.bookingNumber || Number(data?.bookingNumber) === 0);

        if (isOnline && hasNoPaymentId && isUnassigned) {
          const createdMs = getTimestampMillis(data?.createdAt) || 0;
          if (createdMs && now - createdMs > STALE_THRESHOLD_MS) {
            if (data?.razorpayOrderId) {
              const isPaid = await checkRazorpayPaid(data.razorpayOrderId);
              if (isPaid) {
                const nextBookingNumber = await assignNewBookingNumber();
                await adminDb.collection('bookings').doc(docSnap.id).update({
                  status: 'Confirmed',
                  bookingNumber: nextBookingNumber,
                  confirmedAt: Timestamp.now(),
                  updatedAt: Timestamp.now(),
                });
                reconciledCount++;
                continue;
              }
            }
            await adminDb.collection('bookings').doc(docSnap.id).delete();
            deletedCount++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, deletedCount, reconciledCount });
  } catch (error: any) {
    console.error('Error in cancel-pending-payment route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
