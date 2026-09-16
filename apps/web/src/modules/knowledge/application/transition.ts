import type {
  SubstratePayloadV1,
  SubstrateSkill,
  Proficiency,
  UpskillSkill,
  TransitionDelta,
} from '../domain/types';

const PROFICIENCY_RANK: Record<Proficiency, number> = {
  awareness: 0,
  working:   1,
  expert:    2,
};

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

export function computeTransition(
  from: SubstratePayloadV1,
  to: SubstratePayloadV1,
  meta: { fromRoleKey: string; toRoleKey: string },
): TransitionDelta {
  // Index from-skills by normalized name for O(1) lookup
  const fromByName = new Map<string, SubstrateSkill>();
  for (const skill of from.skills) {
    fromByName.set(normalizeSkillName(skill.name), skill);
  }

  const transferable: SubstrateSkill[] = [];
  const upskill: UpskillSkill[] = [];
  const netNew: SubstrateSkill[] = [];

  // Partition to-skills into transferable / upskill / netNew
  for (const toSkill of to.skills) {
    const fromSkill = fromByName.get(normalizeSkillName(toSkill.name));
    if (!fromSkill) {
      netNew.push(toSkill);
      continue;
    }
    const fromRank = PROFICIENCY_RANK[fromSkill.proficiency];
    const toRank   = PROFICIENCY_RANK[toSkill.proficiency];
    if (fromRank >= toRank) {
      transferable.push(toSkill);
    } else {
      upskill.push({ ...toSkill, currentProficiency: fromSkill.proficiency });
    }
  }

  // Index to-skills for retained calculation
  const toNames = new Set(to.skills.map((s) => normalizeSkillName(s.name)));
  const retained: SubstrateSkill[] = from.skills.filter(
    (s) => !toNames.has(normalizeSkillName(s.name)),
  );

  // Difficulty: required netNew + required upskill
  const requiredWork =
    netNew.filter((s) => s.criticality === 'required').length +
    upskill.filter((s) => s.criticality === 'required').length;

  const difficulty: TransitionDelta['difficulty'] =
    requiredWork <= 1 ? 'low' : requiredWork <= 3 ? 'moderate' : 'high';

  return {
    fromRoleKey: meta.fromRoleKey,
    toRoleKey:   meta.toRoleKey,
    transferable,
    upskill,
    netNew,
    retained,
    difficulty,
    computedAt:  new Date().toISOString(),
  };
}
