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
  UserX, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  Search, 
  Eye, 
  Mail, 
  Phone, 
  Calendar,
  AlertTriangle,
  GitMerge,
  Archive,
  ShieldAlert,
  UserMinus,
  CheckCircle2
} from "lucide-react";
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
import type { FirestoreUser } from '@/types/firestore';
import { getTimestampMillis, formatDateInTimezone, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

type InactiveFilterReason = 'all' | 'archived' | 'merged' | 'disabled' | 'incomplete' | 'duplicate';

interface InactiveUsersTabProps {
  users: FirestoreUser[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onViewUserDetails: (user: FirestoreUser) => void;
  appConfig?: any;
}

export default function InactiveUsersTab({
  users,
  isLoading,
  onRefresh,
  onDeleteUser,
  onViewUserDetails,
  appConfig
}: InactiveUsersTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [reasonFilter, setReasonFilter] = useState<InactiveFilterReason>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPurgingAll, setIsPurgingAll] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);

  const getReasonType = (user: FirestoreUser): InactiveFilterReason => {
    if ((user as any).isDuplicate) return 'duplicate';
    if ((user as any).mergedIntoUid) return 'merged';
    if ((user as any).isArchived) return 'archived';
    if (user.isActive === false) return 'disabled';
    if (!user.displayName && !user.email && !user.mobileNumber && !(user as any).phoneNumber) return 'incomplete';
    return 'archived';
  };

  const filteredUsers = useMemo(() => {
    let result = users;

    if (reasonFilter !== 'all') {
      result = result.filter(u => getReasonType(u) === reasonFilter);
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase().trim();
      const numOnly = lower.replace(/\D/g, '');
      result = result.filter(u => {
        const name = (u.displayName || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const phone = (u.mobileNumber || (u as any).phoneNumber || '').replace(/\D/g, '');
        const memberNum = String(u.userNumber || '');
        const uid = String(u.id || u.uid || '').toLowerCase();
        return name.includes(lower) || email.includes(lower) || (numOnly && phone.includes(numOnly)) || memberNum === lower || uid.includes(lower);
      });
    }

    return result;
  }, [users, reasonFilter, searchTerm]);

  const counts = useMemo(() => {
    const c = { all: users.length, archived: 0, merged: 0, disabled: 0, incomplete: 0, duplicate: 0 };
    for (const u of users) {
      const r = getReasonType(u);
      c[r] = (c[r] || 0) + 1;
    }
    return c;
  }, [users]);

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    try {
      await onDeleteUser(userId);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePurgeAll = async () => {
    setIsPurgingAll(true);
    try {
      for (const u of filteredUsers) {
        if (u.id || u.uid) {
          await onDeleteUser(u.id || u.uid);
        }
      }
    } finally {
      setIsPurgingAll(false);
    }
  };

  const renderReasonBadge = (user: FirestoreUser) => {
    const r = getReasonType(user);
    if (r === 'duplicate') {
      return (
        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[10px] font-bold flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Duplicate Account
        </Badge>
      );
    }
    if (r === 'merged') {
      const targetUid = (user as any).mergedIntoUid || '';
      return (
        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px] font-bold flex items-center gap-1">
          <GitMerge className="h-3 w-3" />
          Merged into {targetUid.slice(0, 6)}...
        </Badge>
      );
    }
    if (r === 'archived') {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold flex items-center gap-1">
          <Archive className="h-3 w-3" />
          Archived Account
        </Badge>
      );
    }
    if (r === 'disabled') {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold flex items-center gap-1">
          <ShieldAlert className="h-3 w-3" />
          Disabled / Inactive
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 border-zinc-500/20 text-[10px] font-bold flex items-center gap-1">
        <UserMinus className="h-3 w-3" />
        Incomplete / Stale
      </Badge>
    );
  };

  return (
    <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-card">
      <CardHeader className="p-8 pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <UserX className="h-6 w-6 text-amber-500" />
              Inactive, Archived & Merged Accounts ({users.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              These accounts are excluded from the main directory and create gaps in member numbers until deleted or re-sequenced.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-9 px-3 rounded-xl border border-border text-xs font-bold gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              Refresh
            </Button>

            {filteredUsers.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isPurgingAll}
                    className="h-9 px-3.5 rounded-xl text-xs font-bold gap-1.5 shadow-sm"
                  >
                    {isPurgingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete All Filtered ({filteredUsers.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold">Permanently Delete {filteredUsers.length} Inactive Users?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {filteredUsers.length} inactive, archived, and merged accounts from the database, photos, and Firebase Authentication. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handlePurgeAll}
                      className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold"
                    >
                      Yes, Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 no-scrollbar flex-wrap">
          <Button
            variant={reasonFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReasonFilter('all')}
            className={cn("h-8 rounded-full text-xs font-bold px-3.5", reasonFilter === 'all' && "shadow-sm")}
          >
            All Inactive ({counts.all})
          </Button>
          <Button
            variant={reasonFilter === 'archived' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReasonFilter('archived')}
            className={cn("h-8 rounded-full text-xs font-bold px-3.5", reasonFilter === 'archived' && "shadow-sm")}
          >
            Archived ({counts.archived})
          </Button>
          <Button
            variant={reasonFilter === 'merged' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReasonFilter('merged')}
            className={cn("h-8 rounded-full text-xs font-bold px-3.5", reasonFilter === 'merged' && "shadow-sm")}
          >
            Merged ({counts.merged})
          </Button>
          <Button
            variant={reasonFilter === 'disabled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReasonFilter('disabled')}
            className={cn("h-8 rounded-full text-xs font-bold px-3.5", reasonFilter === 'disabled' && "shadow-sm")}
          >
            Disabled ({counts.disabled})
          </Button>
          <Button
            variant={reasonFilter === 'incomplete' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReasonFilter('incomplete')}
            className={cn("h-8 rounded-full text-xs font-bold px-3.5", reasonFilter === 'incomplete' && "shadow-sm")}
          >
            Incomplete ({counts.incomplete})
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative mt-4 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search by name, email, phone, UID, or previous member #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-11 bg-muted/30 border-muted rounded-2xl text-xs font-medium focus-visible:ring-primary/20"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {users.length === 0 ? (
          <div className="text-center py-24 bg-muted/5">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500/40 mb-3" />
            <p className="text-lg font-bold text-foreground">No Inactive Users Found</p>
            <p className="text-xs text-muted-foreground mt-1">Your user directory is completely clean! Every user in the database is active.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 bg-muted/5">
            <UserX className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm font-bold text-foreground">Zero Matches for Current Filter</p>
            <p className="text-xs text-muted-foreground mt-1">Try switching reason filter pills or adjusting your search term.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-b border-muted/40">
                    <TableHead className="pl-8 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Previous #</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">User / Identity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Contacts</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Status Reason</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Created</TableHead>
                    <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.slice(0, displayLimit).map((u, idx) => {
                    const uid = u.id || u.uid || `user-${idx}`;
                    const isDeletingThis = deletingId === uid;
                    const createdMillis = getTimestampMillis(u.createdAt);
                    const formattedDate = createdMillis
                      ? formatDateInTimezone(new Date(createdMillis), appConfig?.timezone || 'Asia/Kolkata', appConfig?.dateFormat)
                      : 'N/A';

                    return (
                      <TableRow key={uid} className="hover:bg-muted/10 border-b border-muted/30 transition-colors">
                        <TableCell className="pl-8 font-black text-xs text-muted-foreground">
                          {u.userNumber ? `#${u.userNumber}` : '--'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 rounded-lg border border-border/40">
                              <AvatarImage src={u.photoURL || undefined} />
                              <AvatarFallback className="text-xs font-bold bg-muted">
                                {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-xs truncate max-w-[180px]">
                                {u.displayName || 'Unnamed User'}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">
                                {uid}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            {u.email && (
                              <span className="flex items-center gap-1 text-muted-foreground text-[11px] truncate max-w-[200px]">
                                <Mail className="h-3 w-3 shrink-0" /> {u.email}
                              </span>
                            )}
                            {(u.mobileNumber || (u as any).phoneNumber) && (
                              <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                                <Phone className="h-3 w-3 shrink-0" /> {u.mobileNumber || (u as any).phoneNumber}
                              </span>
                            )}
                            {!u.email && !u.mobileNumber && !(u as any).phoneNumber && (
                              <span className="text-[11px] text-muted-foreground/60 italic">No contact details</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {renderReasonBadge(u)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formattedDate}
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onViewUserDetails(u)}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isDeletingThis}
                                  className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                                  title="Permanently Delete"
                                >
                                  {isDeletingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-xl font-bold">Permanently Delete User?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {u.displayName || u.email || uid}? This will permanently remove their database document, files, and Firebase credentials.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(uid)}
                                    className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-muted/30">
              {filteredUsers.slice(0, displayLimit).map((u, idx) => {
                const uid = u.id || u.uid || `user-${idx}`;
                const isDeletingThis = deletingId === uid;
                return (
                  <div key={uid} className="p-4 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-9 w-9 rounded-xl border border-border/40 shrink-0">
                          <AvatarImage src={u.photoURL || undefined} />
                          <AvatarFallback className="text-xs font-bold bg-muted">
                            {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{u.displayName || 'Unnamed User'}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{uid}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black text-muted-foreground">
                          {u.userNumber ? `#${u.userNumber}` : '--'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div>{renderReasonBadge(u)}</div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewUserDetails(u)}
                          className="h-7 w-7 text-muted-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isDeletingThis}
                              className="h-7 w-7 text-destructive"
                            >
                              {isDeletingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-lg font-bold">Permanently Delete User?</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs">
                                Delete {u.displayName || u.email || uid} permanently from database and auth?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(uid)}
                                className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {filteredUsers.length > displayLimit && (
              <div className="p-6 border-t border-muted/30 text-center flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
                <span>Showing {displayLimit} of {filteredUsers.length} inactive accounts</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayLimit(prev => prev + 50)}
                  className="rounded-xl font-bold text-xs"
                >
                  Load More (+50)
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
