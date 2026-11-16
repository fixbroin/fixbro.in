
import type { FirestoreService } from "@/types/firestore";

export const generateBookingId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'FB-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(chars.length * Math.random()));
  }
  return result;
};

/**
 * Generates a random 4-digit numeric OTP for booking verification.
 */
export const generateBookingOtp = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Ensures a booking has both a Start OTP and a Complete OTP.
 * For existing bookings without stored OTPs, deterministically generates
 * consistent 4-digit codes from the booking's unique identifier.
 */
export const ensureBookingOtps = (booking: { id?: string; bookingId?: string; startOtp?: string; completeOtp?: string }): { startOtp: string; completeOtp: string } => {
  let startOtp = booking.startOtp;
  let completeOtp = booking.completeOtp;

  if (!startOtp) {
    const seed = (booking.id || booking.bookingId || '1234') + '_start';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    startOtp = String(1000 + (Math.abs(hash) % 9000));
  }

  if (!completeOtp) {
    const seed = (booking.id || booking.bookingId || '5678') + '_complete';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    completeOtp = String(1000 + (Math.abs(hash) % 9000));
    if (completeOtp === startOtp) {
      completeOtp = String((parseInt(completeOtp, 10) + 1234) % 9000 + 1000);
    }
  }

  return { startOtp, completeOtp };
};

export const getBasePriceForInvoice = (displayedPrice: number, isTaxInclusive: boolean, taxPercent: number): number => {
    if (!isTaxInclusive || taxPercent <= 0) return displayedPrice;
    return (displayedPrice * 100) / (100 + taxPercent);
};

export const getPriceForNthUnit = (service: FirestoreService, n: number): number => {
  if (!service.hasPriceVariants || !service.priceVariants || service.priceVariants.length === 0 || n <= 0) {
    return service.discountedPrice ?? service.price;
  }
  const sortedVariants = [...service.priceVariants].sort((a, b) => a.fromQuantity - b.fromQuantity);
  const applicableTier = sortedVariants.find(tier => {
    const start = tier.fromQuantity;
    const end = tier.toQuantity ?? Infinity;
    return n >= start && n <= end;
  });
  if (applicableTier) return applicableTier.price;
  const lastApplicableTier = sortedVariants.slice().reverse().find(tier => n >= tier.fromQuantity);
  if (lastApplicableTier) return lastApplicableTier.price;
  return service.discountedPrice ?? service.price;
};

export const calculateIncrementalTotalPriceForItem = (service: FirestoreService, quantity: number): number => {
    if (!service.hasPriceVariants || !service.priceVariants || service.priceVariants.length === 0) {
        const unitPrice = service.discountedPrice ?? service.price;
        return unitPrice * quantity;
    }
    let total = 0;
    for (let i = 1; i <= quantity; i++) {
        total += getPriceForNthUnit(service, i);
    }
    return total;
};
