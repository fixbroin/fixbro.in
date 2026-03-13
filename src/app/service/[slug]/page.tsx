import ServiceDetailPageClient from '@/components/service/ServiceDetailPageClient';
import { adminDb } from '@/lib/firebaseAdmin';
import type { FirestoreService, ClientServiceData, FirestoreCategory, FirestoreSubCategory } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { getBaseUrl } from '@/lib/config';
import type { Metadata, ResolvingMetadata } from 'next';
import { replacePlaceholders } from '@/lib/seoUtils';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';

interface ServicePageProps {
  params: { slug: string };
}

async function getServiceData(slug: string): Promise<ClientServiceData | null> {
  try {
    const servRef = adminDb.collection('adminServices');
    const q = servRef.where('slug', '==', slug).where('isActive', '==', true).limit(1);
    const snapshot = await q.get();
    if (snapshot.empty) return null;

    const serviceDoc = snapshot.docs[0];
    const serviceDocData = serviceDoc.data() as FirestoreService | undefined;
    if (!serviceDocData) return null; 

    const serviceId = serviceDoc.id;

    let parentCategoryName: string | undefined;
    let parentCategorySlug: string | undefined;
    let parentCategoryId: string | undefined;

    if (serviceDocData.subCategoryId) {
        const subCatDocRef = adminDb.collection("adminSubCategories").doc(serviceDocData.subCategoryId);
        const subCatDoc = await subCatDocRef.get();
        if (subCatDoc.exists) {
            const subCategory = subCatDoc.data() as FirestoreSubCategory | undefined;
            if (subCategory && subCategory.isActive) { 
                if (subCategory.parentId) {
                    parentCategoryId = subCategory.parentId;
                    const catDocRef = adminDb.collection("adminCategories").doc(subCategory.parentId);
                    const catDoc = await catDocRef.get();
                    if (catDoc.exists) {
                        const category = catDoc.data() as FirestoreCategory | undefined;
                        if (category && category.isActive) { 
                            parentCategoryName = category.name;
                            parentCategorySlug = category.slug;
                        } else {
                            return null;
                        }
                    }
                }
            } else {
                 return null;
            }
        }
    }

    const clientData: ClientServiceData = {
      ...serviceDocData, 
      id: serviceId, 
      parentCategoryName,
      parentCategorySlug,
      parentCategoryId,
      taskTimeValue: serviceDocData.taskTimeValue,
      taskTimeUnit: serviceDocData.taskTimeUnit,
      includedItems: serviceDocData.includedItems,
      excludedItems: serviceDocData.excludedItems,
      allowPayLater: serviceDocData.allowPayLater,
      serviceFaqs: serviceDocData.serviceFaqs,
    };
    
    if (serviceDocData.createdAt && serviceDocData.createdAt instanceof Timestamp) {
      clientData.createdAt = serviceDocData.createdAt.toDate().toISOString();
    } else if (serviceDocData.createdAt) {
      clientData.createdAt = String(serviceDocData.createdAt);
    }

    if (serviceDocData.updatedAt && serviceDocData.updatedAt instanceof Timestamp) {
      clientData.updatedAt = serviceDocData.updatedAt.toDate().toISOString();
    } else if (serviceDocData.updatedAt) {
      clientData.updatedAt = String(serviceDocData.updatedAt);
    }

    return clientData;

  } catch (error) {
    console.error('Error fetching service data for page component:', error);
    return null;
  }
}

export async function generateMetadata(
  { params }: ServicePageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const serviceData = await getServiceData(slug);
  
  if (!serviceData) return {};

  const seoSettings = await getGlobalSEOSettings();
  const appBaseUrl = getBaseUrl();
  const placeholderData = { serviceName: serviceData.name, categoryName: serviceData.parentCategoryName };

  const title = replacePlaceholders(serviceData.metaTitle || seoSettings.servicePageTitlePattern, placeholderData) || `${serviceData.name} | FixBro`;
  const description = replacePlaceholders(serviceData.metaDescription || seoSettings.servicePageDescriptionPattern, placeholderData) || `Book ${serviceData.name} with FixBro. Trusted professionals and reliable service.`;
  const keywords = replacePlaceholders(serviceData.metaKeywords || seoSettings.servicePageKeywordsPattern, placeholderData).split(',').map(k => k.trim()).filter(k => k);

  const ogImage = serviceData.imageUrl || seoSettings.structuredDataImage || `${appBaseUrl}/default-image.png`;

  return {
    title: title,
    description: description,
    keywords: keywords.length > 0 ? keywords : undefined,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${appBaseUrl}/service/${slug}`,
    },
    openGraph: {
      title: title,
      description: description,
      url: `/service/${slug}`,
      images: [{ url: ogImage }],
      type: 'website',
    },
  };
}

export async function generateStaticParams() {
  try {
    const servicesSnapshot = await adminDb.collection('adminServices').where('isActive', '==', true).get();
    return servicesSnapshot.docs
      .map(doc => ({ slug: (doc.data() as FirestoreService).slug }))
      .filter(p => p.slug); 
  } catch (error) {
    console.error("[ServicePage] Error generating static params:", error);
    return []; 
  }
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params;
  const serviceData = await getServiceData(slug);

  if (!serviceData) {
    return (
      <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
        Service not found.
      </div>
    );
  }

  const appBaseUrl = getBaseUrl();
  
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": serviceData.name,
    "description": serviceData.description,
    "image": serviceData.imageUrl || `${appBaseUrl}/android-chrome-512x512.png`,
    "provider": {
      "@type": "LocalBusiness",
      "name": "FixBro",
      "image": `${appBaseUrl}/android-chrome-512x512.png`,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "#44, G S Palya Road, Electronic City Phase 2",
        "addressLocality": "Bangalore",
        "postalCode": "560100",
        "addressCountry": "IN"
      }
    },
    "areaServed": {
      "@type": "City",
      "name": "Bangalore"
    }
  };

  if (serviceData.rating > 0 && serviceData.reviewCount) {
    (serviceSchema as any).aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": serviceData.rating.toFixed(1),
      "reviewCount": serviceData.reviewCount,
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  const h1Title = serviceData.h1_title || serviceData.name;

  return (
    <>
      <JsonLdScript data={serviceSchema} idSuffix={`service-${serviceData.id}`} />
      <ServiceDetailPageClient serviceSlug={slug} initialServiceData={serviceData} initialH1Title={h1Title} />
    </>
  );
}
