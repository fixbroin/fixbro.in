import { adminDb } from '@/lib/firebaseAdmin';
import type { FirestoreCategory, FirestoreCity, FirestoreArea, FirestoreService, FirestoreSubCategory, FirestoreBlogPost, ContentPage } from '@/types/firestore';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export const dynamic = 'force-dynamic';

interface SitemapData {
  pages: Array<{ name: string; url: string }>;
  cities: FirestoreCity[];
  cityCategories: Array<{ city: FirestoreCity; categories: FirestoreCategory[] }>;
  areaCategories: Array<{ city: FirestoreCity; areas: Array<{ area: FirestoreArea; categories: FirestoreCategory[] }> }>;
  globalCategories: FirestoreCategory[];
  servicesByCategory: Array<{ category: FirestoreCategory; subCategories: Array<{ subCategory: FirestoreSubCategory; services: FirestoreService[] }> }>;
  blogs: FirestoreBlogPost[];
}

async function getSitemapData(): Promise<SitemapData> {
  // Static Pages
  const staticPages = [
    { name: 'Home', url: '/' },
    { name: 'About Us', url: '/about-us' },
    { name: 'Contact Us', url: '/contact-us' },
    { name: 'All Categories', url: '/categories' },
    { name: 'FAQ', url: '/faq' },
    { name: 'Blog', url: '/blog' },
    { name: 'Login', url: '/auth/login' },
    { name: 'Sign Up', url: '/auth/signup' },
    { name: 'Join as a Provider', url: '/provider-registration' },
    { name: 'Damage & Claims Policy', url: '/damage-and-claims-policy' },
  ];
  
  const contentPagesSnap = await adminDb.collection('contentPages').get();
  const dynamicContentPages = contentPagesSnap.docs.map(doc => {
      const data = doc.data() as ContentPage;
      return { name: data.title, url: `/${data.slug}`};
  }).filter(page => !staticPages.some(p => p.url === page.url));


  // Fetch all data in parallel
  const [
    citiesSnap,
    categoriesSnap,
    subCategoriesSnap,
    servicesSnap,
    blogsSnap
  ] = await Promise.all([
    adminDb.collection('cities').where('isActive', '==', true).orderBy('name').get(),
    adminDb.collection('adminCategories').orderBy('order').get(),
    adminDb.collection('adminSubCategories').orderBy('name').get(),
    adminDb.collection('adminServices').where('isActive', '==', true).orderBy('name').get(),
    adminDb.collection('blogPosts').where('isPublished', '==', true).orderBy('createdAt', 'desc').get()
  ]);

  const cities = citiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreCity));
  const categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreCategory));
  const subCategories = subCategoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreSubCategory));
  const services = servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreService));
  const blogs = blogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreBlogPost));
  
  // Group City-wise Categories
  const cityCategories = cities.map(city => ({
    city,
    categories,
  }));
  
  // Group Area-wise Categories
  const areaCategoriesPromises = cities.map(async (city) => {
    const areasSnap = await adminDb.collection('areas').where('cityId', '==', city.id).where('isActive', '==', true).orderBy('name').get();
    const areas = areasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreArea));
    return {
      city,
      areas: areas.map(area => ({ area, categories })),
    };
  });
  const areaCategories = await Promise.all(areaCategoriesPromises);

  // Group Services by Category -> SubCategory
  const servicesByCategory = categories.map(category => {
    const relevantSubCats = subCategories.filter(sc => sc.parentId === category.id);
    const subCategoriesWithServices = relevantSubCats.map(subCategory => ({
      subCategory,
      services: services.filter(s => s.subCategoryId === subCategory.id)
    })).filter(sc => sc.services.length > 0);
    return { category, subCategories: subCategoriesWithServices };
  }).filter(cat => cat.subCategories.length > 0);

  return {
    pages: [...staticPages, ...dynamicContentPages],
    cities,
    cityCategories,
    areaCategories,
    globalCategories: categories,
    servicesByCategory,
    blogs,
  };
}


export default async function SitemapPage() {
  const data = await getSitemapData();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground mb-8">Sitemap</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Section 1: All Main Pages */}
        <section>
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Pages</h2>
          <ul className="space-y-2 text-sm">
            {data.pages.map(page => (
              <li key={page.url}><Link href={page.url} className="text-muted-foreground hover:text-primary">{page.name}</Link></li>
            ))}
          </ul>
        </section>

        {/* Section 2: City-wise Home Pages */}
        <section>
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Cities</h2>
          <ul className="space-y-2 text-sm">
            {data.cities.map(city => (
              <li key={city.id}><Link href={`/${city.slug}`} className="text-muted-foreground hover:text-primary">{city.name}</Link></li>
            ))}
          </ul>
        </section>
        
        {/* Section 5: All Categories */}
        <section>
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Categories</h2>
          <ul className="space-y-2 text-sm">
            {data.globalCategories.map(cat => (
              <li key={cat.id}><Link href={`/category/${cat.slug}`} className="text-muted-foreground hover:text-primary">{cat.name}</Link></li>
            ))}
          </ul>
        </section>
      </div>

      <Separator className="my-8" />
      
      {/* Section 3: City-wise Categories */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Cities by Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.cityCategories.map(({ city, categories }) => (
            <div key={city.id}>
              <h3 className="font-medium text-foreground mb-2">{city.name}</h3>
              <ul className="space-y-1.5 text-sm pl-2 border-l">
                {categories.map(cat => (
                  <li key={`${city.id}-${cat.id}`}><Link href={`/${city.slug}/category/${cat.slug}`} className="text-muted-foreground hover:text-primary">{cat.name}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Section 4: Area-wise Categories */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Areas by Category</h2>
        <div className="space-y-6">
          {data.areaCategories.map(({ city, areas }) => (
            <div key={city.id}>
              <h3 className="text-lg font-medium text-foreground">{city.name}</h3>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                {areas.map(({ area, categories }) => (
                  <div key={area.id}>
                    <h4 className="font-semibold text-foreground/80 mb-1">{area.name}</h4>
                    <ul className="space-y-1 text-sm pl-2 border-l">
                      {categories.map(cat => (
                        <li key={`${area.id}-${cat.id}`}><Link href={`/${city.slug}/${area.slug}/${cat.slug}`} className="text-muted-foreground hover:text-primary">{cat.name}</Link></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      
      <Separator className="my-8" />

      {/* Section 6: All Services by Category */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Services by Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.servicesByCategory.map(({ category, subCategories }) => (
            <div key={category.id}>
              <h3 className="font-medium text-foreground mb-2">{category.name}</h3>
              <ul className="space-y-3 text-sm pl-2 border-l">
                {subCategories.map(({ subCategory, services }) => (
                    <li key={subCategory.id}>
                        <p className="font-semibold text-foreground/80 text-xs">{subCategory.name}</p>
                        <ul className="pl-2 space-y-1 mt-1">
                            {services.map(service => (
                                <li key={service.id}>
                                    <Link href={`/service/${service.slug}`} className="text-muted-foreground hover:text-primary text-xs">{service.name}</Link>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Section 7: All Blog Pages */}
      <section>
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Blogs</h2>
        <ul className="space-y-2 text-sm columns-1 sm:columns-2 md:columns-3 lg:columns-4">
          {data.blogs.map(blog => (
            <li key={blog.id} className="break-inside-avoid">
              <Link href={`/blog/${blog.slug}`} className="text-muted-foreground hover:text-primary">{blog.title}</Link>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
