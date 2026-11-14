import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { depositProviderWalletAction } from '@/app/actions/providerWalletActions';
import { unlockProviderIdCardAction } from '@/app/actions/providerIdCardActions';
import { db } from '@/lib/mysqlDb';
import { doc, getDoc, updateDoc, Timestamp, addDoc, collection, query, where, getDocs, limit, deleteDoc } from '@/lib/mysqlDb';
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
    // so they don't spam PM2 logs or trigger unnecessary database reads every few seconds
    if (event.startsWith('payment.downtime.')) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const appConfigSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
    const appConfig = appConfigSnap.exists ? appConfigSnap.data() as any : null;

    const razorpayWebhookSecret = appConfig?.razorpayWebhookSecret;

    if (!razorpayWebhookSecret) {
      console.error("Razorpay Webhook Secret is not configured in database config.");
      return NextResponse.json({ success: false, error: 'Razorpay webhook secret missing.' }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error("Razorpay webhook signature verification failed.");
      return NextResponse.json({ success: false, error: 'Invalid webhook signature.' }, { status: 400 });
    }

    console.log(`Received Razorpay Webhook Event: ${event}`);

    if (event === 'order.paid' || event === 'payment.captured') {
      const paymentEntity = payload.payload.payment?.entity;
      const orderEntity = payload.payload.order?.entity;
      const order = paymentEntity || orderEntity;

      if (!paymentEntity && !orderEntity) {
        return NextResponse.json({ success: true, message: 'No order or payment entity found.' });
      }

      // Merge notes from order and payment entity
      const notes = {
        ...(orderEntity?.notes || {}),
        ...(paymentEntity?.notes || {})
      };
      const { type, providerId, amount: amountStr } = notes;
      let bookingId = notes.bookingId;

      const orderId = paymentEntity?.order_id || orderEntity?.id || '';
      const paymentId = paymentEntity?.id || (orderEntity?.id ? `order_paid_${orderEntity.id}` : '');

      // Secondary lookup by razorpayOrderId if bookingId is not in notes
      if (!bookingId && orderId) {
        try {
          const qSnap = await adminDb.collection('bookings').where('razorpayOrderId', '==', orderId).limit(1).get();
          if (!qSnap.empty) {
            bookingId = qSnap.docs[0].id;
          }
        } catch (lookupErr) {
          console.warn("Could not lookup booking by razorpayOrderId in webhook:", lookupErr);
        }
      }

      if ((type === 'booking' || (!type && bookingId)) && bookingId) {
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (bookingSnap.exists()) {
          const bookingData = bookingSnap.data() as any;
          if (bookingData.status === 'Pending Payment') {
            const nextBookingNumber = await assignNewBookingNumber();

            await updateDoc(bookingRef, {
              status: 'Confirmed',
              bookingNumber: nextBookingNumber,
              paymentMethod: 'Online',
              razorpayPaymentId: paymentId || bookingData.razorpayPaymentId || null,
              razorpayOrderId: orderId || bookingData.razorpayOrderId || null,
              updatedAt: Timestamp.now(),
            });

            // Trigger post-processing (emails, stats, auto-dispatch, WhatsApp)
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? 'https://fixbro.in' : 'http://localhost:3001');
            fetch(`${appUrl}/api/bookings/post-process`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingDocId: bookingId, triggerSource: 'razorpay_webhook' })
            }).catch(err => console.error("Error triggering post-process from Razorpay webhook:", err));

            // Clean up server-side cart for user if userId is present
            if (bookingData.userId) {
              try {
                const userCartRef = doc(db, 'userCarts', bookingData.userId);
                await deleteDoc(userCartRef);
              } catch (cartErr) {
                console.warn("Could not delete user cart in webhook:", cartErr);
              }
            }

            // Create and send notification to customer
            if (bookingData.userId) {
              const userNotificationData: Omit<FirestoreNotification, 'id'> = {
                userId: bookingData.userId,
                title: "Booking Confirmed!",
                message: `Your booking ${bookingData.bookingId} has been successfully placed. We'll assign a provider shortly.`,
                type: 'success',
                href: '/my-bookings',
                read: false,
                createdAt: Timestamp.now(),
              };
              await addDoc(collection(db, "userNotifications"), userNotificationData);
              triggerPushNotification({
                userId: bookingData.userId,
                title: userNotificationData.title,
                body: userNotificationData.message,
                href: userNotificationData.href
              });
            }

            // Create and send alert to Admin
            try {
              const usersRef = collection(db, "users");
              const adminQuery = query(usersRef, where("email", "==", ADMIN_EMAIL), limit(1));
              const adminSnapshot = await getDocs(adminQuery);
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
                await addDoc(collection(db, "userNotifications"), adminNotificationData);
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
        const orderId = order.order_id || order.id;
        const paymentId = order.id;

        // Perform deposit using our depositProviderWalletAction server action
        await depositProviderWalletAction(providerId, parsedAmount, {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          payment_method: 'Razorpay'
        });
      } else if (type === 'provider_id_card_unlock' && providerId) {
        const parsedAmount = amountStr ? parseFloat(amountStr) : 0;
        const orderId = order.order_id || order.id;
        const paymentId = order.id;

        // Unlock ID card using our unlockProviderIdCardAction server action
        await unlockProviderIdCardAction(providerId, {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          amount: parsedAmount
        });
      } else if (type === 'cancellation_fee' && bookingId && amountStr) {
        const parsedAmount = parseFloat(amountStr);
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (bookingSnap.exists()) {
          const bookingData = bookingSnap.data();
          if (bookingData.status !== 'Cancelled') {
            const orderId = order.order_id || order.id;
            const paymentId = order.id;

            await updateDoc(bookingRef, {
              status: 'Cancelled',
              cancellationPaymentId: paymentId || orderId,
              cancellationPaymentMethod: 'Razorpay',
              updatedAt: Timestamp.now(),
              cancellationFeePaid: parsedAmount
            });
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
