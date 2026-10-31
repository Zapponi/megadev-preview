import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

function appWith(night: string, lines: string[]) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n'));
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
}

describe('GET /api/digest/:night', () => {
  it('returns rows sorted by job, times as logged, missing data as null', async () => {
    const app = appWith('2026-10-28', [
      JSON.stringify({ job: 'b', status: 'ok', at: '2026-10-28T02:00:00+01:00' }),
      JSON.stringify({ job: 'a', status: 'fail', at: '2026-10-28T01:00:00+01:00', error: 'boom' }),
    ]);
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: DigestRow[] };
    expect(body.rows.map((r) => r.job)).toEqual(['a', 'b']);
    expect(body.rows[0]?.firstAt).toBe('2026-10-28T01:00:00+01:00');
    expect(body.rows[1]?.owner).toBeNull();
    expect(body.rows[0]?.fails).toBe(1);
  });

  it('404s for a night with no file', async () => {
    const res = await appWith('2026-10-28', []).request('/api/digest/2026-10-27');
    expect(res.status).toBe(404);
  });

  it('lists the same jobs, in the same order, as the page (2026-10-28)', async () => {
    const app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' });
    const json = (await (await app.request('/api/digest/2026-10-28')).json()) as { rows: DigestRow[] };
    const html = await (await app.request('/digest/2026-10-28')).text();
    const pageJobs = [...html.matchAll(/<tr><td>(?:<strong class="warn">)?([^<]+)/g)].map((m) => m[1]);
    expect(json.rows).toHaveLength(5);
    expect(json.rows.map((r) => r.job)).toEqual(pageJobs);
  });
});

describe('GET /api/digest/:night, empty and bad-line nights', () => {
  it('returns 200 with no rows and no bad lines for an empty file', async () => {
    const res = await appWith('2026-11-01', []).request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-11-01', rows: [], badLines: 0 });
  });

  it('keeps the good rows and counts the bad line', async () => {
    const app = appWith('2026-11-02', [
      JSON.stringify({ job: 'a', status: 'ok', at: '2026-11-02T01:00:00+01:00' }),
      'not json at all',
      JSON.stringify({ job: 'b', status: 'nope', at: '2026-11-02T02:00:00+01:00' }),
    ]);
    const res = await app.request('/api/digest/2026-11-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: DigestRow[]; badLines: number };
    expect(body.badLines).toBe(2);
    expect(body.rows.map((r) => r.job)).toEqual(['a']);
  });
});
