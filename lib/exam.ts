/** Pure timing logic. The SERVER calls this with the SERVER clock. */
export type TimingCfg = { section_count: number; section_seconds: number };

export type Timing =
  | { finished: true; elapsed: number; total: number }
  | { finished: false; elapsed: number; total: number; section: number; sectionEndsAtMs: number; examEndsAtMs: number };

export function computeTiming(startedAtMs: number, nowMs: number, cfg: TimingCfg): Timing {
  const total = cfg.section_count * cfg.section_seconds;
  const elapsed = Math.max(0, (nowMs - startedAtMs) / 1000);
  if (elapsed >= total) return { finished: true, elapsed, total };
  // 0-899s -> section 1, 900-1799s -> section 2, ...
  const section = Math.floor(elapsed / cfg.section_seconds) + 1;
  return {
    finished: false, elapsed, total, section,
    sectionEndsAtMs: startedAtMs + section * cfg.section_seconds * 1000,
    examEndsAtMs: startedAtMs + total * 1000,
  };
}
