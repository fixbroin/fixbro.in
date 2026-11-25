
"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Briefcase, ReceiptText, Menu, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/contexts/LoadingContext';
import { useSidebar } from '@/components/ui/sidebar';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from '@/lib/mysqlDb';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import type { ElementType } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
  isProtected: boolean;
  isButton?: boolean;
}

const ProviderBottomNavigationBar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, triggerAuthRedirect } = useAuth();
  const { showLoading } = useLoading();
  const { setOpenMobile } = useSidebar(); // Get the function to open the mobile sidebar

  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || "₹";
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    if (!user?.uid) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWalletBalance(data?.providerWalletBalance || 0);
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const navItems: NavItem[] = [
    { href: '/provider', label: 'Dashboard', icon: LayoutDashboard, isProtected: true },
    { href: '/provider/my-jobs', label: 'My Jobs', icon: Briefcase, isProtected: true },
    { href: '/provider/quotation-invoice', label: 'Billing', icon: ReceiptText, isProtected: true },
    { href: '/provider/wallet', label: `${symbol}${walletBalance.toFixed(appConfig?.currencyDecimalPoints !== undefined ? Number(appConfig.currencyDecimalPoints) : 2)}`, icon: Wallet, isProtected: true },
    { href: '#', label: 'More', icon: Menu, isProtected: false, isButton: true },
  ];

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, item: NavItem) => {
    e.preventDefault();

    if (item.isButton) {
      setOpenMobile(true); // Open the sidebar sheet
      return;
    }
    
    if (pathname !== item.href) {
      showLoading();
    }
    if (item.isProtected && !user) {
      triggerAuthRedirect(item.href);
    } else {
      router.push(item.href);
    }
  };

  return (
    <nav className="apple-glass-bar fixed bottom-0 left-0 right-0 md:hidden z-40 pb-safe">
      <div className="container mx-auto flex justify-around items-center h-16 px-2 gap-1">
        {navItems.map((item) => {
          const isActive = !item.isButton && pathname === item.href;
          const IconComponent = item.icon;
          const tabClasses = cn(
            "apple-glass-btn relative flex flex-col items-center justify-center flex-1 h-[54px] rounded-2xl select-none text-[10px]",
            isActive
              ? "apple-glass-btn-active text-primary font-bold"
              : "text-muted-foreground font-semibold border border-transparent hover:bg-white/30 dark:hover:bg-white/5"
          );

          const indicator = (
            <span
              className={cn(
                "absolute -top-[5px] left-1/2 -translate-x-1/2 h-[3px] rounded-b-full bg-primary transition-all duration-300",
                isActive
                  ? "w-8 opacity-100 shadow-[0_2px_8px_hsl(var(--primary)/0.65)]"
                  : "w-0 opacity-0"
              )}
            />
          );
          
          if (item.isButton) {
              return (
                 <button
                    key={item.label}
                    onClick={(e) => handleNav(e, item)}
                    onTouchStart={() => {}}
                    className={tabClasses}
                    >
                    {indicator}
                    <div className="p-1 rounded-xl">
                      <IconComponent className="h-5 w-5" strokeWidth={1.9} />
                    </div>
                    <span className="mt-0.5 leading-none">{item.label}</span>
                </button>
              )
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={(e) => handleNav(e, item)}
              onTouchStart={() => {}}
              className={tabClasses}
            >
              {indicator}
              <div className={cn("p-1 rounded-xl transition-transform duration-300", isActive ? "scale-110" : "")}>
                <IconComponent className={cn("h-5 w-5", isActive ? "text-primary" : "")} strokeWidth={isActive ? 2.4 : 1.9} />
              </div>
              <span className="mt-0.5 leading-none truncate max-w-full px-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default ProviderBottomNavigationBar;
