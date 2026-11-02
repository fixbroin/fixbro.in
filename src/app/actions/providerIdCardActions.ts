'use server';

import { adminDb } from '@/lib/firebaseAdmin';
import { db } from '@/lib/mysqlDb';
import { doc, getDoc, setDoc, Timestamp } from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import { triggerRefresh } from '@/lib/revalidateUtils';

export interface ProviderIdCardSettings {
  isIdCardEnabled: boolean;
  downloadFee: number;
  validityYears: number;
  signatoryName: string;
  helplineNumber: string;
}

export const DEFAULT_ID_CARD_SETTINGS: ProviderIdCardSettings = {
  isIdCardEnabled: true,
  downloadFee: 0,
  validityYears: 2,
  signatoryName: "Authorized Signatory - FixBro",
  helplineNumber: "+91 8000 123 456",
};

/**
 * Fetch provider ID card settings from database.
 */
export async function getProviderIdCardSettingsAction(): Promise<ProviderIdCardSettings> {
  try {
    const adminSnap = await adminDb.collection('appConfiguration').doc('provider_id_card').get();
    if (adminSnap.exists) {
      const data = adminSnap.data() as any;
      return {
        isIdCardEnabled: data.isIdCardEnabled !== false,
        downloadFee: Number(data.downloadFee ?? DEFAULT_ID_CARD_SETTINGS.downloadFee),
        validityYears: Number(data.validityYears ?? DEFAULT_ID_CARD_SETTINGS.validityYears),
        signatoryName: String(data.signatoryName || DEFAULT_ID_CARD_SETTINGS.signatoryName),
        helplineNumber: String(data.helplineNumber || DEFAULT_ID_CARD_SETTINGS.helplineNumber),
      };
    }

    const docSnap = await getDoc(doc(db, 'appConfiguration', 'provider_id_card'));
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      return {
        isIdCardEnabled: data.isIdCardEnabled !== false,
        downloadFee: Number(data.downloadFee ?? DEFAULT_ID_CARD_SETTINGS.downloadFee),
        validityYears: Number(data.validityYears ?? DEFAULT_ID_CARD_SETTINGS.validityYears),
        signatoryName: String(data.signatoryName || DEFAULT_ID_CARD_SETTINGS.signatoryName),
        helplineNumber: String(data.helplineNumber || DEFAULT_ID_CARD_SETTINGS.helplineNumber),
      };
    }

    return DEFAULT_ID_CARD_SETTINGS;
  } catch (error) {
    console.error("Error fetching provider ID card settings:", error);
    return DEFAULT_ID_CARD_SETTINGS;
  }
}

/**
 * Save provider ID card settings.
 */
export async function saveProviderIdCardSettingsAction(
  settings: ProviderIdCardSettings
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanData = {
      isIdCardEnabled: Boolean(settings.isIdCardEnabled),
      downloadFee: Math.max(0, Number(settings.downloadFee || 0)),
      validityYears: Math.max(1, Number(settings.validityYears || 2)),
      signatoryName: String(settings.signatoryName || DEFAULT_ID_CARD_SETTINGS.signatoryName).trim(),
      helplineNumber: String(settings.helplineNumber || DEFAULT_ID_CARD_SETTINGS.helplineNumber).trim(),
      updatedAt: Timestamp.now(),
    };

    // Save directly via adminDb into MySQL
    await adminDb.collection('appConfiguration').doc('provider_id_card').set(cleanData, { merge: true });

    // Also persist via client SDK reference
    try {
      const docRef = doc(db, 'appConfiguration', 'provider_id_card');
      await setDoc(docRef, cleanData, { merge: true });
    } catch (e) {
      // adminDb write already committed directly
    }

    revalidatePath('/admin/provider-controls');
    revalidatePath('/provider/id-card');
    triggerRefresh('/admin/provider-controls');
    triggerRefresh('/provider/id-card');

    return { success: true, message: "ID card settings saved successfully." };
  } catch (error: any) {
    console.error("Error saving provider ID card settings:", error);
    return { success: false, message: error.message || "Failed to save ID card settings." };
  }
}

/**
 * Unlock ID card download for an approved provider (e.g. after payment or if free).
 */
export async function unlockProviderIdCardAction(
  providerId: string,
  paymentDetails?: { razorpay_order_id?: string; razorpay_payment_id?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const updatePayload: Record<string, any> = {
      idCardUnlocked: true,
      idCardUnlockedAt: Timestamp.now(),
    };

    if (paymentDetails?.razorpay_payment_id) {
      updatePayload.idCardPaymentId = paymentDetails.razorpay_payment_id;
      updatePayload.idCardOrderId = paymentDetails.razorpay_order_id || null;
    }

    await adminDb.collection('providerApplications').doc(providerId).set(updatePayload, { merge: true });

    try {
      await setDoc(doc(db, 'providerApplications', providerId), updatePayload, { merge: true });
    } catch (e) {
      // adminDb already saved
    }

    revalidatePath('/provider/id-card');
    return { success: true, message: "Official ID card unlocked successfully!" };
  } catch (error: any) {
    console.error("Error unlocking provider ID card:", error);
    return { success: false, message: error.message || "Failed to unlock ID card." };
  }
}
