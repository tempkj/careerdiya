export type SignalSource = 'conversation' | 'reflection' | 'task_completion' | 'outcome' | 'system';
export type SignalSignificance = 'minor' | 'major';
export type ConfidenceBasis = 'grounded' | 'inferred' | 'stated';

export interface SignalInput {
  source: SignalSource;
  significance: SignalSignificance;
  payload: Record<string, unknown>;
  sourceRef?: string | null;
}

export interface Signal {
  id: string;
  userId: string;
  source: SignalSource;
  significance: SignalSignificance;
  payload: Record<string, unknown>;
  applied: boolean;
  occurredAt: string;
}

export interface TwinFact {
  value: unknown;
  confidence: { value: number; basis: ConfidenceBasis };
  source: string;      // owning signal id
  capturedAt: string;  // signal.occurredAt
}

// The shape stored in core.twin.twin (JSONB). Must pass the pg_jsonschema CHECK.
export interface DerivedTwin {
  schemaVersion: 'twin/v1';
  identity: Record<string, TwinFact>;
  capability: { gaps: Record<string, TwinFact> };
  aspiration: Record<string, TwinFact>;
  constraints: Record<string, TwinFact>;
  growth: Record<string, TwinFact>;
}

// API read view: DerivedTwin + DB metadata columns.
export interface TwinContext extends DerivedTwin {
  version: number;
  updatedAt: string;
}
