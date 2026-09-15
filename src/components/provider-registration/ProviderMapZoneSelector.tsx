"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, LocateFixed, MapPin, Search, Globe2, Sliders, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ServiceZone } from '@/types/firestore';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from '@/lib/mysqlDb';
import { useToast } from "@/hooks/use-toast";

interface ProviderMapZoneSelectorProps {
  apiKey: string;
  initialCenter?: { lat: number; lng: number } | null;
  initialRadiusKm?: number;
  initialAddress?: string;
  maxRadiusKm?: number;
  onConfirm: (data: {
    center: { lat: number; lng: number };
    radiusKm: number;
    address: string;
  }) => void;
  onClose: () => void;
}

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bangalore
const DEFAULT_ZOOM = 11;
const DETAILED_ZOOM = 14;

const GOOGLE_MAPS_SCRIPT_ID = "fixbro-google-maps-provider-script";
const GOOGLE_MAPS_CALLBACK_NAME = `initFixbroProviderMapCallback_${Math.random().toString(36).substring(2, 15)}`;

const PRESET_RADII = [3, 5, 10, 15, 20, 25];

export default function ProviderMapZoneSelector({
  apiKey,
  initialCenter,
  initialRadiusKm = 5,
  initialAddress = "",
  maxRadiusKm = 50,
  onConfirm,
  onClose,
}: ProviderMapZoneSelectorProps) {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);

  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Active center, radius, and address
  const [currentCenter, setCurrentCenter] = useState<{ lat: number; lng: number }>(
    initialCenter && initialCenter.lat && initialCenter.lng ? initialCenter : DEFAULT_CENTER
  );
  const [radiusKm, setRadiusKm] = useState<number>(Math.min(initialRadiusKm || 5, maxRadiusKm));
  const [addressText, setAddressText] = useState<string>(initialAddress || "");
  const [hasSelected, setHasSelected] = useState<boolean>(!!(initialCenter?.lat && initialCenter?.lng));

  // Service zones from /admin/service-zones
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("custom");

  // Google Maps instances
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const zoneCirclesRef = useRef<google.maps.Circle[]>([]);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteInstanceRef = useRef<google.maps.places.Autocomplete | null>(null);

  // 1. Fetch active service zones
  useEffect(() => {
    let isMounted = true;
    const fetchZones = async () => {
      try {
        const q = query(collection(db, "serviceZones"), where("isActive", "==", true));
        const snapshot = await getDocs(q);
        if (isMounted) {
          const zones = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ServiceZone));
          setServiceZones(zones);
        }
      } catch (err) {
        console.error("Error fetching service zones:", err);
      } finally {
        if (isMounted) setIsLoadingZones(false);
      }
    };
    fetchZones();
    return () => { isMounted = false; };
  }, []);

  // 2. Load Google Maps script safely (without duplicating)
  const loadGoogleMapsScript = useCallback(() => {
    if (window.google && window.google.maps && window.google.maps.places && window.google.maps.Geocoder) {
      setIsScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) ||
      document.getElementById("fixbro-google-maps-places-script") ||
      document.getElementById("fixbro-google-maps-script-zone");

    if (existingScript) {
      const handleLoaded = () => {
        setIsScriptLoaded(true);
        setIsLoading(false);
      };
      if (window.google && window.google.maps) {
        handleLoaded();
      } else {
        existingScript.addEventListener('load', handleLoaded);
        return () => existingScript.removeEventListener('load', handleLoaded);
      }
      return;
    }

    setIsLoading(true);
    (window as any)[GOOGLE_MAPS_CALLBACK_NAME] = () => {
      setIsScriptLoaded(true);
      setIsLoading(false);
    };

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding&callback=${GOOGLE_MAPS_CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("ProviderMapZoneSelector: Google Maps script failed to load.");
      setIsLoading(false);
    };
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) {
      loadGoogleMapsScript();
    } else {
      setIsLoading(false);
    }
  }, [apiKey, loadGoogleMapsScript]);

  // 3. Reverse geocode position to readable address text
  const geocodePosition = useCallback((latLng: google.maps.LatLng | google.maps.LatLngLiteral) => {
    if (!window.google?.maps?.Geocoder) return;
    if (!geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
    setIsGeocoding(true);
    geocoderRef.current.geocode({ location: latLng }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK' && results && results[0]) {
        const formatted = results[0].formatted_address;
        setAddressText(formatted);
        if (autocompleteInputRef.current) {
          autocompleteInputRef.current.value = formatted;
        }
      }
    });
  }, []);

  // 4. Update the center marker and radius circle on the map
  const updateMarkerAndCircle = useCallback((pos: { lat: number; lng: number }, radius: number) => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    const map = mapInstanceRef.current;

    // Center marker
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: pos,
        map: map,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
        title: "Your Work Center",
      });

      markerRef.current.addListener('dragend', () => {
        const newPos = markerRef.current?.getPosition();
        if (newPos) {
          const coords = { lat: newPos.lat(), lng: newPos.lng() };
          setCurrentCenter(coords);
          setHasSelected(true);
          setSelectedZoneId("custom");
          geocodePosition(coords);
        }
      });
    } else {
      markerRef.current.setPosition(pos);
    }

    // Provider's work coverage circle
    if (!circleRef.current) {
      circleRef.current = new window.google.maps.Circle({
        strokeColor: "#45A0A2",
        strokeOpacity: 0.9,
        strokeWeight: 2.5,
        fillColor: "#45A0A2",
        fillOpacity: 0.22,
        map: map,
        center: pos,
        radius: radius * 1000,
      });
    } else {
      circleRef.current.setCenter(pos);
      circleRef.current.setRadius(radius * 1000);
    }
  }, [geocodePosition]);

  // 5. Draw existing Fixbro service zones for context
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps || serviceZones.length === 0) return;

    zoneCirclesRef.current.forEach(c => c.setMap(null));
    zoneCirclesRef.current = [];

    serviceZones.forEach(zone => {
      if (zone.center?.latitude && zone.center?.longitude) {
        const zoneCircle = new window.google.maps.Circle({
          strokeColor: "#2563eb",
          strokeOpacity: 0.45,
          strokeWeight: 1.5,
          fillColor: "#3b82f6",
          fillOpacity: 0.07,
          map: mapInstanceRef.current,
          center: { lat: zone.center.latitude, lng: zone.center.longitude },
          radius: (zone.radiusKm || 5) * 1000,
        });
        zoneCirclesRef.current.push(zoneCircle);
      }
    });

    return () => {
      zoneCirclesRef.current.forEach(c => c.setMap(null));
      zoneCirclesRef.current = [];
    };
  }, [serviceZones, isScriptLoaded]);

  // 6. Handle GPS "Locate Me"
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation || !mapInstanceRef.current) {
      toast({
        title: "Geolocation Unavailable",
        description: "Your browser does not support GPS or permissions are denied.",
        variant: "destructive"
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentCenter(coords);
        setHasSelected(true);
        setSelectedZoneId("custom");
        mapInstanceRef.current?.setCenter(coords);
        mapInstanceRef.current?.setZoom(DETAILED_ZOOM);
        updateMarkerAndCircle(coords, radiusKm);
        geocodePosition(coords);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        toast({
          title: "Location Access Denied",
          description: "Please enable GPS/location permissions or search your area in the search bar.",
          variant: "destructive"
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [radiusKm, updateMarkerAndCircle, geocodePosition, toast]);

  // 7. Initialize Map
  useEffect(() => {
    if (!isScriptLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: currentCenter,
      zoom: hasSelected ? DETAILED_ZOOM : DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_CENTER,
      },
    });
    mapInstanceRef.current = map;

    // Click map to set center
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        setCurrentCenter(coords);
        setHasSelected(true);
        setSelectedZoneId("custom");
        updateMarkerAndCircle(coords, radiusKm);
        geocodePosition(coords);
      }
    });

    // Places autocomplete
    if (autocompleteInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ["geometry", "name", "formatted_address"]
      });
      autocompleteInstanceRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          const loc = place.geometry.location;
          const coords = { lat: loc.lat(), lng: loc.lng() };
          setCurrentCenter(coords);
          setHasSelected(true);
          setSelectedZoneId("custom");
          map.setCenter(coords);
          map.setZoom(DETAILED_ZOOM);
          updateMarkerAndCircle(coords, radiusKm);
          if (place.formatted_address) {
            setAddressText(place.formatted_address);
          } else {
            geocodePosition(coords);
          }
        }
      });
    }

    // Place initial marker and circle
    updateMarkerAndCircle(currentCenter, radiusKm);
    if (!addressText && hasSelected) {
      geocodePosition(currentCenter);
    }
  }, [isScriptLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 8. Keep marker & circle synced with state updates
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateMarkerAndCircle(currentCenter, radiusKm);
    }
  }, [currentCenter, radiusKm, updateMarkerAndCircle]);

  // 9. Zone Selection dropdown change
  const handleZoneSelect = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    if (zoneId === "custom") return;

    const zone = serviceZones.find(z => z.id === zoneId);
    if (zone && zone.center?.latitude && zone.center?.longitude) {
      const coords = { lat: zone.center.latitude, lng: zone.center.longitude };
      const newRadius = Math.min(zone.radiusKm || 5, maxRadiusKm);
      setCurrentCenter(coords);
      setRadiusKm(newRadius);
      setHasSelected(true);
      const zoneName = `${zone.name} (Service Zone)`;
      setAddressText(zoneName);
      if (autocompleteInputRef.current) {
        autocompleteInputRef.current.value = zoneName;
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(coords);
        mapInstanceRef.current.setZoom(13);
      }
      updateMarkerAndCircle(coords, newRadius);
    }
  };

  // 10. Radius change handler
  const handleRadiusChange = (newRadius: number) => {
    const clamped = Math.max(1, Math.min(newRadius, maxRadiusKm));
    setRadiusKm(clamped);
    if (circleRef.current) {
      circleRef.current.setRadius(clamped * 1000);
    }
  };

  // 11. Confirm selection
  const handleConfirm = () => {
    if (!hasSelected && !currentCenter) {
      toast({
        title: "Location Not Set",
        description: "Please search an area, click on the map, or select a zone.",
        variant: "destructive"
      });
      return;
    }

    const finalAddress = addressText || `${currentCenter.lat.toFixed(5)}, ${currentCenter.lng.toFixed(5)}`;
    onConfirm({
      center: currentCenter,
      radiusKm,
      address: finalAddress,
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-background rounded-lg overflow-hidden">
      {/* Top Controls: Zone Quick-Select & Search Bar */}
      <div className="p-3.5 border-b bg-card space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Fixbro Service Zone Quick Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
              <Globe2 className="h-3.5 w-3.5 text-primary" />
              Fixbro Service Zone (Quick Select)
            </label>
            <Select value={selectedZoneId} onValueChange={handleZoneSelect} disabled={isLoadingZones}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={isLoadingZones ? "Loading service zones..." : "Select a service zone..."} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom" className="text-xs font-medium">
                  📍 Custom Location (Pin on map / Search)
                </SelectItem>
                {serviceZones.map(zone => (
                  <SelectItem key={zone.id} value={zone.id} className="text-xs">
                    {zone.name} ({zone.radiusKm} km radius)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Autocomplete Places Search */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
              <Search className="h-3.5 w-3.5 text-primary" />
              Or Search Any Address / Area
            </label>
            <div className="relative">
              <Input
                ref={autocompleteInputRef}
                placeholder="Search area, landmark, or street..."
                className="h-9 text-xs pr-8"
                defaultValue={addressText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
              />
              {isGeocoding && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Radius Adjuster Controls */}
        <div className="bg-muted/40 rounded-md p-2.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-grow max-w-sm">
            <Sliders className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-grow space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground">Service Radius:</span>
                <span className="font-bold text-primary">{radiusKm} km</span>
              </div>
              <Slider
                value={[radiusKm]}
                min={1}
                max={maxRadiusKm}
                step={1}
                onValueChange={(val) => handleRadiusChange(val[0])}
                className="cursor-pointer"
              />
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
            {PRESET_RADII.filter(r => r <= maxRadiusKm).map(r => (
              <Button
                key={r}
                type="button"
                variant={radiusKm === r ? "default" : "outline"}
                size="sm"
                className={`h-7 px-2.5 text-xs font-medium ${radiusKm === r ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => handleRadiusChange(r)}
              >
                {r} km
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Map Display */}
      <div className="relative flex-grow w-full min-h-[350px]">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/60 z-20 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Loading Map...</p>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />

        {/* Floating GPS Locate Me Button */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          title="Locate my current position"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute bottom-4 right-4 z-10 h-10 w-10 rounded-full shadow-lg bg-background hover:bg-muted border border-border"
        >
          {isLocating ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <LocateFixed className="h-4 w-4 text-primary" />}
        </Button>

        {/* Map Legend / Tip */}
        <div className="absolute top-3 left-3 z-10 bg-background/90 backdrop-blur-sm border shadow-md rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#45A0A2] border border-white shadow-sm shrink-0" />
          <span>Click anywhere or drag the pin to position your center point</span>
        </div>
      </div>

      {/* Footer Info & Confirmation */}
      <div className="p-3.5 border-t bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-start gap-2 w-full sm:w-auto overflow-hidden">
          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs truncate max-w-md">
            <p className="font-semibold text-foreground truncate">
              {addressText || "Selected Location on Map"}
            </p>
            <p className="text-muted-foreground text-[11px]">
              Coverage: <span className="font-medium text-primary">{radiusKm} km</span> radius around ({currentCenter.lat.toFixed(4)}, {currentCenter.lng.toFixed(4)})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-xs">
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm} className="h-9 px-5 text-xs font-semibold gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Use Selected Location & Radius
          </Button>
        </div>
      </div>
    </div>
  );
}
