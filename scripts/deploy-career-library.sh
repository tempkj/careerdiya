#!/usr/bin/env bash
set -euo pipefail
PROJECT_REF="${SUPABASE_PROJECT_REF:-kvhovrtaaoecnicdpsgm}"
supabase link --project-ref "$PROJECT_REF"
supabase functions deploy career-library --use-api
supabase functions deploy career-library-video --use-api
supabase functions list
