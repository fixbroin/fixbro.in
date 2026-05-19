// src/lib/seoUtils.ts

import type { FirestoreSEOSettings } from '@/types/firestore';
import { cleanSeoString, getCategorySearchTerm } from './seoAdvancedUtils';

export const defaultSeoValues: FirestoreSEOSettings = {
  siteName: 'FixBro - Home Services in Bangalore',

  defaultMetaTitleSuffix: ' | FixBro',

  defaultMetaDescription:
    'Book trusted carpenter, plumber, electrician, TV installation, furniture assembly, AC repair, and home repair services near you in Bangalore.',

  defaultMetaKeywords:
    'carpenter near me, plumber near me, electrician near me, tv installation near me, furniture assembly near me, home repair services bangalore',

  homepageMetaTitle:
    'Carpenter, Plumber & Electrician Services in Bangalore | FixBro',

  homepageMetaDescription:
    'Book carpenter, plumber, electrician, TV installation, furniture assembly, AC repair, and home repair services near you in Bangalore.',

  homepageMetaKeywords:
    'carpenter near me, plumber near me, electrician near me, furniture assembly near me, tv installation near me',

  homepageH1:
    'Trusted Carpenter, Plumber & Electrician Services in Bangalore',

  categoryPageTitlePattern:
    '{{categorySearchTerm}} Near Me | Best {{categorySearchTerm}} in Bangalore',

  categoryPageDescriptionPattern:
    'Book trusted {{categorySearchTerm}} near you in Bangalore for repair, installation, replacement, and maintenance services at affordable prices.',

  categoryPageKeywordsPattern:
    '{{categorySearchTerm}} near me, best {{categorySearchTerm}} in bangalore, affordable {{categorySearchTerm}} services',

  categoryPageH1Pattern:
    '{{categorySearchTerm}} Services in Bangalore',

  cityCategoryPageTitlePattern:
    '{{categorySearchTerm}} in {{cityName}} | {{categorySearchTerm}} Near Me',

  cityCategoryPageDescriptionPattern:
    'Professional {{categorySearchTerm}} services in {{cityName}} Bangalore by trusted experts near you for homes and offices.',

  cityCategoryPageKeywordsPattern:
    '{{categorySearchTerm}} {{cityName}}, {{categorySearchTerm}} near me, best {{categorySearchTerm}} in {{cityName}}',

  cityCategoryPageH1Pattern:
    '{{categorySearchTerm}} Services in {{cityName}}',

  areaCategoryPageTitlePattern:
    '{{categorySearchTerm}} in {{areaName}} Bangalore | Near Me',

  areaCategoryPageDescriptionPattern:
    'Looking for {{categorySearchTerm}} in {{areaName}} Bangalore? Book trusted experts near you for repair, installation, and maintenance services.',

  areaCategoryPageKeywordsPattern:
    '{{categorySearchTerm}} {{areaName}}, {{categorySearchTerm}} near me {{areaName}}, best {{categorySearchTerm}} {{areaName}}',

  areaCategoryPageH1Pattern:
    '{{categorySearchTerm}} Services in {{areaName}}',

  servicePageTitlePattern:
    '{{serviceName}} Near Me | {{serviceName}} in {{cityName}}',

  servicePageDescriptionPattern:
    'Book professional {{serviceName}} in {{cityName}} Bangalore for fast, affordable, and trusted repair and installation services near you.',

  servicePageKeywordsPattern:
    '{{serviceName}} near me, {{serviceName}} bangalore, best {{serviceName}}, affordable {{serviceName}}',

  servicePageH1Pattern:
    '{{serviceName}} in Bangalore',

  areaPageTitlePattern:
    'Carpenter, Plumber & Electrician Services in {{areaName}} | FixBro',

  areaPageDescriptionPattern:
    'Book carpenter, plumber, electrician, TV installation, furniture assembly, and home repair services in {{areaName}} Bangalore.',

  areaPageKeywordsPattern:
    'carpenter {{areaName}}, plumber {{areaName}}, electrician {{areaName}}, home services {{areaName}}',

  areaPageH1Pattern:
    'Home Services in {{areaName}}',

  cityPageTitlePattern:
    'Home Repair Services in {{cityName}} | FixBro',

  cityPageDescriptionPattern:
    'Book trusted carpenter, plumber, electrician, TV installation, furniture assembly, and home repair services in {{cityName}}.',

  cityPageKeywordsPattern:
    'carpenter {{cityName}}, plumber {{cityName}}, electrician {{cityName}}, home repair services {{cityName}}',

  cityPageH1Pattern:
    'Home Services in {{cityName}}',

  structuredDataType: 'LocalBusiness',

  structuredDataName: 'FixBro',

  structuredDataStreetAddress:
    '#44, G S Palya Road, Konappana Agrahara, Electronic City Phase 2',

  structuredDataLocality: 'Bangalore',

  structuredDataRegion: 'Karnataka',

  structuredDataPostalCode: '560100',

  structuredDataCountry: 'IN',

  structuredDataTelephone: '+91-7353113455',

  structuredDataImage:
    'https://fixbro.in/android-chrome-512x512.png',

  socialProfileUrls: {
    facebook: 'https://www.facebook.com/fixbro.in',
    twitter: 'https://x.com/fixbro_in',
    instagram: 'https://www.instagram.com/fixbro.in/',
    linkedin: 'https://www.linkedin.com/company/fixbro-in',
    youtube: 'https://www.youtube.com/@fixbro-in',
  },

  fallbackRatingValue: '4.9',

  fallbackReviewCount: '2500',
};

/**
 * Replace placeholders dynamically
 */
export function replacePlaceholders(
  template: string | undefined | null,
  data: Record<string, string | number | undefined | null>
): string {
  if (!template) return '';

  let result = template;

  const extendedData = { ...data };

  // Auto generate category search term
  if (
    extendedData.categoryName &&
    !extendedData.categorySearchTerm
  ) {
    extendedData.categorySearchTerm =
      getCategorySearchTerm(
        String(extendedData.categoryName)
      );
  }

  try {
    for (const key in extendedData) {
      if (
        Object.prototype.hasOwnProperty.call(
          extendedData,
          key
        )
      ) {
        const value = extendedData[key];

        result = result.replace(
          new RegExp(`{{${key}}}`, 'g'),
          value !== undefined && value !== null
            ? String(value)
            : ''
        );
      }
    }
  } catch (error) {
    return template;
  }

  return cleanSeoString(result);
}