import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

// One line of runs/<night>.jsonl, after parsing at the edge.
type LogLine = {
  at: string;
  ms: number; // `at` as an instant, only for ordering; `at` itself is what gets kept
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
// An `at` must carry its offset: without one, Date.parse would read it as local time.
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

function isStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && STATUSES.includes(v);
}

// null = the line doesn't parse. A missing `owner` counts as null; a wrong type doesn't parse.
export function parseLine(text: string): LogLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || !AT.test(o.at) || typeof o.job !== 'string' || o.job === '') return null;
  const ms = Date.parse(o.at);
  if (Number.isNaN(ms) || !isStatus(o.status)) return null;
  const owner = o.owner ?? null;
  if (owner !== null && typeof owner !== 'string') return null;
  const error = o.error ?? null;
  if (error !== null && typeof error !== 'string') return null;
  return { at: o.at, ms, job: o.job, status: o.status, owner, error };
}

// Lines in file order. Walked in time order; the sort is stable, so ties keep file order.
function toRow(lines: LogLine[]): DigestRow {
  const timed = [...lines].sort((a, b) => a.ms - b.ms);
  const first = timed[0]!;
  const last = timed[timed.length - 1]!;
  let owner: string | null = null;
  let lastError: string | null = null;
  let retries = 0;
  let fails = 0;
  for (const l of timed) {
    if (l.owner !== null) owner = l.owner;
    // An ok line clears it: a recovered job's earlier errors are not current.
    lastError = l.status === 'ok' ? null : (l.error ?? lastError);
    if (l.status === 'retry') retries++;
    if (l.status === 'fail') fails++;
  }
  return {
    job: first.job,
    owner,
    runs: lines.length,
    retries,
    fails,
    lastStatus: last.status,
    lastError,
    firstAt: first.at,
    lastAt: last.at,
  };
}

export const readNight: ReadNight = (runsDir, night): Night => {
  if (!NIGHT.test(night)) return { found: false, night };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8').replace(/^﻿/, '');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { found: false, night };
    throw e;
  }
  const byJob = new Map<string, LogLine[]>();
  let badLines = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) {
      badLines++;
      continue;
    }
    const list = byJob.get(line.job);
    if (list) list.push(line);
    else byJob.set(line.job, [line]);
  }
  const rows = [...byJob.values()].map(toRow).sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { found: true, night, rows, badLines };
};
