const round2 = (n: number) => Math.round(n * 100) / 100;

export function cadBudget(rows: { peso_kg?: number }[], max: number): { used: number; remaining: number } {
  const sum = rows.reduce((acc, r) => acc + (r.peso_kg ?? 0), 0);
  return { used: round2(sum), remaining: round2(max - sum) };
}
