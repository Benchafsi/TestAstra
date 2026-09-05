/** Continuous scroll path: golden hour remains above the far mountain skyline. */
export function sunElevation(progress: number): number {
  const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  if (progress <= .58) return .42 + (.095 - .42) * smooth(0, .58, progress);
  if (progress <= .80) return .095 + (.042 - .095) * smooth(.58, .80, progress);
  return .042 + (-.14 - .042) * smooth(.80, 1, progress);
}
