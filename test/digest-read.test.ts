import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { Night } from '../src/digest/types.js';

const RUNS = fileURLToPath(new URL('../runs', import.meta.url));

function rowsOf(n: Night) {
  if (!n.found) throw new Error(`no file for ${n.night}`);
  return n;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = rowsOf(readNight(RUNS, '2026-10-28'));

  it('has 5 jobs and 1 bad line (the cut-off last line)', () => {
    expect(night.rows).toHaveLength(5);
    expect(night.badLines).toBe(1);
  });

  it('gives one row per job, sorted by job, times as logged', () => {
    expect(night.rows).toEqual([
      { job: 'digest/render', owner: null, runs: 1, retries: 0, fails: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00' },
      { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, fails: 0, lastStatus: 'ok', lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' },
      { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, fails: 0, lastStatus: 'ok', lastError: 'lock held', firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' },
      { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, fails: 1, lastStatus: 'fail', lastError: 'quota exceeded', firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00' },
      { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, fails: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00' },
    ]);
  });
});

describe('readNight on a temp runs dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  const write = (night: string, lines: string[]) => writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('tells "no file" apart from "empty file"', () => {
    write('2026-11-02', []);
    expect(readNight(dir, '2026-11-01')).toEqual({ found: false, night: '2026-11-01' });
    expect(readNight(dir, '2026-11-02')).toEqual({ found: true, night: '2026-11-02', rows: [], badLines: 0 });
  });

  it('treats a night that is not YYYY-MM-DD as no file', () => {
    expect(readNight(dir, '../runs/2026-10-28')).toEqual({ found: false, night: '../runs/2026-10-28' });
  });

  it('counts lines that do not parse, never throws, skips blank lines', () => {
    write('2026-11-03', [
      'not json',
      '[1,2]',
      '{"at":"2026-11-03T01:00:00+01:00","job":"a","status":"maybe","owner":"x"}',
      '{"at":"not a time","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-11-03T01:00:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-11-03T01:00:00+01:00","job":"","status":"ok","owner":"x"}',
      '{"at":"2026-11-03T01:00:00+01:00","job":"a","status":"ok","owner":7}',
      '{"at":"2026-11-03T01:00:00+01:00","job":"a","status":"fail","owner":"x","error":{"code":1}}',
      '',
      '   ',
    ]);
    expect(readNight(dir, '2026-11-03')).toEqual({ found: true, night: '2026-11-03', rows: [], badLines: 8 });
  });

  it('keeps rows with no owner and takes the last owner that was logged', () => {
    write('2026-11-04', [
      '{"at":"2026-11-04T01:00:00+01:00","job":"a","status":"ok","owner":null}',
      '{"at":"2026-11-04T01:00:00+01:00","job":"b","status":"ok"}',
      '{"at":"2026-11-04T01:00:00+01:00","job":"c","status":"ok","owner":"first"}',
      '{"at":"2026-11-04T02:00:00+01:00","job":"c","status":"ok","owner":"second"}',
      '{"at":"2026-11-04T03:00:00+01:00","job":"c","status":"ok","owner":null}',
    ]);
    const { rows } = rowsOf(readNight(dir, '2026-11-04'));
    expect(rows.map((r) => [r.job, r.owner])).toEqual([['a', null], ['b', null], ['c', 'second']]);
  });

  it('orders by instant across offsets but keeps each time as logged', () => {
    write('2026-11-05', [
      '{"at":"2026-11-05T00:30:00+00:00","job":"a","status":"fail","owner":"x","error":"late"}',
      '{"at":"2026-11-05T01:00:00+02:00","job":"a","status":"retry","owner":"x","error":"early"}',
    ]);
    const [row] = rowsOf(readNight(dir, '2026-11-05')).rows;
    expect(row).toMatchObject({
      firstAt: '2026-11-05T01:00:00+02:00',
      lastAt: '2026-11-05T00:30:00+00:00',
      lastStatus: 'fail',
      lastError: 'late',
      retries: 1,
      fails: 1,
    });
  });

  it('strips a leading BOM', () => {
    writeFileSync(join(dir, '2026-11-07.jsonl'), '﻿{"at":"2026-11-07T01:00:00Z","job":"a","status":"ok","owner":"x"}\n');
    expect(rowsOf(readNight(dir, '2026-11-07'))).toMatchObject({ rows: [{ job: 'a', firstAt: '2026-11-07T01:00:00Z' }], badLines: 0 });
  });

  it('reads CRLF files', () => {
    writeFileSync(join(dir, '2026-11-06.jsonl'), '{"at":"2026-11-06T01:00:00+01:00","job":"a","status":"ok","owner":"x"}\r\n');
    expect(rowsOf(readNight(dir, '2026-11-06'))).toMatchObject({ rows: [{ job: 'a', runs: 1 }], badLines: 0 });
  });
});
