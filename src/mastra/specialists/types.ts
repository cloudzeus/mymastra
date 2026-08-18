import type {
  SemanticEvidence,
} from "../softone/semantic-types";


export type SpecialistRole =
  | "RESEARCH_COMPETITOR"
  | "UI_UX_DESIGNER"
  | "COPYWRITER"
  | "SEARCH_VISIBILITY"
  | "CONTENT_CREATOR"
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
  | "CREATIVE_CONTENT_PACKAGE"
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



export type CustomerAssetType =
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "LOGO"
  | "BRAND_GUIDELINE"
  | "DESIGN_SYSTEM"
  | "PRODUCT_MEDIA"
  | "MOODBOARD"
  | "DOCUMENT"
  | "PRESENTATION"
  | "OTHER";


export type CustomerAssetScope =
  | "CUSTOMER"
  | "PROJECT";


export type CustomerAssetSource =
  | "UPLOADED"
  | "IMPORTED"
  | "GENERATED"
  | "EDITED";


export type ReusableCustomerAssetReference = {
  assetId: string;

  customerId: string;

  projectId?: string;

  scope:
    CustomerAssetScope;

  type:
    CustomerAssetType;

  title?: string;

  description?: string;

  tags: string[];

  reusableAcrossProjects: boolean;

  source:
    CustomerAssetSource;

  derivedFromAssetIds: string[];
};


export type MediaReferenceRole =
  | "SUBJECT"
  | "PRODUCT"
  | "PERSON"
  | "LOCATION"
  | "STYLE"
  | "COMPOSITION"
  | "COLOR_PALETTE"
  | "BRAND"
  | "LOGO"
  | "BACKGROUND"
  | "LIGHTING"
  | "POSE"
  | "WARDROBE"
  | "FIRST_FRAME"
  | "LAST_FRAME"
  | "OTHER";


export type MediaReferencePriority =
  | "REQUIRED"
  | "STRONG"
  | "OPTIONAL";


export type MediaReferenceAsset = {
  assetId: string;

  role:
    MediaReferenceRole;

  priority:
    MediaReferencePriority;

  instructions?: string;

  preservationRequirements: string[];
};


export type BrandDefinitionStatus =
  | "PROVIDED"
  | "VERIFIED"
  | "PROPOSED"
  | "PARTIAL";


export type BrandIdentityDefinition = {
  status:
    BrandDefinitionStatus;

  brandName: string;

  positioning?: string;

  personality: string[];

  toneOfVoice: string[];

  logoAssetIds: string[];

  colors: string[];

  typography: string[];

  iconography: string[];

  photographyStyle: string[];

  illustrationStyle: string[];

  imageryDirection: string[];

  motionDirection: string[];

  spacingPrinciples: string[];

  shapeLanguage: string[];

  dos: string[];

  donts: string[];

  sourceAssetIds: string[];
};


export type DesignSystemDefinition = {
  status:
    BrandDefinitionStatus;

  primitiveTokens: string[];

  semanticTokens: string[];

  componentTokens: string[];

  components: string[];

  patterns: string[];

  templates: string[];

  responsiveRules: string[];

  accessibilityRules: string[];

  motionRules: string[];

  themeRules: string[];

  sourceAssetIds: string[];
};


export type MediaQualityTier =
  | "DRAFT"
  | "STANDARD"
  | "PREMIUM";


export type CreativeAssetType =
  | "IMAGE"
  | "VIDEO";


export type CreativePlacement =
  | "WEBSITE_HERO"
  | "WEBSITE_BANNER"
  | "VIDEO_HERO"
  | "VIDEO_BANNER"
  | "DISPLAY_BANNER"
  | "SOCIAL_POST"
  | "SOCIAL_STORY"
  | "SOCIAL_REEL"
  | "EMAIL_BANNER"
  | "THUMBNAIL"
  | "PRODUCT_MEDIA"
  | "AD"
  | "OTHER";


export type MediaGenerationPolicy = {
  maxImageVariantsPerRequest: number;

  maxVideoVariantsPerRequest: number;

  maxVideoDurationSeconds: number;

  maxCostPerImageUsd: number;

  maxCostPerVideoUsd: number;

  autonomousSpendLimitUsd: number;

  approvalRequiredAboveUsd: number;

  projectBudgetUsd?: number;

  tenantDailyBudgetUsd?: number;

  tenantMonthlyBudgetUsd?: number;
};


export type MediaModelSelectionRequest = {
  assetType:
    CreativeAssetType;

  qualityTier:
    MediaQualityTier;

  requiresReferenceImages: boolean;

  requiresImageEditing: boolean;

  requiresAudio: boolean;

  requiresFirstLastFrame: boolean;

  preferredAspectRatio?: string;

  maxCostUsd: number;

  maxExpectedLatencySeconds?: number;
};


export type MediaGenerationRequest = {
  requestId: string;

  specificationId: string;

  assetType:
    CreativeAssetType;

  qualityTier:
    MediaQualityTier;

  variants: number;

  referenceAssets:
    MediaReferenceAsset[];

  requestedDurationSeconds?: number;

  requiresAudio?: boolean;

  maxCostUsd: number;

  humanApprovalId?: string;
};


export type GeneratedAssetStatus =
  | "PENDING"
  | "PROCESSING"
  | "AVAILABLE"
  | "FAILED";


export type GeneratedAssetReference = {
  assetId: string;

  assetType:
    CreativeAssetType;

  status:
    GeneratedAssetStatus;

  qualityTier:
    MediaQualityTier;

  provider?: string;

  model?: string;

  derivedFromAssetIds: string[];

  estimatedCostUsd?: number;

  actualCostUsd?: number;
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

  brandIdentity?:
    BrandIdentityDefinition;

  designSystem?:
    DesignSystemDefinition;

  customerAssets:
    ReusableCustomerAssetReference[];

  pages:
    UXPageSpecification[];

  components:
    UXComponentSpecification[];

  designSystemRequirements: string[];

  imageCreativeRequirements:
    ImageCreativeSpecification[];

  videoCreativeRequirements:
    VideoCreativeSpecification[];

  mediaGenerationPolicy?:
    MediaGenerationPolicy;

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



export type ImageCreativeSpecification = {
  id: string;

  purpose: string;

  placement:
    CreativePlacement;

  aspectRatio?: string;

  width?: number;

  height?: number;

  visualDirection: string;

  subject?: string;

  composition?: string;

  background?: string;

  lighting?: string;

  style: string[];

  onImageText: string[];

  cta?: string;

  brandRequirements: string[];

  negativeConstraints: string[];

  responsiveVariants: string[];

  referenceAssets:
    MediaReferenceAsset[];

  generationPrompt?: string;

  generatedAssets:
    GeneratedAssetReference[];
};


export type VideoCreativeSpecification = {
  id: string;

  purpose: string;

  placement:
    CreativePlacement;

  platform?:
    VideoPlatform;

  format:
    VideoFormat;

  durationSeconds?: number;

  aspectRatio?: string;

  concept: string;

  hook?: string;

  script?: string;

  scenes:
    VideoScene[];

  visualDirection: string[];

  motionDirection: string[];

  voiceDirection: string[];

  musicSoundDirection: string[];

  loopRequired?: boolean;

  mutedPlaybackCompatible?: boolean;

  referenceAssets:
    MediaReferenceAsset[];

  generationPrompt?: string;

  generatedAssets:
    GeneratedAssetReference[];
};


export type CreativeVariant = {
  id: string;

  sourceCreativeId: string;

  placement:
    CreativePlacement;

  aspectRatio?: string;

  width?: number;

  height?: number;

  durationSeconds?: number;

  adaptationNotes: string[];

  generatedAssetId?: string;
};


export type CreativeContentPackage = {

  campaignObjective: string;

  targetAudience: string[];

  brandIdentity?:
    BrandIdentityDefinition;

  designSystem?:
    DesignSystemDefinition;

  customerAssets:
    ReusableCustomerAssetReference[];

  concept: string;

  visualDirection: string[];

  assetRequirements: string[];

  imageCreatives:
    ImageCreativeSpecification[];

  videoCreatives:
    VideoCreativeSpecification[];

  creativeVariants:
    CreativeVariant[];

  mediaGenerationPolicy?:
    MediaGenerationPolicy;

  primaryPlatform?:
    VideoPlatform;

  primaryFormat?:
    VideoFormat;

  hook?: string;

  script?: string;

  scenes:
    VideoScene[];

  shotList: string[];

  voiceDirection: string[];

  musicSoundDirection: string[];

  generationPrompts: string[];

  thumbnailConcepts: string[];

  videoVariants:
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


export type CreativeContentArtifact =
  SpecialistArtifactEnvelope<
    CreativeContentPackage
  >;


export type CustomerProposalArtifact =
  SpecialistArtifactEnvelope<
    CustomerProposalPackage
  >;
