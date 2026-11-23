"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { MapPin, Search, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Area {
  id: string;
  name: string;
  slug: string;
}

interface ServiceLocalitiesInterlinkingProps {
  serviceName: string;
  serviceSlug: string;
  citySlug?: string;
  cityName?: string;
  areas?: Area[];
  currentAreaSlug?: string;
}

// Top Bangalore commercial and residential hubs sorted by search demand
const TOP_BANGALORE_AREAS = [
  'whitefield', 'hsr-layout', 'koramangala', 'indiranagar', 'bellandur',
  'marathahalli', 'electronic-city', 'sarjapur-road', 'btm-layout', 'jayanagar',
  'jp-nagar', 'banashankari', 'malleshwaram', 'hebbal', 'yelahanka',
  'thanisandra', 'bannerghatta-road', 'cv-raman-nagar', 'kadugodi', 'hoodi',
  'mahadevapura', 'domlur', 'rajajinagar', 'frazer-town', 'rt-nagar',
  'kalyan-nagar', 'vijayanagar', 'basavanagudi', 'richmond-town', 'sadashivanagar'
];

export default function ServiceLocalitiesInterlinking({
  serviceName,
  serviceSlug,
  citySlug = "bangalore",
  cityName = "Bangalore",
  areas = [],
  currentAreaSlug
}: ServiceLocalitiesInterlinkingProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  if (!areas || areas.length === 0) return null;

  const sortedAreas = useMemo(() => {
    const priorityMap = new Map(TOP_BANGALORE_AREAS.map((slug, idx) => [slug, idx]));
    // Deduplicate areas by slug so duplicates in database (like Whitefield) never appear twice
    const uniqueMap = new Map<string, Area>();
    for (const a of areas) {
      if (a.slug && a.slug !== currentAreaSlug && !uniqueMap.has(a.slug)) {
        uniqueMap.set(a.slug, a);
      }
    }
    const filtered = Array.from(uniqueMap.values());
    return filtered.sort((a, b) => {
      const pA = priorityMap.has(a.slug) ? priorityMap.get(a.slug)! : 9999;
      const pB = priorityMap.has(b.slug) ? priorityMap.get(b.slug)! : 9999;
      if (pA !== pB) return pA - pB;
      return a.name.localeCompare(b.name);
    });
  }, [areas, currentAreaSlug]);

  const visibleAreas = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return sortedAreas.filter(a => a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q));
    }
    return isExpanded ? sortedAreas : sortedAreas.slice(0, 36);
  }, [sortedAreas, searchQuery, isExpanded]);

  const headingText = currentAreaSlug 
    ? `${serviceName} in Other Localities of ${cityName}` 
    : `Book ${serviceName} Across Bangalore Localities`;

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-headline font-bold text-foreground">
              {headingText}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Available with same-day doorstep booking across all major Bangalore zones
            </p>
          </div>
        </div>

        {sortedAreas.length > 20 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Find your area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-card border-border/80 focus-visible:ring-primary/20"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 md:gap-2.5">
        {visibleAreas.map((area) => (
          <Link
            key={area.id}
            href={`/${citySlug}/${area.slug}/service/${serviceSlug}`}
            className="group"
          >
            <Badge
              variant="outline"
              className="px-3 py-1.5 text-xs sm:text-sm font-medium hover:border-primary hover:text-primary transition-all cursor-pointer bg-card border-border/70 group-hover:bg-primary/5 flex items-center gap-1.5"
            >
              <MapPin className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>{serviceName} in {area.name}</span>
            </Badge>
          </Link>
        ))}
      </div>

      {!searchQuery && sortedAreas.length > 36 && (
        <div className="mt-4 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 py-1.5 px-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            {isExpanded ? (
              <>Show Less <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>View All {sortedAreas.length} Areas in {cityName} <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>FixBro certified technicians reach your doorstep within 30-45 minutes anywhere in {cityName}. Upfront fixed rates and warranty included.</span>
      </div>
    </div>
  );
}
