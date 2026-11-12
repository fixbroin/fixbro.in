"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  RefreshCw, 
  Loader2,
  Search, 
  Calendar, 
  Clock, 
  Download, 
  MessageCircle, 
  Eye, 
  ArrowUpRight, 
  Sparkles, 
  Repeat, 
  Activity,
  Phone,
  Mail,
  XCircle,
  TrendingUp,
  FileSpreadsheet
} from "lucide-react";
import type { FirestoreUser } from '@/types/firestore';
import { getTimestampMillis, formatDateInTimezone, formatTimeInTimezone, cn } from '@/lib/utils';
import { openWhatsAppChooser } from '@/lib/whatsappUtils';
import { motion, AnimatePresence } from 'framer-motion';

export type DateFilterPreset = 
  | 'last_3_days' 
  | 'last_7_days' 
  | 'last_15_days' 
  | 'last_30_days' 
  | 'this_month' 
  | 'last_month' 
  | 'custom';

export type UserTypeFilter = 'all' | 'returning' | 'new';

interface ActiveUsersTabProps {
  users: FirestoreUser[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onViewUserDetails: (user: FirestoreUser) => void;
  appConfig?: any;
}

function formatRelativeTime(millis: number): string {
  if (!millis) return 'Never';
  const diffSec = Math.floor((Date.now() - millis) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export default function ActiveUsersTab({
  users,
  isLoading,
  onRefresh,
  onViewUserDetails,
  appConfig
}: ActiveUsersTabProps) {
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('last_3_days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const timezone = appConfig?.timezone || 'Asia/Kolkata';

  // Calculate start & end millis based on selected date filter
  const { startMillis, endMillis, filterLabel } = useMemo(() => {
    const now = new Date();
    const end = now.getTime();

    switch (dateFilter) {
      case 'last_3_days': {
        const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        return { startMillis: start.getTime(), endMillis: end, filterLabel: 'Last 3 Days' };
      }
      case 'last_7_days': {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { startMillis: start.getTime(), endMillis: end, filterLabel: 'Last 7 Days' };
      }
      case 'last_15_days': {
        const start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
        return { startMillis: start.getTime(), endMillis: end, filterLabel: 'Last 15 Days' };
      }
      case 'last_30_days': {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { startMillis: start.getTime(), endMillis: end, filterLabel: 'Last 30 Days' };
      }
      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { startMillis: start.getTime(), endMillis: end, filterLabel: 'This Month' };
      }
      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { startMillis: start.getTime(), endMillis: endLastMonth.getTime(), filterLabel: 'Last Month' };
      }
      case 'custom': {
        const start = customStartDate ? new Date(customStartDate + 'T00:00:00').getTime() : now.getTime() - 3 * 24 * 60 * 60 * 1000;
        const customEnd = customEndDate ? new Date(customEndDate + 'T23:59:59.999').getTime() : end;
        return { startMillis: start, endMillis: customEnd, filterLabel: 'Custom Period' };
      }
      default: {
        const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        return { startMillis: start.getTime(), endMillis: end, filterLabel: 'Last 3 Days' };
      }
    }
  }, [dateFilter, customStartDate, customEndDate]);

  // Compute active users within the selected date range
  const { allActiveUsers, returningActiveUsers, newActiveUsers } = useMemo(() => {
    const active: (FirestoreUser & { isReturning: boolean; lastActiveMillis: number; createdMillis: number })[] = [];
    const returning: typeof active = [];
    const newlyJoined: typeof active = [];

    users.forEach(u => {
      const lastActiveMillis = getTimestampMillis(u.lastLoginAt);
      const createdMillis = getTimestampMillis(u.createdAt);

      // Check if user was active within the selected date range
      if (lastActiveMillis >= startMillis && lastActiveMillis <= endMillis) {
        // Returning User: account created BEFORE the selected period started
        // New User: account created DURING the selected period
        const isReturning = createdMillis < startMillis;
        const enriched = { ...u, isReturning, lastActiveMillis, createdMillis };

        active.push(enriched);
        if (isReturning) {
          returning.push(enriched);
        } else {
          newlyJoined.push(enriched);
        }
      }
    });

    // Sort by last active descending (most recently active first)
    active.sort((a, b) => b.lastActiveMillis - a.lastActiveMillis);
    returning.sort((a, b) => b.lastActiveMillis - a.lastActiveMillis);
    newlyJoined.sort((a, b) => b.lastActiveMillis - a.lastActiveMillis);

    return {
      allActiveUsers: active,
      returningActiveUsers: returning,
      newActiveUsers: newlyJoined
    };
  }, [users, startMillis, endMillis]);

  // Apply user-type subfilter & search filter
  const displayedUsers = useMemo(() => {
    let list = allActiveUsers;
    if (userTypeFilter === 'returning') {
      list = returningActiveUsers;
    } else if (userTypeFilter === 'new') {
      list = newActiveUsers;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(u => 
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.mobileNumber && u.mobileNumber.toLowerCase().includes(q)) ||
        (u.userNumber && String(u.userNumber).includes(q))
      );
    }

    return list;
  }, [allActiveUsers, returningActiveUsers, newActiveUsers, userTypeFilter, searchTerm]);

  // Retention percentage calculation
  const returningPercentage = useMemo(() => {
    if (allActiveUsers.length === 0) return 0;
    return Math.round((returningActiveUsers.length / allActiveUsers.length) * 100);
  }, [allActiveUsers, returningActiveUsers]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCSV = () => {
    if (displayedUsers.length === 0) return;

    const headers = [
      'Member #',
      'Name',
      'Email',
      'Mobile',
      'User Type',
      'Registered Date',
      'Last Active Date & Time'
    ];

    const rows = displayedUsers.map(u => {
      const regDate = u.createdMillis ? `${formatDateInTimezone(new Date(u.createdMillis), timezone)}` : 'N/A';
      const lastActive = u.lastActiveMillis 
        ? `${formatDateInTimezone(new Date(u.lastActiveMillis), timezone)} ${formatTimeInTimezone(new Date(u.lastActiveMillis), timezone)}`
        : 'N/A';

      return [
        u.userNumber || 'N/A',
        `"${(u.displayName || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${(u.mobileNumber || '').replace(/"/g, '""')}"`,
        u.isReturning ? 'Returning User (Existing)' : 'New User',
        `"${regDate}"`,
        `"${lastActive}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Active_Users_${filterLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Filter Control Card */}
      <Card className="border-none shadow-xl rounded-[2rem] bg-card overflow-hidden">
        <CardHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-primary mb-1">
                <Activity className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Activity Analytics</span>
              </div>
              <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                Active Users Monitor
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs font-bold">
                  {filterLabel}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Track how many of your previously registered customers are actively returning to Fixbro.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isLoading || isRefreshing}
                className="h-10 px-3.5 rounded-xl border border-border/80 font-bold text-xs flex items-center gap-2 hover:bg-muted"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", (isLoading || isRefreshing) && "animate-spin text-primary")} />
                <span>Refresh Data</span>
              </Button>

              <Button
                size="sm"
                onClick={handleExportCSV}
                disabled={displayedUsers.length === 0}
                className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-2 shadow-sm hover:bg-primary/90"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export ({displayedUsers.length})</span>
              </Button>
            </div>
          </div>

          {/* Date Filter Buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-bold text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Filter Period:
            </span>
            {(
              [
                { id: 'last_3_days', label: 'Last 3 Days' },
                { id: 'last_7_days', label: 'Last 7 Days' },
                { id: 'last_15_days', label: 'Last 15 Days' },
                { id: 'last_30_days', label: 'Last 30 Days' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'custom', label: 'Custom Range' },
              ] as const
            ).map((preset) => {
              const isSelected = dateFilter === preset.id;
              return (
                <Button
                  key={preset.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter(preset.id)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-bold transition-all shadow-2xs",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                      : "border-border/70 hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>

          {/* Custom Date Picker Inputs */}
          {dateFilter === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">From:</span>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-9 w-40 text-xs rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">To:</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-9 w-40 text-xs rounded-lg"
                />
              </div>
            </motion.div>
          )}
        </CardHeader>

        {/* 2. Top Summary KPI Cards */}
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Active Users */}
            <div className="p-5 rounded-2xl bg-muted/40 border border-border/50 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Active Users</span>
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-foreground">
                {isLoading ? <Loader2 className="h-7 w-7 animate-spin text-primary/40" /> : allActiveUsers.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <span>Active during {filterLabel}</span>
              </p>
            </div>

            {/* Card 2: Returning / Old Users (Retention) */}
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Returning (Old) Users</span>
                <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Repeat className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {isLoading ? <Loader2 className="h-7 w-7 animate-spin text-emerald-500/40" /> : returningActiveUsers.length}
              </div>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 flex items-center gap-1">
                <span>Registered before period started</span>
              </p>
            </div>

            {/* Card 3: New Active Users */}
            <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">New Active Users</span>
                <div className="h-8 w-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {isLoading ? <Loader2 className="h-7 w-7 animate-spin text-indigo-500/40" /> : newActiveUsers.length}
              </div>
              <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-1 flex items-center gap-1">
                <span>Registered during this period</span>
              </p>
            </div>

            {/* Card 4: Returning User Retention Rate */}
            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Retention Ratio</span>
                <div className="h-8 w-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
                {isLoading ? <Loader2 className="h-7 w-7 animate-spin text-amber-500/40" /> : `${returningPercentage}%`}
              </div>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1 flex items-center gap-1">
                <span>{returningActiveUsers.length} of {allActiveUsers.length} active are repeat users</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Active Users Table Card */}
      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-card">
        <CardHeader className="p-6 md:p-8 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Sub-filter tabs (All / Returning / New) */}
            <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-xl border border-border/40">
              <button
                type="button"
                onClick={() => setUserTypeFilter('all')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                  userTypeFilter === 'all'
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Active ({allActiveUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setUserTypeFilter('returning')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  userTypeFilter === 'returning'
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Repeat className="h-3 w-3" />
                Returning Users ({returningActiveUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setUserTypeFilter('new')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  userTypeFilter === 'new'
                    ? "bg-indigo-500 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="h-3 w-3" />
                New Users ({newActiveUsers.length})
              </button>
            </div>

            {/* In-table Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search active users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-10 bg-muted/30 border-border/60 rounded-xl text-xs font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-[350px] space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] animate-pulse">
                Analyzing User Activity...
              </p>
            </div>
          ) : displayedUsers.length === 0 ? (
            <div className="text-center py-24 bg-muted/5">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-bold text-foreground">No active users found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? `No active users match "${searchTerm}". Try a different search term.`
                  : `No users were active during ${filterLabel}. Try expanding your date range.`}
              </p>
              {searchTerm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-xs rounded-xl"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b border-border/40">
                    <TableHead className="w-16 font-black text-[10px] uppercase tracking-widest text-muted-foreground py-4 pl-6">ID</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground py-4">User</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground py-4">Category</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground py-4">Registered Date</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground py-4">Last Seen / Active</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground py-4 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/20">
                  {displayedUsers.map((u) => {
                    const cleanPhone = (u.mobileNumber || '').replace(/[^0-9]/g, '');
                    const regDateStr = u.createdMillis 
                      ? formatDateInTimezone(new Date(u.createdMillis), timezone) 
                      : 'N/A';
                    const lastActiveDateStr = u.lastActiveMillis 
                      ? `${formatDateInTimezone(new Date(u.lastActiveMillis), timezone)} at ${formatTimeInTimezone(new Date(u.lastActiveMillis), timezone)}` 
                      : 'N/A';
                    const relativeTimeStr = formatRelativeTime(u.lastActiveMillis);

                    return (
                      <TableRow key={u.id} className="hover:bg-muted/20 transition-colors group">
                        {/* Member # */}
                        <TableCell className="font-black text-xs text-primary/70 pl-6 py-4">
                          #{u.userNumber || 'N/A'}
                        </TableCell>

                        {/* User Info */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 rounded-xl border border-border/60 shadow-2xs">
                              <AvatarImage src={u.photoURL || undefined} alt={u.displayName || 'User'} />
                              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold text-xs">
                                {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-foreground truncate max-w-[180px] sm:max-w-xs">
                                {u.displayName || 'Anonymous User'}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate max-w-[180px] sm:max-w-xs flex items-center gap-1.5">
                                <Mail className="h-3 w-3 shrink-0 opacity-60" />
                                <span>{u.email || 'No email provided'}</span>
                              </div>
                              {u.mobileNumber && (
                                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                                  <Phone className="h-3 w-3 shrink-0 opacity-60" />
                                  <span>{u.mobileNumber}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Category (Returning vs New) */}
                        <TableCell className="py-4">
                          {u.isReturning ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-[10px] uppercase tracking-wider py-1 px-2.5 flex items-center gap-1 w-fit shadow-2xs">
                              <Repeat className="h-3 w-3" />
                              Returning User
                            </Badge>
                          ) : (
                            <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold text-[10px] uppercase tracking-wider py-1 px-2.5 flex items-center gap-1 w-fit shadow-2xs">
                              <Sparkles className="h-3 w-3" />
                              New User
                            </Badge>
                          )}
                        </TableCell>

                        {/* Registered Date */}
                        <TableCell className="py-4">
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{regDateStr}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            Account Created
                          </span>
                        </TableCell>

                        {/* Last Seen / Active */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-bold text-primary border-primary/30 bg-primary/5 py-0.5 px-2">
                              {relativeTimeStr}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 shrink-0 opacity-60" />
                            <span>{lastActiveDateStr}</span>
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {cleanPhone && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openWhatsAppChooser(cleanPhone, `Hello ${u.displayName || ''}, thank you for choosing Fixbro!`)}
                                className="h-9 w-9 p-0 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-2xs"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewUserDetails(u)}
                              className="h-9 px-3 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold text-xs transition-all shadow-2xs flex items-center gap-1.5"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Details</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
