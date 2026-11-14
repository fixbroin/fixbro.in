"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  MessageSquareShare 
} from "lucide-react";
import { openWhatsAppChooser } from '@/lib/whatsappUtils';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated?: () => void;
}

export default function CreateUserModal({ isOpen, onClose, onUserCreated }: CreateUserModalProps) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<any | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newPass = `Fix#${rand}${Math.floor(10 + Math.random() * 90)}`;
    setPassword(newPass);
  };

  const resetForm = () => {
    setName('');
    setMobileNumber('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setShowAddress(false);
    setStreet('');
    setCity('');
    setPincode('');
    setCreatedUser(null);
    setHasCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Name Required", description: "Please enter the customer's full name.", variant: "destructive" });
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
          accountType: 'customer',
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobileNumber: cleanPhone.startsWith('91') && cleanPhone.length === 12 ? `+${cleanPhone}` : `+91${cleanPhone.slice(-10)}`,
          password: password,
          address: (street.trim() || city.trim() || pincode.trim()) ? {
            street: street.trim(),
            city: city.trim(),
            pincode: pincode.trim(),
          } : undefined
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create customer account.");
      }

      setCreatedUser(data.user);
      toast({
        title: "Account Created!",
        description: `Customer account for ${data.user.name} created successfully.`,
      });
      if (onUserCreated) {
        onUserCreated();
      }
    } catch (err: any) {
      console.error("Create User Error:", err);
      toast({
        title: "Creation Failed",
        description: err.message || "Could not create user account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getShareMessage = () => {
    if (!createdUser) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fixbro.in';
    return `Hello ${createdUser.name},\n\nYour Fixbro account has been created successfully!\n\nYou can log in using either your Mobile OTP or with these details:\n• Login Link: ${origin}/auth/login\n• Email: ${createdUser.email}\n• Password: ${createdUser.password}\n• Mobile: ${createdUser.mobileNumber}\n\nThank you for choosing Fixbro!`;
  };

  const handleCopyCredentials = () => {
    const text = getShareMessage();
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast({ title: "Copied!", description: "Account credentials copied to clipboard." });
    setTimeout(() => setHasCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!createdUser) return;
    const cleanPhone = createdUser.mobileNumber.replace(/[^0-9]/g, '');
    const message = getShareMessage();
    openWhatsAppChooser(cleanPhone, message);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="w-[calc(100%-24px)] sm:w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {createdUser ? "Account Ready!" : "Add New Customer Account"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {createdUser 
                  ? "Share credentials or copy details for the customer." 
                  : "Directly create an account for booking requests received via call or office."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {createdUser ? (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mb-2 animate-in zoom-in" />
              <h3 className="font-bold text-lg text-foreground">{createdUser.name}</h3>
              <p className="text-xs text-muted-foreground">Member #{createdUser.userNumber} • Active Customer</p>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border space-y-2 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email:</span>
                <span className="font-mono font-medium">{createdUser.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Mobile:</span>
                <span className="font-mono font-medium">{createdUser.mobileNumber}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Password:</span>
                <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{createdUser.password}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
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
                Create Another Customer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 [scrollbar-width:thin]">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="cust-name" className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Full Name *
                </Label>
                <Input 
                  id="cust-name" 
                  placeholder="e.g. Ramesh Kumar" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <Label htmlFor="cust-phone" className="text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> 10-Digit Mobile Number *
                </Label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 border rounded-md bg-muted text-sm font-mono text-muted-foreground select-none">
                    +91
                  </span>
                  <Input 
                    id="cust-phone" 
                    type="tel" 
                    maxLength={10}
                    placeholder="9876543210" 
                    value={mobileNumber} 
                    onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} 
                    required 
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">User can also use OTP login with this number.</p>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="cust-email" className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address *
                </Label>
                <Input 
                  id="cust-email" 
                  type="email" 
                  placeholder="customer@gmail.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cust-pass" className="text-xs font-semibold flex items-center gap-1.5">
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
                    id="cust-pass" 
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

              {/* Optional Address Collapsible */}
              <div className="pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddress(!showAddress)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Initial Service Address (Optional)
                  </span>
                  {showAddress ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAddress && (
                  <div className="space-y-3 pt-3 animate-in fade-in duration-200">
                    <div>
                      <Input 
                        placeholder="House / Flat / Street address" 
                        value={street} 
                        onChange={(e) => setStreet(e.target.value)} 
                        className="text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        placeholder="City (e.g. Bangalore)" 
                        value={city} 
                        onChange={(e) => setCity(e.target.value)} 
                        className="text-xs"
                      />
                      <Input 
                        placeholder="Pincode (e.g. 560001)" 
                        maxLength={6}
                        value={pincode} 
                        onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))} 
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 bg-muted/20 border-t shrink-0 flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
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
