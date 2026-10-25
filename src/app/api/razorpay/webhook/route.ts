import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { depositProviderWalletAction } from '@/app/actions/providerWalletActions';
import { Timestamp } from '@/lib/mysqlDbAdmin';
import { assignNewBookingNumber } from '@/lib/webServerUtils';
import { triggerPushNotification } from '@/lib/fcmUtils';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import type { FirestoreNotification } from '@/types/firestore';

export async function POST(req: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    const payload = JSON.parse(rawBody);
    const event: string = payload?.event || '';

    // Silently acknowledge global Razorpay bank/UPI downtime status broadcasts
    if (event.startsWith('payment.downtime.')) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const appConfigSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
    const appConfig = appConfigSnap.exists ? appConfigSnap.data() as any : null;

    const razorpayWebhookSecret = appConfig?.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!razorpayWebhookSecret) {
      console.error("Razorpay Webhook Secret is not configured in database config or env.");
      return NextResponse.json({ success: false, error: 'Razorpay webhook secret missing.' }, { status: 500 });
    }

    // Safeguard 4: Authoritative signature verification with raw request body
    const expectedSignature = crypto
      .createHmac('sha256', razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error("Razorpay webhook signature verification failed.");
      return NextResponse.json({ success: false, error: 'Invalid webhook signature.' }, { status: 400 });
    }

    console.log(`[Razorpay Webhook] Verified event: ${event}`);

    // Safeguard 5: For payment.failed, preserve pending booking for possible retry or reconciliation
    if (event === 'payment.failed') {
      const failedPayment = payload.payload?.payment?.entity;
      console.warn(`[Razorpay Webhook] Payment failed for order: ${failedPayment?.order_id || 'unknown'}. Preserving booking.`);
      return NextResponse.json({ success: true, preserved: true });
    }

    if (event === 'order.paid' || event === 'payment.captured') {
      const order = payload.payload.payment?.entity?.order_id 
        ? payload.payload.payment.entity 
        : payload.payload.order?.entity;

      if (!order) {
        return NextResponse.json({ success: true, message: 'No order or payment entity found.' });
      }

      const notes = order.notes || {};
      let { type, bookingId, providerId, amount: amountStr } = notes;
      const orderId = order.order_id || order.id;
      const paymentId = (order.id && order.id.startsWith('pay_')) ? order.id : (payload.payload.payment?.entity?.id || null);

      // Fallback: If bookingId is missing from notes, query booking by razorpayOrderId
      if (!bookingId && orderId) {
        const snap = await adminDb
          .collection('bookings')
          .where('razorpayOrderId', '==', orderId)
          .limit(1)
          .get();
        if (!snap.empty) {
          bookingId = snap.docs[0].id;
          type = type || 'booking';
        }
      }

      if ((type === 'booking' || !type) && bookingId) {
        const bookingRef = adminDb.collection('bookings').doc(bookingId);
        const bookingSnap = await bookingRef.get();

        if (bookingSnap.exists) {
          const bookingData = bookingSnap.data() as any;

          // Safeguard 3: Idempotency Check - prevent duplicate confirmations & duplicate booking numbers
          if (bookingData.status === 'Confirmed' || bookingData.status === 'Completed') {
            console.log(`[Razorpay Webhook] Booking ${bookingId} already confirmed/completed. Idempotent return.`);
            return NextResponse.json({ success: true, alreadyHandled: true });
          }

          if (bookingData.status === 'Pending Payment') {
            const nextBookingNumber = await assignNewBookingNumber();

            await bookingRef.update({
              status: 'Confirmed',
              bookingNumber: nextBookingNumber,
              paymentMethod: 'Online',
              razorpayPaymentId: paymentId || orderId,
              razorpayOrderId: orderId,
              paymentDetails: {
                method: order.method || 'webhook',
                bank: order.bank || null,
                wallet: order.wallet || null,
                vpa: order.vpa || null,
                capturedAt: order.created_at || null,
              },
              confirmedAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });

            // Safeguard 6: Trigger post-processing independently
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixbro.in';
            fetch(`${appUrl}/api/bookings/post-process`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingDocId: bookingId, triggerSource: 'razorpay_webhook' })
            }).catch(err => console.error("Error triggering post-process from Razorpay webhook:", err));

            // Customer in-app notification
            if (bookingData.userId) {
              try {
                const userNotificationData: Omit<FirestoreNotification, 'id'> = {
                  userId: bookingData.userId,
                  title: "Booking Confirmed!",
                  message: `Your booking ${bookingData.bookingId} has been successfully placed. We'll assign a provider shortly.`,
                  type: 'success',
                  href: '/my-bookings',
                  read: false,
                  createdAt: Timestamp.now(),
                };
                await adminDb.collection("userNotifications").add(userNotificationData);
                triggerPushNotification({
                  userId: bookingData.userId,
                  title: userNotificationData.title,
                  body: userNotificationData.message,
                  href: userNotificationData.href
                });
              } catch (notifyErr) {
                console.error("Error sending user push notification in webhook:", notifyErr);
              }
            }

            // Admin in-app notification
            try {
              const usersRef = adminDb.collection("users");
              const adminSnapshot = await usersRef.where("email", "==", ADMIN_EMAIL).limit(1).get();
              if (!adminSnapshot.empty) {
                const adminUid = adminSnapshot.docs[0].id;
                const adminNotificationData: Omit<FirestoreNotification, 'id'> = {
                  userId: adminUid,
                  title: "New Booking Placed (Online)",
                  message: `Booking ${bookingData.bookingId} for ₹${bookingData.totalAmount} has been confirmed via Razorpay.`,
                  type: 'admin_alert',
                  href: `/admin/bookings`,
                  read: false,
                  createdAt: Timestamp.now(),
                };
                await adminDb.collection("userNotifications").add(adminNotificationData);
                triggerPushNotification({
                  userId: adminUid,
                  title: adminNotificationData.title,
                  body: adminNotificationData.message,
                  href: adminNotificationData.href
                });
              }
            } catch (err) {
              console.error("Error notifying admin from Razorpay webhook:", err);
            }
          }
        }
      } else if (type === 'wallet_topup' && providerId && amountStr) {
        const parsedAmount = parseFloat(amountStr);
        await depositProviderWalletAction(providerId, parsedAmount, {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId || orderId,
          payment_method: 'Razorpay'
        });
      } else if (type === 'cancellation_fee' && bookingId && amountStr) {
        const parsedAmount = parseFloat(amountStr);
        const bookingRef = adminDb.collection('bookings').doc(bookingId);
        const bookingSnap = await bookingRef.get();

        if (bookingSnap.exists) {
          const bookingData = bookingSnap.data() as any;
          if (bookingData.status !== 'Cancelled') {
            await bookingRef.update({
              status: 'Cancelled',
              cancellationPaymentId: paymentId || orderId,
              cancellationPaymentMethod: 'Razorpay',
              updatedAt: Timestamp.now(),
              cancellationFeePaid: parsedAmount
            });

            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fixbro.in';
            fetch(`${appUrl}/api/bookings/post-process`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingDocId: bookingId, cancelledBy: 'user' }),
            }).catch(err => console.error("Error triggering post-process for cancellation in webhook:", err));
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error handling Razorpay webhook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
