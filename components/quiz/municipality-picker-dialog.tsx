'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, X, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  type Municipality,
  DIFFICULTY_LABEL,
} from '@/lib/quiz/municipality-data';

interface SearchInputProps {
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
}

function SearchInput({ searchQuery, onSearchChange }: Readonly<SearchInputProps>) {
  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="市区町村名・よみがなで検索..."
        className="w-full pl-8 pr-8 py-1.5 text-xs rounded-md bg-muted/50 border border-border focus:outline-hidden focus:ring-1 focus:ring-primary"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

interface ActionButtonsProps {
  readonly onSelectAll: () => void;
  readonly onDeselectAll: () => void;
  readonly isAllSelected: boolean;
  readonly selectedCount: number;
}

function ActionButtons({
  onSelectAll,
  onDeselectAll,
  isAllSelected,
  selectedCount,
}: Readonly<ActionButtonsProps>) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSelectAll}
        disabled={isAllSelected}
        className="text-xs h-7 px-2.5 flex-1"
      >
        <CheckCheck size={13} className="mr-1" />
        すべて選択
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onDeselectAll}
        disabled={selectedCount === 0}
        className="text-xs h-7 px-2.5 flex-1"
      >
        <X size={13} className="mr-1" />
        すべて解除
      </Button>
    </div>
  );
}

interface SearchHeaderProps {
  readonly prefecture: string;
  readonly selectedCount: number;
  readonly totalCount: number;
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly onSelectAll: () => void;
  readonly onDeselectAll: () => void;
  readonly isAllSelected: boolean;
}

function SearchHeader({
  prefecture,
  selectedCount,
  totalCount,
  searchQuery,
  onSearchChange,
  onSelectAll,
  onDeselectAll,
  isAllSelected,
}: Readonly<SearchHeaderProps>) {
  return (
    <SheetHeader className="p-4 pb-3 border-b border-border">
      <div className="flex items-center justify-between">
        <SheetTitle className="text-base font-semibold">
          {prefecture} の市区町村を選択
        </SheetTitle>
        <span className="text-xs text-muted-foreground font-mono">
          {selectedCount} / {totalCount} 選択中
        </span>
      </div>
      <SheetDescription className="sr-only">
        出題対象に含める市区町村を選択してください
      </SheetDescription>

      <div className="flex flex-col gap-2 pt-2">
        <SearchInput searchQuery={searchQuery} onSearchChange={onSearchChange} />
        <ActionButtons
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          isAllSelected={isAllSelected}
          selectedCount={selectedCount}
        />
      </div>
    </SheetHeader>
  );
}

interface MunicipalityItemProps {
  readonly municipality: Municipality;
  readonly isChecked: boolean;
  readonly isCleared: boolean;
  readonly onToggle: (code: string) => void;
}

function MunicipalityItem({
  municipality,
  isChecked,
  isCleared,
  onToggle,
}: Readonly<MunicipalityItemProps>) {
  return (
    <label className="flex items-center justify-between py-2.5 px-1 cursor-pointer hover:bg-muted/30 rounded-sm transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(municipality.code)}
          className="w-4 h-4 rounded-sm border-border text-primary focus:ring-primary shrink-0"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-foreground truncate">
            {municipality.name}
          </span>
          {municipality.kana && (
            <span className="text-[10px] text-muted-foreground truncate">
              {municipality.kana}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {isCleared && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
            制覇済
          </span>
        )}
        {municipality.difficulty && (
          <span className="text-[10px] text-muted-foreground">
            {DIFFICULTY_LABEL[municipality.difficulty].split(' ')[0]}
          </span>
        )}
      </div>
    </label>
  );
}

interface DialogFooterProps {
  readonly selectedCount: number;
  readonly onCancel: () => void;
  readonly onApply: () => void;
}

function DialogFooter({ selectedCount, onCancel, onApply }: Readonly<DialogFooterProps>) {
  return (
    <div className="p-3 border-t border-border bg-card flex items-center gap-2">
      <Button type="button" variant="outline" onClick={onCancel} className="flex-1 text-xs">
        キャンセル
      </Button>
      <Button type="button" onClick={onApply} className="flex-2 text-xs">
        決定 ({selectedCount} 件選択)
      </Button>
    </div>
  );
}

interface MunicipalityListSectionProps {
  readonly municipalities: readonly Municipality[];
  readonly tempSelected: ReadonlySet<string>;
  readonly clearedCodesSet: ReadonlySet<string>;
  readonly onToggleCode: (code: string) => void;
}

function MunicipalityListSection({
  municipalities,
  tempSelected,
  clearedCodesSet,
  onToggleCode,
}: Readonly<MunicipalityListSectionProps>) {
  if (municipalities.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8 text-center text-xs text-muted-foreground">
        検索条件に一致する市区町村がありません
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-border/40">
      {municipalities.map((m) => (
        <MunicipalityItem
          key={m.code}
          municipality={m}
          isChecked={tempSelected.has(m.code)}
          isCleared={clearedCodesSet.has(m.code)}
          onToggle={onToggleCode}
        />
      ))}
    </div>
  );
}

interface UsePickerStateParams {
  readonly isOpen: boolean;
  readonly selectedCodes?: readonly string[];
  readonly municipalities: readonly Municipality[];
  readonly onSave: (codes: string[] | undefined) => void;
  readonly onOpenChange: (open: boolean) => void;
}

function useMunicipalityPickerState({
  isOpen,
  selectedCodes,
  municipalities,
  onSave,
  onOpenChange,
}: UsePickerStateParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      if (selectedCodes && selectedCodes.length > 0) {
        setTempSelected(new Set(selectedCodes));
      } else {
        setTempSelected(new Set(municipalities.map((m) => m.code)));
      }
      setSearchQuery('');
    }
  }, [isOpen, selectedCodes, municipalities]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return municipalities;
    const q = searchQuery.trim().toLowerCase();
    return municipalities.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.kana && m.kana.toLowerCase().includes(q)),
    );
  }, [municipalities, searchQuery]);

  const handleToggleCode = (code: string) => {
    setTempSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleApply = () => {
    if (tempSelected.size === municipalities.length) {
      onSave(undefined);
    } else {
      onSave(Array.from(tempSelected));
    }
    onOpenChange(false);
  };

  return {
    searchQuery,
    setSearchQuery,
    tempSelected,
    filtered,
    handleToggleCode,
    handleApply,
    selectAll: () => setTempSelected(new Set(municipalities.map((m) => m.code))),
    deselectAll: () => setTempSelected(new Set()),
  };
}

interface MunicipalityPickerDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly prefecture: string;
  readonly municipalities: readonly Municipality[];
  readonly selectedCodes?: readonly string[];
  readonly onSave: (codes: string[] | undefined) => void;
  readonly clearedCodesSet: ReadonlySet<string>;
}

export function MunicipalityPickerDialog({
  isOpen,
  onOpenChange,
  prefecture,
  municipalities,
  selectedCodes,
  onSave,
  clearedCodesSet,
}: Readonly<MunicipalityPickerDialogProps>) {
  const {
    searchQuery,
    setSearchQuery,
    tempSelected,
    filtered,
    handleToggleCode,
    handleApply,
    selectAll,
    deselectAll,
  } = useMunicipalityPickerState({
    isOpen,
    selectedCodes,
    municipalities,
    onSave,
    onOpenChange,
  });

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[88vh] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-background"
      >
        <SearchHeader
          prefecture={prefecture}
          selectedCount={tempSelected.size}
          totalCount={municipalities.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          isAllSelected={tempSelected.size === municipalities.length}
        />

        <MunicipalityListSection
          municipalities={filtered}
          tempSelected={tempSelected}
          clearedCodesSet={clearedCodesSet}
          onToggleCode={handleToggleCode}
        />

        <DialogFooter
          selectedCount={tempSelected.size}
          onCancel={() => onOpenChange(false)}
          onApply={handleApply}
        />
      </SheetContent>
    </Sheet>
  );
}
