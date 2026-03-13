
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowRight, ArrowLeft, Clock, Loader2, AlertTriangle, CalendarDays, CheckCircle2 } from 'lucide-react';
import CheckoutStepper from '@/components/checkout/CheckoutStepper';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import type { 
  FirestoreService, 
  FirestoreSubCategory, 
  TimeSlotCategoryLimit, 
  FirestoreBooking,
  AppSettings,
  DayAvailability
} from '@/types/firestore';
import { getCartEntries, type CartEntry } from '@/lib/cartManager';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/contexts/LoadingContext'; 
import { useRouter, usePathname } from 'next/navigation';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { defaultAppSettings } from '@/config/appDefaults';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import type { BreadcrumbItem } from '@/types/ui';
import { logUserActivity } from '@/lib/activityLogger';
import { useAuth } from '@/hooks/useAuth';
import { getGuestId } from '@/lib/guestIdManager';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Separator } from '@/components/ui/separator';

const DEFAULT_SLOT_INTERVAL_MINUTES = defaultAppSettings.timeSlotSettings.slotIntervalMinutes;
const DEFAULT_ENABLE_LIMIT_LATE_BOOKINGS = defaultAppSettings.enableLimitLateBookings;
const DEFAULT_HOURS_WHEN_LIMIT_ENABLED = defaultAppSettings.limitLateBookingHours;

const getServiceDurationInMinutes = (service: FirestoreService): number => {
    if (!service.taskTimeValue || !service.taskTimeUnit) return 0;
    if (service.taskTimeUnit === 'hours') {
        return service.taskTimeValue * 60;
    }
    return service.taskTimeValue;
};


export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date()); // State for calendar's month view
  const [availableTimeSlots, setAvailableTimeSlots] = useState<{ slot: string; remainingCapacity: number }[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | undefined>();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoadingSlotsAndConfig, setIsLoadingSlotsAndConfig] = useState(true); 
  const [isSearchingForNextDay, setIsSearchingForNextDay] = useState(false);
  const [dataFetchError, setDataFetchError] = useState<string | null>(null);

  const { toast } = useToast();
  const { showLoading } = useLoading(); 
  const router = useRouter(); 
  const pathname = usePathname();
  const { user } = useAuth();

  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();
  
  const [timeSlotLimits, setTimeSlotLimits] = useState<Record<string, TimeSlotCategoryLimit>>({});
  const [allServices, setAllServices] = useState<Record<string, FirestoreService>>({});
  const [allSubCategories, setAllSubCategories] = useState<Record<string, FirestoreSubCategory>>({});
  const [bookingsForSelectedDate, setBookingsForSelectedDate] = useState<FirestoreBooking[]>([]);
  const [cartEntries, setCartEntries] = useState<CartEntry[]>([]);
  const [cartCategoryIds, setCartCategoryIds] = useState<string[]>([]);
  const [totalCartDuration, setTotalCartDuration] = useState(0); 

  const slotIntervalMinutes = useMemo(() => appConfig.timeSlotSettings?.slotIntervalMinutes || DEFAULT_SLOT_INTERVAL_MINUTES, [appConfig]);
  const breakTimeMinutes = useMemo(() => appConfig.timeSlotSettings?.breakTimeMinutes || 0, [appConfig]);
  const enableLimitLateBookings = useMemo(() => appConfig.enableLimitLateBookings ?? DEFAULT_ENABLE_LIMIT_LATE_BOOKINGS, [appConfig]);
  const limitLateBookingHours = useMemo(() => enableLimitLateBookings ? (appConfig.limitLateBookingHours ?? DEFAULT_HOURS_WHEN_LIMIT_ENABLED) : 0, [appConfig, enableLimitLateBookings]);
  const weeklyAvailability = useMemo(() => appConfig.timeSlotSettings?.weeklyAvailability || defaultAppSettings.timeSlotSettings.weeklyAvailability, [appConfig]);


  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const period = timeMatch[3].toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }
    // Fallback for HH:MM format
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const formatTimeFromMinutes = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 && hours < 24 ? 'PM' : 'AM';
    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;
    return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const getDayName = (date: Date): keyof AppSettings['timeSlotSettings']['weeklyAvailability'] => {
    const dayIndex = date.getDay();
    const days: (keyof AppSettings['timeSlotSettings']['weeklyAvailability'])[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
  };

  const calculateSlotsForDay = useCallback(async (date: Date): Promise<{ slot: string; remainingCapacity: number }[]> => {
    const dateISO = date.toLocaleDateString('en-CA');
    const bookingsQuery = query(collection(db, "bookings"), where("scheduledDate", "==", dateISO));
    const bookingsSnap = await getDocs(bookingsQuery);
    const bookingsForDay = bookingsSnap.docs.map(doc => doc.data() as FirestoreBooking);

    const dayName = getDayName(date);
    const dayAvailability = weeklyAvailability[dayName];
    if (!dayAvailability.isEnabled) return [];
    
    const now = new Date();
    const effectiveDelayHours = enableLimitLateBookings ? (limitLateBookingHours || 0) : 0;
    const earliestBookableAbsoluteTime = new Date(now.getTime() + (effectiveDelayHours * 60 * 60 * 1000));
    
    const fullCycleDuration = slotIntervalMinutes + breakTimeMinutes;
    const periodStartTimeMinutes = parseTimeToMinutes(dayAvailability.startTime);
    const periodEndTimeMinutes = parseTimeToMinutes(dayAvailability.endTime);
    
    const availableSlots: { slot: string; remainingCapacity: number }[] = [];

    const busySlotMap = new Map<number, { count: number; categoryIds: Set<string> }>();
    bookingsForDay.forEach(booking => {
      const bookingStartMinutes = parseTimeToMinutes(booking.scheduledTimeSlot);
      let bookingDuration = 0;
      const bookingCategoryIds = new Set<string>();

      booking.services.forEach(item => {
        const serviceDetail = allServices[item.serviceId];
        if (serviceDetail) {
          bookingDuration += getServiceDurationInMinutes(serviceDetail) * item.quantity;
          const subCat = allSubCategories[serviceDetail.subCategoryId];
          if (subCat?.parentId) bookingCategoryIds.add(subCat.parentId);
        }
      });
      
      const bookingSlotsCount = Math.max(1, Math.ceil(bookingDuration / slotIntervalMinutes));

      for (let i = 0; i < bookingSlotsCount; i++) {
        const busySlotTime = bookingStartMinutes + (i * slotIntervalMinutes);
        const slotInfo = busySlotMap.get(busySlotTime) || { count: 0, categoryIds: new Set() };
        slotInfo.count++;
        bookingCategoryIds.forEach(catId => slotInfo.categoryIds.add(catId));
        busySlotMap.set(busySlotTime, slotInfo);
      }
    });

    let potentialStartTimeMinutes = periodStartTimeMinutes;
    while (potentialStartTimeMinutes < periodEndTimeMinutes) {
        const slotString = formatTimeFromMinutes(potentialStartTimeMinutes);
        const slotDateTime = new Date(date);
        slotDateTime.setHours(Math.floor(potentialStartTimeMinutes / 60), potentialStartTimeMinutes % 60, 0, 0);
        
        if (slotDateTime < earliestBookableAbsoluteTime) {
            potentialStartTimeMinutes += fullCycleDuration;
            continue;
        }

        const estimatedEndTimeMinutes = potentialStartTimeMinutes + totalCartDuration;
        if (estimatedEndTimeMinutes > periodEndTimeMinutes) {
            potentialStartTimeMinutes += fullCycleDuration;
            continue;
        }

        let isSlotAvailable = true;
        let minRemainingCapacityInBlock = Infinity;
        const requiredSlotsCount = Math.max(1, Math.ceil(totalCartDuration / slotIntervalMinutes));

        for (let i = 0; i < requiredSlotsCount; i++) {
            const checkTimeMinutes = potentialStartTimeMinutes + (i * slotIntervalMinutes);
            const slotInfo = busySlotMap.get(checkTimeMinutes);
            
            for (const cartCatId of cartCategoryIds) {
                const limitConfig = timeSlotLimits[cartCatId];
                const limit = limitConfig ? limitConfig.maxConcurrentBookings : 1;
                const currentBookingsInSlotForCat = slotInfo?.categoryIds.has(cartCatId) ? (slotInfo?.count || 0) : 0;
                
                const remainingCapacityForThisCat = limit - currentBookingsInSlotForCat;
                minRemainingCapacityInBlock = Math.min(minRemainingCapacityInBlock, remainingCapacityForThisCat);
                
                if (remainingCapacityForThisCat <= 0) {
                    isSlotAvailable = false;
                    break;
                }
            }
            if (!isSlotAvailable) break;
        }

        if (isSlotAvailable) {
            availableSlots.push({ slot: slotString, remainingCapacity: minRemainingCapacityInBlock });
        }

        potentialStartTimeMinutes += fullCycleDuration;
    }
    return availableSlots;
  }, [
    weeklyAvailability, enableLimitLateBookings, limitLateBookingHours, slotIntervalMinutes, breakTimeMinutes,
    allServices, allSubCategories, totalCartDuration, cartCategoryIds, timeSlotLimits
  ]);


  useEffect(() => {
    setIsMounted(true);
    const fetchInitialData = async () => {
      if (isLoadingAppSettings) return;
      setIsLoadingSlotsAndConfig(true);
      setDataFetchError(null);
      try {
        const [limitsSnap, servicesSnap, subCatsSnap] = await Promise.all([
          getDocs(collection(db, "timeSlotCategoryLimits")),
          getDocs(collection(db, "adminServices")),
          getDocs(collection(db, "adminSubCategories")),
        ]);

        const limitsData = Object.fromEntries(limitsSnap.docs.map(doc => [doc.data().categoryId, { id: doc.id, ...doc.data() } as TimeSlotCategoryLimit]));
        const servicesData = Object.fromEntries(servicesSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as FirestoreService]));
        const subCatsData = Object.fromEntries(subCatsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as FirestoreSubCategory]));
        
        setTimeSlotLimits(limitsData);
        setAllServices(servicesData);
        setAllSubCategories(subCatsData);

        const currentCartEntries = getCartEntries();
        setCartEntries(currentCartEntries);

        const uniqueCartCategoryIds = new Set<string>();
        let currentTotalCartDuration = 0;
        currentCartEntries.forEach(entry => {
          const service = servicesData[entry.serviceId];
          if (service) {
            currentTotalCartDuration += getServiceDurationInMinutes(service) * entry.quantity;
            const subCat = subCatsData[service.subCategoryId];
            if (subCat?.parentId) {
              uniqueCartCategoryIds.add(subCat.parentId);
            }
          }
        });
        setCartCategoryIds(Array.from(uniqueCartCategoryIds));
        setTotalCartDuration(currentTotalCartDuration); 
        
        const savedDateStr = localStorage.getItem('fixbroScheduledDate');
        const now = new Date();
        let initialDateToDisplay = new Date(now); 
        initialDateToDisplay.setHours(0,0,0,0);
        if (savedDateStr) {
            const parsedSavedDate = new Date(savedDateStr);
            if (!isNaN(parsedSavedDate.getTime()) && parsedSavedDate >= initialDateToDisplay) {
                initialDateToDisplay = parsedSavedDate;
            }
        }
        setSelectedDate(initialDateToDisplay);
        setDisplayMonth(initialDateToDisplay); // Sync display month
        logUserActivity('checkoutStep', { checkoutStepName: 'schedule', pageUrl: pathname }, user?.uid, !user ? getGuestId() : null);

      } catch (error) {
        console.error("Error fetching initial schedule data:", error);
        setDataFetchError("Failed to load scheduling data. Please try again.");
        toast({ title: "Error", description: "Could not load schedule information.", variant: "destructive"});
      } finally {
        setIsLoadingSlotsAndConfig(false);
      }
    };
    if (isMounted && !isLoadingAppSettings) {
      fetchInitialData();
    }
  }, [isMounted, toast, isLoadingAppSettings, pathname, user]); 

  // Fetch bookings whenever selectedDate changes
  useEffect(() => {
    if (!selectedDate || isSearchingForNextDay) return;
    
    const runSlotCalculation = async () => {
        const slots = await calculateSlotsForDay(selectedDate);
        setAvailableTimeSlots(slots);

        // If today has no slots, and we're not already searching, find the next available day
        if (new Date(selectedDate).toDateString() === new Date().toDateString() && slots.length === 0 && !isSearchingForNextDay) {
            setIsSearchingForNextDay(true);
            let nextDay = new Date(selectedDate);
            let found = false;
            for (let i = 0; i < 30; i++) { // Search up to 30 days ahead
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDaySlots = await calculateSlotsForDay(nextDay);
                if (nextDaySlots.length > 0) {
                    const nextAvailableDate = new Date(nextDay);
                    setSelectedDate(nextAvailableDate);
                    setDisplayMonth(nextAvailableDate); // Sync display month
                    toast({
                        variant: "destructive",
                        title: "No Slots Today",
                        description: `Showing first available slots for ${nextDay.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}.`,
                    });
                    found = true;
                    break;
                }
            }
            if (!found) {
              // No slots found in the next 30 days
            }
            setIsSearchingForNextDay(false);
        }
    };
    runSlotCalculation();
  }, [selectedDate, calculateSlotsForDay, isSearchingForNextDay, toast]);


  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setDisplayMonth(date); // Sync display month
    setSelectedTimeSlot(undefined); 
  };
  

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const handleProceed = () => {
    if (typeof window !== 'undefined' && selectedDate && selectedTimeSlot) {
      showLoading();
      localStorage.setItem('fixbroScheduledDate', selectedDate.toLocaleDateString('en-CA'));
      localStorage.setItem('fixbroScheduledTimeSlot', selectedTimeSlot);
      router.push('/checkout/address');
    }
  };

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Cart", href: "/cart" },
    { label: "Schedule Service" },
  ];

  const formatDateForDisplay = (date: Date | undefined): string => {
    if (!date) return "";
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!isMounted || isLoadingAppSettings || (isLoadingSlotsAndConfig && !selectedDate)) { 
     return (
      <div className="max-w-4xl mx-auto px-2 sm:px-4">
        <Breadcrumbs items={breadcrumbItems} className="mb-4 sm:mb-6" />
        <CheckoutStepper currentStepId="schedule" />
        <Card className="shadow-lg border-none sm:border">
          <CardHeader><CardTitle className="text-xl sm:text-2xl font-headline text-center">Select Date &amp; Time</CardTitle></CardHeader>
          <CardContent className="space-y-6 text-center py-12">
             <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
             <p className="text-muted-foreground animate-pulse font-medium">Preparing available slots...</p>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 border-t pt-6 bg-muted/20">
            <Button variant="ghost" disabled className="hidden sm:flex border border-input"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Cart</Button>
            <Button disabled className="w-full sm:w-auto px-8">
              Proceed to Address <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (dataFetchError) {
    return (
       <div className="max-w-4xl mx-auto px-2 sm:px-4">
        <Breadcrumbs items={breadcrumbItems} className="mb-4 sm:mb-6" />
        <CheckoutStepper currentStepId="schedule" />
        <Card className="shadow-lg border-destructive/20 overflow-hidden">
          <div className="bg-destructive/5 py-12 px-6 flex flex-col items-center text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-bold text-destructive mb-2">Something went wrong</h2>
            <p className="text-destructive/80 max-w-md mb-6">{dataFetchError}</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="border-destructive text-destructive hover:bg-destructive hover:text-white">Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 pb-12">
      <Breadcrumbs items={breadcrumbItems} className="mb-4 sm:mb-6" />
      <CheckoutStepper currentStepId="schedule" />
      
      <Card className="shadow-xl border-none sm:border overflow-hidden">
        <CardHeader className="bg-primary/5 border-b py-6">
          <CardTitle className="text-xl sm:text-2xl font-headline text-center flex items-center justify-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Select Date &amp; Time
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Column: Calendar Selection */}
            <div className="lg:col-span-5 p-4 sm:p-8 border-b lg:border-b-0 lg:border-r bg-muted/5">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                   <div className="h-8 w-1 bg-primary rounded-full" />
                   <h3 className="text-lg font-bold">Pick a Date</h3>
                </div>
                
                <div className="flex justify-center bg-background p-4 rounded-xl shadow-sm border">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    month={displayMonth}
                    onMonthChange={setDisplayMonth}
                    className="rounded-md"
                    disabled={(date) => date < today}
                  />
                </div>
                
                <div className="bg-primary/5 p-4 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Service Duration</p>
                    <p className="text-xs text-muted-foreground">Estimated duration based on your cart: <span className="text-primary font-bold">{totalCartDuration} mins</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Time Slot Selection */}
            <div className="lg:col-span-7 p-4 sm:p-8 space-y-6 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-1 bg-primary rounded-full" />
                  <h3 className="text-lg font-bold">Available Slots</h3>
                </div>
                {selectedDate && (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
                    {formatDateForDisplay(selectedDate)}
                  </Badge>
                )}
              </div>

              <div className="flex-grow">
                {selectedDate ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedDate.toISOString()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="h-full"
                    >
                      {isSearchingForNextDay ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                           <Loader2 className="h-10 w-10 text-primary animate-spin" />
                           <p className="text-muted-foreground font-medium">Finding the next available day...</p>
                        </div>
                      ) : availableTimeSlots.length > 0 ? (
                        <div className="space-y-4">
                           <RadioGroup
                            value={selectedTimeSlot}
                            onValueChange={setSelectedTimeSlot}
                            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                          >
                            {availableTimeSlots.map(({ slot, remainingCapacity }) => (
                              <div key={slot}>
                                <RadioGroupItem 
                                  value={slot} 
                                  id={`slot-${slot}`} 
                                  className="sr-only" 
                                />
                                <Label
                                  htmlFor={`slot-${slot}`}
                                  className={`group relative flex flex-col items-center justify-center border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-primary/50
                                    ${selectedTimeSlot === slot 
                                      ? 'bg-primary border-primary text-primary-foreground shadow-md ring-2 ring-primary/20 scale-[1.02]' 
                                      : 'bg-background border-muted hover:bg-muted/30'}`}
                                >
                                  <Clock className={`h-4 w-4 mb-2 ${selectedTimeSlot === slot ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'}`} />
                                  <span className="font-bold text-sm tracking-tight">{slot}</span>
                                  
                                  {remainingCapacity > 1 && (
                                      <Badge 
                                        variant="default" 
                                        className={`absolute -top-2 -right-1 text-[9px] px-1.5 py-0 bg-green-500 hover:bg-green-600 border-2 border-background shadow-sm
                                          ${selectedTimeSlot === slot ? 'bg-white text-green-600 border-primary' : ''}`}
                                      >
                                        {remainingCapacity} left
                                      </Badge>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                          
                          {selectedTimeSlot && (
                             <motion.div 
                               initial={{ opacity: 0, scale: 0.95 }}
                               animate={{ opacity: 1, scale: 1 }}
                               className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between"
                             >
                               <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                                   <CheckCircle2 className="h-6 w-6" />
                                 </div>
                                 <div>
                                   <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Selected Schedule</p>
                                   <p className="text-sm font-bold">{formatDateForDisplay(selectedDate)} at {selectedTimeSlot}</p>
                                 </div>
                               </div>
                               <Badge className="bg-primary text-primary-foreground">Confirmed</Badge>
                             </motion.div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                          <h4 className="font-bold text-lg mb-1">No slots available</h4>
                          <p className="text-muted-foreground text-sm max-w-xs">
                            This date is fully booked or doesn't accommodate your service duration. Please select another date.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl opacity-60">
                    <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium">Please select a date on the left to see available time slots</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-muted/20 p-6 border-t">
          <Link href="/cart" passHref className="hidden sm:block order-2 sm:order-1">
            <Button variant="ghost" className="border border-input hover:bg-foreground hover:text-background transition-all duration-300 group">
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" /> Back to Cart
            </Button>
          </Link>
          
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 order-1 sm:order-2">
            <Button 
              disabled={!selectedDate || !selectedTimeSlot} 
              onClick={handleProceed}
              className="w-full sm:w-auto px-10 py-6 text-base font-bold shadow-lg shadow-primary/20 group relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center">
                Proceed to Address <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Button>
          </div>
        </CardFooter>
      </Card>
      
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Instant Booking", desc: "Real-time availability updates" },
          { title: "Expert Pro", desc: "Verified professional for every job" },
          { title: "On-time Arrival", desc: "Punctuality is our top priority" }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-background border shadow-sm">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <div>
              <p className="text-sm font-bold leading-none mb-1">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
