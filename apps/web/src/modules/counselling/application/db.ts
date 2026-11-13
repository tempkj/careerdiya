import type { SupabaseClient } from '@supabase/supabase-js';

// The generated Database types don't cover the core schema's cd_* tables, so queries go
// through an untyped schema handle and results are cast to the domain types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CoreDb = any;

export function core(supabase: SupabaseClient): CoreDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).schema('core');
}

export const CERTIFICATE_BUCKET = 'cd-certificates';
export const REPORT_BUCKET = 'cd-reports';

/** Columns visitors are allowed to read on cd_counsellor (anon column grant in migration 043). */
export const PUBLIC_COUNSELLOR_COLUMNS =
  'id, user_id, display_name, headline, bio, city, languages, specialisations, session_mode, session_fee_inr, session_minutes, status, verified_at, created_at';
