// Scratch harness — NOT a test, makes real Anthropic API calls (real spend) against the
// LOCAL Supabase instance. Never picked up by `pnpm test` (see vitest.harness.config.ts).
//
// Run: pnpm exec vitest run --config vitest.harness.config.ts
//
// Prerequisites: local Supabase running (`pnpm db:start`) with migration 025 applied,
// and ANTHROPIC_API_KEY set in .env.local.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { it } from 'vitest';
import {
  computeTransition,
  normalizeRoleKey,
  MockSubstrateGenerator,
  SubstrateStore,
  type SubstratePayloadV1,
} from '@modules/knowledge';
import {
  LiveTaskIdentifier,
  callTaskIdentificationModel,
  validateAndRepairAssessment,
  flattenAssessment,
  bucketGateProfile,
  computeCacheKeyHash,
  TASK_IDENTIFICATION_PROMPT_VERSION,
  IdentificationCacheStore,
  type GateAnswers,
  type CounsellorAssessment,
} from '@modules/blueprint';

// Minimal .env.local loader — avoids depending on the `dotenv` package, which isn't
// resolvable from repo root in this pnpm workspace (only apps/web has it installed).
function loadEnvLocal(): void {
  const path = resolve(__dirname, '../.env.local');
  const content = readFileSync(path, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip inline comments and surrounding quotes, same as dotenv's basic behavior.
    value = value.replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

function getLocalSupabaseCredentials(): { url: string; serviceRoleKey: string } {
  const raw = execSync('supabase status --workdir packages/db', { cwd: resolve(__dirname, '..') }).toString();
  const jsonStart = raw.indexOf('{');
  const parsed = JSON.parse(raw.slice(jsonStart)) as { API_URL: string; SERVICE_ROLE_KEY: string };
  return { url: parsed.API_URL, serviceRoleKey: parsed.SERVICE_ROLE_KEY };
}

// Dev harness only — a standalone script has no per-request user session, so it uses
// service_role directly (no RLS on this table anyway; A5 governs request paths, not
// out-of-band dev tooling). Never do this in application/request code.
function makeHarnessClient(): SupabaseClient {
  const { url, serviceRoleKey } = getLocalSupabaseCredentials();
  return createClient(url, serviceRoleKey);
}

interface TestGap {
  label: string;
  fromRole: string;
  toRole: string;
  gateAnswers: GateAnswers;
  // 'fixture': force the hardcoded MockSubstrateGenerator payload, bypassing the DB.
  // 'seeded': DB-first read via SubstrateStore — exercises the real seed.sql data.
  // 'custom': inline-authored payloads below — for shapes the seed catalog doesn't
  // have (e.g. leveled/senior variants of a role don't exist as separate seeded rows).
  substrateSource: 'fixture' | 'seeded' | 'custom';
  customPayloads?: { from: SubstratePayloadV1; to: SubstratePayloadV1 };
}

// Synthetic "senior data analyst" target — deliberately upskill-heavy (deepens the REAL
// seeded data-analyst skills) plus two genuinely new leadership-scope skills, to stress
// the grow-in-role shape (mostly upskill, minimal netNew) that no seeded pair covers —
// the seed catalog has no leveled/senior variants of any role.
const SENIOR_DATA_ANALYST_FROM: SubstratePayloadV1 = {
  skills: [
    { name: 'SQL querying', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
    { name: 'Excel/Sheets advanced', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'Data visualization (Tableau/Power BI)', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'Descriptive statistics', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'Data cleaning & preparation', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'Business/domain understanding', proficiency: 'working', criticality: 'preferred', basis: 'inferred' },
    { name: 'Python basics for analysis', proficiency: 'awareness', criticality: 'preferred', basis: 'inferred' },
    { name: 'Dashboarding & reporting', proficiency: 'working', criticality: 'differentiating', basis: 'inferred' },
  ],
  market: { demand_signal: 'high', demand_basis: 'AI-inferred, India market, no live signal' },
};
const SENIOR_DATA_ANALYST_TO: SubstratePayloadV1 = {
  skills: [
    { name: 'SQL querying', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
    { name: 'Excel/Sheets advanced', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'Data visualization (Tableau/Power BI)', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
    { name: 'Descriptive statistics', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
    { name: 'Data cleaning & preparation', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'Business/domain understanding', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
    { name: 'Python basics for analysis', proficiency: 'working', criticality: 'preferred', basis: 'inferred' },
    { name: 'Dashboarding & reporting', proficiency: 'expert', criticality: 'differentiating', basis: 'inferred' },
    // Genuinely new — scope/leadership, not a "learn a new function" gap.
    { name: 'Mentoring & reviewing junior analysts’ work', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'Influencing without authority (leadership stakeholder comms)', proficiency: 'working', criticality: 'required', basis: 'inferred' },
  ],
  market: { demand_signal: 'high', demand_basis: 'AI-inferred, India market, no live signal' },
};

const TEST_GAPS: TestGap[] = [
  {
    label: 'GROW-IN-ROLE — data analyst -> senior data analyst (synthetic, upskill-heavy)',
    fromRole: 'data analyst',
    toRole: 'senior data analyst',
    gateAnswers: {
      relevantExperience:
        "I've been a data analyst for 3 years, own our team's core dashboards, and I'm ready to take on more scope and start mentoring the two newer analysts.",
      timeline: '6 months',
    },
    substrateSource: 'custom',
    customPayloads: { from: SENIOR_DATA_ANALYST_FROM, to: SENIOR_DATA_ANALYST_TO },
  },
  {
    label: 'LOW-OVERLAP — digital marketing manager -> software engineer (real seed, near-zero transfer)',
    fromRole: 'digital marketing manager',
    toRole: 'software engineer',
    gateAnswers: {
      relevantExperience:
        "I've run paid and organic campaigns for 5 years, but I have never written production code — I did one intro Python course a while back.",
      timeline: '12 months',
    },
    substrateSource: 'seeded',
  },
  {
    label: 'RETURNER-ISH — business analyst -> data analyst (real seed, rust/recency framing)',
    fromRole: 'business analyst',
    toRole: 'data analyst',
    gateAnswers: {
      relevantExperience:
        'I did business analysis work for 5 years and used SQL regularly, but I have been out of the workforce for the last 2 years and worry my skills are rusty rather than missing.',
      timeline: '3 months',
    },
    substrateSource: 'seeded',
  },
];

// ── Formatting ───────────────────────────────────────────────────────────────────

function printAssessment(assessment: CounsellorAssessment): void {
  console.log('\n─── FRAMING ───────────────────────────────────────────────');
  console.log(assessment.framing);

  for (const group of assessment.taskGroups) {
    console.log(`\n─── GROUP: ${group.title} ───`);
    console.log(`Rationale: ${group.rationale}`);
    for (const task of group.tasks) {
      console.log(`\n  • [${task.taskType ?? 'untyped'}] ${task.title} (${task.skillName})`);
      console.log(`    ${task.description ?? '(no description)'}`);
      console.log(
        `    effort: ${task.effortHours}h | evolveCategory: ${task.evolveCategory} | criticality: ${task.criticality} | targetProficiency: ${task.targetProficiency}`,
      );
      if (task.dependencies.length > 0) console.log(`    depends on: ${task.dependencies.join(', ')}`);
    }
  }

  console.log('\n─── THROUGH-LINE ──────────────────────────────────────────');
  console.log(assessment.throughLine);
}

function printValidationDiff(rawAssessment: unknown, validated: CounsellorAssessment): void {
  const notes: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = rawAssessment as any;
  const rawGroups: unknown[] = Array.isArray(raw?.taskGroups) ? raw.taskGroups : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTasks: any[] = rawGroups.flatMap((g: any) => (Array.isArray(g?.tasks) ? g.tasks : []));
  const validatedTasks = flattenAssessment(validated);
  const validatedBySkill = new Map(validatedTasks.map((t) => [t.skillName?.trim().toLowerCase(), t]));

  for (const rawTask of rawTasks) {
    const skillName = typeof rawTask?.skillName === 'string' ? rawTask.skillName : '(missing skillName)';
    const key = skillName.trim().toLowerCase();
    const final = validatedBySkill.get(key);

    if (!final) {
      notes.push(`DROPPED: "${skillName}" — no matching candidate skill (validate-hard)`);
      continue;
    }
    if (typeof rawTask?.taskType === 'string' && rawTask.taskType !== final.taskType) {
      notes.push(`taskType changed on "${skillName}": ${rawTask.taskType} -> ${final.taskType}`);
    }
    if (typeof rawTask?.criticality === 'string' && rawTask.criticality !== final.criticality) {
      notes.push(`criticality repaired on "${skillName}": ${rawTask.criticality} -> ${final.criticality}`);
    }
  }

  console.log('\n─── VALIDATION NOTES ──────────────────────────────────────');
  console.log(notes.length > 0 ? notes.map((n) => `  - ${n}`).join('\n') : '  (no changes — raw output passed through clean)');
}

// ── Runner ───────────────────────────────────────────────────────────────────────

async function runGap(client: SupabaseClient, gap: TestGap): Promise<void> {
  console.log('\n\n============================================================');
  console.log(gap.label);
  console.log('============================================================');

  const fromRoleKey = normalizeRoleKey(gap.fromRole);
  const toRoleKey = normalizeRoleKey(gap.toRole);

  let fromPayload: SubstratePayloadV1;
  let toPayload: SubstratePayloadV1;
  let basis: 'grounded' | 'inferred';

  if (gap.substrateSource === 'custom') {
    if (!gap.customPayloads) throw new Error(`${gap.label}: substrateSource 'custom' requires customPayloads`);
    fromPayload = gap.customPayloads.from;
    toPayload = gap.customPayloads.to;
    basis = 'inferred';
  } else if (gap.substrateSource === 'fixture') {
    const gen = new MockSubstrateGenerator();
    const [from, to] = await Promise.all([gen.generate(fromRoleKey, 'IN'), gen.generate(toRoleKey, 'IN')]);
    fromPayload = from.payload;
    toPayload = to.payload;
    basis = to.basis;
  } else {
    const store = new SubstrateStore(client, new MockSubstrateGenerator());
    const [from, to] = await Promise.all([store.get(gap.fromRole, 'IN'), store.get(gap.toRole, 'IN')]);
    fromPayload = from.payload;
    toPayload = to.payload;
    basis = to.basis;
  }

  const delta = computeTransition(fromPayload, toPayload, { fromRoleKey, toRoleKey });
  console.log(`Delta: ${delta.netNew.length} netNew, ${delta.upskill.length} upskill, difficulty=${delta.difficulty}`);

  const identifier = new LiveTaskIdentifier(client);
  const bucket = bucketGateProfile(gap.gateAnswers);
  console.log(`Gate bucket: ${JSON.stringify(bucket)}`);
  const keyHash = computeCacheKeyHash(TASK_IDENTIFICATION_PROMPT_VERSION, delta.fromRoleKey, delta.toRoleKey, bucket);

  const cache = new IdentificationCacheStore(client);
  const preExisting = await cache.get(keyHash);

  console.log(`\n>>> First call — expect ${preExisting ? 'a HIT (already cached under this exact key)' : 'a MISS (real API spend)'} <<<`);
  const t0 = Date.now();
  const rawAssessment = await callTaskIdentificationModel(delta, gap.gateAnswers);
  const validated = validateAndRepairAssessment(rawAssessment, delta, basis);
  console.log(`(model call took ${Date.now() - t0}ms)`);

  printAssessment(validated);
  printValidationDiff(rawAssessment, validated);

  // Write to cache ourselves here — we deliberately called callTaskIdentificationModel
  // directly above (not identifier.identify()) so we could print the RAW assessment,
  // which bypasses identify()'s own cache.put(). Without this explicit write, the
  // "second call" below would always be a fresh miss too, not a real hit test (this was
  // exactly the bug in the previous run — every "second call" silently re-generated).
  await cache.put({
    keyHash,
    promptVersion: TASK_IDENTIFICATION_PROMPT_VERSION,
    fromRoleKey: delta.fromRoleKey,
    toRoleKey: delta.toRoleKey,
    gateBucket: bucket,
    assessment: validated,
  });

  // Now the real cache-hit test: identify() recomputes the same key independently and
  // should find the row just written above.
  const t1 = Date.now();
  const flatViaIdentify = await identifier.identify(delta, gap.gateAnswers, basis);
  const elapsed = Date.now() - t1;
  console.log(
    `\n>>> Second call via identify() (expect cache HIT — free, fast) took ${elapsed}ms, ${flatViaIdentify.length} tasks <<<`,
  );
  console.log(
    elapsed < 2000
      ? '  -> cache hit confirmed (fast, no network round trip to Anthropic)'
      : '  -> WARNING: slower than expected for a cache hit — check cache write/read',
  );
}

it('runs the live task-identification harness against local Supabase + real Anthropic calls', async () => {
  const client = makeHarnessClient();
  for (const gap of TEST_GAPS) {
    await runGap(client, gap);
  }
}, 300_000);
