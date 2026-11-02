"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Contact2, 
  Download, 
  FileText, 
  Image as ImageIcon, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  QrCode,
  Sparkles,
  Phone,
  Calendar,
  CreditCard
} from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { db } from '@/lib/firebase';
import { doc, getDoc } from '@/lib/mysqlDb';
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import type { ProviderApplication, FirestoreUser } from '@/types/firestore';
import { 
  getProviderIdCardSettingsAction, 
  unlockProviderIdCardAction, 
  ProviderIdCardSettings,
  DEFAULT_ID_CARD_SETTINGS 
} from '@/app/actions/providerIdCardActions';
import { jsPDF } from 'jspdf';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function ProviderIdCardPage() {
  const { user: providerUser } = useAuth();
  const { config: appConfig } = useApplicationConfig();
  const { toast } = useToast();
  const symbol = appConfig?.currencySymbol || "₹";

  const [isLoading, setIsLoading] = useState(true);
  const [providerApp, setProviderApp] = useState<ProviderApplication | null>(null);
  const [userProfile, setUserProfile] = useState<FirestoreUser | null>(null);
  const [idCardSettings, setIdCardSettings] = useState<ProviderIdCardSettings>(DEFAULT_ID_CARD_SETTINGS);
  const [isPaying, setIsPaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  // Hidden canvas refs for 300 DPI high resolution rendering
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadData = useCallback(async () => {
    if (!providerUser?.uid) return;
    setIsLoading(true);
    try {
      const [settings, appSnap, userSnap] = await Promise.all([
        getProviderIdCardSettingsAction(),
        getDoc(doc(db, "providerApplications", providerUser.uid)),
        getDoc(doc(db, "users", providerUser.uid)),
      ]);

      setIdCardSettings(settings);

      if (appSnap.exists()) {
        setProviderApp(appSnap.data() as ProviderApplication);
      }
      if (userSnap.exists()) {
        setUserProfile(userSnap.data() as FirestoreUser);
      }
    } catch (error) {
      console.error("Error loading ID card data:", error);
      toast({
        title: "Error",
        description: "Failed to load provider credentials.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [providerUser?.uid, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Provider Data formatting
  const isApproved = providerApp?.status === 'approved';
  const providerName = (providerApp?.fullName || userProfile?.displayName || providerUser?.displayName || 'Authorized Partner').toUpperCase();
  const rawId = providerUser?.uid || 'FXB1001';
  // Aadhaar/PAN style formatted Technician ID: e.g. "FXB - 4920 - 8192"
  const cleanHash = rawId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const idPart1 = (cleanHash.substring(0, 4) || 'FXB1').padEnd(4, '0');
  const idPart2 = (cleanHash.substring(4, 8) || '2026').padEnd(4, '0');
  const idPart3 = (cleanHash.substring(8, 12) || '8899').padEnd(4, '0');
  const partnerIdFormatted = `FXB - ${idPart1} - ${idPart2}`;

  const categoryLabel = (providerApp?.workCategoryName || 'Certified Service Technician').toUpperCase();
  const phone = providerApp?.mobileNumber || (userProfile as any)?.phoneNumber || (userProfile as any)?.mobileNumber || '+91 98765 43210';
  const profilePhotoUrl = providerApp?.profilePhotoUrl || userProfile?.photoURL || '';

  // Dates
  const issueDateObj = new Date();
  const issueDateStr = `${String(issueDateObj.getMonth() + 1).padStart(2, '0')}/${issueDateObj.getFullYear()}`;
  const expiryYear = issueDateObj.getFullYear() + (idCardSettings.validityYears || 2);
  const validThruStr = `${String(issueDateObj.getMonth() + 1).padStart(2, '0')}/${expiryYear}`;

  const serviceArea = providerApp?.workAreaAddress || providerApp?.address || 'Pan-City Operational Zone';
  const isUnlocked = Boolean(
    idCardSettings.downloadFee === 0 || 
    (providerApp as any)?.idCardUnlocked
  );

  // Razorpay Script Loader
  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  // Handle Payment Unlock
  const handlePayAndUnlock = async () => {
    if (!providerUser?.uid) return;
    setIsPaying(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast({ title: "Error", description: "Failed to initialize payment gateway.", variant: "destructive" });
        setIsPaying(false);
        return;
      }

      const fee = idCardSettings.downloadFee;
      const currencyCode = appConfig?.currencyCode || 'INR';
      const subunitAmount = Math.round(fee * 100);

      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: subunitAmount,
          currency: currencyCode,
          notes: {
            type: 'id_card_fee',
            providerId: providerUser.uid,
            fee: fee.toString(),
          }
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order.');
      }

      const options = {
        key: appConfig?.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Fixbro",
        description: "Official Provider PVC ID Card Unlock",
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              const unlockResult = await unlockProviderIdCardAction(providerUser.uid, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
              });
              if (unlockResult.success) {
                toast({ title: "Unlocked!", description: "Official PVC ID Card is now permanently unlocked." });
                await loadData();
              } else {
                toast({ title: "Error", description: unlockResult.message, variant: "destructive" });
              }
            } else {
              toast({ title: "Payment Failed", description: verifyData.error || "Payment verification failed.", variant: "destructive" });
            }
          } catch (e: any) {
            toast({ title: "Error", description: e.message || "Failed to verify transaction.", variant: "destructive" });
          } finally {
            setIsPaying(false);
          }
        },
        prefill: {
          name: providerName,
          email: providerUser.email || '',
          contact: phone,
        },
        theme: {
          color: "#0d9488",
        },
        modal: {
          ondismiss: function () {
            setIsPaying(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Payment unlock error:", err);
      toast({ title: "Payment Error", description: err.message || "Could not launch checkout.", variant: "destructive" });
      setIsPaying(false);
    }
  };

  // Helper to load image for canvas
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  };

  // Draw 24-spoke Ashoka Chakra motif
  const drawAshokaChakra = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, alpha: number = 0.85) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#000080';
    ctx.fillStyle = '#000080';
    ctx.lineWidth = radius * 0.08;

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.18, 0, 2 * Math.PI);
    ctx.fill();

    // 24 spokes
    for (let i = 0; i < 24; i++) {
      const angle = (i * 2 * Math.PI) / 24;
      const x2 = cx + radius * Math.cos(angle);
      const y2 = cy + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw Guilloche security pattern
  const drawGuillochePattern = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 1;
    for (let i = 40; i < width - 40; i += 28) {
      ctx.beginPath();
      for (let y = 0; y < height; y += 8) {
        const x = i + Math.sin((y + i) * 0.05) * 14;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw Barcode on Back Card
  const drawBarcode = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, code: string) => {
    ctx.save();
    ctx.fillStyle = '#111827';
    // Generate deterministic pattern based on characters
    let curX = x;
    const barCount = 48;
    const barWidth = width / barCount;
    for (let i = 0; i < barCount; i++) {
      const charCode = code.charCodeAt(i % code.length) + i;
      const isThick = charCode % 3 === 0;
      const isGap = charCode % 5 === 0;
      if (!isGap) {
        ctx.fillRect(curX, y, isThick ? barWidth * 1.6 : barWidth * 0.9, height);
      }
      curX += barWidth;
    }
    ctx.restore();
  };

  // Render 300 DPI Front Card onto Canvas (1012px x 638px)
  const renderFrontCardCanvas = async (): Promise<string> => {
    const canvas = frontCanvasRef.current || document.createElement('canvas');
    canvas.width = 1012;
    canvas.height = 638;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2D context");

    const w = 1012;
    const h = 638;

    // Card Base with rounded rectangle clip
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Subtle background tint
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#FFFFFF');
    bgGrad.addColorStop(0.5, '#F9FAFB');
    bgGrad.addColorStop(1, '#F3F4F6');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Security pattern & Watermark Ashoka Chakra
    drawGuillochePattern(ctx, w, h);
    drawAshokaChakra(ctx, w / 2 + 80, h / 2 + 20, 150, 0.05);

    // TOP BANNER: Indian Tricolor Band (Saffron, White, Green)
    // Saffron Bar
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(0, 0, w, 14);
    // White Bar
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 14, w, 10);
    // Green Bar
    ctx.fillStyle = '#138808';
    ctx.fillRect(0, 24, w, 14);

    // Header Background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 38, w, 92);

    // Header Ashoka Chakra Emblem
    drawAshokaChakra(ctx, 60, 84, 28, 0.95);

    // Header Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("FIXBRO VERIFIED SERVICE PROFESSIONAL", 108, 74);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("AUTHORIZED TECHNICIAN IDENTITY CARD  •  सेवा पेशेवर पहचान पत्र", 108, 102);

    // Government / ISO Standard Verified Pill in top right
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.roundRect(w - 200, 62, 160, 42, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("✓ VERIFIED", w - 170, 89);

    // PHOTO FRAME (Left Column)
    const photoX = 50;
    const photoY = 160;
    const photoW = 220;
    const photoH = 260;

    // Photo frame border & drop shadow
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(photoX - 4, photoY - 4, photoW + 8, photoH + 8);

    // Try loading provider photo or fallback avatar
    try {
      if (profilePhotoUrl) {
        const photoImg = await loadImage(profilePhotoUrl);
        ctx.drawImage(photoImg, photoX, photoY, photoW, photoH);
      } else {
        throw new Error("No photo");
      }
    } catch {
      // Fallback silhouette
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 16);
      ctx.textAlign = 'start';
    }

    // Photo Verified Watermark Tag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(photoX, photoY + photoH - 36, photoW, 36);
    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("FIXBRO TECHNICIAN", photoX + photoW / 2, photoY + photoH - 13);
    ctx.textAlign = 'start';

    // SMART CHIP GRAPHIC (Below Photo)
    const chipX = photoX + 45;
    const chipY = photoY + photoH + 24;
    const chipW = 130;
    const chipH = 90;
    const chipGrad = ctx.createLinearGradient(chipX, chipY, chipX + chipW, chipY + chipH);
    chipGrad.addColorStop(0, '#D4AF37');
    chipGrad.addColorStop(0.5, '#F9E29B');
    chipGrad.addColorStop(1, '#B8860B');
    ctx.fillStyle = chipGrad;
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, chipW, chipH, 8);
    ctx.fill();
    ctx.strokeStyle = '#8B6508';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Chip contact lines
    ctx.strokeStyle = '#785404';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(chipX + 22, chipY + 12, chipW - 44, chipH - 24);
    ctx.beginPath();
    ctx.moveTo(chipX + chipW / 2, chipY + 12);
    ctx.lineTo(chipX + chipW / 2, chipY + chipH - 12);
    ctx.moveTo(chipX + 22, chipY + chipH / 2);
    ctx.lineTo(chipX + chipW - 22, chipY + chipH / 2);
    ctx.stroke();

    // DETAILS (Right Column)
    const textStartX = 310;

    // Full Name
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 32px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(providerName, textStartX, 195);

    // Trade Category Badge
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.roundRect(textStartX, 215, 480, 36, 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`TRADE: ${categoryLabel}`, textStartX + 16, 240);

    // Partner ID (PAN/Aadhaar Style Big Display)
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("TECHNICIAN / PARTNER ID:", textStartX, 290);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 28px "Courier New", monospace';
    ctx.fillText(partnerIdFormatted, textStartX, 325);

    // Horizontal divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(textStartX, 345);
    ctx.lineTo(w - 50, 345);
    ctx.stroke();

    // Contact Number
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("REGISTERED MOBILE:", textStartX, 378);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(phone, textStartX + 190, 378);

    // Issue Date & Validity
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("ISSUED DATE:", textStartX, 416);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(issueDateStr, textStartX + 120, 416);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("VALID THRU:", textStartX + 260, 416);
    ctx.fillStyle = '#059669';
    ctx.font = '900 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(validThruStr, textStartX + 380, 416);

    // Security Hologram Emblem on Front Right Bottom
    const holoX = w - 190;
    const holoY = h - 170;
    const holoGrad = ctx.createRadialGradient(holoX, holoY, 10, holoX, holoY, 55);
    holoGrad.addColorStop(0, '#E0F2FE');
    holoGrad.addColorStop(0.3, '#BAE6FD');
    holoGrad.addColorStop(0.7, '#FED7AA');
    holoGrad.addColorStop(1, '#DDD6FE');
    ctx.fillStyle = holoGrad;
    ctx.beginPath();
    ctx.arc(holoX, holoY, 55, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 3;
    ctx.stroke();

    drawAshokaChakra(ctx, holoX, holoY, 32, 0.7);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 10px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("GENUINE FIXBRO", holoX, holoY + 44);
    ctx.fillText("SECURE CARD", holoX, holoY - 38);
    ctx.textAlign = 'start';

    // BOTTOM FOOTER: Indian Tricolor Stripe
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(0, h - 24, w, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, h - 16, w, 8);
    ctx.fillStyle = '#138808';
    ctx.fillRect(0, h - 8, w, 8);

    // Border surrounding the whole card
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();

    return canvas.toDataURL('image/png');
  };

  // Render 300 DPI Back Card onto Canvas (1012px x 638px)
  const renderBackCardCanvas = async (): Promise<string> => {
    const canvas = backCanvasRef.current || document.createElement('canvas');
    canvas.width = 1012;
    canvas.height = 638;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2D context");

    const w = 1012;
    const h = 638;

    // Card Base
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Security Pattern & Watermark
    drawGuillochePattern(ctx, w, h);
    drawAshokaChakra(ctx, w / 2, h / 2, 170, 0.04);

    // Top Header Banner
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, 56);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("TERMS OF VERIFICATION & EMERGENCY CONTACT / नियम एवं सत्यापन", 40, 36);

    // LEFT COLUMN: QR Code for Verification
    const qrX = 50;
    const qrY = 85;
    const qrSize = 220;

    // QR Box Background
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize, qrSize, 12);
    ctx.fill();
    ctx.stroke();

    // QR Code Image fetch
    const verifyUrl = encodeURIComponent(`https://fixbro.in/verify/provider/${providerUser?.uid || ''}`);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${verifyUrl}`;
    try {
      const qrImg = await loadImage(qrApiUrl);
      ctx.drawImage(qrImg, qrX + 10, qrY + 10, qrSize - 20, qrSize - 20);
    } catch {
      // Fallback QR pattern drawing
      ctx.fillStyle = '#111827';
      ctx.fillRect(qrX + 30, qrY + 30, 40, 40);
      ctx.fillRect(qrX + qrSize - 70, qrY + 30, 40, 40);
      ctx.fillRect(qrX + 30, qrY + qrSize - 70, 40, 40);
      ctx.font = 'bold 14px monospace';
      ctx.fillText("SCAN TO VERIFY", qrX + 45, qrY + qrSize / 2);
    }

    // QR Code caption
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("SCAN WITH ANY SMARTPHONE", qrX + qrSize / 2, qrY + qrSize + 24);
    ctx.fillText("TO VERIFY CREDENTIALS & POLICE KYC", qrX + qrSize / 2, qrY + qrSize + 42);
    ctx.textAlign = 'start';

    // RIGHT COLUMN: Operational Details & Terms
    const textX = 310;

    // Service Location Area
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("OPERATIONAL SERVICE AREA / कार्य क्षेत्र:", textX, 100);

    ctx.fillStyle = '#334155';
    ctx.font = '15px "Segoe UI", Roboto, sans-serif';
    const splitArea = serviceArea.length > 55 ? `${serviceArea.substring(0, 52)}...` : serviceArea;
    ctx.fillText(splitArea, textX, 126);

    // Helpline / Support
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("EMERGENCY & CUSTOMER HELPLINE:", textX, 168);

    ctx.fillStyle = '#0284C7';
    ctx.font = '900 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(idCardSettings.helplineNumber, textX, 194);

    // Official Disclaimer / Rules
    ctx.fillStyle = '#64748B';
    ctx.font = '12px "Segoe UI", Roboto, sans-serif';
    const rules = [
      "1. This card confirms the technician is identity-checked and verified by FixBro.",
      "2. The technician is authorized to carry out home & commercial services assigned.",
      "3. This card remains property of FixBro Technologies and is non-transferable.",
      "4. If lost or found, please return to FixBro Partner Operations or call helpline."
    ];
    let curY = 230;
    rules.forEach((line) => {
      ctx.fillText(line, textX, curY);
      curY += 20;
    });

    // Horizontal line
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(textX, 325);
    ctx.lineTo(w - 50, 325);
    ctx.stroke();

    // BARCODE & PARTNER ID (Bottom-Left)
    drawBarcode(ctx, 50, 400, 380, 55, partnerIdFormatted.replace(/[^A-Za-z0-9]/g, ''));
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(`* ${partnerIdFormatted} *`, 120, 475);

    // DIGITAL SIGNATURE & OFFICIAL SEAL (Bottom-Right)
    const signX = w - 340;
    const signY = 360;

    // Signature stamp graphic
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;
    ctx.strokeRect(signX, signY, 290, 110);

    // Signature cursive font simulation
    ctx.fillStyle = '#000080';
    ctx.font = 'italic bold 28px "Brush Script MT", "Segoe Script", cursive, sans-serif';
    ctx.fillText("FixBro Authorized", signX + 25, signY + 45);

    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(signX + 20, signY + 58);
    ctx.lineTo(signX + 260, signY + 58);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 13px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(idCardSettings.signatoryName, signX + 20, signY + 80);
    ctx.fillStyle = '#64748B';
    ctx.font = '11px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("DIGITALLY SIGNED & VERIFIED ON ISSUANCE", signX + 20, signY + 98);

    // BOTTOM FOOTER: Indian Tricolor Stripe
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(0, h - 24, w, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, h - 16, w, 8);
    ctx.fillStyle = '#138808';
    ctx.fillRect(0, h - 8, w, 8);

    // Outer Border
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();

    return canvas.toDataURL('image/png');
  };

  // 1. Download Front Image
  const handleDownloadFrontPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderFrontCardCanvas();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `FixBro_ID_Front_${cleanHash}.png`;
      a.click();
      toast({ title: "Downloaded!", description: "Front ID card image saved in 300 DPI high resolution." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate front image.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Download Back Image
  const handleDownloadBackPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderBackCardCanvas();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `FixBro_ID_Back_${cleanHash}.png`;
      a.click();
      toast({ title: "Downloaded!", description: "Back ID card image saved in 300 DPI high resolution." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate back image.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Download PVC Card Print-Ready PDF (CR80 Standard: 85.6mm x 54mm)
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const frontDataUrl = await renderFrontCardCanvas();
      const backDataUrl = await renderBackCardCanvas();

      // Standard CR80 PVC Plastic Card dimensions in millimeters
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98]
      });

      // Page 1: Front
      pdf.addImage(frontDataUrl, 'PNG', 0, 0, 85.6, 53.98);

      // Page 2: Back
      pdf.addPage([85.6, 53.98], 'landscape');
      pdf.addImage(backDataUrl, 'PNG', 0, 0, 85.6, 53.98);

      pdf.save(`FixBro_PVC_ID_Card_${cleanHash}.pdf`);
      toast({ 
        title: "PVC Print PDF Downloaded!", 
        description: "Standard CR80 85.6mm x 54mm PDF ready for plastic ID card printers." 
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Feature Disabled Notice
  if (!idCardSettings.isIdCardEnabled) {
    return (
      <ProtectedRoute>
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="p-4 rounded-full bg-muted/60 w-16 h-16 mx-auto flex items-center justify-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">ID Card Generation Disabled</h2>
          <p className="text-sm text-muted-foreground">
            Official PVC ID card generation is currently disabled by the administration. Please check back later or contact partner support.
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  // Not Approved Notice
  if (!isApproved) {
    return (
      <ProtectedRoute>
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <div className="p-4 rounded-full bg-amber-500/10 text-amber-600 w-16 h-16 mx-auto flex items-center justify-center border border-amber-500/20">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Application Verification Pending</h2>
          <p className="text-sm text-muted-foreground">
            Official PVC printable ID cards can only be generated for <strong>Approved & Background-Verified</strong> service partners. Your application status is currently: <span className="font-semibold text-primary capitalize">{providerApp?.status || 'Pending'}</span>.
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Contact2 className="h-7 w-7 text-primary" />
              Official Service Partner ID Card
            </h1>
            <p className="text-sm text-muted-foreground">
              Aadhaar & PAN style professional identity card formatted for standard CR80 PVC plastic printers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeSide === 'front' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSide('front')}
              className="text-xs font-semibold"
            >
              Front Side
            </Button>
            <Button
              variant={activeSide === 'back' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSide('back')}
              className="text-xs font-semibold"
            >
              Back Side
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Flip Card
            </Button>
          </div>
        </div>

        {/* Live Interactive Card Preview */}
        <div className="flex justify-center py-4">
          <div className="w-full max-w-[506px] aspect-[1.585/1] rounded-2xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 overflow-hidden relative select-none transition-all duration-300">
            {activeSide === 'front' ? (
              // FRONT CARD PREVIEW
              <div className="h-full w-full flex flex-col justify-between p-0 relative bg-gradient-to-br from-white via-slate-50 to-slate-100">
                {/* Top Tricolor Strip */}
                <div className="w-full">
                  <div className="h-1 bg-[#FF9933] w-full" />
                  <div className="h-1 bg-white w-full" />
                  <div className="h-1 bg-[#138808] w-full" />
                  <div className="bg-[#0F172A] text-white px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-blue-400 flex items-center justify-center text-[10px] font-bold text-blue-300">
                        ☸
                      </div>
                      <div className="leading-tight">
                        <div className="text-[11px] font-black tracking-wide">FIXBRO VERIFIED PARTNER</div>
                        <div className="text-[8px] text-slate-400 font-semibold tracking-wider">TECHNICIAN IDENTITY CARD</div>
                      </div>
                    </div>
                    <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                      VERIFIED
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-4 py-2 flex gap-3 flex-grow items-center">
                  {/* Photo & Chip Column */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="w-24 h-28 rounded-lg overflow-hidden border-2 border-slate-300 bg-slate-200 flex items-center justify-center relative shadow-sm">
                      {profilePhotoUrl ? (
                        <img src={profilePhotoUrl} alt={providerName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-slate-600">{providerName.charAt(0)}</span>
                      )}
                      <div className="absolute bottom-0 w-full bg-slate-900/80 text-[7px] font-bold text-emerald-400 text-center py-0.5">
                        TECHNICIAN
                      </div>
                    </div>
                    {/* Metallic Smart Chip */}
                    <div className="w-12 h-8 rounded bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-600 border border-amber-700/60 shadow-inner flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-amber-900/60" />
                    </div>
                  </div>

                  {/* Details Column */}
                  <div className="flex flex-col justify-center space-y-1 overflow-hidden flex-grow">
                    <h3 className="text-sm font-black text-slate-900 truncate tracking-tight">{providerName}</h3>
                    <div className="bg-sky-600 text-white text-[9px] font-bold px-2 py-0.5 rounded max-w-fit truncate">
                      TRADE: {categoryLabel}
                    </div>

                    <div className="pt-1">
                      <div className="text-[8px] text-slate-500 font-bold uppercase">TECHNICIAN / PARTNER ID:</div>
                      <div className="text-xs font-black font-mono text-slate-900 tracking-wider">
                        {partnerIdFormatted}
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-700 font-medium pt-1 flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5 text-slate-500" />
                      <span className="font-bold">{phone}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[8px] text-slate-600 pt-0.5">
                      <span>ISSUE: <strong>{issueDateStr}</strong></span>
                      <span>VALID THRU: <strong className="text-emerald-700">{validThruStr}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Bottom Tricolor Strip */}
                <div className="w-full">
                  <div className="h-0.5 bg-[#FF9933] w-full" />
                  <div className="h-0.5 bg-white w-full" />
                  <div className="h-0.5 bg-[#138808] w-full" />
                </div>
              </div>
            ) : (
              // BACK CARD PREVIEW
              <div className="h-full w-full flex flex-col justify-between p-0 relative bg-gradient-to-br from-white via-slate-50 to-slate-100">
                {/* Header */}
                <div className="bg-[#0F172A] text-white px-3 py-1.5 text-[9px] font-bold tracking-wider">
                  TERMS OF IDENTIFICATION & EMERGENCY CONTACT / नियम एवं सत्यापन
                </div>

                {/* Body */}
                <div className="px-4 py-2 flex gap-3 flex-grow items-center">
                  {/* Left QR Code Box */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-24 h-24 p-1.5 bg-white border border-slate-400 rounded-lg shadow-sm flex items-center justify-center">
                      <QrCode className="w-20 h-20 text-slate-900" />
                    </div>
                    <span className="text-[7px] text-slate-600 font-bold mt-1 text-center leading-tight">
                      SCAN TO VERIFY<br />POLICE & KYC STATUS
                    </span>
                  </div>

                  {/* Right Terms & Signature */}
                  <div className="flex flex-col justify-between space-y-1.5 flex-grow text-[8px] text-slate-700">
                    <div>
                      <div className="font-bold text-slate-900 text-[9px]">OPERATIONAL SERVICE AREA:</div>
                      <div className="truncate text-slate-600">{serviceArea}</div>
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 text-[9px]">HELPLINE & LOST CARD:</div>
                      <div className="font-black text-sky-700 text-[10px]">{idCardSettings.helplineNumber}</div>
                    </div>

                    <div className="space-y-0.5 text-[7px] text-slate-500 leading-tight">
                      <p>• Authorized FixBro partner background-verified by platform.</p>
                      <p>• If found, return to FixBro Partner Operations or nearest hub.</p>
                    </div>

                    {/* Signature stamp */}
                    <div className="border border-sky-400/60 rounded p-1 bg-sky-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-serif italic font-bold text-blue-900 text-[9px]">FixBro Authorized</div>
                        <div className="text-[6px] font-semibold text-slate-600">{idCardSettings.signatoryName}</div>
                      </div>
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                  </div>
                </div>

                {/* Bottom Tricolor Strip */}
                <div className="w-full">
                  <div className="h-0.5 bg-[#FF9933] w-full" />
                  <div className="h-0.5 bg-white w-full" />
                  <div className="h-0.5 bg-[#138808] w-full" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden canvases for high-res generation */}
        <div className="hidden">
          <canvas ref={frontCanvasRef} width={1012} height={638} />
          <canvas ref={backCanvasRef} width={1012} height={638} />
        </div>

        {/* Download & Payment Action Box */}
        <Card className="border-border/60 shadow-md">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  {isUnlocked ? (
                    <>
                      <Unlock className="h-5 w-5 text-emerald-600" />
                      ID Card Unlocked & Ready for High-Res Print
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5 text-amber-600" />
                      Unlock Official Printable ID Card
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {isUnlocked 
                    ? "Download your high-resolution PVC print-ready PDF and separate 300 DPI Front/Back PNG graphics."
                    : `Pay the nominal fee of ${symbol}${idCardSettings.downloadFee} set by administration to unlock and permanently download your official ID card.`}
                </CardDescription>
              </div>

              {!isUnlocked && idCardSettings.downloadFee > 0 && (
                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Download Fee:</span>
                  <span className="text-lg font-black text-primary">{symbol}{idCardSettings.downloadFee}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {!isUnlocked ? (
              // Locked State
              <div className="p-6 rounded-2xl bg-muted/30 border border-dashed text-center space-y-4">
                <div className="max-w-md mx-auto space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Unlock your official verified PVC printable ID Card with scannable QR code and partner identification.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Once unlocked, you receive unlimited downloads of the standard plastic PVC printer layout (CR80 85.6mm x 54mm) and 300 DPI PNG images.
                  </p>
                </div>
                <Button
                  onClick={handlePayAndUnlock}
                  disabled={isPaying}
                  size="lg"
                  className="px-8 font-bold shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isPaying ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-5 w-5 mr-2" />
                  )}
                  Pay {symbol}{idCardSettings.downloadFee} & Unlock ID Card
                </Button>
              </div>
            ) : (
              // Unlocked State - 3 High-Quality Download Buttons
              <div className="grid gap-4 sm:grid-cols-3">
                {/* 1. PVC Card PDF */}
                <div className="p-4 rounded-xl border bg-card hover:border-primary/40 transition-all space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FileText className="h-6 w-6 text-red-500" />
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/30">
                        PVC Print Ready
                      </Badge>
                    </div>
                    <h4 className="font-bold text-sm text-foreground">Official PVC PDF</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Standard CR80 (85.6mm × 54mm) 2-page PDF formatted for PVC plastic card printers.
                    </p>
                  </div>
                  <Button
                    onClick={handleDownloadPdf}
                    disabled={isExporting}
                    variant="default"
                    className="w-full text-xs font-bold"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                    Download PDF
                  </Button>
                </div>

                {/* 2. Front Image PNG */}
                <div className="p-4 rounded-xl border bg-card hover:border-primary/40 transition-all space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <ImageIcon className="h-6 w-6 text-blue-500" />
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                        300 DPI
                      </Badge>
                    </div>
                    <h4 className="font-bold text-sm text-foreground">Front Card (PNG)</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Crisp 1012 × 638 pixel PNG graphic with Indian flag header and verified photo.
                    </p>
                  </div>
                  <Button
                    onClick={handleDownloadFrontPng}
                    disabled={isExporting}
                    variant="outline"
                    className="w-full text-xs font-bold"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                    Download Front PNG
                  </Button>
                </div>

                {/* 3. Back Image PNG */}
                <div className="p-4 rounded-xl border bg-card hover:border-primary/40 transition-all space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <ImageIcon className="h-6 w-6 text-emerald-500" />
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        300 DPI
                      </Badge>
                    </div>
                    <h4 className="font-bold text-sm text-foreground">Back Card (PNG)</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      High resolution PNG graphic with scannable QR code, barcode, and digital signature.
                    </p>
                  </div>
                  <Button
                    onClick={handleDownloadBackPng}
                    disabled={isExporting}
                    variant="outline"
                    className="w-full text-xs font-bold"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                    Download Back PNG
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
