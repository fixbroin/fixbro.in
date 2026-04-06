// src/lib/seoUtils.ts
import type { FirestoreSEOSettings } from '@/types/firestore';
import { cleanSeoString } from './seoAdvancedUtils';

// Define default SEO values
export const defaultSeoValues: FirestoreSEOSettings = {
  siteName: 'FixBro – Trusted Home Services in Bangalore',
  defaultMetaTitleSuffix: ' | FixBro Bangalore',
  defaultMetaDescription: 'FixBro provides top-rated home services in Bangalore including carpentry, electrical, plumbing, painting, and more. Book professional experts near you in Bangalore.',
  defaultMetaKeywords: 'fixbro bangalore, home services bangalore, handyman services bangalore, carpenter in bangalore, electrician in bangalore',
  homepageMetaTitle: 'FixBro – Best Professional Home Services in Bangalore',
  homepageMetaDescription: 'FixBro helps you book the best trusted home services in Bangalore including carpentry, electrical, plumbing, painting, and installations. Bangalore\'s top-rated professional experts.',
  homepageMetaKeywords: 'fixbro bangalore, home services bangalore, handyman near me bangalore, best home services in bangalore',
  homepageH1: 'Best Professional Home Services in Bangalore',
  categoryPageTitlePattern: 'Best {{categoryName}} in Bangalore | Top-Rated Professional Experts | FixBro',
  categoryPageDescriptionPattern: 'Book top-rated {{categoryName}} services in Bangalore. Verified professionals, upfront pricing, and same-day service available across Bangalore neighborhoods.',
  categoryPageKeywordsPattern: 'best {{categoryName}} in bangalore, professional {{categoryName}} services bangalore, {{categoryName}} experts bangalore',
  categoryPageH1Pattern: 'Expert {{categoryName}} Services in Bangalore',
  cityCategoryPageTitlePattern: 'Best {{categoryName}} Services in {{cityName}} | Professional {{categoryName}} | FixBro',
  cityCategoryPageDescriptionPattern: 'Hire the best {{categoryName}} services in {{cityName}}. Our professional experts provide reliable and affordable home solutions in Bangalore.',
  cityCategoryPageKeywordsPattern: '{{categoryName}} in {{cityName}}, {{categoryName}} services bangalore, best {{categoryName}} in {{cityName}}',
  cityCategoryPageH1Pattern: 'Best {{categoryName}} Services in {{cityName}}',
  areaCategoryPageTitlePattern: 'Top-Rated {{categoryName}} in {{areaName}} | Expert Services in Bangalore',
  areaCategoryPageDescriptionPattern: 'Need professional {{categoryName}} in {{areaName}}? Book top-rated experts for all your home needs in {{areaName}}, Bangalore.',
  areaCategoryPageKeywordsPattern: '{{categoryName}} in {{areaName}}, {{categoryName}} {{areaName}} bangalore, best {{categoryName}} {{areaName}}',
  areaCategoryPageH1Pattern: 'Expert {{categoryName}} Services in {{areaName}}',
  servicePageTitlePattern: '{{serviceName}} in Bangalore | Best Professional Experts | FixBro',
  servicePageDescriptionPattern: 'Book professional {{serviceName}} in {{cityName}}, Bangalore. Reliable solutions with trusted professionals and transparent pricing.',
  servicePageKeywordsPattern: '{{serviceName}} bangalore, {{categoryName}} {{cityName}}, book {{serviceName}} online bangalore',
  servicePageH1Pattern: 'Professional {{serviceName}} in Bangalore',
  areaPageTitlePattern: 'Best Home Services in {{areaName}} | Trusted Professionals in Bangalore',
  areaPageDescriptionPattern: 'Looking for reliable home services in {{areaName}}, Bangalore? FixBro provides top-rated professionals for all your home repair needs.',
  areaPageKeywordsPattern: 'home services {{areaName}}, handyman {{areaName}} bangalore, home repair {{areaName}}',
  areaPageH1Pattern: 'Trusted Home Services in {{areaName}}',
  cityPageTitlePattern: 'Best Home Services in {{cityName}} | Top-Rated Experts | FixBro',
  cityPageDescriptionPattern: 'FixBro provides the best professional home services in {{cityName}}. Book top-rated experts for carpentry, electrical, plumbing, and more.',
  cityPageKeywordsPattern: 'home services {{cityName}}, best handyman bangalore, professional home repair {{cityName}}',
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

/**
 * Utility to replace placeholders in a string and clean it.
 * @param template The string with placeholders like {{name}}
 * @param data An object containing values for the placeholders
 * @returns The string with placeholders replaced and redundant words cleaned
 */
export function replacePlaceholders(
  template: string | undefined | null,
  data: Record<string, string | number | undefined | null>
): string {
  if (!template) return '';
  
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
  
  // Clean the result to remove redundant words
  return cleanSeoString(result);
}
