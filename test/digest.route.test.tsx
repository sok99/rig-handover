import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { NightDigest } from '../src/digest/types.js';

function tempConfig(): RigConfig {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-route-'));
  return {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
}

function writeNight(runsDir: string, night: string, body: string) {
  writeFileSync(join(runsDir, `${night}.jsonl`), body);
}

function jobCells(html: string): string[] {
  const jobs: string[] = [];
  for (const row of html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)) {
    const cell = /<td>([^<]*)<\/td>/.exec(row[0]);
    if (cell?.[1] !== undefined) jobs.push(cell[1]);
  }
  return jobs;
}

describe('digest routes', () => {
  it('returns the jobs sorted by job for the page and the JSON', async () => {
    const config = tempConfig();
    const night = '2026-11-01';
    writeNight(
      config.runsDir,
      night,
      [
        JSON.stringify({
          at: '2026-11-01T02:00:00+01:00',
          job: 'zeta/pack',
          status: 'ok',
          owner: 'rook',
        }),
        JSON.stringify({
          at: '2026-11-01T01:00:00+01:00',
          job: 'alpha/sync',
          status: 'retry',
          owner: 'lane-07',
        }),
        '',
      ].join('\n'),
    );

    const app = createApp(config);
    const page = await app.request(`/digest/${night}`);
    const jsonRes = await app.request(`/api/digest/${night}`);
    const html = await page.text();
    const digest = (await jsonRes.json()) as NightDigest;
    const jobs = digest.rows.map((row) => row.job);

    expect(page.status).toBe(200);
    expect(jsonRes.status).toBe(200);
    expect(jobs).toEqual(['alpha/sync', 'zeta/pack']);
    expect(jobCells(html)).toEqual(jobs);
    expect(digest.rows.find((row) => row.job === 'alpha/sync')?.retries).toBe(1);
  });

  it('returns 404 when the night file is missing', async () => {
    const app = createApp(tempConfig());

    expect((await app.request('/digest/1999-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/1999-01-01')).status).toBe(404);
  });

  it('renders nothing ran for an empty night file', async () => {
    const config = tempConfig();
    const night = '2026-11-02';
    writeNight(config.runsDir, night, '');

    const app = createApp(config);
    const page = await app.request(`/digest/${night}`);
    const jsonRes = await app.request(`/api/digest/${night}`);
    const html = await page.text();
    const digest = (await jsonRes.json()) as NightDigest;

    expect(page.status).toBe(200);
    expect(jsonRes.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
    expect(digest.rows).toEqual([]);
    expect(digest.badLines).toBe(0);
    expect(jobCells(html)).toEqual(digest.rows.map((row) => row.job));
  });

  it('keeps the good job when a line is not valid JSON', async () => {
    const config = tempConfig();
    const night = '2026-11-03';
    writeNight(
      config.runsDir,
      night,
      '{"at":"2026-10-29T05:41:09+01:00","job":"digest/render","status":"ok","owner":null}\nnot json\n',
    );

    const app = createApp(config);
    const page = await app.request(`/digest/${night}`);
    const jsonRes = await app.request(`/api/digest/${night}`);
    const html = await page.text();
    const digest = (await jsonRes.json()) as NightDigest;
    const jobs = digest.rows.map((row) => row.job);

    expect(page.status).toBe(200);
    expect(jsonRes.status).toBe(200);
    expect(html).toContain('digest/render');
    expect(digest.badLines).toBe(1);
    expect(jobs).toEqual(['digest/render']);
    expect(jobCells(html)).toEqual(jobs);
  });
});
