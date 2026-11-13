import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from '@/lib/mysqlDb'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely converts various timestamp formats to milliseconds.
 * Handles Firestore Timestamp, serialized plain objects, ISO strings, and Date objects.
 */
export function getTimestampMillis(ts: any): number {
  if (!ts) return 0;
  
  // Real Firestore Timestamp
  if (typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  
  // Plain object from JSON/Cache (Firestore-like)
  if (typeof ts === 'object') {
    if (ts.seconds !== undefined) {
      return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
    }
    // Admin SDK format (_seconds)
    if (ts._seconds !== undefined) {
      return ts._seconds * 1000 + (ts._nanoseconds || 0) / 1000000;
    }
    // Date object
    if (ts instanceof Date) {
      return ts.getTime();
    }
  }
  
  // ISO String or other date string
  if (typeof ts === 'string') {
    const date = new Date(ts);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }
  
  // Already a number
  if (typeof ts === 'number') {
    return ts;
  }
  
  return 0;
}

/**
 * Checks whether a booking payment method represents Pay After Service
 * (collected directly by the provider on-site).
 * FixBro has only two payment methods:
 * 1. "Online" (Customer paid online via Razorpay/Stripe)
 * 2. "Pay After Service" (Provider collects payment on-site)
 */
export function isCashPayment(method?: string): boolean {
  if (!method) return true;
  const lower = method.toLowerCase().trim();
  return lower !== 'online';
}

export function hasOnlinePaymentProof(booking?: any): boolean {
  if (!booking) return false;
  return !!(booking.razorpayPaymentId || booking.stripePaymentIntent || booking.stripeSessionId);
}

export const isPayAfterService = isCashPayment;

/**
 * Returns a Date object shifted to represent the target timezone's local time.
 * Useful for "now" calculations on servers with different default timezones.
 * It uses a component-based approach which is much more reliable than string parsing.
 */
export function getZonedDate(date?: Date | string | number, timeZone: string = 'Asia/Kolkata'): Date {
  const d = date ? new Date(date) : new Date();
  
  // Extract components in the target timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(d);

  const findPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  
  // Create a new Date object using these components as "local" time
  return new Date(
    findPart('year'),
    findPart('month') - 1,
    findPart('day'),
    findPart('hour'),
    findPart('minute'),
    findPart('second')
  );
}

/**
 * Formats a Date to an ISO string (YYYY-MM-DD) in the target timezone.
 * Prevents "yesterday" issues when formatting dates in UTC.
 */
export function formatZonedDateToISO(date?: Date | string | number, timeZone: string = 'Asia/Kolkata'): string {
  try {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) throw new Error("Invalid date");

    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    
    // en-CA format is usually YYYY-MM-DD
    const formatted = formatter.format(d);
    if (formatted.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return formatted;
    }

    // Fallback using parts if en-CA didn't give what we wanted
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    
    if (year && month && day) {
        return `${year}-${month}-${day}`;
    }
    
    throw new Error("Formatting failed");
  } catch (e) {
    console.error("formatZonedDateToISO failed:", e);
    // Ultimate fallback to local ISO string part
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Converts a "wall clock" date (created by getZonedDate) back to a real UTC Date object.
 * This is necessary before calling .toISOString() or sending the date to the client.
 */
export function convertWallClockToUTC(wallClockDate: Date, timeZone: string = 'Asia/Kolkata'): Date {
  // Use a component-based diff to find the exact offset in milliseconds
  const testDate = new Date(); // Use current time as a baseline for offset
  const zoned = getZonedDate(testDate, timeZone);
  const offset = zoned.getTime() - testDate.getTime();
  
  return new Date(wallClockDate.getTime() - offset);
}

function getClientSideDateFormat(): string | undefined {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('fixbro_cache_app-config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.data?.dateFormat) {
          return parsed.data.dateFormat;
        }
      }
    } catch (e) {}
  }
  return undefined;
}

export function getClientSideTimezone(): string | undefined {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('fixbro_cache_app-config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.data?.timezone) {
          return parsed.data.timezone;
        }
      }
    } catch (e) {}
  }
  return undefined;
}

export function formatCustomDate(date: Date, formatStr: string, timeZone: string = 'Asia/Kolkata'): string {
  try {
    const clientTz = getClientSideTimezone();
    const effectiveTz = (timeZone && timeZone !== 'Asia/Kolkata') ? timeZone.trim() : (clientTz || timeZone || 'Asia/Kolkata');
    const validTz = effectiveTz.trim() || 'Asia/Kolkata';
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: validTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
      hour12: false
    });
    
    const parts = dtf.formatToParts(date);
    const partMap: Record<string, string> = {};
    parts.forEach(p => {
      partMap[p.type] = p.value;
    });

    const yyyy = partMap.year || '0000';
    const yy = yyyy.slice(-2);
    const mm = partMap.month || '00';
    const m = String(parseInt(mm, 10));
    const dd = partMap.day || '00';
    const d = String(parseInt(dd, 10));
    const weekday = partMap.weekday || '';
    const ddd = weekday.slice(0, 3);
    
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndex = parseInt(mm, 10) - 1;
    const mmm = monthsShort[monthIndex] || '';
    const mmmm = monthsLong[monthIndex] || '';

    let result = formatStr;
    result = result.replace(/dddd/g, weekday);
    result = result.replace(/ddd/g, ddd);
    result = result.replace(/YYYY/g, yyyy);
    result = result.replace(/YY/g, yy);
    result = result.replace(/MMMM/g, mmmm);
    result = result.replace(/MMM/g, mmm);
    result = result.replace(/MM/g, mm);
    result = result.replace(/M/g, m);
    result = result.replace(/DD/g, dd);
    result = result.replace(/D/g, d);

    return result;
  } catch (err) {
    return date.toLocaleDateString();
  }
}

/**
 * Formats a date string or object for display, respecting the target timezone.
 */
export function formatDateInTimezone(
  date: Date | string | number | undefined,
  timeZone: string = 'Asia/Kolkata',
  optionsOrFormat?: Intl.DateTimeFormatOptions | string
): string {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return String(date);
      const clientTz = getClientSideTimezone();
      const effectiveTz = (timeZone && timeZone !== 'Asia/Kolkata') ? timeZone.trim() : (clientTz || timeZone || 'Asia/Kolkata');
      const validTz = effectiveTz.trim() || 'Asia/Kolkata';

      if (typeof optionsOrFormat === 'string') {
        return formatCustomDate(d, optionsOrFormat, validTz);
      }

      const hasDefaultOptions = !optionsOrFormat || (
        typeof optionsOrFormat === 'object' &&
        optionsOrFormat.day === '2-digit' &&
        optionsOrFormat.month === '2-digit' &&
        optionsOrFormat.year === 'numeric' &&
        Object.keys(optionsOrFormat).length === 3
      );

      if (hasDefaultOptions) {
        const clientFormat = getClientSideDateFormat();
        if (clientFormat) {
          return formatCustomDate(d, clientFormat, validTz);
        }
      }

      const options: Intl.DateTimeFormatOptions = (typeof optionsOrFormat === 'object' && optionsOrFormat !== null)
        ? optionsOrFormat
        : { day: '2-digit', month: '2-digit', year: 'numeric' as const };
      return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: validTz }).format(d);
    } catch (e) {
      return String(date);
    }
}

/**
 * Formats a time string or object for display, respecting the target timezone.
 */
export function formatTimeInTimezone(date: Date | string | number | undefined, timeZone: string = 'Asia/Kolkata', options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true }): string {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return String(date);
      const clientTz = getClientSideTimezone();
      const effectiveTz = (timeZone && timeZone !== 'Asia/Kolkata') ? timeZone.trim() : (clientTz || timeZone || 'Asia/Kolkata');
      const validTz = effectiveTz.trim() || 'Asia/Kolkata';
      return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: validTz }).format(d);
    } catch (e) {
      return String(date);
    }
}

/**
 * Converts a raw database date string (YYYY-MM-DD) to a configured format
 */
export function formatScheduledDate(dateStr: string | undefined, formatStr?: string): string {
  if (!dateStr) return 'N/A';
  
  let yyyy = '';
  let mm = '';
  let dd = '';

  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        yyyy = parts[0];
        mm = parts[1];
        dd = parts[2];
      } else if (parts[2].length === 4) {
        dd = parts[0];
        mm = parts[1];
        yyyy = parts[2];
      }
    }
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        yyyy = parts[0];
        mm = parts[1];
        dd = parts[2];
      } else if (parts[2].length === 4) {
        dd = parts[0];
        mm = parts[1];
        yyyy = parts[2];
      }
    }
  }

  if (!yyyy || !mm || !dd) {
    return dateStr;
  }

  const activeFormat = formatStr || getClientSideDateFormat() || 'DD/MM/YYYY';

  const yy = yyyy.slice(-2);
  const m = String(parseInt(mm, 10));
  const d = String(parseInt(dd, 10));
  
  let weekday = '';
  let ddd = '';
  if (activeFormat.includes('ddd') || activeFormat.includes('dddd')) {
    try {
      const tempDate = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
      const parts = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).formatToParts(tempDate);
      weekday = parts.find(p => p.type === 'weekday')?.value || '';
      ddd = weekday.slice(0, 3);
    } catch (e) {}
  }

  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthIndex = parseInt(mm, 10) - 1;
  const mmm = monthsShort[monthIndex] || '';
  const mmmm = monthsLong[monthIndex] || '';

  let result = activeFormat;
  result = result.replace(/dddd/g, weekday);
  result = result.replace(/ddd/g, ddd);
  result = result.replace(/YYYY/g, yyyy);
  result = result.replace(/YY/g, yy);
  result = result.replace(/MMMM/g, mmmm);
  result = result.replace(/MMM/g, mmm);
  result = result.replace(/MM/g, mm);
  result = result.replace(/M/g, m);
  result = result.replace(/DD/g, dd);
  result = result.replace(/D/g, d);

  return result;
}

/**
 * Formats a numeric amount with the target currency symbol, locale rules, and decimal places.
 */
export function formatCurrency(
  amount: number,
  symbol: string = '₹',
  decimals: number = 2,
  code: string = 'INR'
): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
  try {
    const locale = code === 'INR' ? 'en-IN' : 'en-US';
    const formattedAmount = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
    return `${symbol}${formattedAmount}`;
  } catch (e) {
    return `${symbol}${amount.toFixed(decimals)}`;
  }
}

/**
 * Calculates epoch timestamp in milliseconds for a booking's scheduled date and time slot.
 * Used for chronological sorting of bookings (nearest appointment first).
 */
export function getBookingScheduledTimestamp(b: any): number {
  if (!b) return 0;
  const dateStr = b.scheduledDate || b.bookingDate;
  const timeStr = b.scheduledTimeSlot || b.bookingTime;

  if (dateStr && typeof dateStr === 'string') {
    try {
      let year = 0, month = 0, day = 0;
      
      if (dateStr.includes('-')) {
        const parts = dateStr.split('T')[0].split('-').map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          if (parts[0] > 1000) {
            [year, month, day] = parts;
          } else {
            [day, month, year] = parts;
          }
        }
      } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/').map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          if (parts[2] > 1000) {
            [day, month, year] = parts;
          } else if (parts[0] > 1000) {
            [year, month, day] = parts;
          }
        }
      }

      if (year > 0 && month > 0 && day > 0) {
        let timeHours = 12;
        let timeMinutes = 0;
        if (timeStr && typeof timeStr === 'string') {
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (match) {
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const ampm = match[3]?.toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            timeHours = h;
            timeMinutes = m;
          }
        }
        return new Date(year, month - 1, day, timeHours, timeMinutes).getTime();
      }

      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.getTime();
      }
    } catch (e) {}
  }
  
  return getTimestampMillis(b.createdAt);
}

/**
 * Parses time strings such as "10:00 AM", "06:00 PM", or "14:30" into minutes from midnight (0 - 1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3]?.toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Formats total minutes from midnight into 12-hour AM/PM string, e.g. 600 -> "10:00 AM".
 */
export function formatTimeFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours >= 12 && hours < 24 ? 'PM' : 'AM';
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Checks whether a provider is on duty at a given date and time slot.
 * If workingHours is undefined/null, provider has not configured custom hours,
 * so this returns true (standard platform availability fallback).
 */
export function isProviderWorkingAtTimeSlot(
  workingHours: any,
  dateISOOrObj: string | Date,
  timeSlotMinutesOrStr: number | string,
  timeZone: string = 'Asia/Kolkata'
): boolean {
  if (!workingHours || typeof workingHours !== 'object') {
    return true; // Backward compatibility fallback: follows platform hours
  }

  let weekday = '';
  if (typeof dateISOOrObj === 'string') {
    const cleanDate = dateISOOrObj.split('T')[0];
    const parts = cleanDate.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
      weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(d).toLowerCase();
    }
  } else if (dateISOOrObj instanceof Date) {
    weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(dateISOOrObj).toLowerCase();
  }

  if (!weekday || !workingHours[weekday]) {
    return true;
  }

  const daySchedule = workingHours[weekday];
  if (daySchedule.isEnabled === false) {
    return false; // Provider specifically marked this weekday as non-working / off-day
  }

  const slotMinutes = typeof timeSlotMinutesOrStr === 'number' 
    ? timeSlotMinutesOrStr 
    : parseTimeToMinutes(timeSlotMinutesOrStr);

  // Check multiple custom shifts / intervals if provided
  if (Array.isArray(daySchedule.intervals) && daySchedule.intervals.length > 0) {
    return daySchedule.intervals.some((int: any) => {
      const s = parseTimeToMinutes(int.startTime);
      const e = parseTimeToMinutes(int.endTime);
      return slotMinutes >= s && slotMinutes < e;
    });
  }

  // Check standard single start/end time fallback
  if (daySchedule.startTime && daySchedule.endTime) {
    const s = parseTimeToMinutes(daySchedule.startTime);
    const e = parseTimeToMinutes(daySchedule.endTime);
    return slotMinutes >= s && slotMinutes < e;
  }

  return true;
}


