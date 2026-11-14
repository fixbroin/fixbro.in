"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { auth } from '@/lib/firebase';
import { 
  UserPlus, 
  Loader2, 
  Copy, 
  Check, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Phone, 
  Mail, 
  User, 
  Lock, 
  ShieldCheck, 
  Briefcase, 
  ArrowRight, 
  MessageSquareShare 
} from "lucide-react";
import { openWhatsAppChooser } from '@/lib/whatsappUtils';

interface CreateProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderCreated?: () => void;
}

export default function CreateProviderModal({ isOpen, onClose, onProviderCreated }: CreateProviderModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'approved' | 'pending_step_1'>('approved');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdProvider, setCreatedProvider] = useState<any | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newPass = `Pro#${rand}${Math.floor(10 + Math.random() * 90)}`;
    setPassword(newPass);
  };

  const resetForm = () => {
    setName('');
    setMobileNumber('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setStatus('approved');
    setCreatedProvider(null);
    setHasCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Name Required", description: "Please enter the provider's full name.", variant: "destructive" });
      return;
    }

    const cleanPhone = mobileNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      toast({ title: "Valid Phone Required", description: "Please enter a valid 10-digit mobile number.", variant: "destructive" });
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast({ title: "Valid Email Required", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    if (!password || password.length < 6) {
      toast({ title: "Password Too Short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accountType: 'provider',
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobileNumber: cleanPhone.startsWith('91') && cleanPhone.length === 12 ? `+${cleanPhone}` : `+91${cleanPhone.slice(-10)}`,
          password: password,
          initialStatus: status,
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create provider account.");
      }

      setCreatedProvider(data.user);
      toast({
        title: "Provider Account Created!",
        description: `Provider account for ${data.user.name} created successfully.`,
      });
      if (onProviderCreated) {
        onProviderCreated();
      }
    } catch (err: any) {
      console.error("Create Provider Error:", err);
      toast({
        title: "Creation Failed",
        description: err.message || "Could not create provider account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getShareMessage = () => {
    if (!createdProvider) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fixbro.in';
    return `Hello ${createdProvider.name},\n\nYour Fixbro Partner (Provider) account has been created!\n\nYou can log in directly in the Fixbro Provider App or web portal:\n• Login Link: ${origin}/auth/login?redirect=/provider\n• Email: ${createdProvider.email}\n• Password: ${createdProvider.password}\n• Mobile: ${createdProvider.mobileNumber}\n\nWelcome to the Fixbro Partner Network!`;
  };

  const handleCopyCredentials = () => {
    const text = getShareMessage();
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast({ title: "Copied!", description: "Provider credentials copied to clipboard." });
    setTimeout(() => setHasCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!createdProvider) return;
    const cleanPhone = createdProvider.mobileNumber.replace(/[^0-9]/g, '');
    const message = getShareMessage();
    openWhatsAppChooser(cleanPhone, message);
  };

  const handleOpenRegistrationSteps = () => {
    if (!createdProvider?.uid) return;
    handleClose();
    router.push(`/provider-registration?editApplicationId=${createdProvider.uid}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="w-[calc(100%-24px)] sm:w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {createdProvider ? "Provider Account Ready!" : "Add Provider Account"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {createdProvider 
                  ? "Open registration steps to fill details or hand credentials to the provider." 
                  : "Create login account for walk-in providers, then fill registration steps directly."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {createdProvider ? (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mb-2 animate-in zoom-in" />
              <h3 className="font-bold text-lg text-foreground">{createdProvider.name}</h3>
              <p className="text-xs text-emerald-600 font-medium">
                {createdProvider.status === 'approved' ? '✓ Pre-Approved Partner' : 'Pending Steps Registration'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border space-y-2 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email:</span>
                <span className="font-mono font-medium">{createdProvider.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Mobile:</span>
                <span className="font-mono font-medium">{createdProvider.mobileNumber}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Password:</span>
                <span className="font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">{createdProvider.password}</span>
              </div>
            </div>

            {/* Primary Action: Open and Fill All Steps */}
            <Button 
              onClick={handleOpenRegistrationSteps}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-5 flex items-center justify-center gap-2 shadow-sm"
            >
              Open & Complete Registration Steps Now
              <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button 
                variant="outline" 
                onClick={handleCopyCredentials}
                className="w-full flex items-center justify-center gap-2"
              >
                {hasCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {hasCopied ? "Copied!" : "Copy Details"}
              </Button>
              <Button 
                onClick={handleShareWhatsApp}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
              >
                <MessageSquareShare className="h-4 w-4" />
                WhatsApp
              </Button>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="ghost" onClick={resetForm} className="w-full">
                Add Another Provider
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 [scrollbar-width:thin]">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="pro-name" className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Provider Full Name *
                </Label>
                <Input 
                  id="pro-name" 
                  placeholder="e.g. Suresh Electrician" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <Label htmlFor="pro-phone" className="text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> 10-Digit Mobile Number *
                </Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 border rounded-md bg-muted text-sm font-mono text-muted-foreground select-none">
                    +91
                  </span>
                  <Input 
                    id="pro-phone" 
                    type="tel" 
                    maxLength={10}
                    placeholder="9876543210" 
                    value={mobileNumber} 
                    onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} 
                    required 
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Provider can also use Phone OTP login on provider app.</p>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="pro-email" className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address *
                </Label>
                <Input 
                  id="pro-email" 
                  type="email" 
                  placeholder="provider@gmail.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pro-pass" className="text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Initial Password *
                  </Label>
                  <button 
                    type="button" 
                    onClick={generateRandomPassword}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Auto-generate
                  </button>
                </div>
                <div className="relative">
                  <Input 
                    id="pro-pass" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Min 6 characters" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="pr-10"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Initial Approval Status */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="pro-status" className="text-xs font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" /> Initial Approval Status
                </Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger id="pro-status">
                    <SelectValue placeholder="Select initial status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved (Active & Ready to Accept Jobs)</SelectItem>
                    <SelectItem value="pending_step_1">Pending Registration (Admin will fill steps)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  You can immediately fill categories, KYC, and bank details after creating.
                </p>
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 bg-muted/20 border-t shrink-0 flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Briefcase className="h-4 w-4 mr-2" />
                    Create Provider
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
