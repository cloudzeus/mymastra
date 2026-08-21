export * from "./types";

export {
  validateSpecialistArtifact,
  validateUXDesignArtifact,
  validateCreativeContentArtifact,
  validateCustomerProposalArtifact,
} from "./validator";

export type {
  SpecialistArtifactValidation,
} from "./validator";

export type {
  PersistedSpecialistArtifact,
  CreateSpecialistArtifactInput,
} from "./artifact-manager";

export {
  createSpecialistArtifact,
  getSpecialistArtifact,
  getLatestOpportunityArtifact,
  getLatestProjectArtifact,
  listOpportunityArtifacts,
  listProjectArtifacts,
} from "./artifact-manager";
