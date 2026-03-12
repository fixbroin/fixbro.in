// src/lib/seoUtils.ts
import type { FirestoreSEOSettings } from '@/types/firestore';

// Define default SEO values
export const defaultSeoValues: FirestoreSEOSettings = {
  siteName: 'FixBro – Trusted Home Services',
  defaultMetaTitleSuffix: ' - FixBro',
  defaultMetaDescription: 'Book trusted home services near you with FixBro. Hire professional carpenters, electricians, plumbers, painters, and handyman experts.',
  defaultMetaKeywords: 'fixbro, home services near me, handyman services, carpenter near me, electrician near me',
  homepageMetaTitle: 'FixBro – Trusted Home Services Near You',
  homepageMetaDescription: 'FixBro helps you book trusted home services including carpentry, electrical, plumbing, painting, and installations.',
  homepageMetaKeywords: 'fixbro, home services, handyman near me',
  homepageH1: 'Trusted Home Services Near You',
  categoryPageTitlePattern: '{{categoryName}} Services Near You | FixBro',
  categoryPageDescriptionPattern: 'Book professional {{categoryName}} services near you.',
  categoryPageKeywordsPattern: '{{categoryName}} near me, {{categoryName}} services',
  categoryPageH1Pattern: '{{categoryName}} Services',
  cityCategoryPageTitlePattern: '{{categoryName}} Services in {{cityName}} | FixBro',
  cityCategoryPageDescriptionPattern: 'Find trusted {{categoryName}} services in {{cityName}}.',
  cityCategoryPageKeywordsPattern: '{{categoryName}} {{cityName}}',
  cityCategoryPageH1Pattern: '{{categoryName}} Services in {{cityName}}',
  areaCategoryPageTitlePattern: '{{categoryName}} in {{areaName}}, {{cityName}} | FixBro',
  areaCategoryPageDescriptionPattern: 'Hire professional {{categoryName}} experts in {{areaName}}, {{cityName}}.',
  areaCategoryPageKeywordsPattern: '{{categoryName}} {{areaName}}',
  areaCategoryPageH1Pattern: '{{categoryName}} Services in {{areaName}}, {{cityName}}',
  servicePageTitlePattern: '{{serviceName}} | FixBro Home Services',
  servicePageDescriptionPattern: 'Book {{serviceName}} with FixBro.',
  servicePageKeywordsPattern: '{{serviceName}}, {{categoryName}}',
  servicePageH1Pattern: '{{serviceName}}',
  areaPageTitlePattern: 'Home Services in {{areaName}}, {{cityName}} | FixBro',
  areaPageDescriptionPattern: 'Find trusted home services in {{areaName}}, {{cityName}}.',
  areaPageKeywordsPattern: '{{areaName}} home services',
  areaPageH1Pattern: 'Home Services in {{areaName}}, {{cityName}}',
  cityPageTitlePattern: 'Professional Home Services in {{cityName}} | FixBro',
  cityPageDescriptionPattern: 'FixBro provides trusted home services in {{cityName}}.',
  cityPageKeywordsPattern: 'home services {{cityName}}',
  cityPageH1Pattern: 'Reliable Home Services in {{cityName}}',
  structuredDataType: 'LocalBusiness',
  structuredDataName: 'FixBro',
  structuredDataStreetAddress: '#44, G S Palya Road, Konappana Agrahara, Electronic City Phase 2',
  structuredDataLocality: 'Bangalore',
  structuredDataRegion: 'Karnataka',
  structuredDataPostalCode: '560100',
  structuredDataCountry: 'IN',
  structuredDataTelephone: '+91-7353113455',
  structuredDataImage: 'https://fixbro.in/android-chrome-512x512.png',
  socialProfileUrls: {
    facebook: 'https://www.facebook.com/fixbro.in',
    twitter: 'https://x.com/fixbro_in',
    instagram: 'https://www.instagram.com/fixbro.in/',
    linkedin: 'https://www.linkedin.com/company/fixbro-in',
    youtube: 'https://www.youtube.com/@fixbro-in',
  },
};

export function replacePlaceholders(template?: string, data?: Record<string, string | undefined>): string {
  if (!template) return '';
  if (!data) return template;
  let result = template;
  try {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const placeholderValue = data[key];
        if (placeholderValue !== undefined && placeholderValue !== null) {
          result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(placeholderValue));
        } else {
           result = result.replace(new RegExp(`{{${key}}}`, 'g'), '');
        }
      }
    }
  } catch (e) {
    return template;
  }
  return result.trim();
}
