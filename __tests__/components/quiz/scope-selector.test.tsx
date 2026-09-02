// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ScopeSelector } from '@/components/quiz/scope-selector';
import { MunicipalityPickerDialog } from '@/components/quiz/municipality-picker-dialog';
import type { Municipality, MunicipalityScope } from '@/lib/quiz/municipality-data';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

const mockMunicipalities: Municipality[] = [
  { code: '20201', name: '長野市', prefecture: '長野県', region: '中部', difficulty: 'easy', kana: 'ながのし' },
  { code: '20202', name: '松本市', prefecture: '長野県', region: '中部', difficulty: 'easy', kana: 'まつもとし' },
  { code: '20203', name: '上田市', prefecture: '長野県', region: '中部', difficulty: 'medium', kana: 'うえだし' },
];

describe('Scope UI Components', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  describe('ScopeSelector', () => {
    it('Mode D で地域/都道府県の切り替えタブを表示し、地域選択ができる', async () => {
      const handleScopeChange = vi.fn();
      const scope: MunicipalityScope = {
        type: 'region',
        regions: ['全国'],
      };

      await act(async () => {
        root?.render(
          <ScopeSelector
            mode="D"
            scope={scope}
            onScopeChange={handleScopeChange}
          />
        );
      });

      expect(container?.textContent).toContain('地域（地方）で選ぶ');
      expect(container?.textContent).toContain('都道府県で選ぶ');
      expect(container?.textContent).toContain('関東');

      // Click "都道府県で選ぶ"
      const prefTab = Array.from(container?.querySelectorAll('button') ?? []).find(
        (btn) => btn.textContent?.includes('都道府県で選ぶ')
      );
      expect(prefTab).toBeDefined();

      await act(async () => {
        prefTab?.click();
      });

      expect(handleScopeChange).toHaveBeenCalledWith({
        type: 'prefecture',
        prefecture: '東京都',
        selectedCodes: undefined,
      });
    });

    it('都道府県モード時に選択中都道府県と絞り込みボタンを表示する', async () => {
      const handleOpenPicker = vi.fn();
      const scope: MunicipalityScope = {
        type: 'prefecture',
        prefecture: '長野県',
        selectedCodes: ['20201'],
      };

      await act(async () => {
        root?.render(
          <ScopeSelector
            mode="D"
            scope={scope}
            onScopeChange={vi.fn()}
            onOpenMunicipalityPicker={handleOpenPicker}
            selectedCount={1}
            totalPrefectureCount={3}
          />
        );
      });

      expect(container?.textContent).toContain('長野県');
      expect(container?.textContent).toContain('1 / 3 件選択中');

      const pickerBtn = Array.from(container?.querySelectorAll('button') ?? []).find(
        (btn) => btn.textContent?.includes('市区町村を絞り込む')
      );
      expect(pickerBtn).toBeDefined();

      await act(async () => {
        pickerBtn?.click();
      });

      expect(handleOpenPicker).toHaveBeenCalledTimes(1);
    });

    it('スコープ種別（地域/都道府県）を切り替えても直前の都道府県と選択コードを保持して復元する', async () => {
      const handleScopeChange = vi.fn();

      await act(async () => {
        root?.render(
          <ScopeSelector
            mode="D"
            scope={{
              type: 'prefecture',
              prefecture: '長野県',
              selectedCodes: ['20201', '20202'],
            }}
            onScopeChange={handleScopeChange}
            onOpenMunicipalityPicker={vi.fn()}
            selectedCount={2}
            totalPrefectureCount={77}
          />
        );
      });

      const regionToggle = Array.from(container?.querySelectorAll('button') ?? []).find(
        (btn) => btn.textContent?.includes('地域（地方）で選ぶ')
      );
      expect(regionToggle).toBeDefined();

      await act(async () => {
        regionToggle?.click();
      });

      expect(handleScopeChange).toHaveBeenCalledWith({
        type: 'region',
        regions: ['全国'],
      });

      await act(async () => {
        root?.render(
          <ScopeSelector
            mode="D"
            scope={{
              type: 'region',
              regions: ['全国'],
            }}
            onScopeChange={handleScopeChange}
            onOpenMunicipalityPicker={vi.fn()}
          />
        );
      });

      const prefToggle = Array.from(container?.querySelectorAll('button') ?? []).find(
        (btn) => btn.textContent?.includes('都道府県で選ぶ')
      );
      expect(prefToggle).toBeDefined();

      await act(async () => {
        prefToggle?.click();
      });

      expect(handleScopeChange).toHaveBeenLastCalledWith({
        type: 'prefecture',
        prefecture: '長野県',
        selectedCodes: ['20201', '20202'],
      });
    });
  });

  describe('MunicipalityPickerDialog', () => {
    const sapporoMunicipalities: Municipality[] = [
      { code: '01101', name: '札幌市', prefecture: '北海道', region: '北海道', difficulty: 'easy', kana: 'さっぽろし' },
      { code: '01102', name: '札幌市', prefecture: '北海道', region: '北海道', difficulty: 'easy', kana: 'さっぽろし' },
    ];

    it('市区町村リストとチェックボックスを表示し、全選択/解除や個別トグルができる', async () => {
      const handleSave = vi.fn();
      const handleOpenChange = vi.fn();
      const clearedCodes = new Set(['20201']);

      await act(async () => {
        root?.render(
          <MunicipalityPickerDialog
            isOpen={true}
            onOpenChange={handleOpenChange}
            prefecture="長野県"
            municipalities={mockMunicipalities}
            selectedCodes={['20201', '20202']}
            onSave={handleSave}
            clearedCodesSet={clearedCodes}
          />
        );
      });

      expect(document.body.textContent).toContain('長野県 の市区町村を選択');
      expect(document.body.textContent).toContain('長野市');
      expect(document.body.textContent).toContain('松本市');
      expect(document.body.textContent).toContain('上田市');
      expect(document.body.textContent).toContain('制覇済');

      // Click "すべて解除"
      const deselectBtn = Array.from(document.body.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('すべて解除')
      );
      expect(deselectBtn).toBeDefined();

      await act(async () => {
        deselectBtn?.click();
      });

      // Click "決定"
      const applyBtn = Array.from(document.body.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('決定')
      );
      expect(applyBtn).toBeDefined();

      await act(async () => {
        applyBtn?.click();
      });

      expect(handleSave).toHaveBeenCalledWith([]);
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('政令指定都市の区（例: 札幌市中央区, 札幌市北区）を区別したラベルで表示できる', async () => {
      await act(async () => {
        root?.render(
          <MunicipalityPickerDialog
            isOpen={true}
            onOpenChange={vi.fn()}
            prefecture="北海道"
            municipalities={sapporoMunicipalities}
            selectedCodes={['01101']}
            onSave={vi.fn()}
            clearedCodesSet={new Set()}
          />
        );
      });

      expect(document.body.textContent).toContain('札幌市中央区');
      expect(document.body.textContent).toContain('さっぽろしちゅうおうく');
      expect(document.body.textContent).toContain('札幌市北区');
      expect(document.body.textContent).toContain('さっぽろしきたく');
    });

    it('別都道府県や無効なコードが selectedCodes に含まれていても除外して開く', async () => {
      await act(async () => {
        root?.render(
          <MunicipalityPickerDialog
            isOpen={true}
            onOpenChange={vi.fn()}
            prefecture="北海道"
            municipalities={sapporoMunicipalities}
            selectedCodes={['01101', '99999', '13101']}
            onSave={vi.fn()}
            clearedCodesSet={new Set()}
          />
        );
      });

      expect(document.body.textContent).toContain('1 / 2 選択中');
    });
  });
});
