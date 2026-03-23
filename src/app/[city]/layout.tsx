import type { Metadata, ResolvingMetadata } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import type { FirestoreCity, FirestoreSEOSettings, GlobalWebSettings } from '@/types/firestore';
import { replacePlaceholders } from '@/lib/seoUtils';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';
import { getBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

interface CityPageLayoutProps {
  params: Promise<{ city: string }>;
  children: React.ReactNode;
}

const RESERVED_SLUGS = ['api', 'admin', 'provider', 'auth', 'static', '_next'];

// Function to fetch city data by slug
async function getCityData(slug: string): Promise<FirestoreCity | null> {
  try {
    if (slug.includes('.') || RESERVED_SLUGS.includes(slug)) { 
      return null;
    }
    const citiesRef = adminDb.collection('cities');
    const q = citiesRef.where('slug', '==', slug).where('isActive', '==', true).limit(1);
    const snapshot = await q.get();
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FirestoreCity;
  } catch (error) {
    console.error(`[CityLayout] Error fetching city data for slug "${slug}":`, error);
    return null;
  }
}

// Function to fetch global web settings (e.g., for OG image)
async function getGlobalWebsiteSettings(): Promise<GlobalWebSettings | null> {
    try {
        const settingsDocRef = adminDb.collection("webSettings").doc("global");
        const docSnap = await settingsDocRef.get();
        if (docSnap.exists) {
            return docSnap.data() as GlobalWebSettings;
        }
        return null;
    } catch (error) {
        console.error("[CityLayout] Error fetching global web settings for metadata:", error);
        return null;
    }
}


export default function CityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
