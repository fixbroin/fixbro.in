"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Navigation, 
  Compass, 
  Sliders, 
  Loader2, 
  Save, 
  CheckCircle2, 
  Info, 
  AlertTriangle,
  LocateFixed,
  Radio
} from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from '@/lib/mysqlDb';
import ProviderMapZoneSelector from '@/components/provider-registration/ProviderMapZoneSelector';
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import type { ProviderApplication } from '@/types/firestore';

const PRESET_RADII = [3, 5, 10, 15, 20, 25, 30, 50];

export default function ProviderServiceAreaPage() {
  const { user: providerUser } = useAuth();
  const { config: appConfig } = useApplicationConfig();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Service Area State
  const [workAreaAddress, setWorkAreaAddress] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [initialRadiusKm, setInitialRadiusKm] = useState<number>(5);

  const googleMapsApiKey = appConfig?.googleMapsApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const loadProviderApplication = useCallback(async () => {
    if (!providerUser?.uid) return;
    setIsLoading(true);
    try {
      const docRef = doc(db, "providerApplications", providerUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as ProviderApplication;
        if (data.workAreaAddress) setWorkAreaAddress(data.workAreaAddress);
        if (data.workAreaCenter) {
          setLatitude(data.workAreaCenter.latitude);
          setLongitude(data.workAreaCenter.longitude);
        }
        if (data.workAreaRadiusKm) {
          setRadiusKm(data.workAreaRadiusKm);
          setInitialRadiusKm(data.workAreaRadiusKm);
        }
      }
    } catch (error) {
      console.error("Error loading provider service area:", error);
      toast({
        title: "Error",
        description: "Could not load current serviceable area.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [providerUser?.uid, toast]);

  useEffect(() => {
    loadProviderApplication();
  }, [loadProviderApplication]);

  // Handle saving direct radius adjustment
  const handleSaveRadius = async () => {
    if (!providerUser?.uid) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "providerApplications", providerUser.uid);
      await updateDoc(docRef, {
        workAreaRadiusKm: radiusKm,
        updatedAt: Timestamp.now(),
      });
      setInitialRadiusKm(radiusKm);
      toast({
        title: "Radius Updated",
        description: `Your service coverage radius is now set to ${radiusKm} km.`
      });
    } catch (error: any) {
      console.error("Error updating service radius:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update radius.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle confirmed location from MapZoneSelector modal
  const handleMapConfirm = async (data: {
    center: { lat: number; lng: number };
    radiusKm: number;
    address: string;
  }) => {
    if (!providerUser?.uid) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "providerApplications", providerUser.uid);
      const updateData = {
        workAreaCenter: {
          latitude: data.center.lat,
          longitude: data.center.lng,
        },
        workAreaRadiusKm: data.radiusKm,
        workAreaAddress: data.address,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(docRef, updateData);

      setLatitude(data.center.lat);
      setLongitude(data.center.lng);
      setRadiusKm(data.radiusKm);
      setInitialRadiusKm(data.radiusKm);
      setWorkAreaAddress(data.address);

      setIsMapModalOpen(false);
      toast({
        title: "Service Area Updated!",
        description: `Your base location and ${data.radiusKm} km service coverage have been saved successfully.`
      });
    } catch (error: any) {
      console.error("Error updating serviceable location:", error);
      toast({
        title: "Update Error",
        description: error.message || "Could not save serviceable location.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasLocationConfigured = latitude !== null && longitude !== null;
  const isRadiusDirty = radiusKm !== initialRadiusKm;

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Top Header Card */}
        <Card className="border-border/60 shadow-sm bg-gradient-to-r from-card via-card to-primary/5">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-primary" />
                  Serviceable Area & Coverage
                </CardTitle>
                <CardDescription>
                  Manage the geographic base and operating radius where you receive customer booking assignments.
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsMapModalOpen(true)}
                className="flex items-center gap-2 shadow-sm shrink-0"
              >
                <LocateFixed className="h-4 w-4" />
                Change Base Location on Map
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Current Coverage Summary */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 font-semibold">
              <Compass className="h-5 w-5 text-primary" />
              Current Service Area Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Center Address */}
              <div className="md:col-span-2 p-4 rounded-xl border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    Base Operational Center
                  </span>
                  {hasLocationConfigured ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium">
                      <Radio className="h-3 w-3 mr-1 animate-pulse" /> Live Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Not Configured
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {workAreaAddress || "No specific address set yet. Click 'Change Base Location on Map' to select your center point."}
                </p>
                {hasLocationConfigured && (
                  <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground font-mono">
                    <span>Lat: {latitude?.toFixed(6)}</span>
                    <span>Lng: {longitude?.toFixed(6)}</span>
                  </div>
                )}
              </div>

              {/* Active Radius Badge */}
              <div className="p-4 rounded-xl border bg-primary/5 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Radius
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-primary">{radiusKm}</span>
                  <span className="text-sm font-semibold text-muted-foreground">km</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Maximum delivery & travel distance for jobs
                </span>
              </div>
            </div>

            {/* Coverage Explanation Alert */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">How automated job matching works:</p>
                <p className="text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                  When a customer books a service within your <strong>{radiusKm} km</strong> circle, our platform checks your online status and automatically dispatches the job notification to you. Keeping your operational radius accurate ensures you receive jobs that are convenient to travel to.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Radius Adjustment Card */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 font-semibold">
              <Sliders className="h-5 w-5 text-primary" />
              Quick Radius Adjustment
            </CardTitle>
            <CardDescription>
              Adjust your maximum serviceable distance without changing your base GPS pin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Service Radius:</span>
                <span className="text-base font-bold text-primary font-mono">{radiusKm} km</span>
              </div>
              <Slider
                value={[radiusKm]}
                min={1}
                max={50}
                step={1}
                onValueChange={(val) => setRadiusKm(val[0])}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 km (Hyperlocal)</span>
                <span>25 km (Citywide)</span>
                <span>50 km (Metropolitan)</span>
              </div>
            </div>

            {/* Preset Radius Buttons */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Popular Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESET_RADII.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={radiusKm === preset ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRadiusKm(preset)}
                    className="text-xs h-8 px-3 rounded-lg"
                  >
                    {preset} km
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-4">
            <Button
              onClick={handleSaveRadius}
              disabled={isSaving || !isRadiusDirty}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isRadiusDirty ? "Save Radius Changes" : "Radius Saved"}
            </Button>
          </CardFooter>
        </Card>

        {/* Interactive Google Map Selector Modal */}
        {isMapModalOpen && (
          <ProviderMapZoneSelector
            apiKey={googleMapsApiKey}
            initialCenter={latitude && longitude ? { lat: latitude, lng: longitude } : null}
            initialRadiusKm={radiusKm}
            maxRadiusKm={50}
            onConfirm={handleMapConfirm}
            onClose={() => setIsMapModalOpen(false)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
