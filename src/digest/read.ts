import { readFileSync } from 'node:fs';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

const STATUSES: readonly DigestStatus[] = ['ok', 'retry', 'fail'];

type ParsedLine = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isDigestStatus(value: unknown): value is DigestStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

function parseLine(raw: string): ParsedLine | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (typeof record.at !== 'string' || typeof record.job !== 'string') return null;
  if (!isDigestStatus(record.status)) return null;
  if (record.owner !== null && typeof record.owner !== 'string') return null;
  if ('error' in record && typeof record.error !== 'string') return null;

  const line: ParsedLine = {
    at: record.at,
    job: record.job,
    status: record.status,
    owner: record.owner,
  };
  if (typeof record.error === 'string') line.error = record.error;
  return line;
}

export function readNight(runsDir: string, night: string): NightDigest {
  const text = readFileSync(`${runsDir}/${night}.jsonl`, 'utf8');
  if (text === '') return { night, rows: [], badLines: 0 };

  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();

  let badLines = 0;
  const byJob = new Map<string, ParsedLine[]>();

  for (const raw of lines) {
    const parsed = parseLine(raw);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    const group = byJob.get(parsed.job);
    if (group) group.push(parsed);
    else byJob.set(parsed.job, [parsed]);
  }

  const rows: DigestRow[] = [];
  for (const [job, group] of byJob) {
    const first = group[0];
    const last = group[group.length - 1];
    if (!first || !last) continue;
    let retries = 0;
    for (const line of group) {
      if (line.status === 'retry') retries += 1;
    }
    rows.push({
      job,
      owner: last.owner,
      runs: group.length,
      retries,
      lastStatus: last.status,
      lastError: last.error ?? null,
      firstAt: first.at,
      lastAt: last.at,
    });
  }

  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
}
