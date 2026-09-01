'use client';

import { useState } from 'react';
import { ChevronDown, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  type GameMode,
  type MunicipalityScope,
  type Region,
  REGIONS,
  getRegionPrefectures,
} from '@/lib/quiz/municipality-data';

const REGION_ORDER: Region[] = [
  '北海道',
  '東北',
  '関東',
  '中部',
  '近畿',
  '中国',
  '四国',
  '九州',
];

interface PrefecturePickerSheetProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly currentPrefecture: string;
  readonly onSelectPrefecture: (pref: string) => void;
}

function PrefecturePickerSheet({
  isOpen,
  onOpenChange,
  currentPrefecture,
  onSelectPrefecture,
}: Readonly<PrefecturePickerSheetProps>) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 py-5">
        <SheetHeader className="pb-2">
          <SheetTitle>都道府県を選択</SheetTitle>
          <SheetDescription>練習したい都道府県を1つ選択してください</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 pt-2">
          {REGION_ORDER.map((region) => {
            const prefs = getRegionPrefectures(region);
            return (
              <div key={region} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground px-1">
                  {region}
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {prefs.map((pref) => {
                    const isSelected = pref === currentPrefecture;
                    return (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => onSelectPrefecture(pref)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground font-semibold'
                            : 'border-border bg-card hover:bg-accent hover:border-primary/40 text-foreground'
                        }`}
                      >
                        <span className="truncate">{pref}</span>
                        {isSelected && <Check size={13} className="shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface RegionPickerSectionProps {
  readonly regions?: Region[];
  readonly onToggleRegion: (region: Region) => void;
}

function RegionPickerSection({ regions, onToggleRegion }: Readonly<RegionPickerSectionProps>) {
  const currentRegions = regions ?? ['全国'];
  return (
    <div>
      <p className="text-sm font-medium mb-2">出題地域（複数選択可）</p>
      <div className="flex flex-wrap gap-2">
        {REGIONS.map((r) => {
          const isSelected =
            r === '全国'
              ? currentRegions.includes('全国')
              : !currentRegions.includes('全国') && currentRegions.includes(r);
          return (
            <button
              key={r}
              type="button"
              onClick={() => onToggleRegion(r)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PrefecturePickerSectionProps {
  readonly currentPrefecture: string;
  readonly onOpenPrefSheet: () => void;
  readonly onOpenMunicipalityPicker?: () => void;
  readonly selectedCount?: number;
  readonly totalPrefectureCount?: number;
}

function PrefecturePickerSection({
  currentPrefecture,
  onOpenPrefSheet,
  onOpenMunicipalityPicker,
  selectedCount,
  totalPrefectureCount,
}: Readonly<PrefecturePickerSectionProps>) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="text-sm font-medium mb-1.5">出題する都道府県</p>
        <button
          type="button"
          onClick={onOpenPrefSheet}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/40 text-foreground transition-colors"
        >
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            <span className="font-semibold text-base">{currentPrefecture}</span>
            {totalPrefectureCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                ({totalPrefectureCount} 市区町村)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>変更</span>
            <ChevronDown size={14} />
          </div>
        </button>
      </div>

      {onOpenMunicipalityPicker && (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/70">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">出題対象の市区町村</span>
            <span className="text-sm font-medium">
              {selectedCount !== undefined && totalPrefectureCount !== undefined
                ? `${selectedCount} / ${totalPrefectureCount} 件選択中`
                : 'すべての市区町村'}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenMunicipalityPicker}
            className="text-xs h-8"
          >
            市区町村を絞り込む
          </Button>
        </div>
      )}
    </div>
  );
}

interface ScopeTypeToggleProps {
  readonly isPrefectureMode: boolean;
  readonly onSelectType: (type: 'region' | 'prefecture') => void;
}

function ScopeTypeToggle({ isPrefectureMode, onSelectType }: Readonly<ScopeTypeToggleProps>) {
  return (
    <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-lg w-full">
      <button
        type="button"
        onClick={() => onSelectType('region')}
        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
          !isPrefectureMode
            ? 'bg-background text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        地域（地方）で選ぶ
      </button>
      <button
        type="button"
        onClick={() => onSelectType('prefecture')}
        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
          isPrefectureMode
            ? 'bg-background text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        都道府県で選ぶ
      </button>
    </div>
  );
}

interface ScopeSelectorProps {
  readonly mode: GameMode;
  readonly scope: MunicipalityScope;
  readonly onScopeChange: (scope: MunicipalityScope) => void;
  readonly onOpenMunicipalityPicker?: () => void;
  readonly selectedCount?: number;
  readonly totalPrefectureCount?: number;
}

function computeToggledRegions(currentRegions: Region[], r: Region): Region[] {
  if (r === '全国') return ['全国'];
  const without全国 = currentRegions.filter((x) => x !== '全国');
  const already = without全国.includes(r);
  const toggled = already
    ? without全国.filter((x) => x !== r)
    : [...without全国, r];
  return toggled.length === 0 ? ['全国'] : toggled;
}

export function ScopeSelector({
  mode,
  scope,
  onScopeChange,
  onOpenMunicipalityPicker,
  selectedCount,
  totalPrefectureCount,
}: Readonly<ScopeSelectorProps>) {
  const [isPrefSheetOpen, setIsPrefSheetOpen] = useState(false);
  const currentPrefecture = scope.prefecture ?? '東京都';
  const isPrefectureMode = scope.type === 'prefecture';

  const handleScopeTypeChange = (type: 'region' | 'prefecture') => {
    if (type === 'prefecture') {
      onScopeChange({ type: 'prefecture', prefecture: currentPrefecture });
    } else {
      const regions: Region[] =
        scope.regions && scope.regions.length > 0 ? scope.regions : ['全国'];
      onScopeChange({ type: 'region', regions });
    }
  };

  const handleRegionToggle = (r: Region) => {
    onScopeChange({
      type: 'region',
      regions: computeToggledRegions(scope.regions ?? ['全国'], r),
    });
  };

  const handlePrefectureSelect = (pref: string) => {
    onScopeChange({ type: 'prefecture', prefecture: pref });
    setIsPrefSheetOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {mode === 'D' && (
        <ScopeTypeToggle
          isPrefectureMode={isPrefectureMode}
          onSelectType={handleScopeTypeChange}
        />
      )}

      {!isPrefectureMode ? (
        <RegionPickerSection regions={scope.regions} onToggleRegion={handleRegionToggle} />
      ) : (
        <PrefecturePickerSection
          currentPrefecture={currentPrefecture}
          onOpenPrefSheet={() => setIsPrefSheetOpen(true)}
          onOpenMunicipalityPicker={onOpenMunicipalityPicker}
          selectedCount={selectedCount}
          totalPrefectureCount={totalPrefectureCount}
        />
      )}

      <PrefecturePickerSheet
        isOpen={isPrefSheetOpen}
        onOpenChange={setIsPrefSheetOpen}
        currentPrefecture={currentPrefecture}
        onSelectPrefecture={handlePrefectureSelect}
      />
    </div>
  );
}
