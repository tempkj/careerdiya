import { createClient } from '@/lib/supabase/server';
import { insertSignal, deriveTwin, listSignals } from '@modules/twin';
import type { SignalSource } from '@modules/twin';
import { Unauthorized, UnprocessableEntity, InternalError } from '@/lib/api-error';

const VALID_SOURCES: SignalSource[] = [
  'conversation',
  'reflection',
  'task_completion',
  'outcome',
  'system',
];

function inferSignificance(payload: Record<string, unknown>): 'minor' | 'major' {
  const fact = payload['fact'] as string | undefined;
  return fact === 'desired_role' || fact === 'current_role' ? 'major' : 'minor';
}

export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();

  let body: { source?: string; sourceRef?: string | null; payload?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  if (!body.source || !body.payload || typeof body.payload !== 'object') {
    return UnprocessableEntity('source and payload are required.');
  }
  if (!VALID_SOURCES.includes(body.source as SignalSource)) {
    return UnprocessableEntity(`source must be one of: ${VALID_SOURCES.join(', ')}.`);
  }

  try {
    const significance = inferSignificance(body.payload);

    const signal = await insertSignal(supabase, user.id, {
      source: body.source as SignalSource,
      significance,
      payload: body.payload,
      sourceRef: body.sourceRef ?? null,
    });

    // Synchronous recompute. No jobId returned — user-scoped client cannot INSERT
    // core.job (migration 017 restricted it to SELECT-only). See backlog.
    await deriveTwin(supabase, user.id);

    return Response.json(
      { signalId: signal.id, accepted: true, significance, regenerated: false },
      { status: 202, headers: { Location: '/api/v1/twin' } },
    );
  } catch {
    return InternalError();
  }
}

export async function GET(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get('limit');
  const significance = url.searchParams.get('significance') ?? undefined;
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10)) : 50;

  try {
    const page = await listSignals(supabase, user.id, { limit, significance });
    return Response.json(page);
  } catch {
    return InternalError();
  }
}
