// src/lib/seoUtils.ts
import type { FirestoreSEOSettings } from '@/types/firestore';

// Define default SEO values
export const defaultSeoValues: FirestoreSEOSettings = {
  siteName: 'FixBro – Trusted Home Services',
  defaultMetaTitleSuffix: ' | FixBro',
  defaultMetaDescription: 'FixBro provides top-rated home services including carpentry, electrical, plumbing, painting, and more. Book professional experts near you.',
  defaultMetaKeywords: 'fixbro, home services near me, handyman services, carpenter near me, electrician near me',
  homepageMetaTitle: 'FixBro – Best Professional Home Services Near You',
  homepageMetaDescription: 'FixBro helps you book the best trusted home services including carpentry, electrical, plumbing, painting, and installations. Professional experts near you.',
  homepageMetaKeywords: 'fixbro, home services, handyman near me, best professional home services',
  homepageH1: 'Best Professional Home Services Near You',
  categoryPageTitlePattern: 'Best {{categoryName}} Services Near Me | Professional {{categoryName}} | FixBro',
  categoryPageDescriptionPattern: 'Looking for the best {{categoryName}} services? Book professional {{categoryName}} experts near you for high-quality home maintenance and repairs.',
  categoryPageKeywordsPattern: 'best {{categoryName}} near me, professional {{categoryName}} services, {{categoryName}} experts, home {{categoryName}}',
  categoryPageH1Pattern: 'Professional {{categoryName}} Services',
  cityCategoryPageTitlePattern: 'Best {{categoryName}} Services in {{cityName}} | Professional {{categoryName}} Near Me',
  cityCategoryPageDescriptionPattern: 'Hire the best {{categoryName}} services in {{cityName}}. Our professional {{categoryName}} experts provide reliable and affordable home solutions in {{cityName}}.',
  cityCategoryPageKeywordsPattern: '{{categoryName}} in {{cityName}}, {{categoryName}} services {{cityName}}, best {{categoryName}} near me, professional {{categoryName}} {{cityName}}',
  cityCategoryPageH1Pattern: 'Best {{categoryName}} Services in {{cityName}}',
  areaCategoryPageTitlePattern: 'Top-Rated {{categoryName}} in {{areaName}}, {{cityName}} | Expert {{categoryName}} Near Me',
  areaCategoryPageDescriptionPattern: 'Need a professional {{categoryName}} in {{areaName}}, {{cityName}}? Book top-rated experts for all your {{categoryName}} needs near you.',
  areaCategoryPageKeywordsPattern: '{{categoryName}} {{areaName}}, {{categoryName}} in {{areaName}} {{cityName}}, best {{categoryName}} {{areaName}}',
  areaCategoryPageH1Pattern: 'Expert {{categoryName}} Services in {{areaName}}, {{cityName}}',
  servicePageTitlePattern: '{{serviceName}} | Best Professional {{categoryName}} in {{cityName}}',
  servicePageDescriptionPattern: 'Book professional {{serviceName}} in {{cityName}}. Expert {{categoryName}} solutions with trusted professionals and transparent pricing.',
  servicePageKeywordsPattern: '{{serviceName}}, {{categoryName}} {{cityName}}, book {{serviceName}} online',
  servicePageH1Pattern: 'Professional {{serviceName}}',
  areaPageTitlePattern: 'Best Home Services in {{areaName}}, {{cityName}} | Trusted Professionals Near Me',
  areaPageDescriptionPattern: 'Looking for reliable home services in {{areaName}}, {{cityName}}? FixBro provides top-rated professionals for all your home repair and maintenance needs.',
  areaPageKeywordsPattern: 'home services in {{areaName}}, handyman {{areaName}} {{cityName}}, home repair {{areaName}}',
  areaPageH1Pattern: 'Trusted Home Services in {{areaName}}, {{cityName}}',
  cityPageTitlePattern: 'Best Professional Home Services in {{cityName}} | Top-Rated Handyman Near Me',
  cityPageDescriptionPattern: 'FixBro provides the best professional home services in {{cityName}}. Book top-rated experts for carpentry, electrical, plumbing, and more in {{cityName}}.',
  cityPageKeywordsPattern: 'home services {{cityName}}, best handyman {{cityName}}, professional home repair {{cityName}}',
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
 * Utility to replace placeholders in a string.
 * @param template The string with placeholders like {{name}}
 * @param data An object containing values for the placeholders
 * @returns The string with placeholders replaced
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
  return result.trim();
}
