"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Check, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchablePickerItem {
  id: string;
  name: string;
  subtitle?: string;
  badge?: string | number;
}

interface SearchablePickerModalProps {
  title: string;
  description?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  items: SearchablePickerItem[];
  selectedValue: string;
  onSelect: (id: string) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  allOptionLabel?: string;
  allOptionBadge?: string | number;
  triggerClassName?: string;
  size?: "sm" | "default";
}

export default function SearchablePickerModal({
  title,
  description,
  placeholder = "Search and select...",
  searchPlaceholder = "Type to search...",
  items,
  selectedValue,
  onSelect,
  icon,
  disabled = false,
  className,
  allOptionLabel,
  allOptionBadge,
  triggerClassName,
  size = "default",
}: SearchablePickerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedItem = useMemo(() => {
    if (selectedValue === "all" && allOptionLabel) {
      return { id: "all", name: allOptionLabel, badge: allOptionBadge };
    }
    return items.find((item) => item.id === selectedValue);
  }, [items, selectedValue, allOptionLabel, allOptionBadge]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const handleSelectItem = (id: string) => {
    onSelect(id);
    setIsOpen(false);
    setSearchQuery("");
  };

  const isAllSelected = selectedValue === "all" || !selectedValue;

  return (
    <div className={cn("inline-block", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full justify-between font-normal text-left truncate",
          size === "sm" ? "h-9 px-3 text-xs" : "h-10 px-3 text-sm",
          !selectedItem && "text-muted-foreground",
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {icon}
          <span className="truncate">
            {selectedItem ? selectedItem.name : placeholder}
          </span>
          {selectedItem?.badge !== undefined && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
              {selectedItem.badge}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
          <Search className="h-3.5 w-3.5 opacity-60" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </div>
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSearchQuery("");
      }}>
        <DialogContent className="w-[calc(100%-16px)] sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              {icon}
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-xs">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="p-3 border-b bg-muted/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-9 text-sm"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[320px] p-2">
            <div className="space-y-1">
              {allOptionLabel && !searchQuery && (
                <Button
                  type="button"
                  variant={selectedValue === "all" ? "secondary" : "ghost"}
                  className="w-full justify-between h-auto py-2.5 px-3 text-left font-normal"
                  onClick={() => handleSelectItem("all")}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{allOptionLabel}</span>
                    {allOptionBadge !== undefined && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {allOptionBadge}
                      </Badge>
                    )}
                  </div>
                  {selectedValue === "all" && (
                    <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                  )}
                </Button>
              )}

              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground space-y-2">
                  <p>No results found for &ldquo;{searchQuery}&rdquo;</p>
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="text-xs"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedValue === item.id;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={isSelected ? "secondary" : "ghost"}
                      className="w-full justify-between h-auto py-2 px-3 text-left font-normal whitespace-normal group"
                      onClick={() => handleSelectItem(item.id)}
                    >
                      <div className="flex flex-col text-left pr-2 truncate">
                        <span className={cn("text-sm truncate", isSelected ? "font-semibold text-primary" : "font-normal")}>
                          {item.name}
                        </span>
                        {item.subtitle && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {item.badge !== undefined && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                            {item.badge}
                          </Badge>
                        )}
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    </Button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="p-2.5 border-t bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {filteredItems.length} of {items.length} {allOptionLabel ? "(plus All)" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
