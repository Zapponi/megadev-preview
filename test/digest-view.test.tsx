import { describe, expect, it } from 'vitest';
import type { DigestRow } from '../src/digest/types.js';
import { DigestPage } from '../src/views/digest.js';

const row = (over: Partial<DigestRow>): DigestRow => ({
  job: 'lane/sync',
  owner: 'rook',
  runs: 1,
  retries: 0,
  lastStatus: 'ok',
  lastError: null,
  firstAt: '2026-10-28T23:00:06+01:00',
  lastAt: '2026-10-28T23:00:06+01:00',
  ...over,
});

const render = async (rows: DigestRow[], badLines = 0) =>
  String(await (<DigestPage night={{ found: true, night: '2026-10-28', rows, badLines }} />).toString());

describe('digest view', () => {
  it('sorts by job, marks 3+ retries and fail, shows MISSING for nulls', async () => {
    const html = await render([
      row({ job: 'notes/backup', owner: 'lane-07', lastStatus: 'fail', lastError: 'quota exceeded' }),
      row({ job: 'digest/render', owner: null }),
      row({ job: 'fixtures/refresh', retries: 3, runs: 4, lastError: 'upstream 503' }),
      row({ job: 'lane/sync', retries: 2 }),
    ]);
    const order = ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup'].map((j) => html.indexOf(j));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain('<strong class="warn">3</strong>');
    expect(html).not.toContain('<strong class="warn">2</strong>');
    expect(html).toContain('<strong class="warn">fail</strong>');
    expect(html).toContain('<span class="mute">—</span>');
    expect(html).not.toMatch(/<td><\/td>/);
  });

  it('keeps times as logged and errors whole', async () => {
    const long = 'x'.repeat(500);
    const html = await render([row({ lastError: long, firstAt: '2026-10-29T01:30:00+01:00' })]);
    expect(html).toContain('2026-10-29T01:30:00+01:00');
    expect(html).toContain(long);
  });

  it('renders "nothing ran" for an empty night and counts bad lines', async () => {
    const html = await render([], 1);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
    expect(html).toContain("1 line in the log didn&#39;t parse");
  });
});
