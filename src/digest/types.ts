// Plan morning-digest § 1. The contract between the run log reader (src/digest/read.ts) and
// everything in § 2 (page, JSON, board link, route tests). § 2 builds against this file only.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's log. Times are the `at` strings exactly as logged: the offset is
// kept, never converted to UTC. Missing data stays `null` here (and in the JSON, § 2b); the views
// render it as MISSING (§ 2a, 2c). A row is never dropped for missing data.
export type DigestRow = {
  job: string;
  owner: string | null; // the last non-null owner logged for the job; null if none was
  runs: number; // lines logged for the job, every status
  retries: number; // lines with status `retry`
  fails: number; // lines with status `fail`
  lastStatus: RunStatus; // status of the job's latest line
  // The latest `error` logged since the job's last `ok` line. null when the job ended `ok`
  // (a recovered job's old error is not a current one) or when nothing since then had an error.
  lastError: string | null;
  firstAt: string; // earliest `at`
  lastAt: string; // latest `at`
};

// What readNight returns. The two cases § 2 must tell apart:
// - no file for the night (or a night that isn't YYYY-MM-DD): `found: false` → 404
// - an empty file, or one with no line that parses: `found: true`, `rows: []` → "nothing ran"
export type Night =
  | { found: false; night: string }
  | {
      found: true;
      night: string;
      rows: DigestRow[]; // sorted by job (code-unit order), so page and JSON agree
      badLines: number; // non-blank lines that didn't parse; counted, never thrown
    };

// readNight(runsDir, night) reads `<runsDir>/<night>.jsonl`. Implemented in src/digest/read.ts.
export type ReadNight = (runsDir: string, night: string) => Night;

export const MISSING = '—';
