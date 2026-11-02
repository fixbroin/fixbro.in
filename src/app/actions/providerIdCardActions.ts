'use server';

import { adminDb } from '@/lib/firebaseAdmin';
import { db } from '@/lib/mysqlDb';
import { doc, getDoc, setDoc, Timestamp } from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { getTimestampMillis } from '@/lib/utils';
import { 
  type ProviderIdCardSettings, 
  DEFAULT_ID_CARD_SETTINGS,
  type ProviderIdCardRecord,
  formatTechnicianId,
  generateUniqueIdCardNumber
} from '@/types/providerAreaAndId';
import type { ProviderApplication } from '@/types/firestore';

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
        idNumberPrefix: String(data.idNumberPrefix ?? DEFAULT_ID_CARD_SETTINGS.idNumberPrefix),
        idNumberStartingSeq: Number(data.idNumberStartingSeq ?? DEFAULT_ID_CARD_SETTINGS.idNumberStartingSeq),
        disclaimerText: String(data.disclaimerText || DEFAULT_ID_CARD_SETTINGS.disclaimerText),
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
        idNumberPrefix: String(data.idNumberPrefix ?? DEFAULT_ID_CARD_SETTINGS.idNumberPrefix),
        idNumberStartingSeq: Number(data.idNumberStartingSeq ?? DEFAULT_ID_CARD_SETTINGS.idNumberStartingSeq),
        disclaimerText: String(data.disclaimerText || DEFAULT_ID_CARD_SETTINGS.disclaimerText),
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
      idNumberPrefix: String(settings.idNumberPrefix || '').trim(),
      idNumberStartingSeq: Math.max(1, Number(settings.idNumberStartingSeq || DEFAULT_ID_CARD_SETTINGS.idNumberStartingSeq)),
      disclaimerText: String(settings.disclaimerText || DEFAULT_ID_CARD_SETTINGS.disclaimerText).trim(),
      updatedAt: Timestamp.now(),
    };

    // Save directly via adminDb into MySQL
    await adminDb.collection('appConfiguration').doc('provider_id_card').set(cleanData, { merge: true });

    // Also persist via client SDK reference
    try {
      const docRef = doc(db, 'appConfiguration', 'provider_id_card');
      await setDoc(docRef, cleanData, { merge: true });
    } catch {
      // adminDb write already committed directly
    }

    revalidatePath('/admin/provider-controls');
    revalidatePath('/provider/id-card');
    revalidatePath('/admin/provider-id-cards');
    triggerRefresh('/admin/provider-controls');
    triggerRefresh('/provider/id-card');
    triggerRefresh('/admin/provider-id-cards');

    return { success: true, message: "ID card settings saved successfully." };
  } catch (error: any) {
    console.error("Error saving provider ID card settings:", error);
    return { success: false, message: error.message || "Failed to save ID card settings." };
  }
}

/**
 * Record when a verified provider views/generates their ID card for the first time.
 * Also assigns or updates a unique ID card number according to current admin settings.
 */
export async function recordIdCardGenerationAction(
  providerId: string
): Promise<{ success: boolean; message: string; idCardNumber?: string }> {
  try {
    if (!providerId) return { success: false, message: "Missing provider ID" };

    const docRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await docRef.get();
    if (!snap.exists) return { success: false, message: "Application not found" };

    const data = snap.data() as ProviderApplication;
    const settings = await getProviderIdCardSettingsAction();
    const assignedNumber = generateUniqueIdCardNumber(providerId, settings.idNumberStartingSeq, settings.idNumberPrefix);

    const updatePayload: Record<string, any> = {
      idCardGenerated: true,
      idCardGeneratedAt: data.idCardGeneratedAt || Timestamp.now(),
      idCardNumber: assignedNumber,
      updatedAt: Timestamp.now(),
    };

    await docRef.set(updatePayload, { merge: true });
    try {
      await setDoc(doc(db, 'providerApplications', providerId), updatePayload, { merge: true });
    } catch {
      // adminDb committed
    }

    revalidatePath('/admin/provider-id-cards');
    return { success: true, message: "ID card generation recorded", idCardNumber: assignedNumber };
  } catch (error: any) {
    console.error("Error recording ID card generation:", error);
    return { success: false, message: error.message || "Failed to record generation" };
  }
}

/**
 * Delete / reset a generated provider ID card so they can regenerate afresh with current settings.
 */
export async function deleteOrResetProviderIdCardAction(
  providerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!providerId) return { success: false, message: "Missing provider ID" };

    const clearPayload: Record<string, any> = {
      idCardNumber: null,
      idCardGenerated: false,
      idCardGeneratedAt: null,
      idCardUnlocked: false,
      idCardUnlockedAt: null,
      idCardPaymentId: null,
      idCardOrderId: null,
      idCardPaidAmount: 0,
      idCardDownloadCount: 0,
      idCardPdfDownloadCount: 0,
      idCardFrontPngDownloadCount: 0,
      idCardBackPngDownloadCount: 0,
      idCardLastDownloadedAt: null,
      idCardDownloads: [],
      updatedAt: Timestamp.now(),
    };

    await adminDb.collection('providerApplications').doc(providerId).set(clearPayload, { merge: true });
    try {
      await setDoc(doc(db, 'providerApplications', providerId), clearPayload, { merge: true });
    } catch {
      // adminDb committed
    }

    revalidatePath('/admin/provider-id-cards');
    revalidatePath('/provider/id-card');
    triggerRefresh('/admin/provider-id-cards');
    triggerRefresh('/provider/id-card');

    return { success: true, message: "Provider ID card reset successfully. Provider can now regenerate." };
  } catch (error: any) {
    console.error("Error resetting ID card:", error);
    return { success: false, message: error.message || "Failed to reset card" };
  }
}

/**
 * Unlock ID card download for an approved provider (e.g. after payment or if free).
 */
export async function unlockProviderIdCardAction(
  providerId: string,
  paymentDetails?: { razorpay_order_id?: string; razorpay_payment_id?: string; amount?: number }
): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await getProviderIdCardSettingsAction();
    const docRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await docRef.get();
    const data = snap.exists ? (snap.data() as ProviderApplication) : null;
    const assignedNumber = generateUniqueIdCardNumber(providerId, settings.idNumberStartingSeq, settings.idNumberPrefix);

    const updatePayload: Record<string, any> = {
      idCardUnlocked: true,
      idCardUnlockedAt: Timestamp.now(),
      idCardGenerated: true,
      idCardGeneratedAt: data?.idCardGeneratedAt || Timestamp.now(),
      idCardNumber: assignedNumber,
    };

    if (paymentDetails?.razorpay_payment_id) {
      updatePayload.idCardPaymentId = paymentDetails.razorpay_payment_id;
      updatePayload.idCardOrderId = paymentDetails.razorpay_order_id || null;
      updatePayload.idCardPaidAmount = Number(paymentDetails.amount ?? 0);
    } else {
      updatePayload.idCardPaidAmount = 0;
    }

    await docRef.set(updatePayload, { merge: true });

    try {
      await setDoc(doc(db, 'providerApplications', providerId), updatePayload, { merge: true });
    } catch {
      // adminDb already saved
    }

    revalidatePath('/provider/id-card');
    revalidatePath('/admin/provider-id-cards');
    triggerRefresh('/provider/id-card');
    triggerRefresh('/admin/provider-id-cards');

    return { success: true, message: "Official ID card unlocked successfully!" };
  } catch (error: any) {
    console.error("Error unlocking provider ID card:", error);
    return { success: false, message: error.message || "Failed to unlock ID card." };
  }
}

/**
 * Track an ID card download event (PDF, Front Image, or Back Image).
 */
export async function trackIdCardDownloadAction(
  providerId: string,
  downloadType: 'pdf' | 'front_png' | 'back_png'
): Promise<{ success: boolean; downloadCount: number }> {
  try {
    if (!providerId) throw new Error("Missing provider ID");

    const docRef = adminDb.collection('providerApplications').doc(providerId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error("Provider record not found");

    const data = snap.data() as ProviderApplication;
    const currentTotal = Number(data.idCardDownloadCount || 0);
    const currentPdf = Number(data.idCardPdfDownloadCount || 0);
    const currentFront = Number(data.idCardFrontPngDownloadCount || 0);
    const currentBack = Number(data.idCardBackPngDownloadCount || 0);
    const downloadsHistory = Array.isArray(data.idCardDownloads) ? [...data.idCardDownloads] : [];

    const newTotal = currentTotal + 1;
    const newPdf = currentPdf + (downloadType === 'pdf' ? 1 : 0);
    const newFront = currentFront + (downloadType === 'front_png' ? 1 : 0);
    const newBack = currentBack + (downloadType === 'back_png' ? 1 : 0);

    const now = Date.now();
    downloadsHistory.unshift({
      type: downloadType,
      downloadedAt: now,
      id: `${downloadType}_${now}`,
    });

    // Keep the latest 50 download log items to prevent uncontrolled doc growth
    const trimmedHistory = downloadsHistory.slice(0, 50);

    const updatePayload: Record<string, any> = {
      idCardGenerated: true,
      idCardDownloadCount: newTotal,
      idCardPdfDownloadCount: newPdf,
      idCardFrontPngDownloadCount: newFront,
      idCardBackPngDownloadCount: newBack,
      idCardLastDownloadedAt: Timestamp.now(),
      idCardDownloads: trimmedHistory,
      updatedAt: Timestamp.now(),
    };

    await docRef.set(updatePayload, { merge: true });

    try {
      await setDoc(doc(db, 'providerApplications', providerId), updatePayload, { merge: true });
    } catch {
      // adminDb committed
    }

    revalidatePath('/admin/provider-id-cards');
    return { success: true, downloadCount: newTotal };
  } catch (error: any) {
    console.error("Error tracking ID card download:", error);
    return { success: false, downloadCount: 0 };
  }
}

/**
 * Fetch all provider records who generated, unlocked, or are eligible for ID cards.
 */
export async function getProvidersWithIdCardsAction(): Promise<ProviderIdCardRecord[]> {
  try {
    const [snap, settings] = await Promise.all([
      adminDb.collection('providerApplications').get(),
      getProviderIdCardSettingsAction(),
    ]);

    const records: ProviderIdCardRecord[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() as ProviderApplication;
      if (data.status === 'approved') {
        const isGenerated = Boolean(
          data.idCardGenerated || 
          data.idCardUnlocked || 
          (data.idCardDownloadCount && data.idCardDownloadCount > 0)
        );

        const generatedAtMillis = getTimestampMillis(data.idCardGeneratedAt);
        const unlockedAtMillis = getTimestampMillis(data.idCardUnlockedAt);
        const lastDownloadedMillis = getTimestampMillis(data.idCardLastDownloadedAt);

        const safeDownloads = Array.isArray(data.idCardDownloads) 
          ? data.idCardDownloads.map((d: any) => ({
              type: (d.type === 'front_png' || d.type === 'back_png' ? d.type : 'pdf') as 'pdf' | 'front_png' | 'back_png',
              downloadedAt: typeof d.downloadedAt === 'number' ? d.downloadedAt : (getTimestampMillis(d.downloadedAt) || Date.now()),
              id: d.id ? String(d.id) : undefined,
            }))
          : [];

        // Format unique ID number according to current settings
        const idCardNumber = generateUniqueIdCardNumber(docSnap.id, settings.idNumberStartingSeq, settings.idNumberPrefix);

        records.push({
          providerId: docSnap.id,
          fullName: String(data.fullName || 'Service Provider'),
          mobileNumber: data.mobileNumber ? String(data.mobileNumber) : undefined,
          email: data.email ? String(data.email) : undefined,
          profilePhotoUrl: data.profilePhotoUrl ? String(data.profilePhotoUrl) : undefined,
          workCategoryName: data.workCategoryName ? String(data.workCategoryName) : undefined,
          skillLevelLabel: data.skillLevelLabel ? String(data.skillLevelLabel) : undefined,
          workAreaAddress: data.workAreaAddress ? String(data.workAreaAddress) : undefined,
          residentialAddress: data.address ? String(data.address) : undefined,
          gender: data.gender ? String(data.gender) : 'Male',
          age: data.age ? Number(data.age) : undefined,
          idCardNumber,
          technicianId: formatTechnicianId(docSnap.id),
          status: data.status,
          idCardGenerated: isGenerated,
          idCardGeneratedAt: generatedAtMillis,
          idCardUnlocked: Boolean(data.idCardUnlocked),
          idCardUnlockedAt: unlockedAtMillis,
          idCardPaymentId: data.idCardPaymentId ? String(data.idCardPaymentId) : null,
          idCardOrderId: data.idCardOrderId ? String(data.idCardOrderId) : null,
          idCardPaidAmount: Number(data.idCardPaidAmount || 0),
          idCardDownloadCount: Number(data.idCardDownloadCount || 0),
          idCardPdfDownloadCount: Number(data.idCardPdfDownloadCount || 0),
          idCardFrontPngDownloadCount: Number(data.idCardFrontPngDownloadCount || 0),
          idCardBackPngDownloadCount: Number(data.idCardBackPngDownloadCount || 0),
          idCardLastDownloadedAt: lastDownloadedMillis,
          idCardDownloads: safeDownloads,
        });
      }
    });

    // Sort: providers with generated/unlocked/downloaded cards first, then by last downloaded or unlocked
    records.sort((a, b) => {
      if (a.idCardGenerated && !b.idCardGenerated) return -1;
      if (!a.idCardGenerated && b.idCardGenerated) return 1;
      const timeA = a.idCardLastDownloadedAt || a.idCardUnlockedAt || a.idCardGeneratedAt || 0;
      const timeB = b.idCardLastDownloadedAt || b.idCardUnlockedAt || b.idCardGeneratedAt || 0;
      return timeB - timeA;
    });

    return JSON.parse(JSON.stringify(records));
  } catch (error) {
    console.error("Error fetching providers with ID cards:", error);
    return [];
  }
}
