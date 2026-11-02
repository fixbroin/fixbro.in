import type { LocationChangeRequest } from './firestore';

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
