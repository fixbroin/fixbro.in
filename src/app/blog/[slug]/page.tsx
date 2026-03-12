import { adminDb } from '@/lib/firebaseAdmin';
import { notFound } from 'next/navigation';
import type { FirestoreBlogPost } from '@/types/firestore';
import AppImage from '@/components/ui/AppImage';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, User, Clock, Share2, Facebook, Twitter, Linkedin, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Timestamp } from 'firebase-admin/firestore';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { getBaseUrl } from '@/lib/config';
import type { Metadata, ResolvingMetadata } from 'next';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';

interface BlogPostPageProps {
  params: { slug: string };
}

async function getBlogPost(slug: string): Promise<FirestoreBlogPost | null> {
  try {
    const blogRef = adminDb.collection('blogPosts');
    const q = blogRef.where('slug', '==', slug).where('isPublished', '==', true).limit(1);
    const snapshot = await q.get();
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FirestoreBlogPost;
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export async function generateMetadata(
  { params }: BlogPostPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  
  if (!post) return {};

  const seoSettings = await getGlobalSEOSettings();
  const appBaseUrl = getBaseUrl();

  const title = post.metaTitle || `${post.title} | FixBro Blog`;
  const description = post.metaDescription || post.excerpt || '';
  
  const ogImage = post.coverImageUrl || seoSettings.structuredDataImage || `${appBaseUrl}/default-image.png`;

  return {
    title: title,
    description: description,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: title,
      description: description,
      url: `/blog/${slug}`,
      images: [{ url: ogImage }],
      type: 'article',
      publishedTime: post.createdAt instanceof Timestamp ? post.createdAt.toDate().toISOString() : undefined,
      modifiedTime: post.updatedAt instanceof Timestamp ? post.updatedAt.toDate().toISOString() : undefined,
      authors: post.authorName ? [post.authorName] : undefined,
    },
  };
}

export async function generateStaticParams() {
  try {
    const blogSnapshot = await adminDb.collection('blogPosts').where('isPublished', '==', true).get();
    return blogSnapshot.docs.map(doc => ({
      slug: (doc.data() as FirestoreBlogPost).slug,
    }));
  } catch (error) {
    console.error("Error generating static params for blog:", error);
    return [];
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const appBaseUrl = getBaseUrl();
  const postUrl = `${appBaseUrl}/blog/${post.slug}`;
  
  const publishDate = post.createdAt instanceof Timestamp ? post.createdAt.toDate() : new Date();
  const formattedDate = format(publishDate, 'MMMM dd, yyyy');

  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "image": post.coverImageUrl || `${appBaseUrl}/default-image.png`,
    "author": {
      "@type": "Person",
      "name": post.authorName || "FixBro Team"
    },
    "publisher": {
      "@type": "Organization",
      "name": "FixBro",
      "logo": {
        "@type": "ImageObject",
        "url": `${appBaseUrl}/android-chrome-512x512.png`
      }
    },
    "datePublished": publishDate.toISOString(),
    "description": post.excerpt || post.metaDescription
  };

  return (
    <article className="min-h-screen pb-20">
      <JsonLdScript data={blogSchema} idSuffix={`blog-${post.id}`} />
      
      {/* Hero Section */}
      <div className="relative w-full h-[40vh] md:h-[60vh] overflow-hidden">
        <AppImage 
          src={post.coverImageUrl} 
          alt={post.title} 
          fill 
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="container mx-auto px-4 text-center text-white">
            <Link href="/blog" className="inline-flex items-center text-sm font-medium mb-6 hover:text-primary-foreground/80 transition-colors">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog
            </Link>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-headline font-bold mb-6 max-w-4xl mx-auto leading-tight">
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm md:text-base font-medium">
              <div className="flex items-center">
                <Calendar className="mr-2 h-4 w-4 text-primary-foreground" /> {formattedDate}
              </div>
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4 text-primary-foreground" /> {post.authorName || "FixBro Team"}
              </div>
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-primary-foreground" /> {post.readingTime || "5 min"} read
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-10 relative z-10">
        <div className="max-w-4xl mx-auto bg-card rounded-2xl shadow-xl overflow-hidden border">
          {/* Content */}
          <div className="p-6 md:p-12 lg:p-16">
            <div 
              className="prose prose-lg dark:prose-invert max-w-none 
                prose-headings:font-headline prose-headings:font-bold 
                prose-p:text-foreground/80 prose-p:leading-relaxed
                prose-img:rounded-xl prose-img:shadow-lg
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
            
            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t flex flex-wrap gap-2">
                {post.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Social Share */}
            <div className="mt-12 pt-8 border-t flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h3 className="text-lg font-headline font-bold flex items-center">
                <Share2 className="mr-2 h-5 w-5 text-primary" /> Share this article
              </h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" className="rounded-full flex items-center gap-2">
                  <Facebook className="h-4 w-4" /> Facebook
                </Button>
                <Button variant="outline" size="sm" className="rounded-full flex items-center gap-2">
                  <Twitter className="h-4 w-4" /> Twitter
                </Button>
                <Button variant="outline" size="sm" className="rounded-full flex items-center gap-2">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </Button>
                <Button variant="outline" size="sm" className="rounded-full flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" /> Copy Link
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
