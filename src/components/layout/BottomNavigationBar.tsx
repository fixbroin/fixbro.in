"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Layers, Briefcase, UserCircle as UserIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/contexts/LoadingContext';
import { useMarketplaceSettings } from '@/hooks/useMarketplaceSettings';
import type { ElementType } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
  isProtected: boolean;
}

const BottomNavigationBar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, triggerAuthRedirect } = useAuth();
  const { showLoading } = useLoading();
  const { settings } = useMarketplaceSettings();

  const showSellButton = settings.showMarketplaceOnHomeServices !== false;

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    e.preventDefault();
    if (pathname !== item.href) {
      showLoading();
    }
    if (item.isProtected && !user) {
      triggerAuthRedirect(item.href);
    } else {
      router.push(item.href);
    }
  };

  const renderTab = (item: NavItem) => {
    const isActive = pathname === item.href;
    const IconComponent = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={(e) => handleNav(e, item)}
        onTouchStart={() => {}}
        className={cn(
          "apple-glass-btn relative flex flex-col items-center justify-center flex-1 max-w-[76px] h-[54px] rounded-2xl select-none",
          isActive
            ? "apple-glass-btn-active text-primary"
            : "text-muted-foreground border border-transparent hover:bg-white/30 dark:hover:bg-white/5"
        )}
      >
        {/* Top Active Indicator Line (Amazon / Flipkart style) */}
        <span
          className={cn(
            "absolute -top-[5px] left-1/2 -translate-x-1/2 h-[3px] rounded-b-full bg-primary transition-all duration-300",
            isActive
              ? "w-8 opacity-100 shadow-[0_2px_8px_hsl(var(--primary)/0.65)]"
              : "w-0 opacity-0"
          )}
        />

        <div className={cn("p-1 rounded-xl transition-transform duration-300", isActive ? "scale-110" : "")}>
          <IconComponent className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.9} />
        </div>
        <span
          className={cn(
            "text-[10px] tracking-tight leading-none mt-0.5 transition-all",
            isActive ? "font-bold opacity-100" : "font-semibold opacity-80"
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav className="apple-glass-bar fixed bottom-0 left-0 right-0 md:hidden z-40 pb-safe">
      <div className="container mx-auto flex justify-around items-center h-16 px-2 gap-1">
        {renderTab({ href: '/', label: 'Home', icon: Home, isProtected: false })}
        {renderTab({ href: '/categories', label: 'Categories', icon: Layers, isProtected: true })}

        {/* Central Elevated SELL Glass Button */}
        {showSellButton && (
          <Link
            href="/furniture"
            onClick={() => {
              if (pathname !== '/furniture') showLoading();
            }}
            onTouchStart={() => {}}
            className="apple-glass-btn flex flex-col items-center justify-center min-w-[56px] -mt-5 group select-none"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary via-primary to-blue-500 text-white shadow-[0_8px_20px_hsl(var(--primary)/0.45),inset_0_1.5px_2px_rgba(255,255,255,0.65)] ring-4 ring-white/80 dark:ring-zinc-900/80 backdrop-blur-md group-hover:scale-105 active:scale-95 transition-all flex items-center justify-center focus:outline-none">
              <Plus className="h-6 w-6 stroke-[2.8]" />
            </div>
            <span className="text-[10px] font-bold text-primary mt-1 tracking-tight uppercase">
              Sell
            </span>
          </Link>
        )}

        {renderTab({ href: '/my-bookings', label: 'Bookings', icon: Briefcase, isProtected: true })}
        {renderTab({ href: '/account', label: 'Profile', icon: UserIcon, isProtected: true })}
      </div>
    </nav>
  );
};

export default BottomNavigationBar;
