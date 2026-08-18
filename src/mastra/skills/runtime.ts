import type {
  AgentSkillsInput,
} from "@mastra/core/skills";

import {
  SPECIALIST_ROLE_SKILLS,
} from "./registry";

import type {
  SpecialistSkillRole,
} from "./registry";


const APPROVED_SKILL_ROOT =
  "./src/mastra/skills/approved";


export function getSpecialistSkillPaths(
  role:
    SpecialistSkillRole,
): string[] {
  return SPECIALIST_ROLE_SKILLS[
    role
  ].map(
    skill =>
      `${APPROVED_SKILL_ROOT}/${skill}`,
  );
}


export function getSpecialistAgentSkills(
  role:
    SpecialistSkillRole,
): AgentSkillsInput {
  return getSpecialistSkillPaths(
    role,
  );
}
