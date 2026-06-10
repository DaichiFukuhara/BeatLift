// Epley 式による推定1RM。reps が 1 のときは weight をそのまま返す
export function estimate1RM(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
