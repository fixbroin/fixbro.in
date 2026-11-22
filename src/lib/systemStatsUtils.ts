// src/lib/systemStatsUtils.ts
'use server';

import { adminDb } from './firebaseAdmin';
import { FieldValue, Timestamp } from './mysqlDbAdmin';

export async function incrementSystemStats(updates: {
  totalBookings?: number;
  completedBookings?: number;
  totalRevenue?: number;
  earnedCommission?: number;
  totalUsers?: number;
  newSignups30d?: number;
  lastUserNumber?: number;
  lastBookingNumber?: number;
  totalDiscountGiven?: number;
}) {
  try {
    const statsRef = adminDb.collection('appConfiguration').doc('stats');
    const payload: any = {
      updatedAt: Timestamp.now()
    };

    if (updates.totalBookings) payload.totalBookings = FieldValue.increment(updates.totalBookings);
    if (updates.completedBookings) payload.completedBookings = FieldValue.increment(updates.completedBookings);
    if (updates.totalRevenue) payload.totalRevenue = FieldValue.increment(updates.totalRevenue);
    if (updates.earnedCommission) payload.earnedCommission = FieldValue.increment(updates.earnedCommission);
    if (updates.totalUsers) payload.totalUsers = FieldValue.increment(updates.totalUsers);
    if (updates.newSignups30d) payload.newSignups30d = FieldValue.increment(updates.newSignups30d);
    if (updates.lastUserNumber) payload.lastUserNumber = FieldValue.increment(updates.lastUserNumber);
    if (updates.lastBookingNumber) payload.lastBookingNumber = FieldValue.increment(updates.lastBookingNumber);
    if (updates.totalDiscountGiven) payload.totalDiscountGiven = FieldValue.increment(updates.totalDiscountGiven);

    await statsRef.set(payload, { merge: true });
  } catch (error) {
    console.error("Error incrementing system stats:", error);
  }
}

function getExactTimestampMillis(data: any): number {
  const dateStr = data.scheduledDate || data.bookingDate;
  const timeStr = data.scheduledTimeSlot || data.bookingTime;

  if (dateStr) {
    try {
      const parts = String(dateStr).split('-').map(Number);
      if (parts.length === 3) {
        let h = 12, m = 0;
        if (timeStr) {
          const match = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (match) {
            h = parseInt(match[1], 10);
            m = parseInt(match[2], 10);
            const ampm = match[3]?.toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
          }
        }
        return new Date(parts[0], parts[1] - 1, parts[2], h, m).getTime();
      }
    } catch (e) {}
  }

  const ca = data.createdAt;
  if (ca) {
    if (typeof ca._seconds === 'number') return ca._seconds * 1000;
    if (typeof ca.seconds === 'number') return ca.seconds * 1000;
    if (typeof ca === 'string' || typeof ca === 'number') {
      const t = new Date(ca).getTime();
      if (!isNaN(t)) return t;
    }
  }

  return 0;
}

/**
 * Resequences all booking numbers to remove gaps from deletions.
 */
export async function resequenceBookingNumbers() {
  try {
    const statsRef = adminDb.collection('appConfiguration').doc('stats');
    const bookingsSnap = await adminDb.collection('bookings').get();
    
    // Sort chronologically (oldest = 1, latest = highest number)
    const sortedDocs = bookingsSnap.docs
      .map(doc => ({
        ref: doc.ref,
        data: doc.data(),
        timestamp: getExactTimestampMillis(doc.data())
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const totalBookings = sortedDocs.length;
    let modifiedCount = 0;
    let batchCount = 0;
    let batch = adminDb.batch();

    for (let i = 0; i < sortedDocs.length; i++) {
      const item = sortedDocs[i];
      const targetNumber = i + 1;
      if (item.data.bookingNumber !== targetNumber) {
        batch.update(item.ref, { bookingNumber: targetNumber });
        modifiedCount++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }

    await statsRef.set({ 
      lastBookingNumber: totalBookings,
      updatedAt: Timestamp.now() 
    }, { merge: true });

    return { success: true, count: modifiedCount };
  } catch (error) {
    console.error("Error resequencing booking numbers:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Resequences all active user numbers consecutively without gaps.
 * Inactive, archived, and merged users are excluded from the sequence and cleared.
 */
export async function resequenceUserNumbers() {
  try {
    const statsRef = adminDb.collection('appConfiguration').doc('stats');
    const usersSnap = await adminDb.collection('users').get();
    
    const validDocs: { ref: any; data: any; timestamp: number; currentNum: number }[] = [];
    const inactiveDocs: { ref: any; data: any }[] = [];

    for (const doc of usersSnap.docs) {
      const data = doc.data() || {};
      const isExcluded = data.isArchived || data.mergedIntoUid || (!data.displayName && !data.email && !data.mobileNumber && !data.phoneNumber);
      if (isExcluded) {
        inactiveDocs.push({ ref: doc.ref, data });
      } else {
        const rawNum = typeof data.userNumber === 'number' ? data.userNumber : parseInt(String(data.userNumber || '0'), 10);
        validDocs.push({
          ref: doc.ref,
          data,
          timestamp: getExactTimestampMillis(data),
          currentNum: isNaN(rawNum) ? 0 : rawNum
        });
      }
    }

    // Sort valid users chronologically (oldest = 1, latest = highest number)
    validDocs.sort((a, b) => {
      if (a.timestamp > 0 && b.timestamp > 0 && a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      if (a.currentNum > 0 && b.currentNum > 0 && a.currentNum !== b.currentNum) {
        return a.currentNum - b.currentNum;
      }
      return String(a.data.displayName || a.data.email || '').localeCompare(String(b.data.displayName || b.data.email || ''));
    });

    // Deduplicate valid users sharing the same email or mobile number so duplicates do not cause ID gaps
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const dedupedValidDocs: typeof validDocs = [];

    for (const item of validDocs) {
      const email = (item.data.email || '').toLowerCase().trim();
      const phone = (item.data.mobileNumber || item.data.phoneNumber || '').replace(/\D/g, '').replace(/^91/, '');

      let isDup = false;
      if (email && seenEmails.has(email)) isDup = true;
      if (phone && seenPhones.has(phone)) isDup = true;

      if (isDup) {
        inactiveDocs.push(item);
      } else {
        if (email) seenEmails.add(email);
        if (phone) seenPhones.add(phone);
        dedupedValidDocs.push(item);
      }
    }

    let modifiedCount = 0;
    let batchCount = 0;
    let batch = adminDb.batch();

    // 1. Assign strictly consecutive numbers to all active unique users
    for (let i = 0; i < dedupedValidDocs.length; i++) {
      const item = dedupedValidDocs[i];
      const targetNumber = i + 1;
      if (item.currentNum !== targetNumber) {
        batch.update(item.ref, { userNumber: targetNumber });
        modifiedCount++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }

    // 2. Clear userNumber on any inactive, archived, merged, or duplicate users so they never cause gaps
    for (const item of inactiveDocs) {
      if (item.data.userNumber !== null && item.data.userNumber !== undefined) {
        batch.update(item.ref, { userNumber: null });
        modifiedCount++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }

    const totalActiveUsers = dedupedValidDocs.length;
    await statsRef.set({ 
      lastUserNumber: totalActiveUsers,
      totalUsers: totalActiveUsers,
      updatedAt: Timestamp.now() 
    }, { merge: true });

    return { success: true, count: modifiedCount, totalActive: totalActiveUsers };
  } catch (error) {
    console.error("Error resequencing user numbers:", error);
    return { success: false, error: String(error) };
  }
}

export async function initializeBookingNumbers() {
  return resequenceBookingNumbers();
}

export async function initializeUserNumbers() {
  return resequenceUserNumbers();
}
