"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Save, Loader2, RefreshCw, XCircle, Sun, Moon, Sparkles, CheckCircle2, Layout, Zap, Component, Settings2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from '@/lib/mysqlDb';
import { triggerRefresh } from '@/lib/revalidateUtils';
import type { GlobalWebSettings, ThemeColors, ThemePalette, LoaderType } from '@/types/firestore';
import { hexToHslString, hslStringToHex, DEFAULT_LIGHT_THEME_COLORS_HSL, DEFAULT_DARK_THEME_COLORS_HSL, CORE_THEME_PALETTE_KEYS } from '@/lib/colorUtils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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

export default function ThemeSettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ThemeMode>('light');
  
  const [currentColorsHex, setCurrentColorsHex] = useState<Record<ThemeMode, Partial<Record<keyof ThemePalette, string>>>>({
    light: {},
    dark: {},
  });
  const [selectedLoader, setSelectedLoader] = useState<LoaderType>('logo-pulse');
  const [showLabels, setShowLabels] = useState(true);

  const loadThemeSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settingsDocRef = doc(db, WEB_SETTINGS_COLLECTION, WEB_SETTINGS_DOC_ID);
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        const globalSettings = docSnap.data() as GlobalWebSettings;
        setSelectedLoader(globalSettings.loaderType || 'logo-pulse');
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

      const settingsDocRef = doc(db, WEB_SETTINGS_COLLECTION, WEB_SETTINGS_DOC_ID);
      await setDoc(settingsDocRef, { themeColors: themeColorsToSave, loaderType: selectedLoader, updatedAt: Timestamp.now() }, { merge: true });
      await triggerRefresh('global-cache');
      toast({ title: "Theme Updated", description: "Your brand colors and loader have been synchronized." });
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
        updatedAt: Timestamp.now(),
      }, { merge: true });
      await triggerRefresh('global-cache');
      resetToDefaultColorsState();
      setSelectedLoader('logo-pulse');
      toast({ title: "System Reset Complete", description: "Default theme settings restored." });
    } catch (error) {
      toast({ title: "Reset Failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
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
                      currentColorsHex.light.primary?.toLowerCase() === preset.light.primary?.toLowerCase() &&
                      currentColorsHex.light.background?.toLowerCase() === preset.light.background?.toLowerCase();

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
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
                          "group text-left p-3 rounded-2xl border transition-all duration-200 flex flex-col gap-2.5 cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/25 shadow-md"
                            : "border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-primary/40"
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
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">{preset.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{preset.tagline}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
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
