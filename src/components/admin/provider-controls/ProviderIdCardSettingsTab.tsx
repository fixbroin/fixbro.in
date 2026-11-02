"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Contact2, ShieldCheck, IndianRupee, Clock, HelpCircle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from "@/hooks/useApplicationConfig";
import { 
  getProviderIdCardSettingsAction, 
  saveProviderIdCardSettingsAction, 
} from '@/app/actions/providerIdCardActions';
import { type ProviderIdCardSettings, DEFAULT_ID_CARD_SETTINGS } from '@/types/providerAreaAndId';

const idCardSettingsSchema = z.object({
  isIdCardEnabled: z.boolean().default(true),
  downloadFee: z.coerce.number().min(0, "Download fee must be 0 or more."),
  validityYears: z.coerce.number().min(1, "Validity must be at least 1 year.").max(10, "Maximum validity is 10 years."),
  signatoryName: z.string().min(2, "Signatory name is required."),
  helplineNumber: z.string().min(5, "Helpline number is required."),
});

type IdCardSettingsFormData = z.infer<typeof idCardSettingsSchema>;

export default function ProviderIdCardSettingsTab() {
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || "₹";
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<IdCardSettingsFormData>({
    resolver: zodResolver(idCardSettingsSchema),
    defaultValues: DEFAULT_ID_CARD_SETTINGS,
  });

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getProviderIdCardSettingsAction();
      form.reset(data);
    } catch (error) {
      toast({ title: "Error", description: "Could not load ID card settings.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, form]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onSubmit = async (data: IdCardSettingsFormData) => {
    setIsSaving(true);
    try {
      const result = await saveProviderIdCardSettingsAction(data);
      if (result.success) {
        toast({ title: "Success", description: result.message });
        await loadSettings();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not save ID card settings.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Provider ID Card Settings</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Contact2 className="h-5 w-5 text-primary" />
          Provider ID Card Configuration
        </CardTitle>
        <CardDescription>
          Configure official PVC printable ID card generation for verified service providers, pricing, and validity.
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardContent className="space-y-6 pt-4">
            {/* Enable/Disable ID Card Generation */}
            <FormField
              control={form.control}
              name="isIdCardEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 shadow-sm bg-muted/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Enable ID Card Generation
                    </FormLabel>
                    <FormDescription>
                      When enabled, approved service providers will see the "Generate ID Card" menu and can generate official PVC printable cards.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Download Fee */}
              <FormField
                control={form.control}
                name="downloadFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <IndianRupee className="h-4 w-4 text-primary" />
                      Download Fee ({symbol})
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={1} {...field} disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Set amount providers must pay to unlock and download their high-res ID card. Set to <strong>0</strong> for free downloads.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Validity Years */}
              <FormField
                control={form.control}
                name="validityYears"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      Card Validity Period (Years)
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={10} step={1} {...field} disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Number of years the generated ID card is valid from the issuance date (e.g. 2 years).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Authorized Signatory */}
              <FormField
                control={form.control}
                name="signatoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authorized Signatory Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Authorized Signatory - FixBro" disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Name or title printed under the digital authorization signature on the ID card.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Support Helpline */}
              <FormField
                control={form.control}
                name="helplineNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      Support & Helpline Phone
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+91 8000 123 456" disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Helpline and verification number printed on the back of the ID card for customer inquiries.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save ID Card Settings
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
