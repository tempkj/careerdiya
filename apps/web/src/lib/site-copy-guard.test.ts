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

  it('calls the explorer "Career Explorer" everywhere', () => {
    expect(offenders(/>Explore Careers<|'Explore Careers'/)).toEqual([]);
  });

  it('never greets someone by the part of their email before the @', () => {
    expect(offenders(/u\.email\|\|'there'\)\.split\('@'\)/)).toEqual([]);
  });

  it('uses one footer with no single-link "Ecosystem" column', () => {
    expect(offenders(/<b>(Career )?[Ee]cosystem<\/b>/)).toEqual([]);
  });
});

// Home page question cards must map onto answers the explorer understands, or the explorer
// asks "What are you trying to figure out?" a second time.
describe('home page question cards', () => {
  const site = readFileSync(join(PUBLIC_DIR, 'assets', 'site.js'), 'utf8');
  const engine = readFileSync(join(PUBLIC_DIR, 'assets', 'decision-engine.js'), 'utf8');
  const intentKeys = (block: string) => [...block.matchAll(/\['([a-z-]+)','/g)].map((m) => m[1]);
  const engineIntents = (name: string) => {
    const start = engine.indexOf(`const ${name}`);
    const line = engine.slice(start).split('\n').find((l) => l.includes("id:'intent'")) ?? '';
    return intentKeys(line.slice(line.indexOf('options:')));
  };
  const cards = (audience: string) => {
    const start = site.indexOf(`  ${audience}:[`, site.indexOf('const AUDIENCE_INTENTS'));
    return intentKeys(site.slice(start, site.indexOf(']\n  ]', start) + 1)).filter((k) => k !== 'guidance');
  };
  const cases: [string, string][] = [
    ['parent', 'PARENT_QUESTIONS'],
    ['student', 'STUDENT_QUESTIONS'],
    ['professional', 'PROFESSIONAL_QUESTIONS'],
    ['neutral', 'PROFESSIONAL_QUESTIONS'],
  ];
  it.each(cases)('%s cards match the explorer intent answers', (audience, questions) => {
    const keys = cards(audience);
    expect(keys.length).toBe(5);
    for (const k of keys) expect(engineIntents(questions)).toContain(k);
  });
});
