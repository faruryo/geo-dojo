// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TopHud } from '@/components/quiz/hud/top-hud';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let aborts = 0;

function render() {
  act(() => {
    root.render(
      <TopHud currentIndex={2} totalQuestions={10} onAbort={() => { aborts += 1; }} />,
    );
  });
}

function clickByText(text: string) {
  const target = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(target, `「${text}」のボタンが見つからない`).toBeTruthy();
  act(() => {
    target?.click();
  });
}

const dialogText = () => document.body.textContent ?? '';

beforeEach(() => {
  aborts = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('中断の確認', () => {
  it('中断を押しただけでは中断しない（確認を1段挟む）', () => {
    render();

    clickByText('中断');

    expect(aborts).toBe(0);
  });

  it('確認で「中断する」を選んだときだけ中断する', () => {
    render();
    clickByText('中断');

    clickByText('中断する');

    expect(aborts).toBe(1);
  });

  it('「続ける」を選んだら中断せず確認を閉じる', () => {
    render();
    clickByText('中断');
    expect(dialogText()).toContain('記録されません');

    clickByText('続ける');

    expect(aborts).toBe(0);
    expect(dialogText()).not.toContain('記録されません');
  });

  it('中断のタップ領域を 44px 以上取る', () => {
    render();

    const trigger = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '中断',
    );
    expect(trigger?.className).toContain('h-11');
    expect(trigger?.className).toContain('min-w-11');
  });
});
