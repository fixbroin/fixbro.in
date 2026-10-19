'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Armchair,
  Home,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface MarketplaceImageCarouselProps {
  photos: string[];
  alt: string;
  type?: 'furniture' | 'rental';
  aspectRatio?: string; // e.g. "aspect-[4/3]"
  className?: string;
  badge?: React.ReactNode;
  topRightBadge?: React.ReactNode;
  showFullscreenButton?: boolean;
  onImageClick?: (index: number) => void;
  onIndexChange?: (index: number) => void;
  clickOpensFullscreen?: boolean;
  initialIndex?: number;
}

export default function MarketplaceImageCarousel({
  photos = [],
  alt,
  type = 'furniture',
  aspectRatio = 'aspect-[4/3]',
  className = '',
  badge,
  topRightBadge,
  showFullscreenButton = true,
  onImageClick,
  onIndexChange,
  clickOpensFullscreen = false,
  initialIndex = 0,
}: MarketplaceImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync if initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const updateIndex = (newIndex: number) => {
    setCurrentIndex(newIndex);
    if (onIndexChange) {
      onIndexChange(newIndex);
    }
  };

  const validPhotos = Array.isArray(photos) ? photos.filter((p) => Boolean(p && typeof p === 'string')) : [];
  const total = validPhotos.length;
  const currentPhoto = total > 0 ? validPhotos[currentIndex] || validPhotos[0] : null;

  // Touch swipe support (Mobile)
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const wasDragged = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    wasDragged.current = false;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    // Only swipe if mostly horizontal
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 25) {
      wasDragged.current = true;
      if (diffX > 0 && currentIndex < total - 1) {
        goToNext();
      } else if (diffX < 0 && currentIndex > 0) {
        goToPrev();
      }
    }
  };

  // Mouse drag support (Desktop)
  const mouseStartX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    wasDragged.current = false;
    mouseStartX.current = e.clientX;
    isDragging.current = true;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = mouseStartX.current - e.clientX;
    if (Math.abs(diff) > 20) {
      wasDragged.current = true;
    }
    if (Math.abs(diff) > 35) {
      if (diff > 0 && currentIndex < total - 1) {
        goToNext();
      } else if (diff < 0 && currentIndex > 0) {
        goToPrev();
      }
    }
  };

  const goToPrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    updateIndex(Math.max(0, currentIndex - 1));
  };

  const goToNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    updateIndex(Math.min(total - 1, currentIndex + 1));
  };

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen(true);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    if (onImageClick) {
      onImageClick(currentIndex);
    } else if (clickOpensFullscreen && currentPhoto) {
      setIsFullscreen(true);
    }
  };

  // Keyboard navigation for fullscreen lightbox
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentIndex < total - 1) {
        updateIndex(Math.min(total - 1, currentIndex + 1));
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        updateIndex(Math.max(0, currentIndex - 1));
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, currentIndex, total]);

  return (
    <>
      <div
        className={`relative overflow-hidden bg-gray-100 dark:bg-muted select-none group ${aspectRatio} ${className}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleContainerClick}
      >
        {/* Main Photo Display */}
        {currentPhoto ? (
          <img
            src={currentPhoto}
            alt={`${alt} - photo ${currentIndex + 1}`}
            className="w-full h-full object-cover transition-transform duration-300 pointer-events-none"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            {type === 'furniture' ? (
              <Armchair className="h-12 w-12 stroke-1" />
            ) : (
              <Home className="h-12 w-12 stroke-1" />
            )}
            <span className="text-[11px] mt-1 text-muted-foreground">No Photos</span>
          </div>
        )}

        {/* Badges Overlay */}
        {badge && <div className="absolute top-2.5 left-2.5 z-10 pointer-events-auto">{badge}</div>}
        {topRightBadge && <div className="absolute top-2.5 right-2.5 z-10 pointer-events-auto">{topRightBadge}</div>}

        {/* Directional Arrows:
            - Left arrow visible ONLY if images exist on left (currentIndex > 0)
            - Right arrow visible ONLY if images exist on right (currentIndex < total - 1)
        */}
        {total > 1 && currentIndex > 0 && (
          <button
            type="button"
            aria-label="Previous image"
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
          </button>
        )}

        {total > 1 && currentIndex < total - 1 && (
          <button
            type="button"
            aria-label="Next image"
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <ChevronRight className="h-5 w-5 stroke-[2.5]" />
          </button>
        )}

        {/* Controls Bar at Bottom */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-none">
          {/* Photos Counter / Dots */}
          {total > 1 ? (
            <div className="flex items-center gap-1.5 bg-black/65 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm pointer-events-auto">
              <span>{currentIndex + 1}</span>
              <span className="opacity-60">/</span>
              <span>{total}</span>
            </div>
          ) : (
            <div />
          )}

          {/* Full Screen Button at Bottom Right */}
          {showFullscreenButton && currentPhoto && (
            <button
              type="button"
              aria-label="View Full Screen Image"
              title="Full screen view"
              onClick={openFullscreen}
              className="p-1.5 rounded-lg bg-black/65 hover:bg-black/90 text-white backdrop-blur-sm shadow-md transition-all active:scale-90 pointer-events-auto flex items-center justify-center cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Full Screen Lightbox Modal */}
      {isFullscreen && currentPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-between p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Top Bar with Title, Counter and Close Button */}
          <div
            className="flex items-center justify-between text-white z-10 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base font-bold truncate max-w-[200px] sm:max-w-md">
                {alt}
              </span>
              {total > 1 && (
                <span className="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  {currentIndex + 1} / {total}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer"
              title="Close Full Screen (Esc)"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Center Image Container with Directional Arrows */}
          <div
            className="relative flex-1 flex items-center justify-center min-h-0 my-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left arrow if previous image is available */}
            {total > 1 && currentIndex > 0 && (
              <button
                type="button"
                onClick={goToPrev}
                aria-label="Previous photo"
                className="absolute left-2 sm:left-4 z-20 w-11 h-11 rounded-full bg-black/70 hover:bg-white/30 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
              >
                <ChevronLeft className="h-6 w-6 stroke-[3]" />
              </button>
            )}

            <img
              src={currentPhoto}
              alt={`${alt} - Fullscreen ${currentIndex + 1}`}
              className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none"
            />

            {/* Right arrow if next image is available */}
            {total > 1 && currentIndex < total - 1 && (
              <button
                type="button"
                onClick={goToNext}
                aria-label="Next photo"
                className="absolute right-2 sm:right-4 z-20 w-11 h-11 rounded-full bg-black/70 hover:bg-white/30 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
              >
                <ChevronRight className="h-6 w-6 stroke-[3]" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {total > 1 && (
            <div
              className="flex items-center justify-center gap-2 overflow-x-auto py-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {validPhotos.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => updateIndex(idx)}
                  className={`w-14 h-10 sm:w-16 sm:h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    currentIndex === idx
                      ? 'border-primary ring-2 ring-primary/50 opacity-100 scale-105'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
