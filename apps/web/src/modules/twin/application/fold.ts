import type { Signal, DerivedTwin, TwinFact, ConfidenceBasis } from '../domain/types';

// Each mapper returns true if it wrote a fact, false if the payload was malformed.
type KindMapper = (signal: Signal, derived: DerivedTwin) => boolean;

const KIND_MAPPERS: Record<string, KindMapper> = {
  desired_role: (signal, derived) => {
    const role = signal.payload['role'] as string | undefined;
    if (!role) return false;
    derived.aspiration['targetRole'] = {
      value: role,
      confidence: { value: 0.9, basis: 'stated' },
      source: signal.id,
      capturedAt: signal.occurredAt,
    };
    return true;
  },

  current_role: (signal, derived) => {
    const role = signal.payload['role'] as string | undefined;
    if (!role) return false;
    derived.identity['currentRole'] = {
      value: role,
      confidence: { value: 0.9, basis: 'stated' },
      source: signal.id,
      capturedAt: signal.occurredAt,
    };
    return true;
  },

  gap_item: (signal, derived) => {
    const skill = signal.payload['skill'] as string | undefined;
    if (!skill) return false;
    const have = (signal.payload['have'] as boolean) ?? false;
    const rawConf = signal.payload['confidence'] as { value: number; basis: string } | undefined;
    derived.capability.gaps[skill] = {
      value: { skill, have },
      confidence: rawConf
        ? { value: rawConf.value, basis: rawConf.basis as ConfidenceBasis }
        : { value: 0.5, basis: 'inferred' },
      source: signal.id,
      capturedAt: signal.occurredAt,
    };
    return true;
  },
};

export interface FoldResult {
  derived: DerivedTwin;
  // Signal ids that were accepted into the log but contributed nothing to the Twin
  // (absent or unrecognised payload.fact, or malformed required fields).
  unmappedSignalIds: string[];
}

export function foldSignals(signals: Signal[]): FoldResult {
  // Ascending by occurredAt — last write wins implicitly.
  const sorted = [...signals].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  const derived: DerivedTwin = {
    schemaVersion: 'twin/v1',
    identity: {},
    capability: { gaps: {} },
    aspiration: {},
    constraints: {},
    growth: {},
  };

  const unmappedSignalIds: string[] = [];

  for (const signal of sorted) {
    const factKind = signal.payload['fact'] as string | undefined;
    if (!factKind) {
      unmappedSignalIds.push(signal.id);
      continue;
    }
    const mapper = KIND_MAPPERS[factKind];
    if (!mapper) {
      unmappedSignalIds.push(signal.id);
      continue;
    }
    const applied = mapper(signal, derived);
    if (!applied) unmappedSignalIds.push(signal.id);
  }

  return { derived, unmappedSignalIds };
}

// Resolves a dotted path (e.g. "aspiration.targetRole", "capability.gaps.Figma")
// against a DerivedTwin. Returns the TwinFact if the path terminates at one,
// or null if the path doesn't exist or doesn't point to a TwinFact.
export function explainPath(twin: DerivedTwin, path: string): TwinFact | null {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = twin;
  for (const part of parts) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return null;
    cursor = cursor[part];
  }
  if (
    cursor !== null &&
    cursor !== undefined &&
    typeof cursor === 'object' &&
    'value' in cursor &&
    'source' in cursor &&
    'capturedAt' in cursor
  ) {
    return cursor as TwinFact;
  }
  return null;
}
