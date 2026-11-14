import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards decisions from the pre-Kutumbh site review (Nov 2026) against regressions in the
// static Career Diya pages and their scripts.

const PUBLIC_DIR = join(__dirname, '..', '..', 'public');
const APP_DIR = join(__dirname, '..', '..', 'app');

function files(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, exts));
    else if (exts.some((e) => name.endsWith(e)) && !name.includes('.test.')) out.push(p);
  }
  return out;
}

const siteFiles = [...files(PUBLIC_DIR, ['.html', '.js']), ...files(APP_DIR, ['.tsx'])];

function offenders(pattern: RegExp): string[] {
  return siteFiles.filter((f) => pattern.test(readFileSync(f, 'utf8'))).map((f) => relative(PUBLIC_DIR, f));
}

describe('site copy guard', () => {
  it('has no links or redirects to Edumilestones (no external assessment for now)', () => {
    expect(offenders(/edumilestones\.com/i)).toEqual([]);
  });

  it('uses the approved group endorsement wording', () => {
    expect(offenders(/Unit of Swakojo Group/)).toEqual([]);
  });

  it('does not show internal engine or build-status wording to users', () => {
    expect(offenders(/is not wired yet|lightweight, deterministic exploration tool|Why it surfaced/)).toEqual([]);
  });
});
