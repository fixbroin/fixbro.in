'use server';

import { db } from '@/lib/mysqlDb';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from '@/lib/mysqlDb';
import { revalidatePath } from 'next/cache';
import type { MarketplaceCallLog } from '@/types/marketplace';

const CALL_LOGS_COLLECTION = 'marketplaceCallLogs';

export interface SellerCallLogItem {
  id: string;
  callerName: string;
  callerPhone: string;
  callerEmail?: string;
  listingId: string;
  listingTitle: string;
  listingType: 'furniture' | 'rental';
  createdAt: string;
}

/**
 * Records a call click from a logged-in user to a listing owner.
 * Increments callCount on the listing and logs caller details for Admin and Seller.
 * Also generates an in-app notification for the seller so they immediately know who called.
 */
export async function recordMarketplaceCallAction(
  data: Omit<MarketplaceCallLog, 'id' | 'createdAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!data.callerUserId || !data.sellerUserId) {
      return { success: false, error: 'User IDs are required to record a call.' };
    }

    const payload: MarketplaceCallLog = {
      ...data,
      callerName: data.callerName?.trim() || 'FixBro User',
      callerPhone: data.callerPhone?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, CALL_LOGS_COLLECTION), payload);

    // Save phone to caller user profile if missing
    if (data.callerUserId && data.callerPhone) {
      try {
        const userRef = doc(db, 'users', data.callerUserId);
        const uSnap = await getDoc(userRef);
        if (uSnap.exists()) {
          const uData = uSnap.data();
          if (!uData.mobileNumber) {
            await updateDoc(userRef, { mobileNumber: data.callerPhone });
          }
        }
      } catch {}
    }

    // Increment callCount on the respective listing
    const targetCollection = data.listingType === 'furniture' ? 'marketplaceFurniture' : 'marketplaceRentals';
    try {
      const listingRef = doc(db, targetCollection, data.listingId);
      const snap = await getDoc(listingRef);
      if (snap.exists()) {
        const item = snap.data();
        await updateDoc(listingRef, {
          callCount: (item.callCount || 0) + 1,
        });
      }
    } catch (countErr) {
      console.warn("Could not increment callCount:", countErr);
    }

    // In-app notification for seller so they immediately see who called
    if (data.sellerUserId) {
      try {
        await addDoc(collection(db, 'userNotifications'), {
          userId: data.sellerUserId,
          title: `📞 New Inquiry on "${data.listingTitle}"`,
          message: `${data.callerName || 'A buyer'} (${data.callerPhone || 'Caller'}) clicked to call regarding your ${
            data.listingType === 'furniture' ? 'furniture ad' : 'rental listing'
          }.`,
          type: 'info',
          href: '/marketplace/my-posts',
          read: false,
          createdAt: Timestamp.now(),
        });
      } catch (notifErr) {
        console.warn('Could not post seller notification:', notifErr);
      }
    }

    revalidatePath('/admin/furniture');
    revalidatePath('/admin/rentals');
    revalidatePath('/marketplace/my-posts');

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Error recording marketplace call log:', error);
    return { success: false, error: error?.message || 'Failed to record call.' };
  }
}

/**
 * Fetches all call logs for Admin (full details: caller name, phone, email, listing info).
 */
export async function getAdminMarketplaceCallLogsAction(): Promise<MarketplaceCallLog[]> {
  try {
    const collRef = collection(db, CALL_LOGS_COLLECTION);
    const snap = await getDocs(collRef);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceCallLog));
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return list;
  } catch (error) {
    console.error('Error getting admin marketplace call logs:', error);
    return [];
  }
}

/**
 * Fetches caller information for the seller who posted the listing.
 * Includes callerName, callerPhone, callerEmail, listingTitle, and timestamp so the seller knows who called and can call back.
 */
export async function getSellerMarketplaceCallLogsAction(
  sellerUserId: string
): Promise<SellerCallLogItem[]> {
  try {
    if (!sellerUserId) return [];
    const collRef = collection(db, CALL_LOGS_COLLECTION);
    const snap = await getDocs(collRef);
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as MarketplaceCallLog))
      .filter(x => x.sellerUserId === sellerUserId)
      .map(x => ({
        id: x.id || '',
        callerName: x.callerName || 'Interested User',
        callerPhone: x.callerPhone || '',
        callerEmail: x.callerEmail || '',
        listingId: x.listingId || '',
        listingTitle: x.listingTitle || 'Listing',
        listingType: (x.listingType || 'furniture') as 'furniture' | 'rental',
        createdAt: x.createdAt,
      }));
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return list;
  } catch (error) {
    console.error('Error getting seller marketplace call logs:', error);
    return [];
  }
}

/**
 * Permanently deletes all call logs associated with a deleted ad.
 */
export async function deleteMarketplaceCallLogsByListingIdAction(
  listingId: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    if (!listingId) return { success: true, deletedCount: 0 };
    const collRef = collection(db, CALL_LOGS_COLLECTION);
    const snap = await getDocs(collRef);
    let count = 0;
    for (const d of snap.docs) {
      const data = d.data() as MarketplaceCallLog;
      if (data.listingId === listingId) {
        await deleteDoc(doc(db, CALL_LOGS_COLLECTION, d.id));
        count++;
      }
    }
    revalidatePath('/admin/furniture');
    revalidatePath('/admin/rentals');
    revalidatePath('/marketplace/my-posts');
    return { success: true, deletedCount: count };
  } catch (err: any) {
    console.error('Error deleting marketplace call logs for listing:', err);
    return { success: false, error: err?.message || 'Failed to delete call logs' };
  }
}

