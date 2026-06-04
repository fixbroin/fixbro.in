// src/lib/seoUtils.ts

import type { FirestoreSEOSettings } from '@/types/firestore';
import { cleanSeoString, getCategorySearchTerm } from './seoAdvancedUtils';

export const defaultSeoValues: FirestoreSEOSettings = {
  siteName: 'FixBro - Home Services in Bangalore',

  // Automatically added to every meta title
  defaultMetaTitleSuffix: ' | FixBro',

  defaultMetaDescription:
    'Book trusted carpenter, plumber, electrician, TV installation, painting, interior work, furniture assembly, and home repair services near you in Bangalore.',

  defaultMetaKeywords:
    'carpenter near me, plumber near me, electrician near me, tv installation near me, painting services near me, interior designers near me, furniture assembly near me, home repair services bangalore',

  homepageMetaTitle:
    'Carpenter, Plumber, Electrician & TV Installation Services Near Me in Bangalore',

  homepageMetaDescription:
    'Book trusted carpenter, plumber, electrician, TV installation, painting, interior work, furniture assembly, and home repair services near you in Bangalore at affordable prices.',

  homepageMetaKeywords:
    'carpenter near me, plumber near me, electrician near me, tv installation near me, painting services near me, interior designers near me, furniture assembly near me, handyman services bangalore',

  homepageH1:
    'Trusted Home Services Near You in Bangalore',

  categoryPageTitlePattern:
    '{{categorySearchTerm}} Near Me in Bangalore',

  categoryPageDescriptionPattern:
    'Book trusted {{categorySearchTerm}} near you in Bangalore for installation, repair, replacement, maintenance, and handyman services at affordable prices.',

  categoryPageKeywordsPattern:
    '{{categorySearchTerm}} near me, best {{categorySearchTerm}} near me, affordable {{categorySearchTerm}} in bangalore, local {{categorySearchTerm}} services',

  categoryPageH1Pattern:
    '{{categorySearchTerm}} Services in Bangalore',

  cityCategoryPageTitlePattern:
    '{{categorySearchTerm}} in {{cityName}} Bangalore | Near Me',

  cityCategoryPageDescriptionPattern:
    'Professional {{categorySearchTerm}} services in {{cityName}} Bangalore by trusted experts near you for homes and offices.',

  cityCategoryPageKeywordsPattern:
    '{{categorySearchTerm}} {{cityName}}, {{categorySearchTerm}} near me, best {{categorySearchTerm}} in {{cityName}}, affordable {{categorySearchTerm}}',

  cityCategoryPageH1Pattern:
    '{{categorySearchTerm}} Services in {{cityName}}',

  areaCategoryPageTitlePattern:
    '{{categorySearchTerm}} in {{areaName}} Bangalore | Near Me',

  areaCategoryPageDescriptionPattern:
    'Looking for {{categorySearchTerm}} in {{areaName}} Bangalore? Book trusted experts near you for repair, installation, maintenance, and replacement services.',

  areaCategoryPageKeywordsPattern:
    '{{categorySearchTerm}} {{areaName}}, {{categorySearchTerm}} near me {{areaName}}, best {{categorySearchTerm}} {{areaName}}, affordable {{categorySearchTerm}}',

  areaCategoryPageH1Pattern:
    '{{categorySearchTerm}} Services in {{areaName}}',

  servicePageTitlePattern:
    '{{serviceName}} Near Me in Bangalore',

  servicePageDescriptionPattern:
    'Book professional {{serviceName}} near you in Bangalore for fast, affordable, and trusted repair, installation, and maintenance services.',

  servicePageKeywordsPattern:
    '{{serviceName}} near me, best {{serviceName}} in bangalore, affordable {{serviceName}}, local {{serviceName}} services',

  servicePageH1Pattern:
    '{{serviceName}} in Bangalore',

  areaPageTitlePattern:
    'Carpenter, Plumber & Electrician Services in {{areaName}}',

  areaPageDescriptionPattern:
    'Book carpenter, plumber, electrician, TV installation, painting, furniture assembly, and home repair services in {{areaName}} Bangalore.',

  areaPageKeywordsPattern:
    'carpenter {{areaName}}, plumber {{areaName}}, electrician {{areaName}}, tv installation {{areaName}}, painting services {{areaName}}, home services {{areaName}}',

  areaPageH1Pattern:
    'Home Services in {{areaName}}',

  cityPageTitlePattern:
    'Home Repair Services in {{cityName}}',

  cityPageDescriptionPattern:
    'Book trusted carpenter, plumber, electrician, TV installation, painting, furniture assembly, and home repair services in {{cityName}} Bangalore.',

  cityPageKeywordsPattern:
    'carpenter {{cityName}}, plumber {{cityName}}, electrician {{cityName}}, tv installation {{cityName}}, painting services {{cityName}}, home repair services {{cityName}}',

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

  // Dynamic Content Templates (ADVANCED SEO UNIQUENESS)
  cityCategorySeoContentTemplate: `
    <div class="space-y-4">
      <p>Looking for reliable <strong>{{categoryName}} in {{cityName}}</strong>? FixBro connects you with top-rated, background-verified experts for all your home and office needs. Our professionals in {{cityName}} are equipped with modern tools and the expertise required to ensure high-quality results for every task.</p>
      
      <p>We are highly active across all major hubs in {{cityName}}, including areas like {{nearbyAreas}}. Whether you need <strong>{{popularServices}}</strong>, our team ensures a seamless booking experience and transparent pricing from start to finish.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div class="p-4 border border-primary/10 bg-primary/5 rounded-xl">
          <h4 class="font-bold text-primary mb-1">Local Expertise</h4>
          <p class="text-sm">Trusted by thousands of residents in {{cityName}} with an average service rating of {{averageRating}}/5.</p>
        </div>
        <div class="p-4 border border-green-100 bg-green-50/50 rounded-xl">
          <h4 class="font-bold text-green-700 mb-1">Verified Professionals</h4>
          <p class="text-sm">Every {{categoryName}} expert in {{cityName}} undergoes a rigorous 5-step background verification.</p>
        </div>
      </div>
    </div>
  `,

  cityCategoryFaqsTemplate: [
    { question: "How can I book {{categoryName}} in {{cityName}}?", answer: "Booking is simple! Select your specific {{categoryName}} requirement, pick a convenient time slot, and a verified professional in {{cityName}} will be assigned to your request instantly." },
    { question: "What is the average rating for {{categoryName}} services in {{cityName}}?", answer: "Our {{categoryName}} services in {{cityName}} maintain a high customer satisfaction score of {{averageRating}} stars, based on thousands of local reviews." },
    { question: "Are services available in {{nearbyAreas}}?", answer: "Yes, we provide comprehensive {{categoryName}} coverage across {{cityName}}, including {{nearbyAreas}} and all surrounding neighborhoods." }
  ],

  areaCategorySeoContentTemplate: `
    <div class="space-y-4">
      <p>FixBro is your trusted local partner for premium <strong>{{categoryName}} in {{areaName}}</strong>. We understand the specific service needs of residents in the {{areaName}} locality of {{cityName}}, providing rapid response times and expert workmanship for every {{categoryName}} requirement.</p>
      
      <p>Our dedicated team of professionals is frequently booked for <strong>{{popularServices}}</strong> throughout {{areaName}} and neighboring spots like {{nearbyAreas}}. We take pride in maintaining a high standard of service, reflected in our {{averageRating}} star rating from {{completedJobs}}+ successfully completed jobs in {{cityName}}.</p>
      
      <ul class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mt-4 list-disc pl-5">
        <li><strong>Hyper-Local to {{areaName}}</strong>: Quick arrival and neighborhood-specific expertise.</li>
        <li><strong>Comprehensive Range</strong>: Expert handling of {{popularServices}} and more.</li>
        <li><strong>Transparent Pricing</strong>: Standardized rates across {{areaName}}, {{cityName}}.</li>
        <li><strong>Satisfaction Guaranteed</strong>: We ensure you are 99% happy with the work.</li>
      </ul>
    </div>
  `,

  areaCategoryFaqsTemplate: [
    { question: "Do you provide {{categoryName}} services directly in {{areaName}}?", answer: "Yes, we have a specialized team of experts dedicated to the {{areaName}} area in {{cityName}}, ensuring faster arrival and localized service knowledge." },
    { question: "What are the most popular {{categoryName}} tasks in {{areaName}}?", answer: "In the {{areaName}} neighborhood, customers frequently book us for {{popularServices}}. We handle both minor repairs and major installations with equal expertise." },
    { question: "How many jobs has FixBro completed in {{cityName}}?", answer: "We have successfully completed over {{completedJobs}} service requests across {{cityName}}, maintaining a consistent quality rating of {{averageRating}} stars." }
  ],
};

/**
 * Replace placeholders dynamically
 */
export function replacePlaceholders(
  template: string | undefined | null,
  data: Record<string, string | number | undefined | null>,
  isTitle: boolean = false
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

  // Clean extra spaces and duplicate separators
  result = cleanSeoString(result);

  // Auto append title suffix only once, and ONLY if it's a title
  if (isTitle) {
    const titleSuffix = defaultSeoValues.defaultMetaTitleSuffix || '';
    if (result && titleSuffix && !result.endsWith(titleSuffix)) {
      result += titleSuffix;
    }
  }
  
  return result;
}