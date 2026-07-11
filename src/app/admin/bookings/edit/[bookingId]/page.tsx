
// This is now a Server Component wrapper
import EditBookingPageClient from './EditBookingPageClient';

// For output: 'export', this tells Next.js not to pre-render any specific booking IDs
// The actual page content will be client-side rendered.
export async function generateStaticParams(): Promise<{ bookingId: string }[]> {
  return [];
}

interface PageProps {
  params: Promise<{ bookingId: string }>;
}

// No data fetching here, client component handles it
export default async function Page({ params }: PageProps) {
  const { bookingId } = await params;
  return <EditBookingPageClient bookingId={bookingId} />;
}
