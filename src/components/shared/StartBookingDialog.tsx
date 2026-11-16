"use client";

import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayCircle, Camera, Upload, Trash2, Loader2, KeyRound, AlertCircle } from "lucide-react";
import type { FirestoreBooking } from '@/types/firestore';
import AppImage from "@/components/ui/AppImage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { uploadBookingEvidenceAction } from "@/app/actions/providerWalletActions";
import { compressImage } from "@/lib/imageCompressor";

interface StartBookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (otp: string, photoUrl?: string) => Promise<void> | void;
  booking?: FirestoreBooking | null;
  isProcessing: boolean;
}

export default function StartBookingDialog({
  isOpen,
  onClose,
  onConfirm,
  booking,
  isProcessing
}: StartBookingDialogProps) {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setOtp("");
      setPhotoUrl(null);
      setErrorMsg(null);
      setIsUploadingPhoto(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file (JPEG, PNG, WebP).",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image size must be less than 50MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // Automatic client-side compression:
      // If <= 1.0 MB, skips compression to preserve original quality
      // If > 1.0 MB, automatically resizes & compresses under 1.0 MB before upload
      const processedFile = await compressImage(file, 1.0);

      const formData = new FormData();
      formData.append('file', processedFile);

      const result = await uploadBookingEvidenceAction(formData);

      if (result.success && result.url) {
        setPhotoUrl(result.url);
        toast({
          title: "Photo uploaded",
          description: "Before-work photo uploaded successfully.",
        });
      } else {
        throw new Error(result.error || "Failed to upload photo");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleVerifyAndStart = async () => {
    setErrorMsg(null);
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setErrorMsg("Please enter the 4-digit Start OTP from the customer.");
      toast({
        title: "OTP Required",
        description: "Please enter the 4-digit Start OTP from the customer.",
        variant: "destructive"
      });
      return;
    }

    if (cleanOtp.length !== 4 || !/^\d{4}$/.test(cleanOtp)) {
      setErrorMsg("The Start OTP must be exactly 4 numeric digits.");
      toast({
        title: "Invalid OTP Format",
        description: "The Start OTP must be exactly 4 numeric digits.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(cleanOtp, photoUrl || undefined);
    } catch (err: any) {
      const msg = err?.message || "Wrong OTP. You entered an incorrect number.";
      setErrorMsg(msg);
      toast({
        title: "Wrong OTP",
        description: msg,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[430px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-bold">
            <PlayCircle className="h-5 w-5 text-primary" />
            Start Service Verification
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ask the customer for the 4-digit Start OTP displayed on their screen to begin work.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* OTP Input Card */}
          <div className="space-y-2 bg-primary/5 p-4 rounded-xl border border-primary/20">
            <Label htmlFor="start-otp-input" className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Customer Start OTP <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="start-otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="4-Digit OTP"
                disabled={isProcessing || isSubmitting}
                autoFocus
                className={cn(
                  "text-center font-mono text-2xl font-black tracking-[0.4em] h-12 bg-background border-primary/30 focus-visible:ring-primary shadow-inner",
                  errorMsg && "border-red-500 focus-visible:ring-red-500"
                )}
              />
            </div>

            {errorMsg ? (
              <div className="flex items-center gap-1.5 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 text-xs font-semibold animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground pt-1 text-center">
                Customer can find this OTP in <strong className="text-foreground">My Bookings</strong>.
              </p>
            )}
          </div>

          {/* Optional Before-Work Photo */}
          <div className="space-y-2 bg-muted/30 p-3.5 rounded-xl border border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                Before-Work Photo / Evidence
              </Label>
              <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Optional
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You can capture a photo of the item or site condition before beginning work.
            </p>

            {photoUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border mt-2 bg-background">
                <div className="relative h-40 w-full">
                  <AppImage
                    src={photoUrl}
                    alt="Before work evidence"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-2 flex items-center justify-between bg-muted/60">
                  <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                    ✓ Photo attached
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPhotoUrl(null)}
                    disabled={isProcessing}
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 px-2"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ) : isUploadingPhoto ? (
              <div className="flex items-center justify-center gap-2 p-5 bg-muted/50 rounded-xl border border-dashed border-primary/40 mt-1">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs font-medium text-foreground">Optimizing & uploading photo...</span>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isProcessing || isUploadingPhoto}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer text-center group"
                  >
                    <Camera className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-foreground">Take Photo</span>
                    <span className="text-[10px] text-muted-foreground">Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isProcessing || isUploadingPhoto}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/40 hover:bg-muted/80 transition-colors cursor-pointer text-center group"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-foreground">Upload File</span>
                    <span className="text-[10px] text-muted-foreground">Gallery</span>
                  </button>
                </div>

                {/* Hidden input for Camera capture */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isProcessing || isUploadingPhoto}
                />

                {/* Hidden input for Gallery / Media picker selection */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isProcessing || isUploadingPhoto}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing || isSubmitting || isUploadingPhoto}
            className="w-full sm:w-auto text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleVerifyAndStart}
            disabled={isProcessing || isSubmitting || isUploadingPhoto || otp.trim().length !== 4}
            className="w-full sm:w-auto text-xs font-bold bg-primary hover:bg-primary/90 text-white"
          >
            {isProcessing || isSubmitting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Verify & Start Work
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
