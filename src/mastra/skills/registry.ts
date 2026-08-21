export type ApprovedSpecialistSkill =
  | "mastra"
  | "copywriting"
  | "copy-editing"
  | "customer-research"
  | "competitor-profiling"
  | "seo-audit"
  | "ai-seo"
  | "generative-engine-optimization"
  | "design-system"
  | "ui-styling"
  | "sales-enablement"
  | "social"
  | "video";


export type SpecialistSkillRole =
  | "DEVELOPER"
  | "RESEARCH_COMPETITOR"
  | "UI_UX_DESIGNER"
  | "COPYWRITER"
  | "SEARCH_VISIBILITY"
  | "CONTENT_CREATOR"
  | "PROPOSAL_SOLUTIONS_CONSULTANT";


export const SPECIALIST_ROLE_SKILLS:
  Record<
    SpecialistSkillRole,
    readonly ApprovedSpecialistSkill[]
  > = {
    DEVELOPER: [
      "mastra",
    ],

    RESEARCH_COMPETITOR: [
      "customer-research",
      "competitor-profiling",
    ],

    UI_UX_DESIGNER: [
      "design-system",
      "ui-styling",
    ],

    COPYWRITER: [
      "copywriting",
      "copy-editing",
    ],

    SEARCH_VISIBILITY: [
      "seo-audit",
      "ai-seo",
    ],

    CONTENT_CREATOR: [
      "social",
      "video",
    ],

    PROPOSAL_SOLUTIONS_CONSULTANT: [
      "sales-enablement",
    ],
  };


export function getSpecialistSkills(
  role:
    SpecialistSkillRole,
): readonly ApprovedSpecialistSkill[] {
  return SPECIALIST_ROLE_SKILLS[
    role
  ];
}
