"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from '@/lib/firebase';
import type { GlobalWebSettings, ThemeColors, ThemePalette, GlobalAdminPopup, LoaderType } from '@/types/firestore';
import { DEFAULT_LIGHT_THEME_COLORS_HSL, DEFAULT_DARK_THEME_COLORS_HSL, THEME_PALETTE_KEYS } from '@/lib/colorUtils';
import { getCache, setCache } from '@/lib/client-cache';
import { usePathname } from 'next/navigation';

const WEB_SETTINGS_DOC_ID = "global";
const WEB_SETTINGS_COLLECTION = "webSettings";
const CACHE_KEY = "global-web-settings";

export const defaultGlobalWebSettings: GlobalWebSettings = {
  websiteName: "FixBro",
  contactEmail: "support@fixbro.in",
  contactMobile: "+917353113455",
  address: "#44 G S Palya Road Konappana Agrahara Electronic City Phase 2 -560100",
  logoUrl: "/android-chrome-512x512.png",
  faviconUrl: "/favicon.ico",
  websiteIconUrl: "/android-chrome-512x512.png",
  socialMediaLinks: {
    facebook: "https://www.facebook.com/fixbro.in",
    instagram: "https://www.instagram.com/fixbro.in",
    twitter: "https://x.com/fixbro_in",
    linkedin: "https://www.linkedin.com/company/fixbro-in",
    youtube: "https://www.youtube.com/@fixbro-in",
  },
  themeColors: {
    light: { ...DEFAULT_LIGHT_THEME_COLORS_HSL },
    dark: { ...DEFAULT_DARK_THEME_COLORS_HSL },
  },
  loaderType: 'pulse',
  isChatEnabled: false,
  isAiChatBotEnabled: false,
  chatNotificationSoundUrl: "/sounds/default-notification.mp3",
  globalAdminPopup: {
    message: "",
    isActive: false,
    durationSeconds: 10,
  },
  isCookieConsentEnabled: false,
  cookieConsentMessage: "We use cookies to improve your experience. By continuing, you agree to our Cookie Policy.",
  cookiePolicyContent: "<p>Our Cookie Policy details will be updated here soon.</p>",
};

export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalWebSettings>(() => getCache<GlobalWebSettings>(CACHE_KEY, true) || defaultGlobalWebSettings);
  const [isLoading, setIsLoading] = useState(!getCache(CACHE_KEY, true));
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  const processData = useCallback((data: Partial<GlobalWebSettings>): GlobalWebSettings => {
    const mergedLightPalette: Required<ThemePalette> = { ...DEFAULT_LIGHT_THEME_COLORS_HSL };
    THEME_PALETTE_KEYS.forEach(key => {
      if (data.themeColors?.light?.[key]) {
        (mergedLightPalette[key] as any) = data.themeColors.light[key];
      }
    });

    const mergedDarkPalette: Required<ThemePalette> = { ...DEFAULT_DARK_THEME_COLORS_HSL };
    THEME_PALETTE_KEYS.forEach(key => {
      if (data.themeColors?.dark?.[key]) {
        (mergedDarkPalette[key] as any) = data.themeColors.dark[key];
      }
    });

    return {
      ...defaultGlobalWebSettings,
      ...data,
      themeColors: {
        light: mergedLightPalette,
        dark: mergedDarkPalette,
      },
      socialMediaLinks: {
        ...defaultGlobalWebSettings.socialMediaLinks,
        ...(data.socialMediaLinks || {}),
      },
      globalAdminPopup: {
        ...defaultGlobalWebSettings.globalAdminPopup,
        ...(data.globalAdminPopup || {}),
      } as GlobalAdminPopup,
    };
  }, []);

  useEffect(() => {
    const settingsDocRef = doc(db, WEB_SETTINGS_COLLECTION, WEB_SETTINGS_DOC_ID);

    const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const processed = processData(docSnap.data());
        setSettings(processed);
        setCache(CACHE_KEY, processed, true);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching settings:", err);
      setError("Failed to load settings.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [processData]);

  return { settings, isLoading, error };
}
