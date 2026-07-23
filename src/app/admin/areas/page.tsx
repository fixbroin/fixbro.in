
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Loader2, MapPin, CheckCircle, XCircle, PackageSearch, RefreshCw } from "lucide-react";
import type { FirestoreArea, FirestoreCity } from '@/types/firestore';
import AreaForm from '@/components/admin/AreaForm';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, orderBy, query, Timestamp, where, limit } from '@/lib/mysqlDb';
import { useToast } from "@/hooks/use-toast";
import PermissionGuard from '@/components/admin/PermissionGuard';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { submitToGoogleIndexing } from '@/lib/googleIndexing';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { hasActionPermission } from '@/config/rbac';
import { calculateNearbyAreas, recalculateAllNearbyAreasInCity } from '@/lib/locationUtils';
import { generateFreeAreaSeoData, getNearbyAreasSorted } from "@/lib/seoGenerator";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap } from "lucide-react";

const generateSlug = (name: string) => {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

export default function AdminAreasPage() {
  const { adminPermissions } = useAuth();
  const [areas, setAreas] = useState<FirestoreArea[]>([]);
  const [cities, setCities] = useState<FirestoreCity[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<FirestoreArea | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchCityId, setBatchCityId] = useState("");
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCurrentName, setBatchCurrentName] = useState("");

  // Batch SEO States
  const [isBatchSeoOpen, setIsBatchSeoOpen] = useState(false);
  const [batchSeoCityId, setBatchSeoCityId] = useState<string>("all");
  const [batchSeoOverwrite, setBatchSeoOverwrite] = useState(false);
  const [batchSeoRunning, setBatchSeoRunning] = useState(false);
  const [batchSeoProgress, setBatchSeoProgress] = useState(0);
  const [batchSeoStatus, setBatchSeoStatus] = useState("");

  const handleStartBatchSeo = async () => {
    setBatchSeoRunning(true);
    setBatchSeoProgress(0);
    setBatchSeoStatus("Initializing Area SEO batch...");

    try {
      const targetCities = batchSeoCityId === "all" ? cities : cities.filter(c => c.id === batchSeoCityId);
      const cityIds = targetCities.map(c => c.id);
      const targetAreas = areas.filter(a => cityIds.includes(a.cityId));

      const totalIterations = targetAreas.length;
      if (totalIterations === 0) {
        toast({ title: "No targets", description: "No active areas found.", variant: "destructive" });
        setBatchSeoRunning(false);
        return;
      }

      const catSnap = await getDocs(query(collection(db, "adminCategories"), where("isActive", "==", true)));
      const categoryNames = catSnap.docs.map(doc => doc.data().name as string);

      let processedCount = 0;
      let updatedCount = 0;

      for (const area of targetAreas) {
        processedCount++;
        setBatchSeoProgress(Math.round((processedCount / totalIterations) * 100));
        setBatchSeoStatus(`Processing Area SEO: ${area.name} (${processedCount}/${totalIterations})`);

        const hasExisting = area.h1_title || area.seo_title || area.seo_description || area.seo_keywords;
        if (hasExisting && !batchSeoOverwrite) {
          continue;
        }

        const city = cities.find(c => c.id === area.cityId);
        if (!city) continue;

        const fallbackNearby = getNearbyAreasSorted(area, areas.filter(a => a.cityId === area.cityId), 10);

        const result = generateFreeAreaSeoData(city.name, area.name, categoryNames, fallbackNearby);

        const areaDoc = doc(db, "areas", area.id);
        await updateDoc(areaDoc, {
          h1_title: result.h1_title,
          seo_title: result.seo_title,
          seo_description: result.seo_description,
          seo_keywords: result.seo_keywords,
          updatedAt: Timestamp.now()
        });

        updatedCount++;
      }

      toast({
        title: "Area SEO Batch Completed!",
        description: `Successfully updated SEO tags for ${updatedCount} areas.`,
        className: "bg-green-100 border-green-300 text-green-700"
      });

      setIsBatchSeoOpen(false);
      await triggerRefresh('locations');
      await triggerRefresh('sitemap');
      await fetchCitiesAndAreas();
    } catch (err) {
      console.error("Error batch generating area SEO:", err);
      toast({ title: "Batch Failed", description: (err as Error).message || "An error occurred.", variant: "destructive" });
    } finally {
      setBatchSeoRunning(false);
    }
  };

  const areasCollectionRef = collection(db, "areas");
  const citiesCollectionRef = collection(db, "cities");

  const handleBatchSync = async () => {
    if (!batchCityId) return;
    const parentCity = cities.find(c => c.id === batchCityId);
    if (!parentCity) return;

    const targetAreas = areas.filter(a => a.cityId === batchCityId && (!a.latitude || !a.longitude));
    if (targetAreas.length === 0) {
      toast({
        title: "No areas to sync",
        description: `All areas in ${parentCity.name} already have coordinates saved.`,
      });
      setIsBatchDialogOpen(false);
      return;
    }

    setIsBatchRunning(true);
    setBatchProgress(0);
    setBatchTotal(targetAreas.length);
    setBatchCurrentName("Initializing...");

    let successCount = 0;

    for (let i = 0; i < targetAreas.length; i++) {
      const area = targetAreas[i];
      setBatchCurrentName(`Fetching: ${area.name} (${i + 1}/${targetAreas.length})`);
      setBatchProgress(Math.round(((i + 1) / targetAreas.length) * 100));

      try {
        const q = `${area.name}, ${parentCity.name}, India`;
        const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        
        if (data.lat && data.lon) {
          const latNum = Number(data.lat);
          const lonNum = Number(data.lon);
          
          const areaDoc = doc(db, "areas", area.id);
          const nearby = await calculateNearbyAreas(area.id, batchCityId, latNum, lonNum);
          await updateDoc(areaDoc, { 
            latitude: latNum, 
            longitude: lonNum,
            nearbyAreas: nearby,
            updatedAt: Timestamp.now()
          });
          successCount++;
        }
      } catch (error) {
        console.error(`Error batch geocoding ${area.name}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setBatchCurrentName("Recalculating all nearby mappings...");
    await recalculateAllNearbyAreasInCity(batchCityId);

    toast({
      title: "Batch Sync Complete!",
      description: `Successfully updated coordinates and calculated nearby zones for ${successCount} areas.`
    });
    
    setIsBatchRunning(false);
    setIsBatchDialogOpen(false);
    await triggerRefresh('locations');
    await triggerRefresh('sitemap');
    await fetchCitiesAndAreas();
  };

  const fetchCitiesAndAreas = async () => {
    setIsLoading(true);
    try {
      const citiesQuery = query(citiesCollectionRef, orderBy("name", "asc"), limit(100));
      const citiesSnapshot = await getDocs(citiesQuery);
      const fetchedCities = citiesSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as FirestoreCity));
      setCities(fetchedCities);

      const areasQuery = query(areasCollectionRef, orderBy("name", "asc"), limit(500));
      const areasSnapshot = await getDocs(areasQuery);
      const fetchedAreas = areasSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as FirestoreArea));
      setAreas(fetchedAreas);

    } catch (error) {
      console.error("Error fetching cities or areas: ", error);
      toast({ title: "Error", description: "Could not fetch required data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchCitiesAndAreas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddArea = () => {
    setEditingArea(null);
    setIsFormOpen(true);
  };

  const handleEditArea = (area: FirestoreArea) => {
    setEditingArea(area);
    setIsFormOpen(true);
  };

  const handleDeleteArea = async (areaId: string) => {
    setIsSubmitting(true);
    try {
      // Call Google Indexing API before deleting from Firestore so we can resolve its slugs
      await submitToGoogleIndexing('area', areaId, false);
      
      await deleteDoc(doc(db, "areas", areaId));
      setAreas(areas.filter(area => area.id !== areaId));
      toast({ title: "Success", description: "Area deleted successfully." });

      // Refresh the cache
      await triggerRefresh('locations');
      await triggerRefresh('sitemap');
    } catch (error) {
      console.error("Error deleting area: ", error);
      toast({ title: "Error", description: "Could not delete area.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (data: Omit<FirestoreArea, 'id' | 'createdAt' | 'updatedAt' | 'cityName'> & { id?: string }) => {
    setIsSubmitting(true);
    const parentCity = cities.find(c => c.id === data.cityId);
    if (!parentCity) {
        toast({ title: "Error", description: "Parent city not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const payload: Omit<FirestoreArea, 'id' | 'createdAt' | 'updatedAt'> = {
      name: data.name,
      slug: data.slug || "",
      cityId: data.cityId,
      cityName: parentCity.name,
      isActive: data.isActive === undefined ? true : data.isActive,
      seo_title: data.seo_title,
      seo_description: data.seo_description,
      seo_keywords: data.seo_keywords,
      h1_title: data.h1_title,
      latitude: data.latitude ? Number(data.latitude) : undefined,
      longitude: data.longitude ? Number(data.longitude) : undefined,
    };

    try {
      let activeId = data.id || "";
      if (editingArea && data.id) {
        const areaDoc = doc(db, "areas", data.id);
        const nearby = (payload.latitude && payload.longitude)
          ? await calculateNearbyAreas(data.id, data.cityId, Number(payload.latitude), Number(payload.longitude))
          : [];
        await updateDoc(areaDoc, { ...payload, nearbyAreas: nearby, updatedAt: Timestamp.now() });
        toast({ title: "Success", description: "Area updated successfully." });
      } else {
        const docRef = await addDoc(areasCollectionRef, { ...payload, createdAt: Timestamp.now() });
        activeId = docRef.id;
        if (payload.latitude && payload.longitude) {
          const nearby = await calculateNearbyAreas(activeId, data.cityId, Number(payload.latitude), Number(payload.longitude));
          await updateDoc(doc(db, "areas", activeId), { nearbyAreas: nearby });
        }
        toast({ title: "Success", description: "Area added successfully." });
      }
      
      // Refresh the cache
      await triggerRefresh('locations');
      await triggerRefresh('sitemap');
      if (activeId) {
        await submitToGoogleIndexing('area', activeId, payload.isActive);
      }

      setIsFormOpen(false);
      setEditingArea(null);
      await fetchCitiesAndAreas(); // Re-fetch to update list
    } catch (error) {
      console.error("Error saving area: ", error);
      toast({ title: "Error", description: (error as Error).message || "Could not save area.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isMounted) {
     return (
      <div className="space-y-6">
        <Card><CardHeader><CardTitle className="animate-pulse h-8 w-1/2 bg-muted rounded"></CardTitle><CardDescription className="animate-pulse h-4 w-3/4 bg-muted rounded mt-2"></CardDescription></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-2xl flex items-center"><MapPin className="mr-2 h-6 w-6 text-primary" />Manage Areas</CardTitle>
            <CardDescription>Add, edit, or delete service areas under cities.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={() => setIsBatchSeoOpen(true)} variant="outline" disabled={isSubmitting || isLoading || cities.length === 0} className="w-full sm:w-auto">
              <Zap className="mr-2 h-4 w-4 text-amber-500" /> Batch Generate SEO (Free)
            </Button>
            <Button onClick={() => setIsBatchDialogOpen(true)} variant="outline" disabled={isSubmitting || isLoading || cities.length === 0} className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" /> Batch Sync Coordinates
            </Button>
            <Button onClick={handleAddArea} disabled={isSubmitting || isLoading || cities.length === 0} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Area
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading areas...</p>
            </div>
          ) : cities.length === 0 ? (
             <p className="text-muted-foreground text-center py-6">
                No cities found. Please add cities first to create areas under them.
            </p>
          ) : areas.length === 0 ? (
            <div className="text-center py-10">
              <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No areas found yet. Add one to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area Name</TableHead>
                  <TableHead>Parent City</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>H1 Title</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell className="font-medium">{area.name}</TableCell>
                    <TableCell>{area.cityName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{area.slug}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={area.h1_title}>{area.h1_title || "Not set"}</TableCell>
                    <TableCell className="text-center">
                      {area.isActive ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-red-500 mx-auto" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2 sm:justify-end">
                        <PermissionGuard moduleId="areas" action="write">
                          <Button variant="outline" size="icon" onClick={() => handleEditArea(area)} disabled={isSubmitting}>
                            <Edit className="h-4 w-4" /> <span className="sr-only">Edit</span>
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard moduleId="areas" action="delete">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" disabled={isSubmitting}>
                                <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the area "{area.name}". Services under this area might be affected.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteArea(area.id)}
                                  disabled={isSubmitting}
                                  className="bg-destructive hover:bg-destructive/90">
                                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!isSubmitting) { setIsFormOpen(open); if (!open) setEditingArea(null); } }}>
        <DialogContent className="w-[calc(100%-6px)] sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto p-0">
           <DialogHeader className="p-3 pb-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle>{editingArea ? 'Edit Area' : 'Add New Area'}</DialogTitle>
            <DialogDescription>
              {editingArea ? 'Update the details for this area.' : 'Fill in the details to create a new area.'}
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 flex-grow overflow-y-auto">
            {cities.length === 0 && !isLoading ? (
                 <div className="py-8 text-center">
                    <p className="text-destructive">Cannot add areas because no cities exist.</p>
                    <p className="text-muted-foreground text-sm mt-2">Please add at least one city first.</p>
                 </div>
            ) : (
                <AreaForm
                onSubmit={handleFormSubmit}
                initialData={editingArea}
                cities={cities}
                onCancel={() => { setIsFormOpen(false); setEditingArea(null); }}
                isSubmitting={isSubmitting}
                />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchDialogOpen} onOpenChange={(open) => { if (!isBatchRunning) { setIsBatchDialogOpen(open); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batch Auto-Fill Coordinates</DialogTitle>
            <DialogDescription>
              Select a city to automatically fetch coordinates for all areas that are missing them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select City</label>
              <select
                value={batchCityId}
                onChange={(e) => setBatchCityId(e.target.value)}
                disabled={isBatchRunning}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">-- Choose City --</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </div>

            {isBatchRunning && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="font-semibold">{batchCurrentName}</span>
                  <span>{batchProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${batchProgress}%` }}></div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Note: A 1-second delay is added between areas to respect OpenStreetMap rate limits.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBatchDialogOpen(false)}
              disabled={isBatchRunning}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBatchSync}
              disabled={isBatchRunning || !batchCityId}
            >
              {isBatchRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start Auto-Fill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchSeoOpen} onOpenChange={(open) => { if (!batchSeoRunning) setIsBatchSeoOpen(open); }}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Batch Generate Area SEO tags</DialogTitle>
            <DialogDescription>
              Automatically generate H1, Meta Title, Description, and Keywords for all areas under the selected city.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target City</label>
              <Select value={batchSeoCityId} onValueChange={setBatchSeoCityId} disabled={batchSeoRunning}>
                <SelectTrigger>
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(c => (
                    <SelectItem key={c.id} value={c.id!}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="overwrite_seo" 
                checked={batchSeoOverwrite} 
                onCheckedChange={(checked) => setBatchSeoOverwrite(!!checked)}
                disabled={batchSeoRunning}
              />
              <label htmlFor="overwrite_seo" className="text-sm font-medium leading-none cursor-pointer">
                Overwrite existing custom SEO tags
              </label>
            </div>

            {batchSeoRunning && (
              <div className="space-y-2 pt-4">
                <Progress value={batchSeoProgress} className="w-full" />
                <p className="text-xs text-muted-foreground animate-pulse">{batchSeoStatus}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsBatchSeoOpen(false)} disabled={batchSeoRunning}>
              Cancel
            </Button>
            <Button onClick={handleStartBatchSeo} disabled={batchSeoRunning}>
              {batchSeoRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {batchSeoRunning ? "Generating..." : "Start Batch Generation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
