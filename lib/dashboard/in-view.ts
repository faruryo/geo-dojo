export function shouldRevealFromEntries(
  entries: ReadonlyArray<{ isIntersecting: boolean }>,
): boolean {
  return entries.some((entry) => entry.isIntersecting);
}
