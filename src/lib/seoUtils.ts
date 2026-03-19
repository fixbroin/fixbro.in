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
  categoryPageTitlePattern: '#1 {{categoryName}} Services | Professional & Trusted | FixBro',
  categoryPageDescriptionPattern: 'Book top-rated {{categoryName}} services. Professional, reliable, and background-verified experts at your doorstep. Get a free quote today!',
  categoryPageKeywordsPattern: '{{categoryName}}, {{categoryName}} services, home {{categoryName}}',
  categoryPageH1Pattern: 'Best {{categoryName}} Services',
  cityCategoryPageTitlePattern: '#1 {{categoryName}} Services in {{cityName}} | Top-Rated Experts | FixBro',
  cityCategoryPageDescriptionPattern: 'Searching for the best {{categoryName}} services in {{cityName}}? FixBro provides professional and affordable {{categoryName}} experts. Book now for a hassle-free experience!',
  cityCategoryPageKeywordsPattern: '{{categoryName}} {{cityName}}, {{categoryName}} services in {{cityName}}, best {{categoryName}} {{cityName}}',
  cityCategoryPageH1Pattern: 'Top-Rated {{categoryName}} Services in {{cityName}}',
  areaCategoryPageTitlePattern: '#1 {{categoryName}} Services in {{areaName}}, {{cityName}} | Professional Experts | FixBro',
  areaCategoryPageDescriptionPattern: 'Looking for {{categoryName}} in {{areaName}}, {{cityName}}? Get professional and reliable {{categoryName}} services from FixBro. Trusted by thousands. Book your service today!',
  areaCategoryPageKeywordsPattern: '{{categoryName}} {{areaName}}, {{categoryName}} {{areaName}} {{cityName}}, best {{categoryName}} in {{areaName}}',
  areaCategoryPageH1Pattern: 'Professional {{categoryName}} Services in {{areaName}}, {{cityName}}',
  servicePageTitlePattern: '{{serviceName}} in {{cityName}} | Professional & Guaranteed | FixBro',
  servicePageDescriptionPattern: 'Get professional {{serviceName}} from FixBro. Background-verified experts, transparent pricing, and 100% satisfaction guaranteed. Book your service in {{cityName}} now!',
  servicePageKeywordsPattern: '{{serviceName}}, {{categoryName}}, {{serviceName}} service',
  servicePageH1Pattern: '{{serviceName}}',
  areaPageTitlePattern: 'Best Home Services in {{areaName}}, {{cityName}} | #1 Trusted Experts | FixBro',
  areaPageDescriptionPattern: 'Top-rated home services in {{areaName}}, {{cityName}}. From plumbing to carpentry, get background-verified experts at FixBro. Quality guaranteed. Book now!',
  areaPageKeywordsPattern: '{{areaName}} home services, services in {{areaName}} {{cityName}}',
  areaPageH1Pattern: 'Trusted Home Services in {{areaName}}, {{cityName}}',
  cityPageTitlePattern: '#1 Home Services in {{cityName}} | Professional & Reliable | FixBro',
  cityPageDescriptionPattern: 'Book professional home services in {{cityName}}. FixBro offers trusted experts for all your home maintenance needs. Affordable prices, verified pros. Book today!',
  cityPageKeywordsPattern: 'home services {{cityName}}, best services in {{cityName}}, FixBro {{cityName}}',
  cityPageH1Pattern: 'Professional Home Services in {{cityName}}',
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
