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
  recordIdCardGenerationAction,
  trackIdCardDownloadAction,
} from '@/app/actions/providerIdCardActions';
import { 
  type ProviderIdCardSettings, 
  DEFAULT_ID_CARD_SETTINGS,
  generateUniqueIdCardNumber 
} from '@/types/providerAreaAndId';
import OfficialIdCardView from '@/components/shared/OfficialIdCardView';
import { 
  type IdCardRenderOptions, 
  renderFrontCardCanvas, 
  renderBackCardCanvas, 
  generatePvcPdf 
} from '@/lib/idCardRenderer';

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

  // Canvas refs for 300 DPI exports
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
        const appData = appSnap.data() as ProviderApplication;
        setProviderApp(appData);
        if (appData.status === 'approved' && providerUser?.uid) {
          recordIdCardGenerationAction(providerUser.uid).catch(console.error);
        }
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
  const categoryLabel = providerApp?.workCategoryName || 'Certified Technician';
  const profilePhotoUrl = providerApp?.profilePhotoUrl || userProfile?.photoURL || '';

  // Dates
  const issueDateObj = new Date();
  const issueDateStr = `${String(issueDateObj.getMonth() + 1).padStart(2, '0')}/${issueDateObj.getFullYear()}`;
  const expiryYear = issueDateObj.getFullYear() + (idCardSettings.validityYears || 2);
  const validThruStr = `${String(issueDateObj.getMonth() + 1).padStart(2, '0')}/${expiryYear}`;

  const isUnlocked = Boolean(
    idCardSettings.downloadFee === 0 || 
    (providerApp as any)?.idCardUnlocked
  );

  // Generate unique 12-digit Aadhaar style ID number
  const uniqueIdNumber = (providerApp as any)?.idCardNumber || generateUniqueIdCardNumber(
    providerUser?.uid || '',
    idCardSettings.idNumberStartingSeq,
    idCardSettings.idNumberPrefix
  );

  // Construct render options
  const cardRenderOptions: IdCardRenderOptions = {
    providerName,
    categoryName: categoryLabel,
    skillLevelLabel: providerApp?.skillLevelLabel || 'Skilled Professional',
    gender: providerApp?.gender || 'Male',
    idCardNumber: uniqueIdNumber,
    profilePhotoUrl,
    residentialAddress: providerApp?.address || providerApp?.workAreaAddress || 'Address on FixBro file',
    helplinePhone: idCardSettings.helplineNumber,
    signatoryName: idCardSettings.signatoryName,
    issueDateStr,
    validThruStr,
    disclaimerText: idCardSettings.disclaimerText,
    verifyUrl: `https://fixbro.in/verify/provider/${providerUser?.uid || ''}`,
  };

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

      // Create order
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: idCardSettings.downloadFee,
          receipt: `idcard_${providerUser.uid.substring(0, 10)}_${Date.now()}`,
          notes: {
            purpose: 'provider_id_card_unlock',
            providerId: providerUser.uid,
            providerName,
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
        description: `Official Indian ${categoryLabel} ID Card Unlock`,
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
                amount: idCardSettings.downloadFee,
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
          contact: providerApp?.mobileNumber || '',
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

  // 1. Download Front Image
  const handleDownloadFrontPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderFrontCardCanvas(cardRenderOptions, frontCanvasRef.current);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Indian_${categoryLabel.replace(/\s+/g, '_')}_ID_Front_${uniqueIdNumber.replace(/\s+/g, '')}.png`;
      a.click();
      if (providerUser?.uid) {
        trackIdCardDownloadAction(providerUser.uid, 'front_png').catch(console.error);
      }
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
      const dataUrl = await renderBackCardCanvas(cardRenderOptions, backCanvasRef.current);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Indian_${categoryLabel.replace(/\s+/g, '_')}_ID_Back_${uniqueIdNumber.replace(/\s+/g, '')}.png`;
      a.click();
      if (providerUser?.uid) {
        trackIdCardDownloadAction(providerUser.uid, 'back_png').catch(console.error);
      }
      toast({ title: "Downloaded!", description: "Back ID card image saved in 300 DPI high resolution." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate back image.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Download PVC Card Print-Ready PDF (CR80 Standard: 85.6mm x 53.98mm)
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const frontDataUrl = await renderFrontCardCanvas(cardRenderOptions, frontCanvasRef.current);
      const backDataUrl = await renderBackCardCanvas(cardRenderOptions, backCanvasRef.current);

      generatePvcPdf(
        frontDataUrl,
        backDataUrl,
        `FixBro_PVC_Card_${uniqueIdNumber.replace(/\s+/g, '')}.pdf`
      );

      if (providerUser?.uid) {
        trackIdCardDownloadAction(providerUser.uid, 'pdf').catch(console.error);
      }
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
      <ProtectedRoute>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Generating official PVC ID credentials...</p>
        </div>
      </ProtectedRoute>
    );
  }

  // Not enabled in Admin Panel
  if (!idCardSettings.isIdCardEnabled) {
    return (
      <ProtectedRoute>
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
          <div className="p-4 rounded-full bg-slate-100 text-slate-500 w-16 h-16 mx-auto flex items-center justify-center">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">ID Card Generation Temporarily Paused</h2>
          <p className="text-sm text-muted-foreground">
            The administrator has temporarily paused official ID card downloads. Please check back later or contact administration.
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  // Provider not yet approved
  if (!isApproved) {
    return (
      <ProtectedRoute>
        <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
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
              Indian {categoryLabel} ID Card
            </h1>
            <p className="text-sm text-muted-foreground">
              Aadhaar & PAN style professional identity card formatted for standard CR80 PVC plastic printers (85.6mm × 54mm).
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

        {/* Live Interactive Card Preview (CR80 Standard Aspect Ratio) */}
        <div className="flex justify-center py-4">
          <OfficialIdCardView data={cardRenderOptions} activeSide={activeSide} />
        </div>

        {/* Hidden canvases for 300 DPI exports */}
        <canvas ref={frontCanvasRef} style={{ display: 'none' }} />
        <canvas ref={backCanvasRef} style={{ display: 'none' }} />

        {/* Unlock & Download Section */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Printable PVC Card Downloads
                </CardTitle>
                <CardDescription className="text-xs">
                  Download standard ISO CR80 print files or individual 300 DPI images for PVC card printers.
                </CardDescription>
              </div>

              <div>
                {isUnlocked ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 px-3 py-1 flex items-center gap-1 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Permanently Unlocked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/40 px-3 py-1 flex items-center gap-1 text-xs">
                    <Lock className="h-3.5 w-3.5" /> Locked ({symbol}{idCardSettings.downloadFee})
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {!isUnlocked ? (
              // Locked State - Requires Payment
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-foreground text-sm">
                      One-time ID Card Verification Fee: {symbol}{idCardSettings.downloadFee}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      To download and print your official PVC card, an administrative processing fee of <strong>{symbol}{idCardSettings.downloadFee}</strong> is applicable. Once unlocked, you can download unlimited high-resolution PDF and PNG files anytime.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handlePayAndUnlock}
                    disabled={isPaying}
                    className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 shadow-md"
                  >
                    {isPaying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                    Pay {symbol}{idCardSettings.downloadFee} & Unlock ID Card
                  </Button>
                </div>
              </div>
            ) : (
              // Unlocked State - Download Buttons
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Option 1: PVC Print PDF */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        PVC Print PDF (CR80)
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Standard CR80 2-page print document (85.6mm × 54mm) ready for plastic ID card printers.
                      </p>
                    </div>
                    <Button
                      onClick={handleDownloadPdf}
                      disabled={isExporting}
                      className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                    >
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Download PDF
                    </Button>
                  </div>

                  {/* Option 2: Front Side PNG */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <ImageIcon className="h-4 w-4 text-sky-600" />
                        Front Side Image
                      </div>
                      <p className="text-xs text-muted-foreground">
                        300 DPI high-resolution front card PNG format (1012 × 638 pixels).
                      </p>
                    </div>
                    <Button
                      onClick={handleDownloadFrontPng}
                      disabled={isExporting}
                      variant="outline"
                      className="w-full text-xs font-semibold flex items-center gap-1.5"
                    >
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Download Front PNG
                    </Button>
                  </div>

                  {/* Option 3: Back Side PNG */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                        <ImageIcon className="h-4 w-4 text-indigo-600" />
                        Back Side Image
                      </div>
                      <p className="text-xs text-muted-foreground">
                        300 DPI high-resolution back card PNG with QR code and address details.
                      </p>
                    </div>
                    <Button
                      onClick={handleDownloadBackPng}
                      disabled={isExporting}
                      variant="outline"
                      className="w-full text-xs font-semibold flex items-center gap-1.5"
                    >
                      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Download Back PNG
                    </Button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 text-xs text-sky-800 dark:text-sky-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-600 shrink-0" />
                  <span>
                    <strong>PVC Print Tip:</strong> Take the downloaded PDF to any local digital print shop or PVC card printer. It is pre-formatted to standard CR80 dimensions.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
