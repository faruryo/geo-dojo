// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppShell, useImmersiveLayout } from '@/app/(app)/app-shell';

(globalThis as unknown as Record<string, boolean>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({
  usePathname: () => '/quiz/municipality/d',
}));

function Consumer({ immersive }: Readonly<{ immersive: boolean }>) {
  useImmersiveLayout(immersive);
  return <p>出題中</p>;
}

interface Harness {
  readonly host: HTMLElement;
  readonly root: Root;
  readonly render: (immersive: boolean) => void;
  readonly unmountConsumer: () => void;
}

function mount(): Harness {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  const render = (immersive: boolean) => {
    act(() => {
      root.render(
        <AppShell>
          <Consumer immersive={immersive} />
        </AppShell>,
      );
    });
  };

  const unmountConsumer = () => {
    act(() => {
      root.render(<AppShell>{null}</AppShell>);
    });
  };

  return { host, root, render, unmountConsumer };
}

const hasBottomNav = (host: HTMLElement) => host.querySelector('nav') !== null;
const hasAttribution = (host: HTMLElement) =>
  host.textContent?.includes('国土数値情報') ?? false;

describe('AppShell のフルスクリーン枠', () => {
  it('通常時はボトムナビと出典表記の両方を出す', () => {
    const { host, render } = mount();
    render(false);

    expect(hasBottomNav(host)).toBe(true);
    expect(hasAttribution(host)).toBe(true);
  });

  it('出題中はボトムナビと出典表記の両方を消す', () => {
    const { host, render } = mount();
    render(true);

    expect(hasBottomNav(host)).toBe(false);
    expect(hasAttribution(host)).toBe(false);
  });

  it('出題中は下余白を外しスクロールを殺す', () => {
    const { host, render } = mount();
    render(true);

    const main = host.querySelector('main');
    expect(main?.className).toContain('overflow-hidden');
    expect(main?.className).not.toContain('pb-24');
  });

  it('通常時は下余白を残しスクロールできる', () => {
    const { host, render } = mount();
    render(false);

    const main = host.querySelector('main');
    expect(main?.className).toContain('overflow-y-auto');
    expect(main?.className).toContain('pb-24');
  });

  it('出題側が unmount したら枠が復帰する（中断・完了・エラー境界のどれで抜けても戻す）', () => {
    const { host, render, unmountConsumer } = mount();
    render(true);
    expect(hasBottomNav(host)).toBe(false);

    unmountConsumer();

    expect(hasBottomNav(host)).toBe(true);
    expect(hasAttribution(host)).toBe(true);
  });

  it('出題側が false へ切り替えたら枠が復帰する', () => {
    const { host, render } = mount();
    render(true);
    expect(hasBottomNav(host)).toBe(false);

    render(false);

    expect(hasBottomNav(host)).toBe(true);
  });
});
