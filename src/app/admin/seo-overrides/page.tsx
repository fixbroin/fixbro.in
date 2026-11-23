"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, Edit, Trash2, Loader2, PackageSearch, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchablePickerModal from '@/components/admin/SearchablePickerModal';
import type { CityCategorySeoSetting, AreaCategorySeoSetting, FirestoreCategory, FirestoreCity, FirestoreArea } from '@/types/firestore';
import CityCategorySeoForm, { type CityCategorySeoFormData } from '@/components/admin/CityCategorySeoForm';
import AreaCategorySeoForm, { type AreaCategorySeoFormData } from '@/components/admin/AreaCategorySeoForm';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, Timestamp, where, getDoc, limit } from '@/lib/mysqlDb';
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { submitToGoogleIndexing } from '@/lib/googleIndexing';
import { useAuth } from '@/hooks/useAuth';
import { executeDbClearTable, executeBulkOverridesSeoGenerate, executeBulkDeleteByAreaAction, executeBulkDeleteByCategoryAction, executeBulkDeleteCityCategoryByCityAction, executeBulkDeleteAreaCategoryByCityAction, executeDeleteDuplicateSeoAction } from '@/app/actions/dbActions';
import { hasActionPermission } from '@/config/rbac';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { getCache, setCache } from '@/lib/client-cache';
import { getAdminCategories, getCities, getAreas, getCityCategorySeoSettings, getAreaCategorySeoSettings } from '@/lib/webServerUtils';
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { generateFreeCityCategorySeoData, generateFreeAreaCategorySeoData, getNearbyAreasSorted } from "@/lib/seoGenerator";

const generateSeoSlug = (parts: (string | undefined)[]): string => {
    return parts.filter(Boolean).map(part => part!.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')).join('/');
};

export default function SeoOverridesPage() {
  const [activeTab, setActiveTab] = useState<string>("city-category");
  const [cityCategorySettings, setCityCategorySettings] = useState<CityCategorySeoSetting[]>([]);
  const [areaCategorySettings, setAreaCategorySettings] = useState<AreaCategorySeoSetting[]>([]);
  const [categories, setCategories] = useState<FirestoreCategory[]>([]);
  const [cities, setCities] = useState<FirestoreCity[]>([]);
  const [areas, setAreas] = useState<FirestoreArea[]>([]);
  const [cityDisplayLimit, setCityDisplayLimit] = useState(100);
  const [areaDisplayLimit, setAreaDisplayLimit] = useState(100);
  const [cityCityFilterId, setCityCityFilterId] = useState<string>("all");
  const [cityCategoryFilterId, setCityCategoryFilterId] = useState<string>("all");
  const [areaCityFilterId, setAreaCityFilterId] = useState<string>("all");
  const [areaCategoryFilterId, setAreaCategoryFilterId] = useState<string>("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<CityCategorySeoSetting | AreaCategorySeoSetting | null>(null);
  const [formType, setFormType] = useState<'cityCategory' | 'areaCategory' | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const { adminPermissions } = useAuth();

  const cityCatSeoRef = collection(db, "cityCategorySeoSettings");
  const areaCatSeoRef = collection(db, "areaCategorySeoSettings");

  // Batch Generation State
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchCityId, setBatchCityId] = useState<string>("all");
  const [batchCategoryId, setBatchCategoryId] = useState<string>("all");
  const [batchOverwrite, setBatchOverwrite] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchStatus, setBatchStatus] = useState("");

  // Delete All State
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStatus, setDeleteStatus] = useState("");

  // Bulk Delete State
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState<"city" | "area" | "category" | "city-category" | "duplicates" | "">("");
  const [bulkDeleteCityId, setBulkDeleteCityId] = useState<string>("");
  const [bulkDeleteAreaId, setBulkDeleteAreaId] = useState<string>("");
  const [bulkDeleteCategoryId, setBulkDeleteCategoryId] = useState<string>("");
  const [bulkDeleteRunning, setBulkDeleteRunning] = useState(false);

  const resolveUniqueSlug = async (collectionRef: any, baseSlug: string, currentId?: string): Promise<string> => {
    let uniqueSlug = baseSlug;
    let counter = 1;
    let isUnique = false;

    while (!isUnique) {
      const q = query(
        collectionRef,
        where("slug", "==", uniqueSlug),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        isUnique = true;
      } else {
        const docSnap = querySnapshot.docs[0];
        if (currentId && docSnap.id === currentId) {
          isUnique = true;
        } else {
          uniqueSlug = `${baseSlug}-${counter}`;
          counter++;
        }
      }
    }
    return uniqueSlug;
  };

  const handleStartBatch = async () => {
    setBatchRunning(true);
    setBatchProgress(0);
    setBatchStatus("Initializing server-side bulk generation...");

    try {
      setBatchProgress(20);
      setBatchStatus("Running bulk SEO generation on database server (this takes about 2-5 seconds)...");

      const result = await executeBulkOverridesSeoGenerate({
        activeTab: activeTab as "city-category" | "area-category",
        batchCityId,
        batchCategoryId,
        batchOverwrite
      });

      setBatchProgress(100);

      toast({
        title: "Batch Generation Completed!",
        description: `Successfully processed all combinations. Created: ${result.createdCount}, Updated: ${result.updatedCount}, Skipped: ${result.skippedCount}.`,
        className: "bg-green-100 border-green-300 text-green-700"
      });

      setIsBatchOpen(false);
      await triggerRefresh('seo-settings');
      await fetchData(true);
    } catch (err) {
      console.error("Error in batch generation:", err);
      toast({ title: "Batch Failed", description: (err as Error).message || "An error occurred.", variant: "destructive" });
    } finally {
      setBatchRunning(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleteRunning(true);
    setDeleteProgress(0);
    setDeleteStatus("Initializing deletion...");

    try {
      const targetSettings = activeTab === "city-category" ? cityCategorySettings : areaCategorySettings;
      const collectionRef = activeTab === "city-category" ? cityCatSeoRef : areaCatSeoRef;
      const total = targetSettings.length;

      if (total === 0) {
        toast({ title: "No overrides", description: "There are no overrides to delete in this tab.", variant: "destructive" });
        setDeleteRunning(false);
        return;
      }

      setDeleteStatus(`Clearing all overrides from the ${activeTab === 'city-category' ? 'cityCategorySeoSettings' : 'areaCategorySeoSettings'} table...`);
      setDeleteProgress(50);

      const targetTable = activeTab === "city-category" ? "cityCategorySeoSettings" : "areaCategorySeoSettings";
      await executeDbClearTable(targetTable);

      setDeleteProgress(100);

      toast({
        title: "All Overrides Deleted",
        description: `Successfully deleted all ${total} overrides in the ${activeTab === 'city-category' ? 'City-Category' : 'Area-Category'} section.`,
        className: "bg-green-100 border-green-300 text-green-700"
      });

      setIsDeleteAllOpen(false);
      await triggerRefresh('seo-settings');
      await fetchData(true);
    } catch (err) {
      console.error("Error deleting all overrides:", err);
      toast({ title: "Delete Failed", description: (err as Error).message || "An error occurred.", variant: "destructive" });
    } finally {
      setDeleteRunning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteType) {
      toast({ title: "Validation Error", description: "Please select a deletion type.", variant: "destructive" });
      return;
    }

    if (bulkDeleteType === 'city' && !bulkDeleteCityId) {
      toast({ title: "Validation Error", description: "Please select a target city.", variant: "destructive" });
      return;
    }

    if (bulkDeleteType === 'city-category') {
      if (!bulkDeleteCityId) {
        toast({ title: "Validation Error", description: "Please select a target city.", variant: "destructive" });
        return;
      }
      if (!bulkDeleteCategoryId) {
        toast({ title: "Validation Error", description: "Please select a target category.", variant: "destructive" });
        return;
      }
    }

    if (bulkDeleteType === 'area' && !bulkDeleteAreaId) {
      toast({ title: "Validation Error", description: "Please select a target area.", variant: "destructive" });
      return;
    }

    if (bulkDeleteType === 'category' && !bulkDeleteCategoryId) {
      toast({ title: "Validation Error", description: "Please select a target category.", variant: "destructive" });
      return;
    }

    setBulkDeleteRunning(true);

    try {
      if (bulkDeleteType === 'city') {
        if (activeTab === 'city-category') {
          const res = await executeBulkDeleteCityCategoryByCityAction(bulkDeleteCityId);
          if (res.success) {
            toast({ title: "Success", description: res.message });
          } else {
            toast({ title: "Failed", description: res.error, variant: "destructive" });
          }
        } else {
          const res = await executeBulkDeleteAreaCategoryByCityAction(bulkDeleteCityId);
          if (res.success) {
            toast({ title: "Success", description: res.message });
          } else {
            toast({ title: "Failed", description: res.error, variant: "destructive" });
          }
        }
      } else if (bulkDeleteType === 'city-category') {
        const res = await executeBulkDeleteAreaCategoryByCityAction(bulkDeleteCityId, bulkDeleteCategoryId);
        if (res.success) {
          toast({ title: "Success", description: res.message });
        } else {
          toast({ title: "Failed", description: res.error, variant: "destructive" });
        }
      } else if (bulkDeleteType === 'area') {
        const areaName = areas.find(a => a.id === bulkDeleteAreaId)?.name || "Selected Area";
        await executeBulkDeleteByAreaAction(bulkDeleteAreaId);
        toast({
          title: "Bulk Delete Success",
          description: `Successfully deleted overrides for area: ${areaName}.`,
          className: "bg-green-100 border-green-300 text-green-700"
        });
      } else if (bulkDeleteType === 'category') {
        const catName = categories.find(c => c.id === bulkDeleteCategoryId)?.name || "Selected Category";
        await executeBulkDeleteByCategoryAction(bulkDeleteCategoryId);
        toast({
          title: "Bulk Delete Success",
          description: `Successfully deleted overrides for category: ${catName}.`,
          className: "bg-green-100 border-green-300 text-green-700"
        });
      } else if (bulkDeleteType === 'duplicates') {
        const table = activeTab === 'city-category' ? 'cityCategorySeoSettings' : 'areaCategorySeoSettings';
        const res = await executeDeleteDuplicateSeoAction(table);
        if (res.success) {
          toast({ title: "Success", description: res.message });
        } else {
          toast({ title: "Failed", description: res.error, variant: "destructive" });
        }
      }

      setIsBulkDeleteOpen(false);
      setBulkDeleteType("");
      setBulkDeleteCityId("");
      setBulkDeleteAreaId("");
      setBulkDeleteCategoryId("");
      await triggerRefresh('seo-settings');
      await triggerRefresh('sitemap');
      await fetchData(true);
    } catch (err: any) {
      console.error("Error running bulk delete:", err);
      toast({ title: "Delete Failed", description: err.message || "An error occurred.", variant: "destructive" });
    } finally {
      setBulkDeleteRunning(false);
    }
  };

  const fetchData = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      let cachedCats = getCache<FirestoreCategory[]>('admin-cats-for-seo', true);
      let cachedCities = getCache<FirestoreCity[]>('admin-cities-for-seo', true);
      let cachedAreas = getCache<FirestoreArea[]>('admin-areas-for-seo', true);

      if (forceRefresh || !cachedCats || !cachedCities || !cachedAreas) {
        const [fetchedCats, fetchedCities, fetchedAreas] = await Promise.all([
          getAdminCategories(),
          getCities(),
          getAreas()
        ]);

        cachedCats = fetchedCats;
        cachedCities = fetchedCities;
        cachedAreas = fetchedAreas;

        setCache('admin-cats-for-seo', fetchedCats, true);
        setCache('admin-cities-for-seo', fetchedCities, true);
        setCache('admin-areas-for-seo', fetchedAreas, true);
      }

      setCategories(cachedCats);
      setCities(cachedCities);
      setAreas(cachedAreas);

      // ALWAYS load settings fresh from server on page reload/navigation to avoid stale caches
      const [fetchedCitySeo, fetchedAreaSeo] = await Promise.all([
        getCityCategorySeoSettings(),
        getAreaCategorySeoSettings()
      ]);

      setCityCategorySettings(fetchedCitySeo);
      setAreaCategorySettings(fetchedAreaSeo);
      setCityDisplayLimit(500);
      setAreaDisplayLimit(500);
    } catch (error) {
      console.error("Error fetching SEO override data:", error);
      toast({ title: "Error", description: "Could not load SEO override data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddSetting = (type: 'cityCategory' | 'areaCategory') => {
    setEditingSetting(null);
    setFormType(type);
    setIsFormOpen(true);
  };

  const handleEditSetting = async (setting: CityCategorySeoSetting | AreaCategorySeoSetting, type: 'cityCategory' | 'areaCategory') => {
    setIsSubmitting(true);
    const collectionRef = type === 'cityCategory' ? cityCatSeoRef : areaCatSeoRef;
    try {
      const docRef = doc(collectionRef, setting.id!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEditingSetting({ id: docSnap.id, ...docSnap.data() } as any);
        setFormType(type);
        setIsFormOpen(true);
      } else {
        toast({ title: "Error", description: "SEO Override not found.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error loading override details:", err);
      toast({ title: "Error", description: "Failed to load override details.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSetting = async (id: string, type: 'cityCategory' | 'areaCategory') => {
    setIsSubmitting(true);
    const collectionRef = type === 'cityCategory' ? cityCatSeoRef : areaCatSeoRef;
    try {
      const setting = type === 'cityCategory' 
        ? cityCategorySettings.find(s => s.id === id)
        : areaCategorySettings.find(s => s.id === id);
      await deleteDoc(doc(collectionRef, id));
      await triggerRefresh('seo-settings');
      
      if (setting) {
        const city = cities.find(c => c.id === setting.cityId);
        const category = categories.find(c => c.id === setting.categoryId);
        if (type === 'cityCategory') {
          if (city?.slug && category?.slug) {
            await submitToGoogleIndexing('city-category', { citySlug: city.slug, categorySlug: category.slug }, false);
          }
        } else {
          const area = areas.find(a => a.id === (setting as AreaCategorySeoSetting).areaId);
          if (city?.slug && area?.slug && category?.slug) {
            await submitToGoogleIndexing('area-category', { citySlug: city.slug, areaSlug: area.slug, categorySlug: category.slug }, false);
          }
        }
      }
      
      toast({ title: "Success", description: "SEO override deleted successfully." });
      await fetchData(true); // Force refresh
    } catch (error) {
      toast({ title: "Error", description: "Could not delete SEO override.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (setting: CityCategorySeoSetting | AreaCategorySeoSetting, type: 'cityCategory' | 'areaCategory') => {
    setIsSubmitting(true);
    const collectionRef = type === 'cityCategory' ? cityCatSeoRef : areaCatSeoRef;
    try {
        await updateDoc(doc(collectionRef, setting.id!), { isActive: !setting.isActive, updatedAt: Timestamp.now() });
        await triggerRefresh('seo-settings');
        
        const city = cities.find(c => c.id === setting.cityId);
        const category = categories.find(c => c.id === setting.categoryId);
        if (type === 'cityCategory') {
          if (city?.slug && category?.slug) {
            await submitToGoogleIndexing('city-category', { citySlug: city.slug, categorySlug: category.slug }, !setting.isActive);
          }
        } else {
          const area = areas.find(a => a.id === (setting as AreaCategorySeoSetting).areaId);
          if (city?.slug && area?.slug && category?.slug) {
            await submitToGoogleIndexing('area-category', { citySlug: city.slug, areaSlug: area.slug, categorySlug: category.slug }, !setting.isActive);
          }
        }
        
        toast({ title: "Success", description: "Status updated."});
        await fetchData(true);
    } catch (error) {
        toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };


  const handleCityCategoryFormSubmit = async (data: CityCategorySeoFormData & { id?: string }) => {
    setIsSubmitting(true);
    const city = cities.find(c => c.id === data.cityId);
    const category = categories.find(c => c.id === data.categoryId);
    if (!city || !category) {
      toast({ title: "Error", description: "Selected city or category not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const basePayload: Omit<CityCategorySeoSetting, 'id' | 'createdAt' | 'updatedAt'> = {
        cityId: data.cityId,
        cityName: city.name,
        categoryId: data.categoryId,
        categoryName: category.name,
        slug: data.slug || generateSeoSlug([city.slug, category.slug]),
        h1_title: data.h1_title,
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        meta_keywords: data.meta_keywords,
        seo_content: data.seo_content,
        faqs: data.faqs,
        imageHint: data.imageHint,
        isActive: data.isActive,
    };

    try {
      if (data.id) { 
        await updateDoc(doc(cityCatSeoRef, data.id), { ...basePayload, updatedAt: Timestamp.now() });
      } else { 
        const q = query(cityCatSeoRef, where("cityId", "==", data.cityId), where("categoryId", "==", data.categoryId));
        const snap = await getDocs(q);
        if (!snap.empty) {
           toast({ title: "Duplicate Entry", description: "An SEO override for this city and category already exists.", variant: "destructive"});
           setIsSubmitting(false); return;
        }
        await addDoc(cityCatSeoRef, { ...basePayload, createdAt: Timestamp.now() });
      }
      await triggerRefresh('seo-settings');
      if (city.slug && category.slug) {
        await submitToGoogleIndexing('city-category', { citySlug: city.slug, categorySlug: category.slug }, basePayload.isActive);
      }
      toast({ title: "Success", description: "City-Category SEO setting saved." });
      setIsFormOpen(false); 
      await fetchData(true);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message || "Could not save setting.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAreaCategoryFormSubmit = async (data: AreaCategorySeoFormData & { id?: string }) => {
    setIsSubmitting(true);
    const city = cities.find(c => c.id === data.cityId);
    const area = areas.find(a => a.id === data.areaId);
    const category = categories.find(c => c.id === data.categoryId);
    if (!city || !area || !category) {
      toast({ title: "Error", description: "Selected city, area, or category not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const basePayload: Omit<AreaCategorySeoSetting, 'id' | 'createdAt' | 'updatedAt'> = {
      cityId: data.cityId, cityName: city.name, areaId: data.areaId, areaName: area.name,
      categoryId: data.categoryId, categoryName: category.name,
      slug: data.slug || generateSeoSlug([city.slug, area.slug, category.slug]),
      h1_title: data.h1_title, meta_title: data.meta_title, meta_description: data.meta_description,
      meta_keywords: data.meta_keywords,
      seo_content: data.seo_content,
      faqs: data.faqs,
      imageHint: data.imageHint, isActive: data.isActive,
    };

    try {
      if (data.id) { 
        await updateDoc(doc(areaCatSeoRef, data.id), { ...basePayload, updatedAt: Timestamp.now() });
      } else { 
        const q = query(areaCatSeoRef, where("areaId", "==", data.areaId), where("categoryId", "==", data.categoryId));
        const snap = await getDocs(q);
        if (!snap.empty) {
           toast({ title: "Duplicate Entry", description: "An SEO override for this area and category already exists.", variant: "destructive"});
           setIsSubmitting(false); return;
        }
        await addDoc(areaCatSeoRef, { ...basePayload, createdAt: Timestamp.now() });
      }
      await triggerRefresh('seo-settings');
      if (city.slug && area.slug && category.slug) {
        await submitToGoogleIndexing('area-category', { citySlug: city.slug, areaSlug: area.slug, categorySlug: category.slug }, basePayload.isActive);
      }
      toast({ title: "Success", description: "Area-Category SEO setting saved." });
      setIsFormOpen(false); 
      await fetchData(true);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message || "Could not save setting.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  const cityCategoryDuplicates = (() => {
    const seen = new Set<string>();
    let count = 0;
    cityCategorySettings.forEach(s => {
      const key = `${s.cityId}:${s.categoryId}`;
      if (seen.has(key)) count++;
      else seen.add(key);
    });
    return count;
  })();

  const areaCategoryDuplicates = (() => {
    const seen = new Set<string>();
    let count = 0;
    areaCategorySettings.forEach(s => {
      const key = `${s.areaId}:${s.categoryId}`;
      if (seen.has(key)) count++;
      else seen.add(key);
    });
    return count;
  })();

  const filteredCitySettings = cityCategorySettings.filter(s => {
    const matchesCity = cityCityFilterId === 'all' || s.cityId === cityCityFilterId;
    const matchesCategory = cityCategoryFilterId === 'all' || s.categoryId === cityCategoryFilterId;
    return matchesCity && matchesCategory;
  });

  const filteredAreaSettings = areaCategorySettings.filter(s => {
    const matchesCity = areaCityFilterId === 'all' || s.cityId === areaCityFilterId;
    const matchesCategory = areaCategoryFilterId === 'all' || s.categoryId === areaCategoryFilterId;
    return matchesCity && matchesCategory;
  });

  if (!isMounted || isLoading) {
    return (
      <div className="space-y-6">
        <Card><CardHeader><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center"><Zap className="mr-2 h-6 w-6 text-primary" />Advanced SEO Overrides</CardTitle>
          <CardDescription>Manage specific SEO settings for City-Category and Area-Category combinations.</CardDescription>
        </CardHeader>
      </Card>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="city-category">City-Category SEO</TabsTrigger>
          <TabsTrigger value="area-category">Area-Category SEO</TabsTrigger>
        </TabsList>
        <TabsContent value="city-category">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><CardTitle>City-Category Specific Settings</CardTitle><CardDescription>Overrides for /[city]/category/[categorySlug] pages.</CardDescription></div>
              <div className="flex flex-wrap md:flex-nowrap gap-2 shrink-0">
                <PermissionGuard moduleId="seo_overrides" action="create">
                  <Button variant="outline" onClick={() => { setFormType('cityCategory'); setIsBatchOpen(true); }} disabled={isSubmitting || cities.length === 0}><Zap className="mr-2 h-4 w-4 text-amber-500" />Batch Generate (Free)</Button>
                  {cityCategorySettings.length > 0 && (
                    <>
                      <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={() => { setBulkDeleteType(''); setIsBulkDeleteOpen(true); }} disabled={isSubmitting}>
                        <Trash2 className="mr-2 h-4 w-4"/>Bulk Delete
                      </Button>
                      <Button variant="destructive" onClick={() => setIsDeleteAllOpen(true)} disabled={isSubmitting}>
                        <Trash2 className="mr-2 h-4 w-4"/>Delete All
                      </Button>
                    </>
                  )}
                  <Button onClick={() => handleAddSetting('cityCategory')} disabled={isSubmitting || cities.length === 0 || categories.length === 0}><PlusCircle className="mr-2 h-4 w-4"/>Add New</Button>
                </PermissionGuard>
              </div>
            </CardHeader>
            <CardContent>
              {cityCategorySettings.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">City:</span>
                    <SearchablePickerModal
                      title="Filter by City"
                      placeholder="All Cities"
                      allOptionLabel="All Cities"
                      allOptionBadge={cityCategorySettings.length}
                      selectedValue={cityCityFilterId}
                      onSelect={(val) => { setCityCityFilterId(val); setCityDisplayLimit(100); }}
                      items={cities.map(c => ({
                        id: c.id!,
                        name: c.name,
                        badge: `${cityCategorySettings.filter(s => s.cityId === c.id).length} overrides`,
                      }))}
                      size="sm"
                      className="w-[180px]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Category:</span>
                    <SearchablePickerModal
                      title="Filter by Category"
                      placeholder="All Categories"
                      allOptionLabel="All Categories"
                      allOptionBadge={cityCategorySettings.length}
                      selectedValue={cityCategoryFilterId}
                      onSelect={(val) => { setCityCategoryFilterId(val); setCityDisplayLimit(100); }}
                      items={categories.map(cat => ({
                        id: cat.id!,
                        name: cat.name,
                        badge: `${cityCategorySettings.filter(s => s.categoryId === cat.id).length} overrides`,
                      }))}
                      size="sm"
                      className="w-[180px]"
                    />
                  </div>

                  {(cityCityFilterId !== 'all' || cityCategoryFilterId !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={() => { setCityCityFilterId('all'); setCityCategoryFilterId('all'); }} className="h-9 text-xs">Reset Filters</Button>
                  )}

                  {cityCategoryDuplicates > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="ml-auto h-9 text-xs bg-amber-500/10 border-amber-500 text-amber-600 hover:bg-amber-500/20"
                      onClick={() => {
                        setBulkDeleteType('duplicates');
                        setIsBulkDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Clean Duplicates ({cityCategoryDuplicates})
                    </Button>
                  )}
                </div>
              )}

              {cityCategorySettings.length === 0 ? (
                 <div className="text-center py-10"><PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No City-Category SEO overrides found.</p></div>
              ) : filteredCitySettings.length === 0 ? (
                 <div className="text-center py-10"><PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No overrides found for the selected filter.</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>City</TableHead><TableHead>Category</TableHead><TableHead>Slug Segment</TableHead><TableHead>H1 Title</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredCitySettings.slice(0, cityDisplayLimit).map(setting => (
                      <TableRow key={setting.id}>
                        <TableCell>{setting.cityName}</TableCell><TableCell>{setting.categoryName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{setting.slug}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={setting.h1_title}>{setting.h1_title || "Not set"}</TableCell>
                        <TableCell className="text-center"><Switch checked={setting.isActive} onCheckedChange={() => handleToggleActive(setting, 'cityCategory')} disabled={isSubmitting || !hasActionPermission(adminPermissions, 'seo_overrides', 'write')}/></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <PermissionGuard moduleId="seo_overrides" action="write">
                              <Button variant="outline" size="icon" onClick={() => handleEditSetting(setting, 'cityCategory')} disabled={isSubmitting}><Edit className="h-4 w-4"/></Button>
                            </PermissionGuard>
                            <PermissionGuard moduleId="seo_overrides" action="delete">
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isSubmitting}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete Confirmation</AlertDialogTitle><AlertDialogDescription>Delete SEO override for {setting.cityName} - {setting.categoryName}?</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSetting(setting.id!, 'cityCategory')} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
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

              {filteredCitySettings.length > 0 && (
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground border-t pt-4">
                  <div>
                    Showing {Math.min(cityDisplayLimit, filteredCitySettings.length)} of {filteredCitySettings.length} overrides
                    {filteredCitySettings.length !== cityCategorySettings.length ? ` (Total in DB: ${cityCategorySettings.length})` : ''}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cityDisplayLimit < filteredCitySettings.length && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setCityDisplayLimit(prev => prev + 100)}>
                          Load More (+100)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCityDisplayLimit(prev => prev + 500)}>
                          Load More (+500)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCityDisplayLimit(filteredCitySettings.length)}>
                          Load All ({filteredCitySettings.length})
                        </Button>
                      </>
                    )}
                    {cityDisplayLimit > 100 && (
                      <Button variant="ghost" size="sm" onClick={() => setCityDisplayLimit(100)}>
                        Reset to 100
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="area-category">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><CardTitle>Area-Category Specific Settings</CardTitle><CardDescription>Overrides for /[city]/[area]/[categorySlug] pages.</CardDescription></div>
              <div className="flex flex-wrap md:flex-nowrap gap-2 shrink-0">
                <PermissionGuard moduleId="seo_overrides" action="create">
                  <Button variant="outline" onClick={() => { setFormType('areaCategory'); setIsBatchOpen(true); }} disabled={isSubmitting || cities.length === 0}><Zap className="mr-2 h-4 w-4 text-amber-500" />Batch Generate (Free)</Button>
                  {areaCategorySettings.length > 0 && (
                    <>
                      <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={() => { setBulkDeleteType(''); setIsBulkDeleteOpen(true); }} disabled={isSubmitting}>
                        <Trash2 className="mr-2 h-4 w-4"/>Bulk Delete
                      </Button>
                      <Button variant="destructive" onClick={() => setIsDeleteAllOpen(true)} disabled={isSubmitting}>
                        <Trash2 className="mr-2 h-4 w-4"/>Delete All
                      </Button>
                    </>
                  )}
                  <Button onClick={() => handleAddSetting('areaCategory')} disabled={isSubmitting || cities.length === 0 || areas.length === 0 || categories.length === 0}><PlusCircle className="mr-2 h-4 w-4"/>Add New</Button>
                </PermissionGuard>
              </div>
            </CardHeader>
            <CardContent>
              {areaCategorySettings.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">City:</span>
                    <SearchablePickerModal
                      title="Filter by City"
                      placeholder="All Cities"
                      allOptionLabel="All Cities"
                      allOptionBadge={areaCategorySettings.length}
                      selectedValue={areaCityFilterId}
                      onSelect={(val) => { setAreaCityFilterId(val); setAreaDisplayLimit(100); }}
                      items={cities.map(c => ({
                        id: c.id!,
                        name: c.name,
                        badge: `${areaCategorySettings.filter(s => s.cityId === c.id).length} overrides`,
                      }))}
                      size="sm"
                      className="w-[180px]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Category:</span>
                    <SearchablePickerModal
                      title="Filter by Category"
                      placeholder="All Categories"
                      allOptionLabel="All Categories"
                      allOptionBadge={areaCategorySettings.length}
                      selectedValue={areaCategoryFilterId}
                      onSelect={(val) => { setAreaCategoryFilterId(val); setAreaDisplayLimit(100); }}
                      items={categories.map(cat => ({
                        id: cat.id!,
                        name: cat.name,
                        badge: `${areaCategorySettings.filter(s => s.categoryId === cat.id).length} overrides`,
                      }))}
                      size="sm"
                      className="w-[180px]"
                    />
                  </div>

                  {(areaCityFilterId !== 'all' || areaCategoryFilterId !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={() => { setAreaCityFilterId('all'); setAreaCategoryFilterId('all'); }} className="h-9 text-xs">Reset Filters</Button>
                  )}

                  {areaCategoryDuplicates > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="ml-auto h-9 text-xs bg-amber-500/10 border-amber-500 text-amber-600 hover:bg-amber-500/20"
                      onClick={() => {
                        setBulkDeleteType('duplicates');
                        setIsBulkDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Clean Duplicates ({areaCategoryDuplicates})
                    </Button>
                  )}
                </div>
              )}

              {areaCategorySettings.length === 0 ? (
                  <div className="text-center py-10"><PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No Area-Category SEO overrides found.</p></div>
              ) : filteredAreaSettings.length === 0 ? (
                  <div className="text-center py-10"><PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No overrides found for the selected filter.</p></div>
              ) : (
                  <Table>
                      <TableHeader><TableRow><TableHead>City</TableHead><TableHead>Area</TableHead><TableHead>Category</TableHead><TableHead>Slug Segment</TableHead><TableHead>H1 Title</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                      {filteredAreaSettings.slice(0, areaDisplayLimit).map(setting => (
                          <TableRow key={setting.id}>
                          <TableCell>{setting.cityName}</TableCell><TableCell>{setting.areaName}</TableCell><TableCell>{setting.categoryName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{setting.slug}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={setting.h1_title}>{setting.h1_title || "Not set"}</TableCell>
                          <TableCell className="text-center"><Switch checked={setting.isActive} onCheckedChange={() => handleToggleActive(setting, 'areaCategory')} disabled={isSubmitting || !hasActionPermission(adminPermissions, 'seo_overrides', 'write')}/></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <PermissionGuard moduleId="seo_overrides" action="write">
                                <Button variant="outline" size="icon" onClick={() => handleEditSetting(setting, 'areaCategory')} disabled={isSubmitting}><Edit className="h-4 w-4"/></Button>
                              </PermissionGuard>
                              <PermissionGuard moduleId="seo_overrides" action="delete">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isSubmitting}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete Confirmation</AlertDialogTitle><AlertDialogDescription>Delete SEO override for {setting.areaName} - {setting.categoryName}?</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSetting(setting.id!, 'areaCategory')} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
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

              {filteredAreaSettings.length > 0 && (
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground border-t pt-4">
                  <div>
                    Showing {Math.min(areaDisplayLimit, filteredAreaSettings.length)} of {filteredAreaSettings.length} overrides
                    {filteredAreaSettings.length !== areaCategorySettings.length ? ` (Total in DB: ${areaCategorySettings.length})` : ''}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {areaDisplayLimit < filteredAreaSettings.length && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setAreaDisplayLimit(prev => prev + 100)}>
                          Load More (+100)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setAreaDisplayLimit(prev => prev + 500)}>
                          Load More (+500)
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setAreaDisplayLimit(filteredAreaSettings.length)}>
                          Load All ({filteredAreaSettings.length})
                        </Button>
                      </>
                    )}
                    {areaDisplayLimit > 100 && (
                      <Button variant="ghost" size="sm" onClick={() => setAreaDisplayLimit(100)}>
                        Reset to 100
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!isSubmitting) { setIsFormOpen(open); if (!open) { setEditingSetting(null); setFormType(null); } }}}>
        <DialogContent className="w-[calc(100%-6px)] sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-3 pb-4 border-b">
            <DialogTitle>{editingSetting ? 'Edit' : 'Add New'} {formType === 'cityCategory' ? 'City-Category' : 'Area-Category'} SEO Setting</DialogTitle>
            <DialogDescription>Fill in the details for the SEO override.</DialogDescription>
          </DialogHeader>
          <div className="p-3">
            {cities.length === 0 || categories.length === 0 || (formType === 'areaCategory' && areas.length === 0) ? (
                 <div className="py-8 text-center"><PackageSearch className="mx-auto h-10 w-10 text-muted-foreground mb-3" /><p className="text-destructive">Cannot add settings: Cities, Categories (and Areas for area-specific) must exist first.</p></div>
            ) : formType === 'cityCategory' ? (
              <CityCategorySeoForm
                onSubmit={handleCityCategoryFormSubmit}
                initialData={editingSetting as CityCategorySeoSetting | null}
                existingSettings={cityCategorySettings}
                cities={cities}
                categories={categories}
                onCancel={() => { setIsFormOpen(false); setEditingSetting(null); setFormType(null); }}
                isSubmitting={isSubmitting}
              />
            ) : formType === 'areaCategory' ? (
              <AreaCategorySeoForm
                onSubmit={handleAreaCategoryFormSubmit}
                initialData={editingSetting as AreaCategorySeoSetting | null}
                existingSettings={areaCategorySettings}
                cities={cities}
                areas={areas}
                categories={categories}
                onCancel={() => { setIsFormOpen(false); setEditingSetting(null); setFormType(null); }}
                isSubmitting={isSubmitting}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchOpen} onOpenChange={(open) => { if (!batchRunning) setIsBatchOpen(open); }}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Batch Generate Free SEO Overrides</DialogTitle>
            <DialogDescription>
              Automatically generate and save spinned local SEO copy for all selected combinations. This operates entirely client-side for free.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target City</label>
              <SearchablePickerModal
                title="Select Target City"
                placeholder="Select City"
                allOptionLabel="All Cities"
                selectedValue={batchCityId}
                onSelect={setBatchCityId}
                disabled={batchRunning}
                items={cities.map(c => ({
                  id: c.id!,
                  name: c.name,
                }))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Target Category</label>
              <SearchablePickerModal
                title="Select Target Category"
                placeholder="Select Category"
                allOptionLabel="All Categories"
                selectedValue={batchCategoryId}
                onSelect={setBatchCategoryId}
                disabled={batchRunning}
                items={categories.map(c => ({
                  id: c.id!,
                  name: c.name,
                }))}
                className="w-full"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="overwrite" 
                checked={batchOverwrite} 
                onCheckedChange={(checked) => setBatchOverwrite(!!checked)}
                disabled={batchRunning}
              />
              <label htmlFor="overwrite" className="text-sm font-medium leading-none cursor-pointer">
                Overwrite existing custom overrides
              </label>
            </div>

            {batchRunning && (
              <div className="space-y-2 pt-4">
                <Progress value={batchProgress} className="w-full" />
                <p className="text-xs text-muted-foreground animate-pulse">{batchStatus}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsBatchOpen(false)} disabled={batchRunning}>
              Cancel
            </Button>
            <Button onClick={handleStartBatch} disabled={batchRunning}>
              {batchRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {batchRunning ? "Generating..." : "Start Batch Generation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteAllOpen} onOpenChange={(open) => { if (!deleteRunning) setIsDeleteAllOpen(open); }}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-6 w-6" /> Danger: Delete All Overrides?
            </DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to delete **ALL** SEO overrides in the current **{activeTab === 'city-category' ? 'City-Category' : 'Area-Category'}** tab? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {deleteRunning && (
              <div className="space-y-2 pt-2">
                <Progress value={deleteProgress} className="w-full" />
                <p className="text-xs text-muted-foreground animate-pulse">{deleteStatus}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsDeleteAllOpen(false)} disabled={deleteRunning}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={deleteRunning}>
              {deleteRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleteRunning ? "Deleting..." : "Yes, Delete All"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDeleteOpen} onOpenChange={(open) => { if (!bulkDeleteRunning) setIsBulkDeleteOpen(open); }}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-6 w-6" /> Bulk Delete SEO Overrides
            </DialogTitle>
            <DialogDescription>
              {activeTab === 'city-category' 
                ? "Selectively delete City-Category SEO overrides by City, by Category, or clean duplicates."
                : "Selectively delete Area-Category SEO overrides by City, City + Category, Area, Category, or clean duplicates."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Delete by Filter Type</label>
              <SearchablePickerModal
                title="Select Deletion Type"
                placeholder="Select deletion type..."
                searchPlaceholder="Search deletion type..."
                selectedValue={bulkDeleteType}
                onSelect={(val) => setBulkDeleteType(val as any)}
                disabled={bulkDeleteRunning}
                items={
                  activeTab === 'city-category'
                    ? [
                        { id: 'city', name: 'Delete by City', subtitle: 'Delete all category overrides for a selected city' },
                        { id: 'category', name: 'Delete by Category', subtitle: 'Delete all overrides belonging to a category' },
                        { id: 'duplicates', name: `Clean Duplicates (${cityCategoryDuplicates})`, subtitle: 'Safely remove duplicate City-Category records' },
                      ]
                    : [
                        { id: 'city', name: 'Delete by City (All Areas)', subtitle: 'Delete all area category overrides in a city' },
                        { id: 'city-category', name: 'Delete by City + Category', subtitle: 'Delete overrides for a specific category in a city' },
                        { id: 'area', name: 'Delete by Area', subtitle: 'Delete overrides for a single specific area' },
                        { id: 'category', name: 'Delete by Category', subtitle: 'Delete overrides for a specific category' },
                        { id: 'duplicates', name: `Clean Duplicates (${areaCategoryDuplicates})`, subtitle: 'Safely remove duplicate Area-Category records' },
                      ]
                }
                className="w-full"
              />
            </div>

            {(bulkDeleteType === 'city' || bulkDeleteType === 'city-category') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select City</label>
                <SearchablePickerModal
                  title="Choose City"
                  placeholder="Choose City..."
                  selectedValue={bulkDeleteCityId}
                  onSelect={setBulkDeleteCityId}
                  disabled={bulkDeleteRunning}
                  items={cities.map(city => ({
                    id: city.id!,
                    name: city.name,
                  }))}
                  className="w-full"
                />
              </div>
            )}

            {(bulkDeleteType === 'category' || bulkDeleteType === 'city-category') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Category</label>
                <SearchablePickerModal
                  title="Choose Category"
                  placeholder="Choose Category..."
                  selectedValue={bulkDeleteCategoryId}
                  onSelect={setBulkDeleteCategoryId}
                  disabled={bulkDeleteRunning}
                  items={categories.map(cat => ({
                    id: cat.id!,
                    name: cat.name,
                  }))}
                  className="w-full"
                />
              </div>
            )}

            {bulkDeleteType === 'area' && activeTab === 'area-category' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Area</label>
                <SearchablePickerModal
                  title="Choose Area"
                  placeholder="Choose Area..."
                  selectedValue={bulkDeleteAreaId}
                  onSelect={setBulkDeleteAreaId}
                  disabled={bulkDeleteRunning}
                  items={areas.map(area => ({
                    id: area.id!,
                    name: area.name,
                    subtitle: cities.find(c => c.id === area.cityId)?.name || 'Unknown City',
                  }))}
                  className="w-full"
                />
              </div>
            )}

            {bulkDeleteType === 'duplicates' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-semibold">Safe Duplicate Cleanup:</p>
                <p>
                  Scans all {activeTab === 'city-category' ? 'City-Category' : 'Area-Category'} records, keeps the earliest record for each unique combination, and permanently removes redundant duplicates.
                </p>
              </div>
            )}

            {bulkDeleteRunning && (
              <div className="pt-2 animate-pulse text-xs text-muted-foreground">
                Executing bulk deletion from database...
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setIsBulkDeleteOpen(false);
              setBulkDeleteType("");
              setBulkDeleteCityId("");
              setBulkDeleteAreaId("");
              setBulkDeleteCategoryId("");
            }} disabled={bulkDeleteRunning}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete} 
              disabled={
                bulkDeleteRunning || 
                !bulkDeleteType || 
                (bulkDeleteType === 'city' && !bulkDeleteCityId) ||
                (bulkDeleteType === 'city-category' && (!bulkDeleteCityId || !bulkDeleteCategoryId)) ||
                (bulkDeleteType === 'area' && !bulkDeleteAreaId) || 
                (bulkDeleteType === 'category' && !bulkDeleteCategoryId)
              }
            >
              {bulkDeleteRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {bulkDeleteRunning ? "Deleting..." : "Delete Selected"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
