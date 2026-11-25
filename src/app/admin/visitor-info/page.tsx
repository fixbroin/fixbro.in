"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Globe2, PackageSearch, AlertTriangle, 
  Trash2 as TrashIcon, TrendingUp, Users, MapPin, 
  MousePointer2, Search, Monitor, Smartphone, Layout,
  X, Copy, ShieldAlert
} from "lucide-react"; 
import type { FirestoreVisitorInfoLog } from '@/types/firestore';
import { auth } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from 'date-fns';
import { Input } from "@/components/ui/input";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getTimestampMillis } from '@/lib/utils';

const ITEMS_PER_PAGE = 50;

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

interface CountryStat {
  name: string;
  value: number;
  percentage: number;
}

interface GlobalStats {
  totalVisits: number;
  uniqueVisitors: number;
  topCity: string;
  topPath: string;
  countryData: CountryStat[];
  trendData: { name: string; value: number }[];
}

const formatLogTimestamp = (timestamp?: any): string => {
  const millis = getTimestampMillis(timestamp);
  if (!millis) return 'N/A';
  return formatDistanceToNow(new Date(millis), { addSuffix: true });
};

const getBrowserIcon = (ua: string) => {
  if (ua.includes('Chrome')) return <Monitor className="h-3 w-3 inline mr-1 text-blue-500" />;
  if (ua.includes('Firefox')) return <Monitor className="h-3 w-3 inline mr-1 text-orange-500" />;
  if (ua.includes('Safari') && !ua.includes('Chrome')) return <Monitor className="h-3 w-3 inline mr-1 text-blue-400" />;
  return <Monitor className="h-3 w-3 inline mr-1 text-gray-500" />;
};

const getDeviceIcon = (ua: string) => {
  if (/Mobile|Android|iPhone/i.test(ua)) return <Smartphone className="h-3 w-3 inline mr-1 text-green-500" />;
  return <Monitor className="h-3 w-3 inline mr-1 text-indigo-500" />;
};

export default function AdminVisitorInfoPage() {
  const [visitorLogs, setVisitorLogs] = useState<FirestoreVisitorInfoLog[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [filteredTotal, setFilteredTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [foreignOnly, setForeignOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'all' | 'unique'>('all');
  const { toast } = useToast();
  const isFirstMount = useRef(true);

  // Debounce search input to prevent unnecessary server queries while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchLogs = useCallback(async (opts: {
    offset?: number;
    append?: boolean;
    includeStats?: boolean;
    search?: string;
    country?: string | null;
    foreign?: boolean;
  } = {}) => {
    const {
      offset = 0,
      append = false,
      includeStats = false,
      search = debouncedSearch,
      country = selectedCountry,
      foreign = foreignOnly,
    } = opts;

    if (append) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Authentication required.");
      }

      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String(offset),
        includeStats: includeStats ? 'true' : 'false',
      });

      if (search) params.set('search', search);
      if (country) params.set('country', country);
      if (foreign) params.set('foreignOnly', 'true');

      const res = await fetch(`/api/admin/visitor-info?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not fetch visitor logs.');
      }

      if (append) {
        setVisitorLogs(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const uniqueNew = (data.logs as FirestoreVisitorInfoLog[]).filter(item => !existingIds.has(item.id));
          return [...prev, ...uniqueNew];
        });
      } else {
        setVisitorLogs(data.logs || []);
      }

      setFilteredTotal(Number(data.filteredTotal || 0));
      setHasMore(Boolean(data.hasMore));
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error: any) {
      console.error("Error fetching visitor logs:", error);
      toast({
        title: "Error",
        description: error.message || "Could not fetch visitor logs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [debouncedSearch, selectedCountry, foreignOnly, toast]);

  // Initial load with global stats
  useEffect(() => {
    fetchLogs({ offset: 0, append: false, includeStats: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch filtered logs whenever search, country, or foreignOnly changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    fetchLogs({
      offset: 0,
      append: false,
      includeStats: false,
      search: debouncedSearch,
      country: selectedCountry,
      foreign: foreignOnly,
    });
  }, [debouncedSearch, selectedCountry, foreignOnly, fetchLogs]);

  const handleRefresh = () => {
    fetchLogs({
      offset: 0,
      append: false,
      includeStats: true,
      search: debouncedSearch,
      country: selectedCountry,
      foreign: foreignOnly,
    });
  };

  const handleLoadMore = () => {
    if (!hasMore || isFetchingMore || isLoading) return;
    fetchLogs({
      offset: visitorLogs.length,
      append: true,
      includeStats: false,
      search: debouncedSearch,
      country: selectedCountry,
      foreign: foreignOnly,
    });
  };

  const handleClearAllLogs = async () => {
    setIsClearing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required.");

      const res = await fetch('/api/admin/visitor-info', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not clear visitor logs.");
      }

      setVisitorLogs([]);
      setFilteredTotal(0);
      setHasMore(false);
      setStats({
        totalVisits: 0,
        uniqueVisitors: 0,
        topCity: 'N/A',
        topPath: '/',
        countryData: [],
        trendData: [],
      });
      toast({ title: "Logs Cleared", description: "All visitor logs have been successfully deleted." });
    } catch (error: any) {
      console.error("Error clearing visitor logs: ", error);
      toast({
        title: "Error Clearing Logs",
        description: error.message || "Could not clear visitor logs.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleCountryToggle = (countryName: string) => {
    if (!countryName) return;
    setSelectedCountry(prev => (prev === countryName ? null : countryName));
  };

  const handleCopyIp = (ip: string) => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    toast({
      title: "IP Copied",
      description: `${ip} copied to clipboard.`,
    });
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setSelectedCountry(null);
    setForeignOnly(false);
  };

  const uniqueVisitorLogs = useMemo(() => {
    const map = new Map<string, {
      ipAddress: string;
      city: string;
      countryName: string;
      pathname: string;
      ispOrganization: string;
      userAgent: string;
      timestamp: any;
      visitCount: number;
      paths: string[];
    }>();

    visitorLogs.forEach(log => {
      if (!log.ipAddress) return;
      const existing = map.get(log.ipAddress);
      if (existing) {
        existing.visitCount += 1;
        const currentMillis = getTimestampMillis(log.timestamp) || 0;
        const existingMillis = getTimestampMillis(existing.timestamp) || 0;
        if (currentMillis > existingMillis) {
          existing.timestamp = log.timestamp;
          existing.pathname = log.pathname || '/';
          existing.city = log.city || '';
          existing.countryName = log.countryName || '';
          existing.ispOrganization = log.ispOrganization || '';
          existing.userAgent = log.userAgent || '';
        }
        if (log.pathname && !existing.paths.includes(log.pathname)) {
          existing.paths.push(log.pathname);
        }
      } else {
        map.set(log.ipAddress, {
          ipAddress: log.ipAddress,
          city: log.city || '',
          countryName: log.countryName || '',
          pathname: log.pathname || '/',
          ispOrganization: log.ispOrganization || '',
          userAgent: log.userAgent || '',
          timestamp: log.timestamp,
          visitCount: 1,
          paths: [log.pathname || '/']
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const aMillis = getTimestampMillis(a.timestamp) || 0;
      const bMillis = getTimestampMillis(b.timestamp) || 0;
      return bMillis - aMillis;
    });
  }, [visitorLogs]);

  const currentDisplayLogs = viewMode === 'all' ? visitorLogs : uniqueVisitorLogs;
  const hasActiveFilter = Boolean(debouncedSearch || selectedCountry || foreignOnly);

  const renderMobileCard = (log: FirestoreVisitorInfoLog) => (
    <Card key={log.id} className="mb-4 border-l-4 border-l-primary shadow-sm overflow-hidden">
      <CardContent className="p-4 space-y-3 text-sm">
         <div className="flex justify-between items-start">
             <div className="flex items-center gap-2">
                 <button
                   type="button"
                   onClick={() => handleCopyIp(log.ipAddress)}
                   className="inline-flex items-center gap-1"
                   title="Copy IP"
                 >
                   <Badge variant="outline" className="bg-primary/5 text-[10px] py-0 hover:bg-primary/15">
                     {log.ipAddress}
                     <Copy className="h-2.5 w-2.5 ml-1 opacity-60" />
                   </Badge>
                 </button>
                 <span className="text-[10px] text-muted-foreground">{formatLogTimestamp(log.timestamp)}</span>
             </div>
             <div className="flex items-center gap-1">
                 {getDeviceIcon(log.userAgent)}
                 {getBrowserIcon(log.userAgent)}
             </div>
         </div>
         
         <div className="space-y-2">
             <div className="flex items-center gap-1.5 text-xs">
                 <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                 <span className="truncate">{log.city || 'N/A'}, {log.countryName || 'N/A'}</span>
             </div>
             <div className="bg-secondary/20 p-2 rounded-md border border-secondary/30">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    <Layout className="h-3 w-3" />
                    <span>Visited Path</span>
                </div>
                <div className="font-mono text-xs break-all text-primary font-medium leading-relaxed">
                    {log.pathname}
                </div>
             </div>
         </div>

         <Separator className="my-1 opacity-50" />
         
         <div className="text-[10px] text-muted-foreground italic truncate">
             ISP: {log.ispOrganization || 'N/A'}
         </div>
      </CardContent>
    </Card>
  );

  const renderMobileUniqueCard = (log: typeof uniqueVisitorLogs[number]) => (
    <Card key={log.ipAddress} className="mb-4 border-l-4 border-l-blue-500 shadow-sm overflow-hidden">
      <CardContent className="p-4 space-y-3 text-sm">
         <div className="flex justify-between items-start">
             <div className="flex items-center gap-2">
                 <button
                   type="button"
                   onClick={() => handleCopyIp(log.ipAddress)}
                   className="inline-flex items-center gap-1"
                   title="Copy IP"
                 >
                   <Badge variant="outline" className="bg-primary/5 text-[10px] py-0 hover:bg-primary/15">
                     {log.ipAddress}
                     <Copy className="h-2.5 w-2.5 ml-1 opacity-60" />
                   </Badge>
                 </button>
                 <span className="text-[10px] text-muted-foreground">{formatLogTimestamp(log.timestamp)}</span>
             </div>
             <div className="flex items-center gap-1">
                 {getDeviceIcon(log.userAgent)}
                 {getBrowserIcon(log.userAgent)}
             </div>
         </div>
         
         <div className="space-y-2">
             <div className="flex justify-between items-center text-xs">
                 <div className="flex items-center gap-1.5">
                     <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                     <span className="truncate">{log.city || 'N/A'}, {log.countryName || 'N/A'}</span>
                 </div>
                 <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-none font-bold text-[10px] px-2 py-0.5">
                     {log.visitCount} visits
                 </Badge>
             </div>
             <div className="bg-secondary/20 p-2 rounded-md border border-secondary/30">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    <Layout className="h-3 w-3" />
                    <span>Last Path Visited</span>
                </div>
                <div className="font-mono text-xs break-all text-primary font-medium leading-relaxed">
                    {log.pathname}
                </div>
                {log.paths.length > 1 && (
                  <div className="text-[9px] text-muted-foreground mt-1 truncate">
                    Paths: {log.paths.join(', ')}
                  </div>
                )}
             </div>
         </div>

         <Separator className="my-1 opacity-50" />
         
         <div className="text-[10px] text-muted-foreground italic truncate">
             ISP: {log.ispOrganization || 'N/A'}
         </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-none bg-primary/5 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary p-2.5 rounded-lg text-primary-foreground shadow-md">
                 <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">Visitor Insights</CardTitle>
                <CardDescription>Full database analytics, country filtering, and live traffic logs.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading || isClearing} className="flex-1 md:flex-none">
                  <Loader2 className={`mr-2 h-4 w-4 ${isLoading && !isFetchingMore ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isLoading || isClearing || (stats?.totalVisits || 0) === 0} className="flex-1 md:flex-none">
                    <TrashIcon className="mr-2 h-4 w-4" /> Clear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-destructive"/>Delete All Logs?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently erase all {stats?.totalVisits?.toLocaleString() || ''} historical visitor records. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllLogs} className="bg-destructive hover:bg-destructive/90">Confirm Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* KPI Stats */}
      {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-sm border-none bg-card hover:shadow-md transition-all">
                  <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-100 text-blue-600"><Users className="h-4 w-4"/></div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Visits (All)</p>
                        <p className="text-lg font-bold">{stats.totalVisits.toLocaleString()}</p>
                      </div>
                  </CardContent>
              </Card>
              <Card className="shadow-sm border-none bg-card hover:shadow-md transition-all">
                  <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-100 text-green-600"><Monitor className="h-4 w-4"/></div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Unique IPs (All)</p>
                        <p className="text-lg font-bold">{stats.uniqueVisitors.toLocaleString()}</p>
                      </div>
                  </CardContent>
              </Card>
              <Card className="shadow-sm border-none bg-card hover:shadow-md transition-all">
                  <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-100 text-amber-600"><MapPin className="h-4 w-4"/></div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Top Location</p>
                        <p className="text-lg font-bold truncate max-w-[110px]" title={stats.topCity}>{stats.topCity}</p>
                      </div>
                  </CardContent>
              </Card>
              <Card className="shadow-sm border-none bg-card hover:shadow-md transition-all">
                  <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-100 text-purple-600"><MousePointer2 className="h-4 w-4"/></div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Most Visited</p>
                        <p className="text-lg font-bold truncate max-w-[110px]" title={stats.topPath}>{stats.topPath}</p>
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* Charts Section */}
      {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 shadow-sm border-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary"/>
                      Traffic Trend (Last 14 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[260px] pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.trendData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                              <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis fontSize={10} axisLine={false} tickLine={false} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                                cursor={{ fill: '#f3f4f6' }}
                              />
                              <Bar dataKey="value" name="Visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={28} />
                          </BarChart>
                      </ResponsiveContainer>
                  </CardContent>
              </Card>

              <Card className="shadow-sm border-none">
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Globe2 className="h-4 w-4 text-primary"/>
                        Visitor Geolocation
                      </CardTitle>
                      {selectedCountry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCountry(null)}
                          className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                        >
                          <X className="h-3 w-3 mr-0.5" /> Reset
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Click any country slice or label to filter logs</p>
                  </CardHeader>
                  <CardContent className="pt-2">
                      <div className="h-[190px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.countryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={52}
                                    outerRadius={76}
                                    paddingAngle={4}
                                    dataKey="value"
                                    className="cursor-pointer outline-none"
                                    onClick={(entry: any) => {
                                      if (entry?.name) handleCountryToggle(entry.name);
                                    }}
                                >
                                    {stats.countryData.map((entry, index) => {
                                        const isSelected = selectedCountry === entry.name;
                                        const isDimmed = selectedCountry && !isSelected;
                                        return (
                                          <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                            opacity={isDimmed ? 0.3 : 1}
                                            stroke={isSelected ? '#0f172a' : 'none'}
                                            strokeWidth={isSelected ? 2 : 0}
                                          />
                                        );
                                    })}
                                </Pie>
                                <Tooltip
                                  formatter={(value: any, _name: any, props: any) => {
                                    const pct = props?.payload?.percentage ?? 0;
                                    return [`${Number(value).toLocaleString()} visits (${pct}%)`, props?.payload?.name || 'Country'];
                                  }}
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                          {stats.countryData.map((entry, index) => {
                              const isSelected = selectedCountry === entry.name;
                              return (
                                <button
                                  key={entry.name}
                                  type="button"
                                  onClick={() => handleCountryToggle(entry.name)}
                                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                      : 'bg-muted/40 hover:bg-muted border-border/60 text-foreground'
                                  }`}
                                >
                                  <div
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: isSelected ? '#ffffff' : COLORS[index % COLORS.length] }}
                                  />
                                  <span>{entry.name}</span>
                                  <span className={isSelected ? 'opacity-90' : 'text-muted-foreground'}>
                                    {entry.percentage}%
                                  </span>
                                </button>
                              );
                          })}
                      </div>
                  </CardContent>
              </Card>
          </div>
      )}

      {/* Main Table Section */}
      <Card className="shadow-sm border-none">
        <CardHeader className="pb-4 space-y-3">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-lg font-bold">Activity Logs</CardTitle>
              
              {/* Tab Selector */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
                <Button
                  variant={viewMode === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs font-semibold px-3"
                  onClick={() => setViewMode('all')}
                >
                  All Visits ({filteredTotal.toLocaleString()})
                </Button>
                <Button
                  variant={viewMode === 'unique' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs font-semibold px-3"
                  onClick={() => setViewMode('unique')}
                >
                  Unique IPs ({uniqueVisitorLogs.length})
                </Button>
              </div>

              <span className="text-xs text-muted-foreground">
                Showing <strong className="text-foreground">{visitorLogs.length}</strong> of <strong className="text-foreground">{filteredTotal.toLocaleString()}</strong>
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <Button
                type="button"
                variant={foreignOnly ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setForeignOnly(prev => !prev)}
                className="h-9 text-xs font-semibold shrink-0"
              >
                <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                {foreignOnly ? 'Showing Non-India Only' : 'Non-India Only'}
              </Button>

              <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                      placeholder="Search all logs (IP, country, path, ISP)..." 
                      className="pl-9 pr-8 h-9 bg-muted/30 border-none focus-visible:ring-primary"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
              </div>
            </div>
          </div>

          {/* Active Filters Banner */}
          {hasActiveFilter && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground font-medium">Active Filters:</span>
              {selectedCountry && (
                <Badge variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs">
                  Country: <strong>{selectedCountry}</strong>
                  <button type="button" onClick={() => setSelectedCountry(null)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {foreignOnly && (
                <Badge variant="destructive" className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs">
                  Non-India Traffic Only
                  <button type="button" onClick={() => setForeignOnly(false)} className="hover:opacity-80">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {debouncedSearch && (
                <Badge variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs">
                  Search: &quot;{debouncedSearch}&quot;
                  <button type="button" onClick={() => setSearchTerm("")} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button variant="link" size="sm" onClick={clearAllFilters} className="h-6 px-2 text-xs">
                Clear all
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="animate-pulse text-sm">Querying visitor logs...</p>
            </div>
          ) : currentDisplayLogs.length === 0 ? (
            <div className="text-center py-16">
              <PackageSearch className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">
                {hasActiveFilter ? 'No visitor logs match the selected filter.' : 'No visitor logs recorded yet.'}
              </p>
              {hasActiveFilter && (
                <Button variant="link" onClick={clearAllFilters} className="mt-2">Clear filters</Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block">
                {viewMode === 'all' ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Visitor / Device</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Location</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Path</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Network (ISP)</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visitorLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell>
                              <div className="flex flex-col">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyIp(log.ipAddress)}
                                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary hover:underline text-left w-fit"
                                    title="Click to copy IP"
                                  >
                                    {log.ipAddress}
                                    <Copy className="h-3 w-3 opacity-40 hover:opacity-100" />
                                  </button>
                                  <div className="flex items-center mt-1 text-[10px] text-muted-foreground">
                                      {getDeviceIcon(log.userAgent)}
                                      <span className="truncate max-w-[120px]" title={log.userAgent}>{log.userAgent.split(' ')[0]}...</span>
                                  </div>
                              </div>
                          </TableCell>
                          <TableCell>
                              <div className="flex flex-col">
                                  <span className="text-xs font-medium">{log.city || 'Unknown City'}</span>
                                  <button
                                    type="button"
                                    onClick={() => log.countryName && handleCountryToggle(log.countryName)}
                                    className="text-[10px] text-muted-foreground uppercase tracking-tight hover:text-primary text-left w-fit"
                                    title="Click to filter by this country"
                                  >
                                    {log.countryName || 'Global'}
                                  </button>
                              </div>
                          </TableCell>
                          <TableCell>
                              <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0 bg-secondary/30 max-w-[300px] truncate" title={log.pathname}>
                                  {log.pathname}
                              </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground max-w-[160px] truncate" title={log.ispOrganization}>
                              {log.ispOrganization || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                               <div className="flex flex-col items-end">
                                  <span className="text-xs font-medium">{formatLogTimestamp(log.timestamp)}</span>
                                  <span className="text-[10px] text-muted-foreground opacity-60 font-mono">
                                      {(() => {
                                          const millis = getTimestampMillis(log.timestamp);
                                          return millis ? format(new Date(millis), 'HH:mm:ss') : '';
                                      })()}
                                  </span>
                              </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Visitor / Device</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Location</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Visits Count</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Last Path Visited</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Network (ISP)</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uniqueVisitorLogs.map((log) => (
                        <TableRow key={log.ipAddress} className="hover:bg-muted/10 transition-colors">
                          <TableCell>
                              <div className="flex flex-col">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyIp(log.ipAddress)}
                                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary hover:underline text-left w-fit"
                                    title="Click to copy IP"
                                  >
                                    {log.ipAddress}
                                    <Copy className="h-3 w-3 opacity-40 hover:opacity-100" />
                                  </button>
                                  <div className="flex items-center mt-1 text-[10px] text-muted-foreground">
                                      {getDeviceIcon(log.userAgent)}
                                      <span className="truncate max-w-[120px]" title={log.userAgent}>{log.userAgent.split(' ')[0]}...</span>
                                  </div>
                              </div>
                          </TableCell>
                          <TableCell>
                              <div className="flex flex-col">
                                  <span className="text-xs font-medium">{log.city || 'Unknown City'}</span>
                                  <button
                                    type="button"
                                    onClick={() => log.countryName && handleCountryToggle(log.countryName)}
                                    className="text-[10px] text-muted-foreground uppercase tracking-tight hover:text-primary text-left w-fit"
                                    title="Click to filter by this country"
                                  >
                                    {log.countryName || 'Global'}
                                  </button>
                              </div>
                          </TableCell>
                          <TableCell>
                              <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-none font-bold text-[10px] px-2 py-0.5">
                                  {log.visitCount} visits
                              </Badge>
                          </TableCell>
                          <TableCell>
                              <div className="flex flex-col gap-1 items-start">
                                <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0 bg-secondary/30 max-w-[260px] truncate" title={log.pathname}>
                                    {log.pathname}
                                </Badge>
                                {log.paths.length > 1 && (
                                  <span className="text-[9px] text-muted-foreground">
                                    +{log.paths.length - 1} other paths
                                  </span>
                                )}
                              </div>
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground max-w-[160px] truncate" title={log.ispOrganization}>
                              {log.ispOrganization || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                               <div className="flex flex-col items-end">
                                  <span className="text-xs font-medium">{formatLogTimestamp(log.timestamp)}</span>
                                  <span className="text-[10px] text-muted-foreground opacity-60 font-mono">
                                      {(() => {
                                          const millis = getTimestampMillis(log.timestamp);
                                          return millis ? format(new Date(millis), 'HH:mm:ss') : '';
                                      })()}
                                  </span>
                              </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Mobile View */}
              <div className="lg:hidden">
                {viewMode === 'all' 
                  ? visitorLogs.map(renderMobileCard)
                  : uniqueVisitorLogs.map(renderMobileUniqueCard)
                }
              </div>
            </>
          )}
        </CardContent>
        {hasMore && (
            <CardFooter className="pt-4 justify-center border-t bg-muted/5">
                <Button variant="ghost" size="sm" onClick={handleLoadMore} disabled={isFetchingMore || isLoading} className="text-xs font-bold text-primary">
                    {isFetchingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <TrendingUp className="mr-2 h-4 w-4"/>}
                    {isFetchingMore
                      ? 'Fetching more data...'
                      : `Load More (${(filteredTotal - visitorLogs.length).toLocaleString()} remaining)`}
                </Button>
            </CardFooter>
        )}
      </Card>
      
      {/* Footer Info */}
       <div className="bg-muted/30 rounded-xl p-4 flex items-start gap-3 border border-border/50">
          <InfoIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed text-muted-foreground">
             <strong>Privacy & Accuracy Note:</strong> IP-based geolocation provides approximate location data and is subject to provider accuracy. 
             Browsers and devices are identified via User-Agent strings. This dashboard is designed for high-level traffic analysis and 
             does not link specific actions to logged-in users. For individual user audit trails, refer to the 
             <Link href="/admin/activity-feed" className="text-primary hover:underline ml-1 font-bold">Security Activity Feed</Link>.
          </div>
       </div>
    </div>
  );
}

const InfoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
);
