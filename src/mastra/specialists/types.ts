import type {
  SemanticEvidence,
} from "../softone/semantic-types";


export type SpecialistRole =
  | "RESEARCH_COMPETITOR"
  | "UI_UX_DESIGNER"
  | "COPYWRITER"
  | "SEARCH_VISIBILITY"
  | "VIDEO_CONTENT_CREATOR"
  | "PROPOSAL_SOLUTIONS_CONSULTANT";


export type SpecialistArtifactStatus =
  | "DRAFT"
  | "PARTIAL"
  | "READY"
  | "BLOCKED";


export type SpecialistArtifactType =
  | "RESEARCH_PACKAGE"
  | "UX_DESIGN_PACKAGE"
  | "COPY_PACKAGE"
  | "SEARCH_VISIBILITY_PACKAGE"
  | "VIDEO_CONTENT_PACKAGE"
  | "CUSTOMER_PROPOSAL_PACKAGE";


export type SpecialistFinding = {
  id: string;

  statement: string;

  evidence:
    SemanticEvidence;

  sourceIds:
    string[];

  impact?:
    "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";

  notes?: string[];
};


export type SpecialistRecommendation = {
  id: string;

  statement: string;

  rationale: string;

  evidence:
    SemanticEvidence;

  sourceIds:
    string[];

  priority:
    "LOW"
    | "MEDIUM"
    | "HIGH";

  required:
    boolean;
};


export type SpecialistUnresolvedItem = {
  id: string;

  description: string;

  requiredForCompletion:
    boolean;

  resolutionRequired: string;

  sourceIds:
    string[];
};


export type SpecialistBlocker = {
  id: string;

  description: string;

  resolutionRequired: string;

  sourceIds:
    string[];
};


export type SpecialistProvenance = {
  sourceId: string;

  sourceType:
    | "USER_REQUIREMENT"
    | "PROJECT_DEFINITION"
    | "SPECIALIST_ARTIFACT"
    | "WEB_RESEARCH"
    | "COMPETITOR_SOURCE"
    | "ANALYTICS"
    | "SEO_DATA"
    | "USER_VERIFIED_ARTIFACT"
    | "INTEGRATION_REGISTRY"
    | "TECHNICAL_VERIFICATION";

  evidence:
    SemanticEvidence;

  description?: string;
};


export type ArtifactOwnership =
  | {
      scope: "OPPORTUNITY";
      customerId: string;
      opportunityId: string;
      projectId?: never;
    }
  | {
      scope: "PROJECT";
      customerId: string;
      opportunityId?: string;
      projectId: string;
    };


export type SpecialistArtifactEnvelope<
  TPayload,
> = ArtifactOwnership & {
  id: string;

  version: number;

  tenantId: string;

  tenantCode: string;

  role:
    SpecialistRole;

  artifactType:
    SpecialistArtifactType;

  status:
    SpecialistArtifactStatus;

  title: string;

  objective: string;

  sourceArtifactIds:
    string[];

  findings:
    SpecialistFinding[];

  recommendations:
    SpecialistRecommendation[];

  unresolved:
    SpecialistUnresolvedItem[];

  blockers:
    SpecialistBlocker[];

  provenance:
    SpecialistProvenance[];

  payload:
    TPayload;

  createdAt: string;

  updatedAt: string;
};


export type ResearchSource = {
  id: string;

  title: string;

  sourceType:
    | "WEBSITE"
    | "SEARCH_RESULT"
    | "DOCUMENT"
    | "CUSTOMER_SOURCE"
    | "COMPETITOR_SOURCE"
    | "OTHER";

  reference: string;

  accessedAt?: string;

  notes?: string[];
};


export type ResearchCompetitor = {
  name: string;

  reference?: string;

  positioning?: string;

  strengths: string[];

  weaknesses: string[];

  notableFeatures: string[];

  contentThemes: string[];

  observations: string[];
};


export type ResearchPackage = {
  marketContext: string[];

  audienceInsights: string[];

  competitors:
    ResearchCompetitor[];

  sources:
    ResearchSource[];

  opportunities: string[];

  risks: string[];

  differentiationIdeas: string[];

  contentGaps: string[];
};


export type UXPageSpecification = {
  id: string;

  name: string;

  purpose: string;

  primaryAudience: string[];

  userGoals: string[];

  sections: string[];

  primaryActions: string[];

  states: string[];

  responsiveNotes: string[];

  accessibilityNotes: string[];
};


export type UXComponentSpecification = {
  id: string;

  name: string;

  purpose: string;

  variants: string[];

  states: string[];

  contentRequirements: string[];

  responsiveBehavior: string[];

  accessibilityRequirements: string[];
};


export type UXDesignPackage = {
  designObjectives: string[];

  targetAudiences: string[];

  informationArchitecture: string[];

  userFlows: string[];

  pages:
    UXPageSpecification[];

  components:
    UXComponentSpecification[];

  designSystemRequirements: string[];

  responsiveStrategy: string[];

  accessibilityRequirements: string[];

  developerHandoffNotes: string[];
};


export type CopyContentItem = {
  id: string;

  location: string;

  contentType:
    | "HEADLINE"
    | "SUBHEADLINE"
    | "BODY"
    | "CTA"
    | "MICROCOPY"
    | "META_TITLE"
    | "META_DESCRIPTION"
    | "SOCIAL"
    | "AD"
    | "EMAIL"
    | "OTHER";

  language: string;

  text: string;

  purpose: string;

  sourceIds:
    string[];
};


export type CopyPackage = {
  brandVoice: string[];

  messagingPillars: string[];

  audience: string[];

  valuePropositions: string[];

  content:
    CopyContentItem[];

  terminologyRules: string[];

  forbiddenClaims: string[];

  localizationNotes: string[];
};


export type SearchIntent =
  | "INFORMATIONAL"
  | "NAVIGATIONAL"
  | "COMMERCIAL"
  | "TRANSACTIONAL"
  | "LOCAL";


export type SearchTopic = {
  id: string;

  topic: string;

  intent:
    SearchIntent;

  keywords: string[];

  entities: string[];

  targetPages: string[];

  questions: string[];

  evidence:
    SemanticEvidence;

  sourceIds:
    string[];
};


export type SearchVisibilityPackage = {
  seoObjectives: string[];

  geoObjectives: string[];

  aeoObjectives: string[];

  topics:
    SearchTopic[];

  contentArchitecture: string[];

  internalLinkingRecommendations: string[];

  structuredDataRecommendations: string[];

  answerEngineRecommendations: string[];

  generativeEngineRecommendations: string[];

  technicalSeoRequirements: string[];

  measurementRecommendations: string[];
};


export type VideoPlatform =
  | "YOUTUBE"
  | "YOUTUBE_SHORTS"
  | "TIKTOK"
  | "INSTAGRAM_REELS"
  | "FACEBOOK"
  | "LINKEDIN"
  | "WEBSITE"
  | "OTHER";


export type VideoFormat =
  | "REEL"
  | "TIKTOK"
  | "YOUTUBE_SHORT"
  | "YOUTUBE_LONGFORM"
  | "PRODUCT_VIDEO"
  | "EXPLAINER"
  | "SOCIAL_AD"
  | "CORPORATE"
  | "TESTIMONIAL"
  | "TUTORIAL"
  | "UGC_STYLE";


export type VideoScene = {
  id: string;

  order: number;

  durationSeconds?: number;

  visual: string;

  voiceover?: string;

  onScreenText?: string;

  bRoll?: string[];

  editingNotes?: string[];
};


export type VideoVariant = {
  id: string;

  platform:
    VideoPlatform;

  format:
    VideoFormat;

  durationSeconds?: number;

  aspectRatio?: string;

  hook: string;

  cta: string;

  caption?: string;

  hashtags?: string[];
};


export type VideoContentPackage = {
  campaignObjective: string;

  targetAudience: string[];

  primaryPlatform:
    VideoPlatform;

  primaryFormat:
    VideoFormat;

  concept: string;

  hook: string;

  script: string;

  scenes:
    VideoScene[];

  shotList: string[];

  visualDirection: string[];

  voiceDirection: string[];

  musicSoundDirection: string[];

  assetRequirements: string[];

  generationPrompts: string[];

  thumbnailConcepts: string[];

  variants:
    VideoVariant[];

  distributionNotes: string[];

  measurementRecommendations: string[];
};


export type ProposalMode =
  | "TECHNICAL_PROPOSAL"
  | "COMMERCIAL_PROPOSAL";


export type ProposalPricingStatus =
  | "VERIFIED"
  | "UNRESOLVED"
  | "NOT_APPLICABLE";


export type ProposalCommercialLine = {
  id: string;

  description: string;

  quantity?: number;

  unitPrice?: number;

  totalPrice?: number;

  currency?: string;

  sourceIds: string[];
};


export type CustomerProposalPackage = {
  mode:
    ProposalMode;

  customerNeed: string[];

  executiveSummary: string;

  businessObjectives: string[];

  proposedSolution: string[];

  scopeOfWork: string[];

  deliverables: string[];

  technicalArchitecture: string[];

  uxDesignApproach: string[];

  contentStrategy: string[];

  searchVisibilityStrategy: string[];

  videoCreativeStrategy: string[];

  integrations: string[];

  implementationPhases: string[];

  timeline: string[];

  dependencies: string[];

  assumptions: string[];

  exclusions: string[];

  risks: string[];

  acceptanceCriteria: string[];

  optionalAddOns: string[];

  pricingStatus:
    ProposalPricingStatus;

  commercialLines:
    ProposalCommercialLine[];

  commercialNotes: string[];

  validity?: string;

  nextSteps: string[];
};


export type ResearchArtifact =
  SpecialistArtifactEnvelope<
    ResearchPackage
  >;


export type UXDesignArtifact =
  SpecialistArtifactEnvelope<
    UXDesignPackage
  >;


export type CopyArtifact =
  SpecialistArtifactEnvelope<
    CopyPackage
  >;


export type SearchVisibilityArtifact =
  SpecialistArtifactEnvelope<
    SearchVisibilityPackage
  >;


export type VideoContentArtifact =
  SpecialistArtifactEnvelope<
    VideoContentPackage
  >;


export type CustomerProposalArtifact =
  SpecialistArtifactEnvelope<
    CustomerProposalPackage
  >;
