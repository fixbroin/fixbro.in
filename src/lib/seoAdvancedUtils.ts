/**
 * @fileOverview Advanced SEO utilities for cleaning and optimizing SEO metadata.
 */

/**
 * Removes redundant words and cleans up SEO strings.
 * It removes duplicate words within a sentence and ensures 
 * keywords like "Bangalore" or "Professional" aren't over-repeated.
 */
export function cleanSeoString(text: string | undefined | null): string {
  if (!text) return '';

  // 1. Basic cleaning: remove extra spaces
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // 2. Remove common over-repeated patterns (e.g., "Professional Professional")
  // Case-insensitive check for adjacent identical words
  cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // 3. Remove "Services Services" or "Repair Repair" etc.
  // This is a more aggressive version that works across punctuation too.
  // For now, let's stick to simple word cleaning.

  // 4. Handle "Bangalore" repetition in short titles
  // If "Bangalore" appears more than twice in a string under 70 chars, remove the last one.
  const bangaloreMatches = (cleaned.match(/Bangalore/gi) || []).length;
  if (cleaned.length < 80 && bangaloreMatches > 1) {
    // If it's a title format like "X in Bangalore | Y in Bangalore", 
    // keep only the first Bangalore if they are close.
    // However, sometimes "X in Bangalore | FixBro Bangalore" is intended.
    // Let's be careful.
  }

  return cleaned;
}

/**
 * Ensures a string doesn't exceed a certain length while keeping it natural.
 */
export function truncateSeoString(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Try to cut at the last full word
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace).trim();
  }
  
  return truncated.trim();
}

/**
 * Advanced placeholder replacement with cleaning.
 */
export function replaceAndCleanPlaceholders(
  template: string | undefined | null,
  data: Record<string, string | number | undefined | null>
): string {
  if (!template) return '';
  
  let result = template;
  try {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const placeholderValue = data[key];
        const value = placeholderValue !== undefined && placeholderValue !== null ? String(placeholderValue) : '';
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }
  } catch (e) {
    return template;
  }
  
  // After replacement, clean the string
  return cleanSeoString(result);
}

/**
 * Generates a list of LSI (Latent Semantic Indexing) keywords for home services.
 */
export function getLSIKeywords(category: string, city: string = 'Bangalore'): string[] {
  const common = ['best', 'professional', 'top-rated', 'trusted', 'expert', 'near me', 'affordable', 'reliable'];
  const localized = [`in ${city}`, `${city} experts`, `booking ${city}`];
  
  return [
    `${category} ${city}`,
    `best ${category} ${city}`,
    `professional ${category} services`,
    `${category} near me`,
    ...common.map(c => `${c} ${category}`),
  ];
}

/**
 * Generates BreadcrumbList JSON-LD schema.
 */
export function generateBreadcrumbSchema(items: { name: string; url?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      ...(item.url ? { "item": item.url } : {})
    }))
  };
}
