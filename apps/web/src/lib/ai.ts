import Anthropic from '@anthropic-ai/sdk';

// Haiku for dev (~5-25x cheaper than Sonnet). Switch to Sonnet/Opus in production via
// AI_DEFAULT_MODEL in your secrets manager — do not hardcode a tier here. (ADR-003)
export const AI_MODEL = process.env.AI_DEFAULT_MODEL ?? 'claude-haiku-4-5-20251001';

// Task identification (packages/prompts/task-identification/v1.md) is deliberately NOT
// on the shared AI_MODEL default: it's the counsellor prompt's creative core, worth the
// best model even in dev while tuning it. A dedicated var (not AI_DEFAULT_MODEL) so
// dev-testing quality here is never silently downgraded by a change meant for the rest
// of the app's dev-cost default.
export const AI_TASK_IDENTIFICATION_MODEL = process.env.AI_TASK_IDENTIFICATION_MODEL ?? 'claude-opus-4-8';

// 'mock': deterministic fixtures, no network call, $0. Default in any non-production env.
// 'live': calls the real model. Set AI_MODE=live for real-API testing against dev.
export const AI_MODE: 'mock' | 'live' =
  (process.env.AI_MODE as 'mock' | 'live' | undefined) ??
  (process.env.NODE_ENV === 'production' ? 'live' : 'mock');

// Instantiated lazily so env vars are resolved at call time, not module-load time.
let _client: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
