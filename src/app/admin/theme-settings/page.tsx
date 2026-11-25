"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Save, Loader2, RefreshCw, XCircle, Sun, Moon, Sparkles, CheckCircle2, Layout, Zap, Component, Settings2, CloudRain, Cloud, Snowflake, Flower2, PartyPopper, Flag, Upload, Trash2, Image as ImageIcon, Type, Clock } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from '@/lib/mysqlDb';
import { triggerRefresh } from '@/lib/revalidateUtils';
import type { GlobalWebSettings, ThemeColors, ThemePalette, LoaderType, SeasonalEffectConfig, SeasonalEffectMode } from '@/types/firestore';
import { hexToHslString, hslStringToHex, DEFAULT_LIGHT_THEME_COLORS_HSL, DEFAULT_DARK_THEME_COLORS_HSL, CORE_THEME_PALETTE_KEYS } from '@/lib/colorUtils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, formatDateInTimezone, formatTimeInTimezone } from '@/lib/utils';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import PermissionGuard from '@/components/admin/PermissionGuard';

const WEB_SETTINGS_DOC_ID = "global";
const WEB_SETTINGS_COLLECTION = "webSettings";

const loaderTypes: LoaderType[] = ["logo-pulse", "pulse", "typing", "bars", "gradient", "orbit", "dots", "progress", "cube", "shine", "bounce", "ring", "flip", "wave", "heart", "matrix"];

interface ColorGroup {
  title: string;
  keys: (keyof ThemePalette)[];
  description: string;
}

const colorGroups: ColorGroup[] = [
  { 
    title: "Brand Colors", 
    description: "Core identity colors for buttons, icons, and accents.",
    keys: ['primary', 'primary-foreground', 'accent', 'accent-foreground', 'secondary', 'secondary-foreground'] 
  },
  { 
    title: "Base UI", 
    description: "Backgrounds and text colors for the main interface.",
    keys: ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground'] 
  },
  { 
    title: "System & Borders", 
    description: "Visual elements like borders, icons, and feedback colors.",
    keys: ['border', 'input', 'ring', 'muted', 'muted-foreground', 'destructive', 'destructive-foreground'] 
  }
];

type ThemeMode = 'light' | 'dark';

interface ThemePreset {
  id: string;
  name: string;
  tagline: string;
  light: Partial<Record<keyof ThemePalette, string>>;
  dark: Partial<Record<keyof ThemePalette, string>>;
}

const getDefaultHexPalette = (mode: ThemeMode): Partial<Record<keyof ThemePalette, string>> => {
  const source = mode === 'light' ? DEFAULT_LIGHT_THEME_COLORS_HSL : DEFAULT_DARK_THEME_COLORS_HSL;
  const result: Partial<Record<keyof ThemePalette, string>> = {};
  CORE_THEME_PALETTE_KEYS.forEach((key) => {
    result[key] = hslStringToHex(source[key]!);
  });
  return result;
};

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default-teal',
    name: 'Fixbro Default',
    tagline: 'Original Teal',
    light: getDefaultHexPalette('light'),
    dark: getDefaultHexPalette('dark'),
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    tagline: 'Crisp Corporate',
    light: {
      background: '#F4F8FC', foreground: '#1E293B', card: '#FFFFFF', 'card-foreground': '#1E293B',
      popover: '#FFFFFF', 'popover-foreground': '#1E293B', primary: '#0284C7', 'primary-foreground': '#FFFFFF',
      secondary: '#E0F2FE', 'secondary-foreground': '#0F172A', muted: '#E2E8F0', 'muted-foreground': '#475569',
      accent: '#0369A1', 'accent-foreground': '#FFFFFF', destructive: '#EF4444', 'destructive-foreground': '#FFFFFF',
      border: '#CBD5E1', input: '#94A3B8', ring: '#0284C7',
    },
    dark: {
      background: '#0B1120', foreground: '#F1F5F9', card: '#111827', 'card-foreground': '#F1F5F9',
      popover: '#111827', 'popover-foreground': '#F1F5F9', primary: '#38BDF8', 'primary-foreground': '#0F172A',
      secondary: '#1E293B', 'secondary-foreground': '#F1F5F9', muted: '#1E293B', 'muted-foreground': '#94A3B8',
      accent: '#0EA5E9', 'accent-foreground': '#0F172A', destructive: '#DC2626', 'destructive-foreground': '#FFFFFF',
      border: '#334155', input: '#334155', ring: '#38BDF8',
    },
  },
  {
    id: 'emerald-fresh',
    name: 'Emerald Fresh',
    tagline: 'Clean Mint Green',
    light: {
      background: '#F2FBF7', foreground: '#1E293B', card: '#FFFFFF', 'card-foreground': '#1E293B',
      popover: '#FFFFFF', 'popover-foreground': '#1E293B', primary: '#059669', 'primary-foreground': '#FFFFFF',
      secondary: '#D1FAE5', 'secondary-foreground': '#064E3B', muted: '#E2EFEA', 'muted-foreground': '#475569',
      accent: '#047857', 'accent-foreground': '#FFFFFF', destructive: '#EF4444', 'destructive-foreground': '#FFFFFF',
      border: '#CBD5E1', input: '#94A3B8', ring: '#059669',
    },
    dark: {
      background: '#0A1410', foreground: '#ECFDF5', card: '#111F19', 'card-foreground': '#ECFDF5',
      popover: '#111F19', 'popover-foreground': '#ECFDF5', primary: '#34D399', 'primary-foreground': '#064E3B',
      secondary: '#1A2E25', 'secondary-foreground': '#ECFDF5', muted: '#1A2E25', 'muted-foreground': '#94A3B8',
      accent: '#10B981', 'accent-foreground': '#064E3B', destructive: '#DC2626', 'destructive-foreground': '#FFFFFF',
      border: '#2B4237', input: '#2B4237', ring: '#34D399',
    },
  },
  {
    id: 'royal-indigo',
    name: 'Royal Indigo',
    tagline: 'Modern Violet',
    light: {
      background: '#F5F6FF', foreground: '#1E1B4B', card: '#FFFFFF', 'card-foreground': '#1E293B',
      popover: '#FFFFFF', 'popover-foreground': '#1E293B', primary: '#4F46E5', 'primary-foreground': '#FFFFFF',
      secondary: '#E0E7FF', 'secondary-foreground': '#1E1B4B', muted: '#E5E7EB', 'muted-foreground': '#475569',
      accent: '#4338CA', 'accent-foreground': '#FFFFFF', destructive: '#EF4444', 'destructive-foreground': '#FFFFFF',
      border: '#CBD5E1', input: '#94A3B8', ring: '#4F46E5',
    },
    dark: {
      background: '#0F1020', foreground: '#EEF2FF', card: '#17192E', 'card-foreground': '#EEF2FF',
      popover: '#17192E', 'popover-foreground': '#EEF2FF', primary: '#818CF8', 'primary-foreground': '#0F172A',
      secondary: '#232642', 'secondary-foreground': '#EEF2FF', muted: '#232642', 'muted-foreground': '#94A3B8',
      accent: '#6366F1', 'accent-foreground': '#FFFFFF', destructive: '#DC2626', 'destructive-foreground': '#FFFFFF',
      border: '#31355C', input: '#31355C', ring: '#818CF8',
    },
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    tagline: 'Warm & Energetic',
    light: {
      background: '#FFF8F4', foreground: '#1F2937', card: '#FFFFFF', 'card-foreground': '#1F2937',
      popover: '#FFFFFF', 'popover-foreground': '#1F2937', primary: '#EA580C', 'primary-foreground': '#FFFFFF',
      secondary: '#FFEDD5', 'secondary-foreground': '#431407', muted: '#F3EAE3', 'muted-foreground': '#57534E',
      accent: '#C2410C', 'accent-foreground': '#FFFFFF', destructive: '#DC2626', 'destructive-foreground': '#FFFFFF',
      border: '#D6D3D1', input: '#A8A29E', ring: '#EA580C',
    },
    dark: {
      background: '#14100E', foreground: '#FAF5F0', card: '#1F1916', 'card-foreground': '#FAF5F0',
      popover: '#1F1916', 'popover-foreground': '#FAF5F0', primary: '#FB923C', 'primary-foreground': '#1C1917',
      secondary: '#2E241F', 'secondary-foreground': '#FAF5F0', muted: '#2E241F', 'muted-foreground': '#A8A29E',
      accent: '#F97316', 'accent-foreground': '#1C1917', destructive: '#DC2626', 'destructive-foreground': '#FFFFFF',
      border: '#44362E', input: '#44362E', ring: '#FB923C',
    },
  },
  {
    id: 'crimson-ruby',
    name: 'Crimson Ruby',
    tagline: 'Bold Rose Red',
    light: {
      background: '#FFF5F7', foreground: '#1F2937', card: '#FFFFFF', 'card-foreground': '#1F2937',
      popover: '#FFFFFF', 'popover-foreground': '#1F2937', primary: '#E11D48', 'primary-foreground': '#FFFFFF',
      secondary: '#FFE4E6', 'secondary-foreground': '#4C0519', muted: '#F3E8EA', 'muted-foreground': '#52525B',
      accent: '#BE123C', 'accent-foreground': '#FFFFFF', destructive: '#B91C1C', 'destructive-foreground': '#FFFFFF',
      border: '#D4D4D8', input: '#A1A1AA', ring: '#E11D48',
    },
    dark: {
      background: '#140D10', foreground: '#FFF1F2', card: '#1F1418', 'card-foreground': '#FFF1F2',
      popover: '#1F1418', 'popover-foreground': '#FFF1F2', primary: '#FB7185', 'primary-foreground': '#18181B',
      secondary: '#2E1D23', 'secondary-foreground': '#FFF1F2', muted: '#2E1D23', 'muted-foreground': '#A1A1AA',
      accent: '#F43F5E', 'accent-foreground': '#FFFFFF', destructive: '#DC2626', 'destructive-foreground': '#FFFFFF',
      border: '#472C36', input: '#472C36', ring: '#FB7185',
    },
  },
  {
    id: 'executive-amber',
    name: 'Executive Gold',
    tagline: 'Warm Slate & Amber',
    light: {
      background: '#FAF8F5', foreground: '#1E293B', card: '#FFFFFF', 'card-foreground': '#1E293B',
      popover: '#FFFFFF', 'popover-foreground': '#1E293B', primary: '#D97706', 'primary-foreground': '#FFFFFF',
      secondary: '#FEF3C7', 'secondary-foreground': '#451A03', muted: '#EAE8E1', 'muted-foreground': '#475569',
      accent: '#B45309', 'accent-foreground': '#FFFFFF', destructive: '#EF4444', 'destructive-foreground': '#FFFFFF',
      border: '#CBD5E1', input: '#94A3B8', ring: '#D97706',
    },
    dark: {
      background: '#12110E', foreground: '#F8FAFC', card: '#1C1A15', 'card-foreground': '#F8FAFC',
      popover: '#1C1A15', 'popover-foreground': '#F8FAFC', primary: '#FBBF24', 'primary-foreground': '#18181B',
      secondary: '#2B271F', 'secondary-foreground': '#F8FAFC', muted: '#2B271F', 'muted-foreground': '#94A3B8',
      accent: '#F59E0B', 'accent-foreground': '#18181B', destructive: '#DC2626', 'destructive-foreground': '#FFFFFF',
      border: '#3F3A2E', input: '#3F3A2E', ring: '#FBBF24',
    },
  },
];

const isHexClose = (hexA?: string, hexB?: string): boolean => {
  if (!hexA || !hexB) return false;
  const norm = (h: string) => {
    const clean = h.replace('#', '');
    if (clean.length === 3) return clean.split('').map(c => c + c).join('');
    return clean;
  };
  const a = norm(hexA);
  const b = norm(hexB);
  if (a.length !== 6 || b.length !== 6) return false;
  const r1 = parseInt(a.slice(0, 2), 16), g1 = parseInt(a.slice(2, 4), 16), b1 = parseInt(a.slice(4, 6), 16);
  const r2 = parseInt(b.slice(0, 2), 16), g2 = parseInt(b.slice(2, 4), 16), b2 = parseInt(b.slice(4, 6), 16);
  return Math.abs(r1 - r2) <= 10 && Math.abs(g1 - g2) <= 10 && Math.abs(b1 - b2) <= 10;
};

export default function ThemeSettingsPage() {
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ThemeMode>('light');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  
  const [currentColorsHex, setCurrentColorsHex] = useState<Record<ThemeMode, Partial<Record<keyof ThemePalette, string>>>>({
    light: {},
    dark: {},
  });
  const [selectedLoader, setSelectedLoader] = useState<LoaderType>('logo-pulse');
  const [seasonalEffect, setSeasonalEffect] = useState<SeasonalEffectConfig>({
    mode: 'none',
    intensity: 'medium',
    scope: 'all',
    customImageUrl: '',
    customText: '',
    durationType: 'always',
    startAt: '',
    expiresAt: '',
  });
  const [isUploadingEffectPng, setIsUploadingEffectPng] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  const loadThemeSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settingsDocRef = doc(db, WEB_SETTINGS_COLLECTION, WEB_SETTINGS_DOC_ID);
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        const globalSettings = docSnap.data() as GlobalWebSettings;
        setSelectedLoader(globalSettings.loaderType || 'logo-pulse');
        if (globalSettings.seasonalEffect) {
          setSeasonalEffect({
            mode: globalSettings.seasonalEffect.mode || 'none',
            intensity: globalSettings.seasonalEffect.intensity || 'medium',
            scope: globalSettings.seasonalEffect.scope || 'all',
            customImageUrl: globalSettings.seasonalEffect.customImageUrl || '',
            customText: globalSettings.seasonalEffect.customText || '',
            durationType: globalSettings.seasonalEffect.durationType || 'always',
            startAt: globalSettings.seasonalEffect.startAt || '',
            expiresAt: globalSettings.seasonalEffect.expiresAt || '',
          });
        }
        const loadedLightHexColors: Record<string, string> = {};
        const loadedDarkHexColors: Record<string, string> = {};

        CORE_THEME_PALETTE_KEYS.forEach(configKey => {
          const lightHslValue = globalSettings.themeColors?.light?.[configKey];
          loadedLightHexColors[configKey] = lightHslValue ? hslStringToHex(lightHslValue) : hslStringToHex(DEFAULT_LIGHT_THEME_COLORS_HSL[configKey]!);
          
          const darkHslValue = globalSettings.themeColors?.dark?.[configKey];
          loadedDarkHexColors[configKey] = darkHslValue ? hslStringToHex(darkHslValue) : hslStringToHex(DEFAULT_DARK_THEME_COLORS_HSL[configKey]!);
        });
        setCurrentColorsHex({
          light: loadedLightHexColors as Partial<Record<keyof ThemePalette, string>>,
          dark: loadedDarkHexColors as Partial<Record<keyof ThemePalette, string>>,
        });
      } else {
        resetToDefaultColorsState();
        setSelectedLoader('logo-pulse');
      }
    } catch (error) {
      console.error("Error loading theme settings:", error);
      toast({ title: "Error", description: "Could not load theme settings.", variant: "destructive" });
      resetToDefaultColorsState();
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadThemeSettings();
  }, [loadThemeSettings]);

  const resetToDefaultColorsState = (mode?: ThemeMode) => {
    if (mode === 'light' || !mode) {
      const defaultLightHex: Record<string, string> = {};
      CORE_THEME_PALETTE_KEYS.forEach(configKey => {
        defaultLightHex[configKey] = hslStringToHex(DEFAULT_LIGHT_THEME_COLORS_HSL[configKey]!);
      });
      setCurrentColorsHex(prev => ({ ...prev, light: defaultLightHex as Partial<Record<keyof ThemePalette, string>> }));
    }
    if (mode === 'dark' || !mode) {
      const defaultDarkHex: Record<string, string> = {};
      CORE_THEME_PALETTE_KEYS.forEach(configKey => {
        defaultDarkHex[configKey] = hslStringToHex(DEFAULT_DARK_THEME_COLORS_HSL[configKey]!);
      });
      setCurrentColorsHex(prev => ({ ...prev, dark: defaultDarkHex as Partial<Record<keyof ThemePalette, string>> }));
    }
  };

  const handleColorChange = (mode: ThemeMode, id: keyof ThemePalette, hexValue: string) => {
    setCurrentColorsHex(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [id]: hexValue,
      },
    }));
  };

  const handleSaveTheme = async () => {
    setIsSaving(true);
    try {
      const themeColorsToSave: ThemeColors = { light: {}, dark: {} };
      (Object.keys(currentColorsHex.light) as Array<keyof ThemePalette>).forEach(key => {
        if (currentColorsHex.light[key]) themeColorsToSave.light![key] = hexToHslString(currentColorsHex.light[key]);
      });
      (Object.keys(currentColorsHex.dark) as Array<keyof ThemePalette>).forEach(key => {
        if (currentColorsHex.dark[key]) themeColorsToSave.dark![key] = hexToHslString(currentColorsHex.dark[key]);
      });

      let effectToSave: SeasonalEffectConfig = { ...seasonalEffect };
      if (effectToSave.mode === 'none' || effectToSave.durationType === 'always' || !effectToSave.durationType) {
        effectToSave.durationType = effectToSave.mode === 'none' ? 'always' : (effectToSave.durationType || 'always');
        effectToSave.startAt = '';
        effectToSave.expiresAt = '';
      } else if (effectToSave.durationType === '1h') {
        const now = Date.now();
        effectToSave.startAt = new Date(now).toISOString();
        effectToSave.expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
        setSeasonalEffect(effectToSave);
      } else if (effectToSave.durationType === '24h') {
        const now = Date.now();
        effectToSave.startAt = new Date(now).toISOString();
        effectToSave.expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
        setSeasonalEffect(effectToSave);
      }

      const settingsDocRef = doc(db, WEB_SETTINGS_COLLECTION, WEB_SETTINGS_DOC_ID);
      await setDoc(settingsDocRef, { themeColors: themeColorsToSave, loaderType: selectedLoader, seasonalEffect: effectToSave, updatedAt: Timestamp.now() }, { merge: true });
      await triggerRefresh('global-cache');
      toast({ title: "Theme Updated", description: "Your brand colors, loader, and seasonal effect have been synchronized." });
    } catch (error) {
      toast({ title: "Save Failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAllToDefault = async () => {
    setIsSaving(true);
    try {
      const settingsDocRef = doc(db, WEB_SETTINGS_COLLECTION, WEB_SETTINGS_DOC_ID);
      await setDoc(settingsDocRef, {
        themeColors: { light: { ...DEFAULT_LIGHT_THEME_COLORS_HSL }, dark: { ...DEFAULT_DARK_THEME_COLORS_HSL } },
        loaderType: 'logo-pulse',
        seasonalEffect: { mode: 'none', intensity: 'medium', scope: 'all', customImageUrl: '' },
        updatedAt: Timestamp.now(),
      }, { merge: true });
      await triggerRefresh('global-cache');
      resetToDefaultColorsState();
      setSelectedLoader('logo-pulse');
      setSeasonalEffect({ mode: 'none', intensity: 'medium', scope: 'all', customImageUrl: '' });
      toast({ title: "System Reset Complete", description: "Default theme settings restored." });
    } catch (error) {
      toast({ title: "Reset Failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOldEffectPng = async (fileUrl?: string) => {
    if (!fileUrl) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileUrl }),
      });
    } catch (err) {
      console.warn("Could not delete previous seasonal PNG:", err);
    }
  };

  const handleUploadEffectPng = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('png') && !file.type.includes('webp') && !file.type.includes('image/')) {
      toast({ title: "Invalid File", description: "Please upload a PNG or WebP image (transparent PNG recommended).", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please choose a small PNG under 2MB for smooth falling animation.", variant: "destructive" });
      return;
    }

    const previousUrl = seasonalEffect.customImageUrl;
    setIsUploadingEffectPng(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadPath', 'theme-effects');

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Upload failed');
      }

      if (previousUrl && previousUrl !== data.url) {
        await deleteOldEffectPng(previousUrl);
      }

      setSeasonalEffect(prev => ({ ...prev, mode: 'custom-png', customImageUrl: data.url }));
      toast({ title: "PNG Replaced", description: "Previous PNG deleted and new PNG uploaded. Click 'Save Changes' to publish." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Could not upload image.", variant: "destructive" });
    } finally {
      setIsUploadingEffectPng(false);
      e.target.value = '';
    }
  };

  const getCurrentColor = (mode: ThemeMode, key: keyof ThemePalette) => {
    const defaultPalette = mode === 'light' ? DEFAULT_LIGHT_THEME_COLORS_HSL : DEFAULT_DARK_THEME_COLORS_HSL;
    return currentColorsHex[mode]?.[key] || hslStringToHex(defaultPalette[key]!);
  };

  const getPreviewStyles = (mode: ThemeMode) => ({
    '--background': getCurrentColor(mode, 'background'),
    '--foreground': getCurrentColor(mode, 'foreground'),
    '--card': getCurrentColor(mode, 'card'),
    '--card-foreground': getCurrentColor(mode, 'card-foreground'),
    '--popover': getCurrentColor(mode, 'popover'),
    '--popover-foreground': getCurrentColor(mode, 'popover-foreground'),
    '--primary': getCurrentColor(mode, 'primary'),
    '--primary-foreground': getCurrentColor(mode, 'primary-foreground'),
    '--secondary': getCurrentColor(mode, 'secondary'),
    '--secondary-foreground': getCurrentColor(mode, 'secondary-foreground'),
    '--muted': getCurrentColor(mode, 'muted'),
    '--muted-foreground': getCurrentColor(mode, 'muted-foreground'),
    '--accent': getCurrentColor(mode, 'accent'),
    '--accent-foreground': getCurrentColor(mode, 'accent-foreground'),
    '--destructive': getCurrentColor(mode, 'destructive'),
    '--destructive-foreground': getCurrentColor(mode, 'destructive-foreground'),
    '--border': getCurrentColor(mode, 'border'),
    '--input': getCurrentColor(mode, 'input'),
    '--ring': getCurrentColor(mode, 'ring'),
  } as React.CSSProperties);

  const renderBrandColorsPreview = (mode: ThemeMode) => {
    return (
      <div className="p-5 rounded-[1.5rem] border space-y-4 shadow-sm flex flex-col"
           style={{ 
             ...getPreviewStyles(mode),
             backgroundColor: mode === 'dark' ? '#0F172A' : '#F8FAFC', 
             borderColor: 'var(--border)',
             color: 'var(--foreground)'
           }}>
        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Brand Colors Preview</div>
        
        {/* Primary Action Button */}
        <div className="space-y-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase">Primary / Primary-Foreground</span>
          <button className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-all"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            Primary Button
          </button>
        </div>

        {/* Secondary Button */}
        <div className="space-y-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase">Secondary / Secondary-Foreground</span>
          <button className="w-full h-10 rounded-xl border font-black text-[10px] uppercase tracking-widest shadow-sm transition-all"
                  style={{ backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)', borderColor: 'var(--border)' }}>
            Secondary Action
          </button>
        </div>

        {/* Accent Badge / Rating */}
        <div className="space-y-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase">Accent / Accent-Foreground</span>
          <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: mode === 'dark' ? '#1E293B' : '#FFFFFF' }}>
            <div className="flex items-center gap-1 font-bold text-xs">
              <span style={{ color: 'var(--accent)' }}>★★★★★</span>
              <span className="text-[10px] text-muted-foreground ml-1">Rating</span>
            </div>
            <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm"
                 style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}>
              Special Offer
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBaseUIPreview = (mode: ThemeMode) => {
    return (
      <div className="p-5 rounded-[1.5rem] border space-y-4 shadow-sm flex flex-col transition-all duration-300 animate-in fade-in"
           style={{ 
             ...getPreviewStyles(mode),
             backgroundColor: 'var(--background)', 
             color: 'var(--foreground)', 
             borderColor: 'var(--border)' 
           }}>
        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Base UI Preview</div>

        {/* Mock Page Window */}
        <div className="space-y-1.5">
          <span className="text-[8px] font-bold text-muted-foreground uppercase">Background / Foreground</span>
          <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-black uppercase tracking-tight">Main Screen Title</div>
            
            {/* Card Mockup */}
            <div className="p-3.5 rounded-xl border shadow-sm"
                 style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-bold mb-1">Nested Card Block</div>
              <div className="text-[10px] text-muted-foreground">This content card adapts to your card background.</div>
            </div>
          </div>
        </div>

        {/* Floating Popover Mockup */}
        <div className="space-y-1.5">
          <span className="text-[8px] font-bold text-muted-foreground uppercase">Popover / Popover-Foreground</span>
          <div className="p-3.5 rounded-xl border shadow-lg space-y-2"
               style={{ backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', borderColor: 'var(--border)' }}>
            <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Select Profile Option</div>
            <div className="p-2 rounded-lg text-xs font-bold border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
               Account Settings
            </div>
            <div className="p-2 rounded-lg text-xs font-black flex items-center justify-between" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
               <span>Active Session</span>
               <span>✓</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSystemBordersPreview = (mode: ThemeMode) => {
    return (
      <div className="p-5 rounded-[1.5rem] border space-y-4 shadow-sm flex flex-col animate-in fade-in"
           style={{ 
             ...getPreviewStyles(mode),
             backgroundColor: mode === 'dark' ? '#0F172A' : '#F8FAFC', 
             borderColor: 'var(--border)',
             color: 'var(--foreground)'
           }}>
        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">System & Borders Preview</div>

        {/* Form Input Field with Input & Ring */}
        <div className="space-y-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase">Input / Ring (Active State)</span>
          <div className="relative rounded-xl border flex items-center p-2.5 shadow-sm transition-all"
               style={{ 
                 borderColor: 'var(--border)', 
                 backgroundColor: 'var(--input)',
                 boxShadow: '0 0 0 2px var(--ring)'
               }}>
            <span className="text-xs mr-2 text-muted-foreground">🔍</span>
            <span className="text-xs font-semibold text-muted-foreground">Input focus outline...</span>
          </div>
        </div>

        {/* Muted Timeline Section */}
        <div className="space-y-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase">Muted / Muted-Foreground / Border</span>
          <div className="p-3 rounded-xl border text-xs" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>
             ℹ️ Standard notification alert detailing background updates.
          </div>
        </div>

        {/* Destructive Action */}
        <div className="space-y-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase">Destructive / Destructive-Foreground</span>
          <button className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-all"
                  style={{ backgroundColor: 'var(--destructive)', color: 'var(--destructive-foreground)' }}>
             Delete Account
          </button>
        </div>
      </div>
    );
  };

  const renderGroupPreview = (title: string, mode: ThemeMode) => {
    switch (title) {
      case "Brand Colors":
        return renderBrandColorsPreview(mode);
      case "Base UI":
        return renderBaseUIPreview(mode);
      case "System & Borders":
        return renderSystemBordersPreview(mode);
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] animate-pulse">Syncing Visual Identity...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-2 sm:px-4">
      <PermissionGuard moduleId="theme_settings" action="write">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-primary">
              <Palette className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Appearance Studio</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight">Visual Identity</h1>
            <p className="text-muted-foreground text-sm font-medium">Define your brand colors, interface aesthetics, and loading animations.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-12 sm:h-10 rounded-xl text-destructive hover:bg-destructive hover:text-white font-bold text-xs uppercase tracking-tight border border-destructive/20 transition-all duration-300">
                  <RefreshCw className="mr-2 h-4 w-4" /> Factory Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl">
                <AlertDialogHeader>
                  <div className="bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                    <XCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <AlertDialogTitle className="text-2xl font-black tracking-tight uppercase">System Overwrite</AlertDialogTitle>
                  <AlertDialogDescription className="text-base font-medium">This will wipe all custom branding and restore the original Fixbro defaults.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8">
                  <AlertDialogCancel className="rounded-xl border-none bg-muted">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetAllToDefault} className="rounded-xl bg-destructive hover:bg-destructive/90 px-8">Confirm Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={handleSaveTheme} disabled={isSaving} className="h-14 sm:h-12 rounded-2xl px-8 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-black text-xs uppercase tracking-widest">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </header>

        <div className="grid gap-8 grid-cols-1 lg:grid-cols-12 mt-8">
          {/* Left: System Loader (3 cols) */}
          <div className="lg:col-span-3 space-y-8">
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-card">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center space-x-3 mb-1 text-primary">
                  <Zap className="h-5 w-5" />
                  <CardTitle className="text-xl font-black tracking-tight uppercase">System Loader</CardTitle>
                </div>
                <CardDescription className="text-xs font-medium">Select the global transition animation.</CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8 pt-0">
                <ScrollArea className="h-[450px] pr-4">
                  <div className="grid grid-cols-2 gap-3 py-2">
                    {loaderTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedLoader(type)}
                        className={cn(
                          "group flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300",
                          selectedLoader === type 
                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-100" 
                            : "bg-muted/30 border-transparent hover:border-primary/20 hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg mb-2 flex items-center justify-center transition-transform duration-500",
                          selectedLoader === type ? "bg-white/20 scale-110" : "bg-primary/10 text-primary group-hover:scale-110"
                        )}>
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter text-center line-clamp-1">{type}</span>
                        {selectedLoader === type && <CheckCircle2 className="h-3 w-3 mt-1 text-white opacity-80" />}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right: Color Settings & Previews (9 cols) */}
          <div className="lg:col-span-9 space-y-6">
            {/* Quick Theme Presets */}
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-card">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 text-primary">
                    <Palette className="h-5 w-5" />
                    <CardTitle className="text-lg font-black tracking-tight uppercase">Quick Theme Presets</CardTitle>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">1-click high-contrast palettes</span>
                </div>
                <CardDescription className="text-xs font-medium">
                  Select any preset below to load both Light &amp; Dark palettes, then click Save Changes to apply it live.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {THEME_PRESETS.map((preset) => {
                    const isSelected =
                      selectedPresetId === preset.id ||
                      (selectedPresetId === null &&
                        isHexClose(currentColorsHex.light.primary, preset.light.primary) &&
                        isHexClose(currentColorsHex.light.background, preset.light.background));

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          setCurrentColorsHex({
                            light: { ...preset.light },
                            dark: { ...preset.dark },
                          });
                          toast({
                            title: `${preset.name} Loaded`,
                            description: "Preview updated. Click 'Save Changes' to publish this theme.",
                          });
                        }}
                        className={cn(
                          "group text-left p-3.5 rounded-2xl border-2 transition-all duration-200 flex flex-col gap-2.5 cursor-pointer relative",
                          isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md"
                            : "border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center -space-x-1.5">
                            <span
                              className="h-6 w-6 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm"
                              style={{ backgroundColor: preset.light.primary }}
                              title="Primary"
                            />
                            <span
                              className="h-6 w-6 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm"
                              style={{ backgroundColor: preset.light.accent }}
                              title="Accent"
                            />
                            <span
                              className="h-6 w-6 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm"
                              style={{ backgroundColor: preset.light.background }}
                              title="Background"
                            />
                          </div>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </div>
                        <div>
                          <p className={cn("text-xs font-bold leading-tight", isSelected ? "text-primary" : "text-foreground")}>{preset.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{preset.tagline}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Weather & Festival Falling Effects */}
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-card">
              <CardHeader className="p-6 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 text-primary">
                    <Sparkles className="h-5 w-5" />
                    <CardTitle className="text-lg font-black tracking-tight uppercase">Weather &amp; Festival Effects</CardTitle>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">Customer pages only · Non-blocking overlay</span>
                </div>
                <CardDescription className="text-xs font-medium">
                  Enable live weather (rain, clouds, snow) or festival falling flowers/confetti, or upload your own custom PNG image.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {([
                    { id: 'none', label: 'Off (None)', sub: 'Normal clean view', icon: XCircle, color: 'text-muted-foreground' },
                    { id: 'rain', label: 'Monsoon Rain', sub: 'Falling raindrops', icon: CloudRain, color: 'text-blue-500' },
                    { id: 'clouds', label: 'Floating Clouds', sub: 'Drifting soft clouds', icon: Cloud, color: 'text-sky-400' },
                    { id: 'snow', label: 'Winter Snow', sub: 'Soft snowflakes', icon: Snowflake, color: 'text-cyan-400' },
                    { id: 'sunshine', label: 'Golden Glow', sub: 'Warm light motes', icon: Sun, color: 'text-amber-500' },
                    { id: 'diwali', label: 'Diwali Flowers', sub: 'Marigold & sparkles', icon: Sparkles, color: 'text-orange-500' },
                    { id: 'holi', label: 'Holi Colors', sub: 'Vibrant color splash', icon: Palette, color: 'text-pink-500' },
                    { id: 'celebration', label: 'Celebration', sub: 'Party confetti', icon: PartyPopper, color: 'text-purple-500' },
                    { id: 'tricolor', label: 'Tricolor', sub: 'Saffron, White, Green', icon: Flag, color: 'text-emerald-600' },
                    { id: 'spring', label: 'Spring Blossoms', sub: 'Pink & white petals', icon: Flower2, color: 'text-rose-400' },
                    { id: 'custom-png', label: 'Custom PNG', sub: 'Upload your own PNG', icon: ImageIcon, color: 'text-primary' },
                    { id: 'custom-text', label: 'Custom Text', sub: 'Color-changing text', icon: Type, color: 'text-violet-500' },
                  ] as { id: SeasonalEffectMode; label: string; sub: string; icon: any; color: string }[]).map((item) => {
                    const IconComp = item.icon;
                    const isSelected = seasonalEffect.mode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSeasonalEffect(prev => ({ ...prev, mode: item.id }))}
                        className={cn(
                          "text-left p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col gap-1.5 cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary/25 shadow-sm"
                            : "border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <IconComp className={cn("h-4 w-4", item.color)} />
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <div>
                          <p className={cn("text-xs font-bold leading-tight", isSelected ? "text-primary" : "text-foreground")}>{item.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {seasonalEffect.mode !== 'none' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/50">
                    {/* Intensity Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Effect Intensity</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['light', 'medium', 'festive'] as const).map((lvl) => (
                          <Button
                            key={lvl}
                            type="button"
                            size="sm"
                            variant={seasonalEffect.intensity === lvl ? 'default' : 'outline'}
                            onClick={() => setSeasonalEffect(prev => ({ ...prev, intensity: lvl }))}
                            className="capitalize text-xs h-8"
                          >
                            {lvl}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Scope Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Where to Show</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={seasonalEffect.scope === 'home' ? 'default' : 'outline'}
                          onClick={() => setSeasonalEffect(prev => ({ ...prev, scope: 'home' }))}
                          className="text-xs h-8"
                        >
                          Homepage Only
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={seasonalEffect.scope !== 'home' ? 'default' : 'outline'}
                          onClick={() => setSeasonalEffect(prev => ({ ...prev, scope: 'all' }))}
                          className="text-xs h-8"
                        >
                          All Customer Pages
                        </Button>
                      </div>
                    </div>

                    {/* Schedule / Auto-Expire Selector */}
                    <div className="md:col-span-2 space-y-2.5 pt-2 border-t border-border/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" /> Auto-Expire Schedule
                        </Label>
                        {seasonalEffect.durationType && seasonalEffect.durationType !== 'always' && seasonalEffect.expiresAt && (
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            Date.now() >= Date.parse(seasonalEffect.expiresAt)
                              ? "bg-destructive/10 text-destructive"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          )}>
                            {(() => {
                              const tz = appConfig?.timezone || 'Asia/Kolkata';
                              const formattedExpiry = `${formatDateInTimezone(seasonalEffect.expiresAt, tz, appConfig?.dateFormat)} ${formatTimeInTimezone(seasonalEffect.expiresAt, tz)}`;
                              return Date.now() >= Date.parse(seasonalEffect.expiresAt)
                                ? `Expired (${formattedExpiry})`
                                : `Active until ${formattedExpiry}`;
                            })()}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([
                          { id: 'always', label: 'Always On' },
                          { id: '1h', label: '1 Hour' },
                          { id: '24h', label: '1 Day (24h)' },
                          { id: 'custom', label: 'Custom Dates' },
                        ] as const).map((opt) => (
                          <Button
                            key={opt.id}
                            type="button"
                            size="sm"
                            variant={(seasonalEffect.durationType || 'always') === opt.id ? 'default' : 'outline'}
                            onClick={() => setSeasonalEffect(prev => ({ ...prev, durationType: opt.id }))}
                            className="text-xs h-8"
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>

                      {seasonalEffect.durationType === 'custom' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <Label htmlFor="effect-start-at" className="text-[11px] text-muted-foreground">Start Date &amp; Time</Label>
                            <Input
                              id="effect-start-at"
                              type="datetime-local"
                              value={seasonalEffect.startAt ? new Date(new Date(seasonalEffect.startAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSeasonalEffect(prev => ({ ...prev, startAt: val ? new Date(val).toISOString() : '' }));
                              }}
                              className="h-9 text-xs bg-background rounded-xl"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="effect-expires-at" className="text-[11px] text-muted-foreground">End Date &amp; Time (Auto Turn Off)</Label>
                            <Input
                              id="effect-expires-at"
                              type="datetime-local"
                              value={seasonalEffect.expiresAt ? new Date(new Date(seasonalEffect.expiresAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSeasonalEffect(prev => ({ ...prev, expiresAt: val ? new Date(val).toISOString() : '' }));
                              }}
                              className="h-9 text-xs bg-background rounded-xl"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {seasonalEffect.mode === 'custom-png' && (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {seasonalEffect.customImageUrl ? (
                        <div className="h-14 w-14 rounded-xl border bg-background p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={seasonalEffect.customImageUrl} alt="Custom Effect PNG" className="max-h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="h-14 w-14 rounded-xl border border-dashed flex items-center justify-center bg-muted/50 shrink-0">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold">Custom Falling PNG Image</p>
                        <p className="text-[11px] text-muted-foreground">
                          Upload a transparent PNG (e.g., flower, diya, offer badge). Max 2MB.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/webp,image/*"
                          className="hidden"
                          onChange={handleUploadEffectPng}
                          disabled={isUploadingEffectPng}
                        />
                        <span className="inline-flex items-center justify-center h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm">
                          {isUploadingEffectPng ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                          {isUploadingEffectPng ? 'Uploading...' : (seasonalEffect.customImageUrl ? 'Change PNG' : 'Upload PNG')}
                        </span>
                      </label>
                      {seasonalEffect.customImageUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const urlToDelete = seasonalEffect.customImageUrl;
                            setSeasonalEffect(prev => ({ ...prev, customImageUrl: '' }));
                            if (urlToDelete) await deleteOldEffectPng(urlToDelete);
                          }}
                          className="h-9 px-2.5 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {seasonalEffect.mode === 'custom-text' && (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                    <Label htmlFor="custom-effect-text" className="text-xs font-bold flex items-center gap-1.5">
                      <Type className="h-3.5 w-3.5 text-primary" /> Floating Custom Text
                    </Label>
                    <Input
                      id="custom-effect-text"
                      type="text"
                      maxLength={40}
                      value={seasonalEffect.customText || ''}
                      onChange={(e) => setSeasonalEffect(prev => ({ ...prev, customText: e.target.value }))}
                      placeholder="e.g. Happy Diwali, Happy Birthday, Happy Holi..."
                      className="bg-background rounded-xl h-10 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      This text will float gently across the screen while smoothly cycling through vibrant colors.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ThemeMode)} className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList className="grid w-full max-md:max-w-md grid-cols-2 p-1 bg-card/50 rounded-[1.5rem] h-14 border shadow-sm backdrop-blur-sm">
                  <TabsTrigger 
                    value="light" 
                    className={cn(
                      "rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-wider",
                      "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
                    )}
                  >
                    <Sun className="mr-2 h-4 w-4" /> Light Palette
                  </TabsTrigger>
                  <TabsTrigger 
                    value="dark" 
                    className={cn(
                      "rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-wider",
                      "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
                    )}
                  >
                    <Moon className="mr-2 h-4 w-4" /> Dark Palette
                  </TabsTrigger>
                </TabsList>
              </div>

              {['light', 'dark'].map((mode) => (
                <TabsContent key={mode} value={mode} className="focus-visible:outline-none space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {colorGroups.map((group) => (
                    <Card key={group.title} className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-card">
                      <CardHeader className="p-8 pb-4">
                        <div className="flex items-center space-x-3 mb-1 text-primary">
                          <Component className="h-5 w-5" />
                          <CardTitle className="text-xl font-black tracking-tight uppercase">{group.title}</CardTitle>
                        </div>
                        <CardDescription className="text-xs font-medium">{group.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-8 pt-0">
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                          {/* Left Column: Color Controls (7 cols) */}
                          <div className="xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {group.keys.map((key) => {
                              const defaultPalette = mode === 'light' ? DEFAULT_LIGHT_THEME_COLORS_HSL : DEFAULT_DARK_THEME_COLORS_HSL;
                              const label = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                              const colorValue = currentColorsHex[mode as ThemeMode]?.[key] || hslStringToHex(defaultPalette[key]!);
                              
                              return (
                                <div key={`${mode}-${key}`} className="p-4 rounded-2xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-all group">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider group-hover:text-primary transition-colors">{label}</span>
                                    <button
                                      onClick={() => handleColorChange(mode as ThemeMode, key, hslStringToHex(defaultPalette[key]!))}
                                      className={cn(
                                        "p-1 hover:bg-primary/10 rounded-md transition-all",
                                        colorValue === hslStringToHex(defaultPalette[key]!) ? "opacity-0 invisible" : "opacity-100 visible"
                                      )}
                                      title="Reset to default"
                                    >
                                      <XCircle className="h-3 w-3 text-destructive" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden shadow-inner border border-white/20">
                                      <input
                                        type="color"
                                        value={colorValue}
                                        onChange={(e) => handleColorChange(mode as ThemeMode, key, e.target.value)}
                                        className="absolute inset-0 h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                      />
                                    </div>
                                    <Input
                                      type="text"
                                      value={colorValue.toUpperCase()}
                                      onChange={(e) => handleColorChange(mode as ThemeMode, key, e.target.value)}
                                      className="h-10 bg-background border-none shadow-sm rounded-xl font-mono text-[11px] font-bold tracking-tighter"
                                      placeholder="#HEX"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Right Column: Dedicated Preview (5 cols) */}
                          <div className="xl:col-span-5 flex flex-col justify-center">
                            {renderGroupPreview(group.title, mode as ThemeMode)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </PermissionGuard>
    </div>
  );
}
