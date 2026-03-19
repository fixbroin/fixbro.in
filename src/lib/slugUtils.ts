import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Generates a URL-friendly slug from a string.
 */
export const generateSlug = (name: string): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generates a unique slug by checking against existing slugs in a Firestore collection.
 * If a collision is found, it appends a number (e.g., slug-1, slug-2).
 */
export async function generateUniqueSlug(
  name: string,
  collectionName: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = generateSlug(name);
  if (!baseSlug) return "";

  let uniqueSlug = baseSlug;
  let counter = 1;
  let isUnique = false;

  while (!isUnique) {
    const q = query(
      collection(db, collectionName),
      where("slug", "==", uniqueSlug),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    // If no document found, it's unique
    if (querySnapshot.empty) {
      isUnique = true;
    } else {
      // If a document is found, check if it's the one we are currently editing
      const foundDocId = querySnapshot.docs[0].id;
      if (excludeId && foundDocId === excludeId) {
        isUnique = true;
      } else {
        // Collision! Try the next number
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }
    
    // Safety break to prevent infinite loops (unlikely but good practice)
    if (counter > 100) break;
  }

  return uniqueSlug;
}
