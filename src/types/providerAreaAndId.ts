import type { LocationChangeRequest } from './firestore';

export interface ProviderIdCardSettings {
  isIdCardEnabled: boolean;
  downloadFee: number;
  validityYears: number;
  signatoryName: string;
  helplineNumber: string;
  idNumberPrefix: string;
  idNumberStartingSeq: number;
  disclaimerText: string;
}

export const DEFAULT_ID_CARD_SETTINGS: ProviderIdCardSettings = {
  isIdCardEnabled: true,
  downloadFee: 0,
  validityYears: 2,
  signatoryName: "Authorized Signatory - FixBro",
  helplineNumber: "+91 8000 123 456",
  idNumberPrefix: "",
  idNumberStartingSeq: 361707601001,
  disclaimerText: "This ID card NOT issued by the Government.",
};

export interface SerializedLocationChangeRequest {
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: number;
  resolvedAt?: number;
  previousAddress: string;
  previousCenter?: { latitude: number; longitude: number };
  previousRadiusKm?: number;
  newAddress: string;
  newCenter: { latitude: number; longitude: number };
  newRadiusKm: number;
  rejectionReason?: string;
}

export interface PendingLocationChangeItem {
  providerId: string;
  providerName: string;
  providerPhone?: string;
  categoryName?: string;
  photoUrl?: string;
  request: SerializedLocationChangeRequest;
}

/**
 * Format a 12-digit number into Aadhaar style (4-4-4): "3617 0760 6355"
 */
export function formatAadhaarStyleNumber(numStr: string, prefix?: string): string {
  const digits = String(numStr).replace(/\D/g, '');
  const cleanPrefix = (prefix || '').trim();
  
  if (digits.length >= 12) {
    const d12 = digits.slice(-12);
    const spaced = `${d12.slice(0, 4)} ${d12.slice(4, 8)} ${d12.slice(8, 12)}`;
    return cleanPrefix ? `${cleanPrefix} ${spaced}` : spaced;
  }
  
  // Pad to 12 digits if shorter
  const padded = digits.padStart(12, '0');
  const spaced = `${padded.slice(0, 4)} ${padded.slice(4, 8)} ${padded.slice(8, 12)}`;
  return cleanPrefix ? `${cleanPrefix} ${spaced}` : spaced;
}

/**
 * Deterministically compute a unique 12-digit ID card number for a provider
 * using the admin's configured starting sequence.
 */
export function generateUniqueIdCardNumber(uid: string, startingSeq: number = 361707601001, prefix?: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  const offset = hash % 900000;
  const rawNum = startingSeq + offset;
  return formatAadhaarStyleNumber(String(rawNum), prefix);
}

export function formatTechnicianId(uid: string): string {
  const cleanHash = (uid || 'FXB1001').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `FXB - ${cleanHash.slice(0, 4)} - ${cleanHash.slice(4, 8) || '2026'}`;
}

export interface ProviderIdCardRecord {
  providerId: string;
  fullName: string;
  mobileNumber?: string;
  email?: string;
  profilePhotoUrl?: string;
  workCategoryName?: string;
  skillLevelLabel?: string;
  workAreaAddress?: string;
  residentialAddress?: string;
  gender?: string;
  age?: number;
  idCardNumber: string; // The official unique 12-digit / configured ID number
  technicianId: string;
  status: string;

  // ID Card Generation & Unlock Info
  idCardGenerated: boolean;
  idCardGeneratedAt?: number | null;
  idCardUnlocked: boolean;
  idCardUnlockedAt?: number | null;
  idCardPaymentId?: string | null;
  idCardOrderId?: string | null;
  idCardPaidAmount?: number;

  // Downloads metrics
  idCardDownloadCount: number;
  idCardPdfDownloadCount: number;
  idCardFrontPngDownloadCount: number;
  idCardBackPngDownloadCount: number;
  idCardLastDownloadedAt?: number | null;
  idCardDownloads?: Array<{
    type: 'pdf' | 'front_png' | 'back_png';
    downloadedAt: number;
    id?: string;
  }>;
}
