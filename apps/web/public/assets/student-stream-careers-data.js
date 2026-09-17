/* Career Diya student stream/major -> careers dataset (ADR-CAREERDIY-0016)
 * Two tiers, gated by the wizard's existing `stage` answer:
 *   - school_stream: for stage === 'late_school' (11th/12th)
 *   - ug_major:      for stage === 'college' | 'recent_grad'
 * careerIds reference apps/web/public/assets/career-mapping.js's CAREER_LIBRARY_CATALOGUE
 * ids where possible, resolved through the already-shipped canonicalCareerById() — never
 * re-authored here. A handful of categories below are populated as working examples;
 * the rest are deliberate content stubs (empty careerIds) for real content to replace.
 *
 * An empty careerIds array is NOT a dead end: decision-engine.js treats a selected
 * stream/major with zero careers the same as "not listed" and routes to the edge guide
 * (POST /api/v1/career-diya/guide) instead of rendering a blank list. This is deliberate
 * so partial content rollout never produces an empty screen.
 */
const STUDENT_STREAM_CAREERS = {
  school_stream: {
    science_pcm: {
      label: 'Science (Physics, Chemistry, Maths)',
      careerIds: ['software_engineering', 'mechanical_engineering', 'electrical_engineering', 'data_science', 'aerospace_engineering'],
    },
    science_pcb: {
      label: 'Science (Physics, Chemistry, Biology)',
      careerIds: ['veterinary_science', 'pharmacology', 'nutrition_and_dietetics', 'biotechnology_research', 'physiotherapy'],
    },
    commerce: {
      label: 'Commerce',
      careerIds: ['chartered_accountancy', 'investment_banking', 'financial_analysis', 'business_management', 'company_secretaryship'],
    },
    arts_humanities: {
      label: 'Arts / Humanities',
      careerIds: [], // stub — content to follow
    },
    vocational: {
      label: 'Vocational / Skill-based',
      careerIds: [], // stub — content to follow
    },
  },
  ug_major: {
    computer_science: {
      label: 'Computer Science / IT',
      careerIds: ['software_engineering', 'full_stack_development', 'data_science', 'machine_learning_engineer', 'cyber_security', 'mobile_application_development'],
    },
    commerce_business: {
      label: 'Commerce / Business / Management',
      careerIds: ['chartered_accountancy', 'investment_banking', 'business_management', 'financial_analysis', 'product_management'],
    },
    design_creative: {
      label: 'Design / Creative / Media',
      careerIds: ['graphic_design', 'fashion_design', 'animation', 'interior_design', 'user_experience_design_ux'],
    },
    law: {
      label: 'Law',
      careerIds: ['law', 'law_enforcement_studies'],
    },
    economics_finance: {
      label: 'Economics / Finance',
      careerIds: ['financial_analysis', 'investment_advisory', 'actuarial_science', 'risk_management'],
    },
    engineering_other: {
      label: 'Engineering (non-CS)',
      careerIds: [], // stub — content to follow
    },
    biology_health: {
      label: 'Biology / Life Sciences / Health',
      careerIds: [], // stub — content to follow
    },
    arts_humanities_ug: {
      label: 'Arts / Humanities / Social Sciences',
      careerIds: [], // stub — content to follow
    },
  },
};

// tier: 'school_stream' | 'ug_major'. Returns null for an unknown tier (never for an
// unknown key within a known tier — callers check key presence via streamOptionsFor).
function streamOptionsFor(tier) {
  const group = STUDENT_STREAM_CAREERS[tier];
  if (!group) return null;
  return Object.entries(group).map(([key, entry]) => ({ key, label: entry.label }));
}

// Returns null for an unknown tier/key. Returns { key, label, careerIds: [] } for a known
// but not-yet-content-filled entry — callers treat an empty careerIds the same as "not
// listed" (see file header), so this is a safe, non-dead-end value either way.
function streamCareersFor(tier, key) {
  const entry = STUDENT_STREAM_CAREERS[tier] && STUDENT_STREAM_CAREERS[tier][key];
  return entry ? { key, label: entry.label, careerIds: entry.careerIds } : null;
}
