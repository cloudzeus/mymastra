export type SemanticEvidence =
  | "VERIFIED"
  | "DERIVED"
  | "HYPOTHESIS";

export type SemanticScope =
  | "GLOBAL"
  | "TENANT"
  | "RECIPE";

export type SemanticNodeType =
  | "FACT"
  | "METRIC"
  | "DATASET"
  | "RECIPE"
  | "RANKING"
  | "TENANT_RULE";

export type SemanticProvenance =
  | "SCHEMA_CACHE"
  | "RELATIONS_CACHE"
  | "CANONICAL_REGISTRY"
  | "LIVE_TENANT_VERIFICATION"
  | "USER_VERIFIED_SQL"
  | "USER_PROVIDED_WORKING_SOFTONE_JS";

export type SoftOneSemanticNode = {
  id: string;
  type: SemanticNodeType;

  concept: string;
  description: string;

  businessObjects?: string[];

  scope: SemanticScope;
  tenantCode?: string;

  evidence: SemanticEvidence;
  provenance: SemanticProvenance[];

  dependsOn?: string[];
  physicalSources?: string[];

  dimensions?: string[];
  outputs?: string[];

  expression?: string;
  conditions?: string[];
  joins?: string[];

  aggregate?: "SUM" | "COUNT" | "MIN" | "MAX" | "NONE";
  expressionDescription?: string;

  parameters?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;

  sqlTemplate?: string;
  templateParameterStyle?:
    | "INTERNAL_SEMANTIC_TOKENS"
    | "SOFTONE_LITERAL_PLACEHOLDERS"
    | "SOFTONE_SYSTEM_CONTEXT";

  tags?: string[];
  notes?: string[];

  executionStrategy?:
    | "GETDATA"
    | "SQLDATA"
    | "SOFTONE_SCRIPT"
    | "WRITE_PLAN"
    | "NONE";
};
