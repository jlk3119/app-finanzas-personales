export function getDefaultBudgetMonth(
  closures: { year: number; month: number }[],
  from: Date,
): { year: number; month: number } {
  let y = from.getFullYear();
  let m = from.getMonth() + 1;
  while (closures.some((c) => c.year === y && c.month === m)) {
    if (m === 12) {
      m = 1;
      y += 1;
    } else {
      m += 1;
    }
  }
  return { year: y, month: m };
}
