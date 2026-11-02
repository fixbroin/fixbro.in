"use client";

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  FileText, 
  Image as ImageIcon, 
  QrCode, 
  CreditCard, 
  Phone, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ShieldCheck,
  Copy,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from 'jspdf';
import type { ProviderIdCardRecord } from '@/types/providerAreaAndId';
import { trackIdCardDownloadAction } from '@/app/actions/providerIdCardActions';

interface ProviderIdCardModalProps {
  provider: ProviderIdCardRecord | null;
  isOpen: boolean;
  onClose: () => void;
  currencySymbol?: string;
  signatoryName?: string;
  helplinePhone?: string;
}

export default function ProviderIdCardModal({
  provider,
  isOpen,
  onClose,
  currencySymbol = "₹",
  signatoryName = "Authorized Signatory - FixBro",
  helplinePhone = "+91 8000 123 456",
}: ProviderIdCardModalProps) {
  const { toast } = useToast();
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [isExporting, setIsExporting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!provider) return null;

  const providerName = (provider.fullName || 'Authorized Partner').toUpperCase();
  const technicianId = provider.technicianId || 'FXB - 1001 - 2026';
  const cleanHash = provider.providerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const phone = provider.mobileNumber || 'Not Provided';
  const categoryLabel = (provider.workCategoryName || 'General Service Partner').toUpperCase();
  const serviceArea = provider.workAreaAddress || 'Standard Citywide Coverage';
  const profilePhotoUrl = provider.profilePhotoUrl;

  const issueDate = provider.idCardUnlockedAt || provider.idCardGeneratedAt ? new Date(provider.idCardUnlockedAt || provider.idCardGeneratedAt!) : new Date();
  const issueDateStr = `${String(issueDate.getDate()).padStart(2, '0')}/${String(issueDate.getMonth() + 1).padStart(2, '0')}/${issueDate.getFullYear()}`;
  const validThruDate = new Date(issueDate);
  validThruDate.setFullYear(validThruDate.getFullYear() + 2);
  const validThruStr = `${String(validThruDate.getDate()).padStart(2, '0')}/${String(validThruDate.getMonth() + 1).padStart(2, '0')}/${validThruDate.getFullYear()}`;

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    toast({ title: "Copied!", description: `Copied to clipboard.` });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  };

  const drawAshokaChakra = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, alpha: number = 0.85) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#000080';
    ctx.fillStyle = '#000080';
    ctx.lineWidth = radius * 0.08;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.18, 0, 2 * Math.PI);
    ctx.fill();

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

  const drawBarcode = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, code: string) => {
    ctx.save();
    ctx.fillStyle = '#111827';
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

  // Render Front Canvas 300 DPI
  const renderFrontCardCanvas = async (): Promise<string> => {
    const canvas = frontCanvasRef.current || document.createElement('canvas');
    canvas.width = 1012;
    canvas.height = 638;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2D context");

    const w = 1012;
    const h = 638;

    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#FFFFFF');
    bgGrad.addColorStop(0.5, '#F9FAFB');
    bgGrad.addColorStop(1, '#F3F4F6');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    drawGuillochePattern(ctx, w, h);
    drawAshokaChakra(ctx, w / 2 + 80, h / 2 + 20, 150, 0.05);

    // Tricolor Top Band
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 14, w, 10);
    ctx.fillStyle = '#138808';
    ctx.fillRect(0, 24, w, 14);

    // Header Background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 38, w, 92);

    // Header Emblem
    drawAshokaChakra(ctx, 60, 84, 28, 0.95);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("FIXBRO VERIFIED SERVICE PROFESSIONAL", 108, 74);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("AUTHORIZED TECHNICIAN IDENTITY CARD  •  सेवा पेशेवर पहचान पत्र", 108, 102);

    // Verified Pill
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.roundRect(w - 200, 62, 160, 42, 8);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("✓ VERIFIED", w - 120, 89);
    ctx.textAlign = 'start';

    // Provider Photo
    const photoX = 50;
    const photoY = 160;
    const photoW = 200;
    const photoH = 250;

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.roundRect(photoX, photoY, photoW, photoH, 12);
    ctx.fill();
    ctx.stroke();

    if (profilePhotoUrl) {
      try {
        const pImg = await loadImage(profilePhotoUrl);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(photoX, photoY, photoW, photoH, 12);
        ctx.clip();
        ctx.drawImage(pImg, photoX, photoY, photoW, photoH);
        ctx.restore();
      } catch {
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 18);
        ctx.textAlign = 'start';
      }
    } else {
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(providerName.charAt(0), photoX + photoW / 2, photoY + photoH / 2 + 18);
      ctx.textAlign = 'start';
    }

    // Photo Badge Pill
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(photoX, photoY + photoH - 36, photoW, 36);
    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 14px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("GOVT KYC VERIFIED", photoX + photoW / 2, photoY + photoH - 13);
    ctx.textAlign = 'start';

    // Smart Chip
    const chipX = photoX + 45;
    const chipY = photoY + photoH + 24;
    const chipW = 110;
    const chipH = 75;
    const chipGrad = ctx.createLinearGradient(chipX, chipY, chipX + chipW, chipY + chipH);
    chipGrad.addColorStop(0, '#D97706');
    chipGrad.addColorStop(0.5, '#FDE68A');
    chipGrad.addColorStop(1, '#B45309');
    ctx.fillStyle = chipGrad;
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(chipX, chipY, chipW, chipH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chipX + 35, chipY);
    ctx.lineTo(chipX + 35, chipY + chipH);
    ctx.moveTo(chipX + 75, chipY);
    ctx.lineTo(chipX + 75, chipY + chipH);
    ctx.moveTo(chipX, chipY + chipH / 2);
    ctx.lineTo(chipX + chipW, chipY + chipH / 2);
    ctx.stroke();

    // Provider Details
    const textX = 290;
    let textY = 190;

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("NAME OF SERVICE PROFESSIONAL / नाम:", textX, textY);

    textY += 32;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 30px "Segoe UI", Roboto, sans-serif';
    const splitName = providerName.length > 25 ? `${providerName.substring(0, 24)}...` : providerName;
    ctx.fillText(splitName, textX, textY);

    textY += 34;
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.roundRect(textX, textY - 24, 380, 36, 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`AUTHORIZED TRADE: ${categoryLabel}`, textX + 16, textY);

    textY += 46;
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("TECHNICIAN / PARTNER IDENTIFIER (ID):", textX, textY);

    textY += 36;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 34px "Consolas", monospace';
    ctx.fillText(technicianId, textX, textY);

    textY += 42;
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`REGISTERED PHONE:  ${phone}`, textX, textY);

    textY += 38;
    ctx.fillStyle = '#64748B';
    ctx.font = '16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`ISSUED: ${issueDateStr}`, textX, textY);
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`VALID THRU: ${validThruStr}`, textX + 220, textY);

    // Security Hologram
    const holoX = w - 140;
    const holoY = h - 160;
    const holoRadius = 65;
    const holoGrad = ctx.createRadialGradient(holoX, holoY, 5, holoX, holoY, holoRadius);
    holoGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    holoGrad.addColorStop(0.3, 'rgba(167, 139, 250, 0.7)');
    holoGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.7)');
    holoGrad.addColorStop(1, 'rgba(52, 211, 153, 0.8)');
    ctx.fillStyle = holoGrad;
    ctx.beginPath();
    ctx.arc(holoX, holoY, holoRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawAshokaChakra(ctx, holoX, holoY, 32, 0.4);
    ctx.fillStyle = '#312E81';
    ctx.font = 'bold 10px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("GENUINE FIXBRO", holoX, holoY + 44);
    ctx.fillText("SECURE CARD", holoX, holoY - 38);
    ctx.textAlign = 'start';

    // Bottom Tricolor Stripe
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(0, h - 24, w, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, h - 16, w, 8);
    ctx.fillStyle = '#138808';
    ctx.fillRect(0, h - 8, w, 8);

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();

    return canvas.toDataURL('image/png');
  };

  // Render Back Canvas 300 DPI
  const renderBackCardCanvas = async (): Promise<string> => {
    const canvas = backCanvasRef.current || document.createElement('canvas');
    canvas.width = 1012;
    canvas.height = 638;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2D context");

    const w = 1012;
    const h = 638;

    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    drawGuillochePattern(ctx, w, h);
    drawAshokaChakra(ctx, w / 2, h / 2, 170, 0.04);

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, 56);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("TERMS OF VERIFICATION & EMERGENCY CONTACT / नियम एवं सत्यापन", 40, 36);

    // QR Code Box
    const qrX = 50;
    const qrY = 85;
    const qrSize = 220;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(qrX, qrY, qrSize, qrSize, 12);
    ctx.fill();
    ctx.stroke();

    const verifyUrl = encodeURIComponent(`https://fixbro.in/verify/provider/${provider.providerId}`);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${verifyUrl}`;
    try {
      const qrImg = await loadImage(qrApiUrl);
      ctx.drawImage(qrImg, qrX + 10, qrY + 10, qrSize - 20, qrSize - 20);
    } catch {
      ctx.fillStyle = '#111827';
      ctx.fillRect(qrX + 30, qrY + 30, 40, 40);
      ctx.fillRect(qrX + qrSize - 70, qrY + 30, 40, 40);
      ctx.fillRect(qrX + 30, qrY + qrSize - 70, 40, 40);
      ctx.font = 'bold 14px monospace';
      ctx.fillText("SCAN TO VERIFY", qrX + 45, qrY + qrSize / 2);
    }

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("SCAN WITH ANY SMARTPHONE", qrX + qrSize / 2, qrY + qrSize + 24);
    ctx.fillText("TO VERIFY CREDENTIALS & POLICE KYC", qrX + qrSize / 2, qrY + qrSize + 42);
    ctx.textAlign = 'start';

    // Right Column
    const textX = 310;
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("OPERATIONAL SERVICE AREA / कार्य क्षेत्र:", textX, 100);

    ctx.fillStyle = '#334155';
    ctx.font = '15px "Segoe UI", Roboto, sans-serif';
    const splitArea = serviceArea.length > 55 ? `${serviceArea.substring(0, 52)}...` : serviceArea;
    ctx.fillText(splitArea, textX, 126);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("CUSTOMER SUPPORT & HELPLINE:", textX, 165);

    ctx.fillStyle = '#0284C7';
    ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(helplinePhone, textX, 192);

    ctx.fillStyle = '#475569';
    ctx.font = '13px "Segoe UI", Roboto, sans-serif';
    ctx.fillText("• Always display this ID card while servicing customers on-site.", textX, 230);
    ctx.fillText("• Valid only when actively designated as an approved partner.", textX, 254);
    ctx.fillText("• Report immediately to FixBro administration if lost or damaged.", textX, 278);

    // Digital Signatory
    const signX = w - 280;
    const signY = 320;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(signX, signY + 36);
    ctx.lineTo(signX + 220, signY + 36);
    ctx.stroke();

    ctx.fillStyle = '#1E3A8A';
    ctx.font = 'italic bold 22px "Brush Script MT", cursive, Georgia, serif';
    ctx.fillText("FixBro Verification Cell", signX + 20, signY + 28);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
    ctx.fillText(signatoryName, signX + 15, signY + 54);

    // Barcode
    const barW = w - 100;
    const barH = 50;
    const barX = 50;
    const barY = h - 145;

    drawBarcode(ctx, barX, barY, barW, barH, cleanHash);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 15px "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`* ${technicianId} *`, w / 2, barY + barH + 22);
    ctx.textAlign = 'start';

    // Bottom Stripe
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(0, h - 24, w, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, h - 16, w, 8);
    ctx.fillStyle = '#138808';
    ctx.fillRect(0, h - 8, w, 8);

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();

    return canvas.toDataURL('image/png');
  };

  // Download Front PNG
  const handleDownloadFrontPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderFrontCardCanvas();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `FixBro_ID_Front_${cleanHash}.png`;
      a.click();
      trackIdCardDownloadAction(provider.providerId, 'front_png').catch(console.error);
      toast({ title: "Downloaded Front PNG", description: "300 DPI high resolution front card saved." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to download image", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Download Back PNG
  const handleDownloadBackPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderBackCardCanvas();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `FixBro_ID_Back_${cleanHash}.png`;
      a.click();
      trackIdCardDownloadAction(provider.providerId, 'back_png').catch(console.error);
      toast({ title: "Downloaded Back PNG", description: "300 DPI high resolution back card saved." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to download image", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Download PVC Print Ready PDF
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const frontDataUrl = await renderFrontCardCanvas();
      const backDataUrl = await renderBackCardCanvas();

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 53.98]
      });

      pdf.addImage(frontDataUrl, 'PNG', 0, 0, 85.6, 53.98);
      pdf.addPage([85.6, 53.98], 'landscape');
      pdf.addImage(backDataUrl, 'PNG', 0, 0, 85.6, 53.98);

      pdf.save(`FixBro_PVC_ID_Card_${cleanHash}.pdf`);
      trackIdCardDownloadAction(provider.providerId, 'pdf').catch(console.error);
      toast({
        title: "Downloaded PVC Print PDF",
        description: "Official 85.6mm x 54mm PDF generated successfully."
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                Provider ID Card • {providerName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                CR80 PVC Printable Plastic Card with Indian Flag theme & security features
              </DialogDescription>
            </div>

            {/* Toggle Front / Back Preview */}
            <div className="flex items-center gap-2">
              <Button
                variant={activeSide === 'front' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSide('front')}
                className="text-xs h-8"
              >
                Front Side
              </Button>
              <Button
                variant={activeSide === 'back' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSide('back')}
                className="text-xs h-8"
              >
                Back Side
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
                className="text-xs h-8 flex items-center gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Flip
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Card Visual Preview */}
        <div className="flex justify-center py-4">
          <div className="w-full max-w-[506px] aspect-[1.585/1] rounded-2xl shadow-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 overflow-hidden relative select-none transition-all duration-300">
            {activeSide === 'front' ? (
              // FRONT PREVIEW
              <div className="h-full w-full flex flex-col justify-between p-0 relative bg-gradient-to-br from-white via-slate-50 to-slate-100">
                <div className="w-full">
                  <div className="h-1 bg-[#FF9933] w-full" />
                  <div className="h-1 bg-white w-full" />
                  <div className="h-1 bg-[#138808] w-full" />
                  <div className="bg-[#0F172A] text-white px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border border-blue-400 flex items-center justify-center text-[9px] font-bold text-blue-300">
                        ☸
                      </div>
                      <div className="leading-tight">
                        <div className="text-[10px] font-black tracking-wide">FIXBRO VERIFIED PARTNER</div>
                        <div className="text-[7.5px] text-slate-400 font-semibold tracking-wider">TECHNICIAN IDENTITY CARD</div>
                      </div>
                    </div>
                    <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm">
                      VERIFIED
                    </span>
                  </div>
                </div>

                <div className="px-4 py-2 flex gap-3 flex-grow items-center">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="w-20 h-24 rounded-lg overflow-hidden border-2 border-slate-300 bg-slate-200 flex items-center justify-center relative shadow-sm">
                      {profilePhotoUrl ? (
                        <img src={profilePhotoUrl} alt={providerName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-slate-600">{providerName.charAt(0)}</span>
                      )}
                      <div className="absolute bottom-0 w-full bg-slate-900/80 text-[6.5px] font-bold text-emerald-400 text-center py-0.5">
                        TECHNICIAN
                      </div>
                    </div>
                    <div className="w-10 h-6 rounded bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-600 border border-amber-700/60 shadow-inner flex items-center justify-center">
                      <CreditCard className="h-3 w-3 text-amber-900/60" />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center space-y-1 overflow-hidden flex-grow">
                    <h3 className="text-xs font-black text-slate-900 truncate tracking-tight">{providerName}</h3>
                    <div className="bg-sky-600 text-white text-[8px] font-bold px-2 py-0.5 rounded max-w-fit truncate">
                      TRADE: {categoryLabel}
                    </div>

                    <div className="pt-0.5">
                      <div className="text-[7.5px] text-slate-500 font-bold uppercase">TECHNICIAN / PARTNER ID:</div>
                      <div className="text-[11px] font-black font-mono text-slate-900 tracking-wider">
                        {technicianId}
                      </div>
                    </div>

                    <div className="text-[8px] text-slate-700 font-medium pt-0.5 flex items-center gap-1">
                      <Phone className="h-2 w-2 text-slate-500" />
                      <span className="font-bold">{phone}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[7px] text-slate-600 pt-0.5">
                      <span>ISSUE: <strong>{issueDateStr}</strong></span>
                      <span>VALID THRU: <strong className="text-emerald-700">{validThruStr}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <div className="h-0.5 bg-[#FF9933] w-full" />
                  <div className="h-0.5 bg-white w-full" />
                  <div className="h-0.5 bg-[#138808] w-full" />
                </div>
              </div>
            ) : (
              // BACK PREVIEW
              <div className="h-full w-full flex flex-col justify-between p-0 relative bg-gradient-to-br from-white via-slate-50 to-slate-100">
                <div className="bg-[#0F172A] text-white px-3 py-1.5 text-[8.5px] font-bold tracking-wider">
                  TERMS OF IDENTIFICATION & EMERGENCY CONTACT / नियम एवं सत्यापन
                </div>

                <div className="px-4 py-2 flex gap-3 flex-grow items-center">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-20 h-20 p-1 bg-white border border-slate-400 rounded-lg shadow-sm flex items-center justify-center">
                      <QrCode className="w-16 h-16 text-slate-900" />
                    </div>
                    <span className="text-[6.5px] text-slate-600 font-bold mt-1 text-center leading-tight">
                      SCAN TO VERIFY KYC
                    </span>
                  </div>

                  <div className="flex flex-col justify-center space-y-1 overflow-hidden flex-grow text-[8px] text-slate-800">
                    <div>
                      <span className="font-bold text-slate-900">SERVICE AREA:</span>
                      <p className="text-[7.5px] text-slate-600 truncate">{serviceArea}</p>
                    </div>

                    <div className="pt-0.5">
                      <span className="font-bold text-slate-900">HELPLINE: </span>
                      <span className="font-bold text-sky-600">{helplinePhone}</span>
                    </div>

                    <p className="text-[6.5px] text-slate-500 leading-tight pt-0.5">
                      • Must be presented on request during service visits.<br />
                      • Report lost or damaged cards to FixBro administration.
                    </p>

                    <div className="pt-1 text-right">
                      <div className="text-[9px] font-bold italic font-serif text-slate-800">FixBro Cell</div>
                      <div className="text-[6px] text-slate-500 font-semibold">{signatoryName}</div>
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <div className="h-0.5 bg-[#FF9933] w-full" />
                  <div className="h-0.5 bg-white w-full" />
                  <div className="h-0.5 bg-[#138808] w-full" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Download Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-4 border-b">
          <Button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download PVC Print PDF (CR80)
          </Button>

          <Button
            onClick={handleDownloadFrontPng}
            disabled={isExporting}
            variant="outline"
            className="h-9 text-xs font-semibold flex items-center gap-1.5"
          >
            <ImageIcon className="h-3.5 w-3.5 text-sky-600" />
            Download Front Image (PNG)
          </Button>

          <Button
            onClick={handleDownloadBackPng}
            disabled={isExporting}
            variant="outline"
            className="h-9 text-xs font-semibold flex items-center gap-1.5"
          >
            <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
            Download Back Image (PNG)
          </Button>
        </div>

        {/* Detailed Provider Metrics: Purchase Status & Download History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
          {/* Purchase Details */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-primary" /> Purchase & Unlock Info
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Unlock Status:</span>
                {provider.idCardUnlocked ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Unlocked / Purchased
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-400/40 text-[10px]">
                    <Clock className="h-3 w-3 mr-1" /> Pending Unlock
                  </Badge>
                )}
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-semibold text-foreground">
                  {provider.idCardPaidAmount ? `${currencySymbol}${provider.idCardPaidAmount}` : (provider.idCardUnlocked ? 'Free (₹0)' : '—')}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Razorpay Payment ID:</span>
                {provider.idCardPaymentId ? (
                  <button
                    onClick={() => copyToClipboard(provider.idCardPaymentId!, 'payId')}
                    className="font-mono text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>{provider.idCardPaymentId}</span>
                    {copiedField === 'payId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Razorpay Order ID:</span>
                {provider.idCardOrderId ? (
                  <button
                    onClick={() => copyToClipboard(provider.idCardOrderId!, 'orderId')}
                    className="font-mono text-[11px] text-slate-700 dark:text-slate-300 hover:underline flex items-center gap-1"
                  >
                    <span>{provider.idCardOrderId}</span>
                    {copiedField === 'orderId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Download Tracking Metrics */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="h-4 w-4 text-emerald-600" /> Download Statistics
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Total Downloads:</span>
                <span className="font-bold text-sm text-foreground">
                  {provider.idCardDownloadCount || 0} times
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Formats Breakdown:</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">PDF: {provider.idCardPdfDownloadCount || 0}</Badge>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">Front: {provider.idCardFrontPngDownloadCount || 0}</Badge>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">Back: {provider.idCardBackPngDownloadCount || 0}</Badge>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Last Downloaded:</span>
                <span className="font-medium text-foreground">
                  {provider.idCardLastDownloadedAt ? new Date(provider.idCardLastDownloadedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }) : 'Never'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Card Generated At:</span>
                <span className="font-medium text-foreground">
                  {provider.idCardGeneratedAt ? new Date(provider.idCardGeneratedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Download Event History Log */}
        {provider.idCardDownloads && provider.idCardDownloads.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <h5 className="text-xs font-semibold text-muted-foreground mb-2">
              Recent Download History Log (Latest {provider.idCardDownloads.length})
            </h5>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {provider.idCardDownloads.map((dl, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-100 dark:bg-slate-800/60"
                >
                  <span className="flex items-center gap-1.5 font-medium capitalize">
                    {dl.type === 'pdf' ? (
                      <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-sky-600" />
                    )}
                    {dl.type.replace('_', ' ').toUpperCase()} Download
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {new Date(dl.downloadedAt).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'medium'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
