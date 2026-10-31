import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = (runsDir: string) => ({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

describe('GET /digest/:night', () => {
  it('renders the 2026-10-28 fixture in the layout', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config('runs')).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html.match(/<tr><td>/g)).toHaveLength(5);
    expect(html).toContain('<strong class="warn">fixtures/refresh</strong>');
    expect(html).toContain('<strong class="warn">notes/backup</strong>');
    expect(html).toMatch(/digest\/render<\/td><td><span class="mute">—<\/span>/);
    expect(html).toContain('2026-10-29T05:41:09+01:00');
    expect(html).toContain("1 line in the log didn&#39;t parse");
  });

  it('answers 404 for a night with no file, and for a malformed night', async () => {
    const app = createApp(config('runs'));
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
    expect((await app.request('/digest/..%2Fpackage')).status).toBe(404);
  });

  it('renders "nothing ran" for an empty file in the configured runs dir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-11-01.jsonl'), '');
    const res = await createApp(config(dir)).request('/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders the good rows and the bad-line notice for a temp night with a bad line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    const good = JSON.stringify({ job: 'a/job', status: 'ok', at: '2026-11-02T01:00:00+01:00' });
    writeFileSync(join(dir, '2026-11-02.jsonl'), `${good}
not json at all
`);
    const res = await createApp(config(dir)).request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain("1 line in the log didn&#39;t parse");
  });
});
