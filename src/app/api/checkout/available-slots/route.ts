
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { AppSettings, FirestoreService, FirestoreSubCategory, TimeSlotCategoryLimit, FirestoreBooking } from '@/types/firestore';
import { defaultAppSettings } from '@/config/appDefaults';

interface CartEntry {
  serviceId: string;
  quantity: number;
}

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

export async function POST(req: NextRequest) {
    try {
        const { selectedDate, cartEntries } = await req.json();

        if (!selectedDate || !cartEntries) {
            return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
        }

        const dateObj = new Date(selectedDate);
        const dateISO = dateObj.toLocaleDateString('en-CA');

        // Parallel data fetching on the server
        const [appConfigSnap, limitsSnap, servicesSnap, subCatsSnap, bookingsSnap] = await Promise.all([
            adminDb.collection("webSettings").doc("applicationConfig").get(),
            adminDb.collection("timeSlotCategoryLimits").get(),
            adminDb.collection("adminServices").get(),
            adminDb.collection("adminSubCategories").get(),
            adminDb.collection("bookings").where("scheduledDate", "==", dateISO).get()
        ]);

        const appConfig = (appConfigSnap.exists ? appConfigSnap.data() : defaultAppSettings) as AppSettings;
        const limitsData = Object.fromEntries(limitsSnap.docs.map(doc => [doc.data().categoryId, { id: doc.id, ...doc.data() } as TimeSlotCategoryLimit]));
        const servicesData = Object.fromEntries(servicesSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as FirestoreService]));
        const subCatsData = Object.fromEntries(subCatsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as FirestoreSubCategory]));
        const bookingsForDay = bookingsSnap.docs.map(doc => doc.data() as FirestoreBooking);

        // Settings from config
        const slotIntervalMinutes = appConfig.timeSlotSettings?.slotIntervalMinutes || DEFAULT_SLOT_INTERVAL_MINUTES;
        const breakTimeMinutes = appConfig.timeSlotSettings?.breakTimeMinutes || 0;
        const enableLimitLateBookings = appConfig.enableLimitLateBookings ?? DEFAULT_ENABLE_LIMIT_LATE_BOOKINGS;
        const limitLateBookingHours = enableLimitLateBookings ? (appConfig.limitLateBookingHours ?? DEFAULT_HOURS_WHEN_LIMIT_ENABLED) : 0;
        const weeklyAvailability = appConfig.timeSlotSettings?.weeklyAvailability || defaultAppSettings.timeSlotSettings.weeklyAvailability;

        // Calculate Cart specific data
        const uniqueCartCategoryIds = new Set<string>();
        let totalCartDuration = 0;
        cartEntries.forEach((entry: CartEntry) => {
            const service = servicesData[entry.serviceId];
            if (service) {
                totalCartDuration += getServiceDurationInMinutes(service) * entry.quantity;
                const subCat = subCatsData[service.subCategoryId];
                if (subCat?.parentId) {
                    uniqueCartCategoryIds.add(subCat.parentId);
                }
            }
        });
        const cartCategoryIds = Array.from(uniqueCartCategoryIds);

        // Available slots logic (Exactly as it was on client-side)
        const dayName = getDayName(dateObj);
        const dayAvailability = weeklyAvailability[dayName];
        if (!dayAvailability.isEnabled) {
            return NextResponse.json({ availableTimeSlots: [], totalCartDuration });
        }

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
                const serviceDetail = servicesData[item.serviceId];
                if (serviceDetail) {
                    bookingDuration += getServiceDurationInMinutes(serviceDetail) * item.quantity;
                    const subCat = subCatsData[serviceDetail.subCategoryId];
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
            const slotDateTime = new Date(dateObj);
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
                    const limitConfig = limitsData[cartCatId];
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

        return NextResponse.json({ availableTimeSlots: availableSlots, totalCartDuration });
    } catch (error) {
        console.error("API Error fetching available slots:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
