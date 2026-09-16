import type { ActivationSession } from '../domain/types';

export function rowToSession(row: Record<string, unknown>): ActivationSession {
  return {
    id: row['id'] as string,
    currentRole: (row['current_role'] as string | null) ?? null,
    desiredRole: (row['desired_role'] as string | null) ?? null,
    onetCode: (row['onet_code'] as string | null) ?? null,
    gap: (row['gap'] as ActivationSession['gap']) ?? [],
    firstAction: (row['first_action'] as string | null) ?? null,
    journey: (row['journey'] as ActivationSession['journey']) ?? [],
    completedAt: (row['completed_at'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
  };
}
