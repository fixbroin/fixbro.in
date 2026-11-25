"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Armchair,
  Home,
  Plus,
  FileText,
  Wrench,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface MarketplaceBottomNavProps {
  activeTab?: 'furniture' | 'rentals' | 'my-posts' | 'services';
}

export default function MarketplaceBottomNav({
  activeTab,
}: MarketplaceBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [isPostChooserOpen, setIsPostChooserOpen] = useState(false);

  const currentTab =
    activeTab ||
    (pathname.startsWith('/furniture')
      ? 'furniture'
      : pathname.startsWith('/rent-home')
      ? 'rentals'
      : pathname.startsWith('/marketplace/my-posts')
      ? 'my-posts'
      : 'furniture');

  return (
    <>
      <div className="apple-glass-bar fixed bottom-0 left-0 right-0 z-40 md:hidden pb-safe">
        <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-around gap-1 relative">
          {/* Furniture */}
          <Link
            href="/furniture"
            onTouchStart={() => {}}
            className={`apple-glass-btn relative flex flex-col items-center justify-center flex-1 h-[54px] rounded-2xl select-none ${
              currentTab === 'furniture'
                ? 'apple-glass-btn-active text-primary font-bold'
                : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-white/30 dark:hover:bg-white/5'
            }`}
          >
            <span
              className={`absolute -top-[5px] left-1/2 -translate-x-1/2 h-[3px] rounded-b-full bg-primary transition-all duration-300 ${
                currentTab === 'furniture'
                  ? 'w-8 opacity-100 shadow-[0_2px_8px_hsl(var(--primary)/0.65)]'
                  : 'w-0 opacity-0'
              }`}
            />
            <div className={`p-1 rounded-xl transition-transform duration-300 ${currentTab === 'furniture' ? 'scale-110' : ''}`}>
              <Armchair className="h-5 w-5" strokeWidth={currentTab === 'furniture' ? 2.4 : 1.9} />
            </div>
            <span className="text-[10px] leading-none mt-0.5">Furniture</span>
          </Link>

          {/* Rent Home */}
          <Link
            href="/rent-home"
            onTouchStart={() => {}}
            className={`apple-glass-btn relative flex flex-col items-center justify-center flex-1 h-[54px] rounded-2xl select-none ${
              currentTab === 'rentals'
                ? 'apple-glass-btn-active text-primary font-bold'
                : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-white/30 dark:hover:bg-white/5'
            }`}
          >
            <span
              className={`absolute -top-[5px] left-1/2 -translate-x-1/2 h-[3px] rounded-b-full bg-primary transition-all duration-300 ${
                currentTab === 'rentals'
                  ? 'w-8 opacity-100 shadow-[0_2px_8px_hsl(var(--primary)/0.65)]'
                  : 'w-0 opacity-0'
              }`}
            />
            <div className={`p-1 rounded-xl transition-transform duration-300 ${currentTab === 'rentals' ? 'scale-110' : ''}`}>
              <Home className="h-5 w-5" strokeWidth={currentTab === 'rentals' ? 2.4 : 1.9} />
            </div>
            <span className="text-[10px] leading-none mt-0.5">Rent Home</span>
          </Link>

          {/* Central Elevated Post (+) Glass Button */}
          <div className="flex flex-col items-center justify-center min-w-[56px] -mt-5">
            <button
              type="button"
              onTouchStart={() => {}}
              onClick={() => {
                if (!user) {
                  router.push('/auth/login?redirect=/furniture/post');
                  return;
                }
                setIsPostChooserOpen(true);
              }}
              className="apple-glass-btn w-12 h-12 rounded-full bg-gradient-to-tr from-primary via-primary to-blue-500 text-white shadow-[0_8px_20px_hsl(var(--primary)/0.45),inset_0_1.5px_2px_rgba(255,255,255,0.65)] ring-4 ring-white/80 dark:ring-zinc-900/80 backdrop-blur-md hover:scale-105 transition-all flex items-center justify-center focus:outline-none"
              aria-label="Post Free Ad"
            >
              <Plus className="h-6 w-6 stroke-[2.8]" />
            </button>
            <span className="text-[10px] font-bold text-primary mt-1">Post (+)</span>
          </div>

          {/* My Posts */}
          <button
            type="button"
            onTouchStart={() => {}}
            onClick={() => {
              if (!user) {
                router.push('/auth/login?redirect=/marketplace/my-posts');
                return;
              }
              router.push('/marketplace/my-posts');
            }}
            className={`apple-glass-btn relative flex flex-col items-center justify-center flex-1 h-[54px] rounded-2xl select-none ${
              currentTab === 'my-posts'
                ? 'apple-glass-btn-active text-primary font-bold'
                : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-white/30 dark:hover:bg-white/5'
            }`}
          >
            <span
              className={`absolute -top-[5px] left-1/2 -translate-x-1/2 h-[3px] rounded-b-full bg-primary transition-all duration-300 ${
                currentTab === 'my-posts'
                  ? 'w-8 opacity-100 shadow-[0_2px_8px_hsl(var(--primary)/0.65)]'
                  : 'w-0 opacity-0'
              }`}
            />
            <div className={`p-1 rounded-xl transition-transform duration-300 ${currentTab === 'my-posts' ? 'scale-110' : ''}`}>
              <FileText className="h-5 w-5" strokeWidth={currentTab === 'my-posts' ? 2.4 : 1.9} />
            </div>
            <span className="text-[10px] leading-none mt-0.5">My Posts</span>
          </button>

          {/* Home Services */}
          <Link
            href="/"
            onTouchStart={() => {}}
            className="apple-glass-btn relative flex flex-col items-center justify-center flex-1 h-[54px] rounded-2xl select-none text-gray-500 dark:text-gray-400 border border-transparent hover:bg-white/30 dark:hover:bg-white/5"
          >
            <div className="p-1 rounded-xl">
              <Wrench className="h-5 w-5" strokeWidth={1.9} />
            </div>
            <span className="text-[10px] leading-none mt-0.5">Services</span>
          </Link>
        </div>
      </div>

      {/* Post Category Chooser Modal for Mobile */}
      <Dialog open={isPostChooserOpen} onOpenChange={setIsPostChooserOpen}>
        <DialogContent className="max-w-sm w-[92vw] p-5 rounded-3xl bg-white dark:bg-card">
          <DialogHeader className="text-center space-y-1.5">
            <div className="mx-auto p-2.5 bg-primary/10 rounded-2xl text-primary w-fit">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
              What do you want to post?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              FixBro Marketplace is 100% free with direct phone connections.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2.5 pt-2">
            <Link
              href="/furniture/post"
              onClick={() => setIsPostChooserOpen(false)}
              className="p-3.5 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5 flex items-center gap-3.5 transition-all"
            >
              <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-xl shrink-0">
                <Armchair className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-gray-900 dark:text-white">
                  Sell Furniture
                </p>
                <p className="text-[11px] text-gray-500">
                  Used or brand new sofas, beds, tables & more
                </p>
              </div>
            </Link>

            <Link
              href="/rent-home/post"
              onClick={() => setIsPostChooserOpen(false)}
              className="p-3.5 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5 flex items-center gap-3.5 transition-all"
            >
              <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-xl shrink-0">
                <Home className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-gray-900 dark:text-white">
                  Post Rental Property
                </p>
                <p className="text-[11px] text-gray-500">
                  Flats, 1RK, 1/2/3 BHK, rooms, or houses for rent
                </p>
              </div>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
