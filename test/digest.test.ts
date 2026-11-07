import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

describe('readNight', () => {
  it('reads the 2026-10-28 fixture', () => {
    const digest = readNight('runs', '2026-10-28');

    expect(digest.night).toBe('2026-10-28');
    expect(digest.badLines).toBe(1);
    expect(digest.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest.rows).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
    ]);
  });

  it('returns an empty digest for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');

    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('counts one good line and one bad line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(
      join(dir, '2026-01-02.jsonl'),
      '{"at":"2026-10-29T05:41:09+01:00","job":"digest/render","status":"ok","owner":null}\nnot json\n',
    );

    const digest = readNight(dir, '2026-01-02');
    expect(digest.badLines).toBe(1);
    expect(digest.rows).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
    ]);
  });

  it('throws ENOENT when the night file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));

    expect(() => readNight(dir, '1999-01-01')).toThrow(
      expect.objectContaining({ code: 'ENOENT' }),
    );
  });
});
