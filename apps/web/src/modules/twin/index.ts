// Public surface of the 'twin' module. Other modules import ONLY from here (invariant A1).
export type {
  Signal,
  SignalInput,
  SignalSource,
  SignalSignificance,
  ConfidenceBasis,
  TwinFact,
  DerivedTwin,
  TwinContext,
} from './domain/types';
export { insertSignal } from './application/signals';
export { deriveTwin } from './application/derive';
export { getTwin, explainTwinFact, listSignals } from './application/get';
export type { TwinFactExplanation, SignalListPage } from './application/get';
export { foldSignals, explainPath } from './application/fold';
export type { FoldResult } from './application/fold';
