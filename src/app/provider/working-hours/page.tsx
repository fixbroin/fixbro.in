"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Info, 
  Sparkles,
  RotateCcw,
  Sun,
  Moon
} from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from '@/lib/mysqlDb';
import type { ProviderApplication, DayAvailability, TimeInterval } from '@/types/firestore';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { cn } from '@/lib/utils';

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const DAYS_OF_WEEK: { key: DayKey; label: string; short: string }[] = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

const DEFAULT_SCHEDULE: Record<DayKey, DayAvailability> = {
  monday: { isEnabled: true, startTime: "10:00", endTime: "18:00", intervals: [{ startTime: "10:00", endTime: "18:00" }] },
  tuesday: { isEnabled: true, startTime: "10:00", endTime: "18:00", intervals: [{ startTime: "10:00", endTime: "18:00" }] },
  wednesday: { isEnabled: true, startTime: "10:00", endTime: "18:00", intervals: [{ startTime: "10:00", endTime: "18:00" }] },
  thursday: { isEnabled: true, startTime: "10:00", endTime: "18:00", intervals: [{ startTime: "10:00", endTime: "18:00" }] },
  friday: { isEnabled: true, startTime: "10:00", endTime: "18:00", intervals: [{ startTime: "10:00", endTime: "18:00" }] },
  saturday: { isEnabled: true, startTime: "10:00", endTime: "18:00", intervals: [{ startTime: "10:00", endTime: "18:00" }] },
  sunday: { isEnabled: true, startTime: "10:00", endTime: "16:00", intervals: [{ startTime: "10:00", endTime: "16:00" }] },
};

function formatTimeTo12Hour(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24 || '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function ProviderWorkingHoursPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();

  const [schedule, setSchedule] = useState<Record<DayKey, DayAvailability>>(DEFAULT_SCHEDULE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasCustomHoursConfigured, setHasCustomHoursConfigured] = useState(false);

  // Load existing working hours from providerApplications collection
  useEffect(() => {
    if (!user?.uid) return;

    const loadProviderWorkingHours = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, "providerApplications", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as ProviderApplication;
          if (data.workingHours && typeof data.workingHours === 'object') {
            setHasCustomHoursConfigured(true);
            const merged: Record<DayKey, DayAvailability> = { ...DEFAULT_SCHEDULE };

            DAYS_OF_WEEK.forEach(({ key }) => {
              const existingDay = (data.workingHours as any)[key];
              if (existingDay) {
                const intervals = Array.isArray(existingDay.intervals) && existingDay.intervals.length > 0
                  ? existingDay.intervals
                  : [{ startTime: existingDay.startTime || "10:00", endTime: existingDay.endTime || "18:00" }];

                merged[key] = {
                  isEnabled: existingDay.isEnabled !== false,
                  startTime: existingDay.startTime || intervals[0]?.startTime || "10:00",
                  endTime: existingDay.endTime || intervals[0]?.endTime || "18:00",
                  intervals
                };
              }
            });

            setSchedule(merged);
          } else {
            // If provider has not configured individual hours, initialize from global app settings if available
            setHasCustomHoursConfigured(false);
            const globalWeekly = appConfig?.timeSlotSettings?.weeklyAvailability;
            if (globalWeekly) {
              const fromGlobal: Record<DayKey, DayAvailability> = { ...DEFAULT_SCHEDULE };
              DAYS_OF_WEEK.forEach(({ key }) => {
                const gDay = (globalWeekly as any)[key];
                if (gDay) {
                  const intervals = Array.isArray(gDay.intervals) && gDay.intervals.length > 0
                    ? gDay.intervals
                    : [{ startTime: gDay.startTime || "10:00", endTime: gDay.endTime || "18:00" }];

                  fromGlobal[key] = {
                    isEnabled: gDay.isEnabled !== false,
                    startTime: gDay.startTime || intervals[0]?.startTime || "10:00",
                    endTime: gDay.endTime || intervals[0]?.endTime || "18:00",
                    intervals
                  };
                }
              });
              setSchedule(fromGlobal);
            }
          }
        }
      } catch (error) {
        console.error("Error loading provider working hours:", error);
        toast({
          title: "Error",
          description: "Failed to load working hours. Please try refreshing.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProviderWorkingHours();
  }, [user?.uid, appConfig, toast]);

  // Toggle day enabled/disabled
  const handleToggleDay = (day: DayKey, isEnabled: boolean) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isEnabled
      }
    }));
  };

  // Update interval times
  const handleIntervalChange = (day: DayKey, index: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedule(prev => {
      const dayData = prev[day];
      const intervals = [...(dayData.intervals || [{ startTime: dayData.startTime, endTime: dayData.endTime }])];
      intervals[index] = {
        ...intervals[index],
        [field]: value
      };

      return {
        ...prev,
        [day]: {
          ...dayData,
          startTime: intervals[0]?.startTime || dayData.startTime,
          endTime: intervals[intervals.length - 1]?.endTime || dayData.endTime,
          intervals
        }
      };
    });
  };

  // Add shift interval
  const handleAddInterval = (day: DayKey) => {
    setSchedule(prev => {
      const dayData = prev[day];
      const intervals = [...(dayData.intervals || [{ startTime: dayData.startTime, endTime: dayData.endTime }])];
      intervals.push({ startTime: "14:00", endTime: "20:00" });

      return {
        ...prev,
        [day]: {
          ...dayData,
          intervals
        }
      };
    });
  };

  // Delete shift interval
  const handleDeleteInterval = (day: DayKey, index: number) => {
    setSchedule(prev => {
      const dayData = prev[day];
      const intervals = (dayData.intervals || []).filter((_, i) => i !== index);
      if (intervals.length === 0) {
        intervals.push({ startTime: "10:00", endTime: "18:00" });
      }

      return {
        ...prev,
        [day]: {
          ...dayData,
          startTime: intervals[0]?.startTime || "10:00",
          endTime: intervals[intervals.length - 1]?.endTime || "18:00",
          intervals
        }
      };
    });
  };

  // Quick Preset: Apply 10 AM - 6 PM to all working days
  const handleApplyStandardHours = () => {
    setSchedule(prev => {
      const next: Record<DayKey, DayAvailability> = { ...prev };
      DAYS_OF_WEEK.forEach(({ key }) => {
        if (next[key].isEnabled) {
          next[key] = {
            ...next[key],
            startTime: "10:00",
            endTime: "18:00",
            intervals: [{ startTime: "10:00", endTime: "18:00" }]
          };
        }
      });
      return next;
    });
    toast({
      title: "Preset Applied",
      description: "Set 10:00 AM – 06:00 PM for all your active working days."
    });
  };

  // Quick Preset: Copy Monday to Weekdays (Tue - Fri)
  const handleCopyMondayToWeekdays = () => {
    const mondayData = schedule.monday;
    setSchedule(prev => ({
      ...prev,
      tuesday: { ...mondayData },
      wednesday: { ...mondayData },
      thursday: { ...mondayData },
      friday: { ...mondayData },
    }));
    toast({
      title: "Monday Schedule Copied",
      description: "Monday shift timings applied to Tuesday through Friday."
    });
  };

  // Save to database
  const handleSaveWorkingHours = async () => {
    if (!user?.uid) return;
    setIsSaving(true);

    try {
      // Validate that start time is before end time for every interval
      for (const { key, label } of DAYS_OF_WEEK) {
        const dayData = schedule[key];
        if (dayData.isEnabled && dayData.intervals) {
          for (let i = 0; i < dayData.intervals.length; i++) {
            const int = dayData.intervals[i];
            if (int.startTime >= int.endTime) {
              toast({
                title: "Invalid Timing",
                description: `${label}: Start time (${formatTimeTo12Hour(int.startTime)}) must be before end time (${formatTimeTo12Hour(int.endTime)}).`,
                variant: "destructive"
              });
              setIsSaving(false);
              return;
            }
          }
        }
      }

      const docRef = doc(db, "providerApplications", user.uid);
      await updateDoc(docRef, {
        workingHours: schedule,
        updatedAt: Timestamp.now()
      });

      setHasCustomHoursConfigured(true);
      toast({
        title: "Working Hours Saved",
        description: "Your weekly working hours have been updated successfully! Customers and auto-dispatch will now use these timings."
      });
    } catch (error: any) {
      console.error("Error saving working hours:", error);
      toast({
        title: "Save Failed",
        description: error.message || "Could not save working hours. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Count active days
  const activeDaysCount = useMemo(() => {
    return DAYS_OF_WEEK.filter(({ key }) => schedule[key].isEnabled).length;
  }, [schedule]);

  return (
    <ProtectedRoute>
      <div className="container mx-auto max-w-5xl py-6 md:py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-primary mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Provider Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Working Hours & Shifts
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Set your weekly working hours. Orders and auto-dispatch will only be scheduled during your active shift timings.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-[11px] font-semibold border-primary/30 text-primary bg-primary/5">
                Platform Timezone: {appConfig?.timezone || 'Asia/Kolkata'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveWorkingHours}
              disabled={isSaving || isLoading}
              className="h-11 px-6 rounded-xl font-bold text-xs sm:text-sm shadow-md bg-primary hover:bg-primary/90 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isSaving ? "Saving..." : "Save Working Hours"}</span>
            </Button>
          </div>
        </div>

        {/* Informational Guidance Banner */}
        <Card className="border border-primary/20 bg-primary/5 rounded-2xl shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Info className="h-5 w-5" />
            </div>
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold text-foreground">
                How your working hours work:
              </p>
              <p className="text-muted-foreground leading-relaxed">
                You only need to set your <strong>Shift Start Time</strong> and <strong>Shift End Time</strong>. 
                Appointment slot intervals (e.g. 60-minute duration and buffer time) are automatically managed by Fixbro within your working hours.
                {hasCustomHoursConfigured ? (
                  <span className="block mt-1 text-emerald-600 font-semibold">
                    ✓ Custom shift timings are active for your account.
                  </span>
                ) : (
                  <span className="block mt-1 text-amber-600 font-medium">
                    ℹ️ You are currently using Fixbro standard platform hours. Configure your shifts below to customize your schedule.
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Presets Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-muted/40 rounded-2xl border border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">
              Working: <strong className="text-primary">{activeDaysCount} of 7 days</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyStandardHours}
              disabled={isSaving || isLoading}
              className="h-8 text-xs font-semibold rounded-lg"
            >
              <Sun className="h-3.5 w-3.5 mr-1 text-amber-500" />
              Set 10 AM – 6 PM All Days
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyMondayToWeekdays}
              disabled={isSaving || isLoading}
              className="h-8 text-xs font-semibold rounded-lg"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1 text-primary" />
              Copy Monday to Mon–Fri
            </Button>
          </div>
        </div>

        {/* Days of Week Cards */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Loading your schedule...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {DAYS_OF_WEEK.map(({ key, label }) => {
              const dayData = schedule[key];
              const intervals = dayData.intervals || [{ startTime: dayData.startTime || "10:00", endTime: dayData.endTime || "18:00" }];

              return (
                <Card 
                  key={key} 
                  className={cn(
                    "rounded-2xl transition-all duration-200 border",
                    dayData.isEnabled 
                      ? "bg-card border-border/80 shadow-xs" 
                      : "bg-muted/20 border-dashed border-border/60 opacity-80"
                  )}
                >
                  <CardHeader className="p-4 sm:p-5 pb-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors",
                          dayData.isEnabled 
                            ? "bg-primary/10 text-primary" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base sm:text-lg font-bold">
                              {label}
                            </CardTitle>
                            {dayData.isEnabled ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold py-0.5">
                                Working Day
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-border text-[10px] font-bold py-0.5">
                                Day Off
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {dayData.isEnabled 
                              ? `${intervals.length} shift${intervals.length > 1 ? 's' : ''}: ${intervals.map(i => `${formatTimeTo12Hour(i.startTime)} - ${formatTimeTo12Hour(i.endTime)}`).join(', ')}`
                              : "No bookings will be assigned on this day."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Label htmlFor={`toggle-${key}`} className="text-xs font-semibold text-muted-foreground hidden sm:inline-block cursor-pointer">
                          {dayData.isEnabled ? "Available" : "Off"}
                        </Label>
                        <Switch
                          id={`toggle-${key}`}
                          checked={dayData.isEnabled}
                          onCheckedChange={(checked) => handleToggleDay(key, checked)}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </CardHeader>

                  {dayData.isEnabled && (
                    <CardContent className="p-4 sm:p-5 pt-1 space-y-3 border-t border-border/40 mt-2">
                      <div className="space-y-2.5">
                        {intervals.map((interval, index) => (
                          <div 
                            key={index}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background px-2 py-1 rounded-md border border-border/60">
                                Shift {index + 1}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 flex-1 max-w-md">
                              <div>
                                <Label htmlFor={`${key}-start-${index}`} className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mb-1">
                                  <Clock className="h-3 w-3 text-primary" /> Start Time
                                </Label>
                                <Input
                                  id={`${key}-start-${index}`}
                                  type="time"
                                  value={interval.startTime}
                                  onChange={(e) => handleIntervalChange(key, index, 'startTime', e.target.value)}
                                  disabled={isSaving}
                                  className="h-10 text-xs font-semibold rounded-lg bg-card"
                                />
                                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                                  {formatTimeTo12Hour(interval.startTime)}
                                </span>
                              </div>

                              <div>
                                <Label htmlFor={`${key}-end-${index}`} className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mb-1">
                                  <Clock className="h-3 w-3 text-primary" /> End Time
                                </Label>
                                <Input
                                  id={`${key}-end-${index}`}
                                  type="time"
                                  value={interval.endTime}
                                  onChange={(e) => handleIntervalChange(key, index, 'endTime', e.target.value)}
                                  disabled={isSaving}
                                  className="h-10 text-xs font-semibold rounded-lg bg-card"
                                />
                                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                                  {formatTimeTo12Hour(interval.endTime)}
                                </span>
                              </div>
                            </div>

                            {intervals.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteInterval(key, index)}
                                disabled={isSaving}
                                className="h-9 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg self-end sm:self-center"
                                title="Delete shift"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="pt-1 flex justify-start">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddInterval(key)}
                          disabled={isSaving}
                          className="h-8 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Another Shift (Split Shift)</span>
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Bottom Save Action */}
        <div className="flex justify-end pt-4 pb-12">
          <Button
            onClick={handleSaveWorkingHours}
            disabled={isSaving || isLoading}
            size="lg"
            className="h-12 px-8 rounded-xl font-bold text-sm shadow-lg bg-primary hover:bg-primary/90 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{isSaving ? "Saving Working Hours..." : "Save Working Hours"}</span>
          </Button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
