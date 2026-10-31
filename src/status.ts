import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// counts is null when the night's file can't be read (e.g. gone since the listing): shown as —.
export type NightSummary = { night: string; counts: { ok: number; retry: number; fail: number } | null };

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Counts come from the reader's rows, never from re-parsing the file. Every logged line has exactly
// one status, so ok = runs - retries - fails, summed over jobs. A night with bad lines still counts
// its good lines.
export function summarizeNight(runsDir: string, night: string): NightSummary {
  const n = readNight(runsDir, night);
  if (!n.found) return { night, counts: null };
  let ok = 0;
  let retry = 0;
  let fail = 0;
  for (const r of n.rows) {
    ok += r.runs - r.retries - r.fails;
    retry += r.retries;
    fail += r.fails;
  }
  return { night, counts: { ok, retry, fail } };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarizeNight(config.runsDir, n)),
  };
}
