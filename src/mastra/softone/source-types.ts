export type SoftOneSourceAuthority =
  | "OFFICIAL_DOCUMENTATION"
  | "OFFICIAL_TRAINING"
  | "CANONICAL_INTERNAL"
  | "TENANT_VERIFIED"
  | "USER_VERIFIED"
  | "COMMUNITY_EXPERT"
  | "INFERRED";

export type SoftOneSourceType =
  | "WEB_DOCUMENTATION"
  | "WIKI"
  | "PDF"
  | "VIDEO"
  | "COMMUNITY_FORUM"
  | "GITHUB"
  | "SCHEMA_CACHE"
  | "RELATIONS_CACHE"
  | "REGISTRY"
  | "LIVE_API"
  | "SQL"
  | "JAVASCRIPT";

export type SoftOneProductArea =
  | "WEB_SERVICES"
  | "OBJECT_MODEL"
  | "DATABASE_DESIGNER"
  | "FORM_DESIGN"
  | "DATA_FLOWS"
  | "SCRIPTING"
  | "EVENTS"
  | "SQL"
  | "SQLDATA"
  | "BROWSERS"
  | "REPORTING"
  | "CUSTOMIZATION"
  | "INTEGRATIONS"
  | "SCHEMA"
  | "RELATIONS"
  | "PHYSICAL_DATABASE"
  | "TENANT_CONFIGURATION";

export type SoftOneVerificationEffect =
  | "CAN_VERIFY_DOCUMENTED_BEHAVIOR"
  | "SUPPORTING_EVIDENCE_ONLY"
  | "CAN_VERIFY_TENANT_BEHAVIOR"
  | "CAN_VERIFY_STRUCTURE"
  | "CAN_VERIFY_PHYSICAL_MAPPING"
  | "CAN_VERIFY_WORKING_IMPLEMENTATION";

export interface SoftOneSourceDefinition {
  id: string;

  title: string;

  type: SoftOneSourceType;

  authority: SoftOneSourceAuthority;

  url?: string;

  productAreas: SoftOneProductArea[];

  verificationEffects: SoftOneVerificationEffect[];

  language?: string;

  version?: string;

  description: string;

  usagePolicy: string[];

  tags?: string[];
}

export interface SoftOneSourceReference {
  sourceId: string;

  sourceUrl?: string;

  sourceTitle?: string;

  section?: string;

  page?: number;

  timestampSeconds?: number;

  publishedAt?: string;

  retrievedAt?: string;

  softOneVersion?: string;

  notes?: string[];
}
