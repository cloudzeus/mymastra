import type {
  SoftOneProductArea,
  SoftOneSourceAuthority,
  SoftOneSourceDefinition,
  SoftOneSourceType,
} from "./source-types";

export const SOFTONE_SOURCE_REGISTRY: readonly SoftOneSourceDefinition[] = [
  {
    id: "OFFICIAL_SOFTONE_WS_DOCS",
    title: "Soft1 Web Services Reference",
    type: "WEB_DOCUMENTATION",
    authority: "OFFICIAL_DOCUMENTATION",
    url: "https://www.softone.gr/ws/",
    productAreas: [
      "WEB_SERVICES",
      "OBJECT_MODEL",
      "INTEGRATIONS",
    ],
    verificationEffects: [
      "CAN_VERIFY_DOCUMENTED_BEHAVIOR",
    ],
    language: "EN",
    description:
      "Official Soft1 Web Services reference for authentication, services, request/response behavior and integration contracts.",
    usagePolicy: [
      "Use for documented Soft1 Web Services behavior.",
      "Do not use it to infer tenant-specific identifiers.",
      "Do not use documentation capability as proof that a specific tenant configuration exists.",
    ],
    tags: [
      "official",
      "web-services",
      "api",
    ],
  },

  {
    id: "OFFICIAL_SOFTONE_WIKI",
    title: "SOFT1 Wiki",
    type: "WIKI",
    authority: "OFFICIAL_DOCUMENTATION",
    url: "https://wiki.soft1.eu/",
    productAreas: [
      "OBJECT_MODEL",
      "FORM_DESIGN",
      "SCRIPTING",
      "CUSTOMIZATION",
      "BROWSERS",
      "REPORTING",
      "INTEGRATIONS",
    ],
    verificationEffects: [
      "CAN_VERIFY_DOCUMENTED_BEHAVIOR",
    ],
    description:
      "SOFT1 Wiki documentation and knowledge base.",
    usagePolicy: [
      "Use documented behavior as official-source evidence.",
      "Record the exact page URL when knowledge is ingested.",
      "Preserve version-specific qualifications when present.",
      "Do not convert generic documentation into tenant-specific facts.",
    ],
    tags: [
      "official",
      "wiki",
      "documentation",
    ],
  },

  {
    id: "OFFICIAL_SOFTONE_BLACKBOOK_3_5",
    title: "SoftOne BlackBook ENG ver.3.5",
    type: "PDF",
    authority: "OFFICIAL_DOCUMENTATION",
    url: "https://s1sales.blob.core.windows.net/portal-documents/Greek_Documents/SoftOne%20BlackBook%20ENG%20ver.3.5.pdf",
    productAreas: [
      "OBJECT_MODEL",
      "FORM_DESIGN",
      "SCRIPTING",
      "EVENTS",
      "DATABASE_DESIGNER",
      "SQL",
      "BROWSERS",
      "REPORTING",
      "CUSTOMIZATION",
      "INTEGRATIONS",
    ],
    verificationEffects: [
      "CAN_VERIFY_DOCUMENTED_BEHAVIOR",
    ],
    language: "EN",
    version: "3.5",
    description:
      "SoftOne BlackBook technical reference supplied as a primary technical knowledge source.",
    usagePolicy: [
      "Ingest by section rather than as one unstructured document.",
      "Keep page and section provenance for extracted knowledge.",
      "Preserve documented version context.",
      "Do not treat examples as tenant-specific configuration.",
    ],
    tags: [
      "blackbook",
      "official",
      "technical-reference",
    ],
  },

  {
    id: "OFFICIAL_SOFTONE_DATABASE_DESIGNER_VIDEO",
    title: "S1 Database Designer ENG",
    type: "VIDEO",
    authority: "OFFICIAL_TRAINING",
    url: "https://s1sales.blob.core.windows.net/portal-documents/English_Docs/Videos/S1%20Database%20Designer%20ENG.mp4",
    productAreas: [
      "DATABASE_DESIGNER",
      "PHYSICAL_DATABASE",
      "SCHEMA",
      "RELATIONS",
      "CUSTOMIZATION",
    ],
    verificationEffects: [
      "CAN_VERIFY_DOCUMENTED_BEHAVIOR",
    ],
    language: "EN",
    description:
      "SoftOne training material covering S1 Database Designer concepts.",
    usagePolicy: [
      "Use for documented Database Designer capabilities and concepts.",
      "Do not infer that a demonstrated custom table or field exists in a tenant.",
      "Tenant structure still requires schema or live verification.",
      "Store timestamp provenance for extracted video knowledge.",
    ],
    tags: [
      "training",
      "database-designer",
    ],
  },

  {
    id: "OFFICIAL_SOFTONE_FORM_DATA_FLOWS_VIDEO",
    title: "S1 Form Design - Data Flows ENG",
    type: "VIDEO",
    authority: "OFFICIAL_TRAINING",
    url: "https://s1sales.blob.core.windows.net/portal-documents/English_Docs/Videos/S1%20Form%20Design-Data%20Flows%20ENG.mp4",
    productAreas: [
      "FORM_DESIGN",
      "DATA_FLOWS",
      "OBJECT_MODEL",
      "SCRIPTING",
      "EVENTS",
      "CUSTOMIZATION",
    ],
    verificationEffects: [
      "CAN_VERIFY_DOCUMENTED_BEHAVIOR",
    ],
    language: "EN",
    description:
      "SoftOne training material for Form Design and Data Flows.",
    usagePolicy: [
      "Use for form/data-flow execution semantics.",
      "Distinguish form behavior from object schema behavior.",
      "Do not infer tenant customization from training examples.",
      "Store timestamp provenance for extracted video knowledge.",
    ],
    tags: [
      "training",
      "form-design",
      "data-flows",
    ],
  },

  {
    id: "SOFT1_DEVELOPERS_GROUP",
    title: "Softone Developers Network - Google Group",
    type: "COMMUNITY_FORUM",
    authority: "COMMUNITY_EXPERT",
    url: "https://groups.google.com/g/soft1",
    productAreas: [
      "SCRIPTING",
      "EVENTS",
      "CUSTOMIZATION",
      "INTEGRATIONS",
      "WEB_SERVICES",
      "SQL",
      "FORM_DESIGN",
      "DATABASE_DESIGNER",
    ],
    verificationEffects: [
      "SUPPORTING_EVIDENCE_ONLY",
    ],
    description:
      "Long-running SoftOne developer community containing implementation discussions, examples, workarounds and version-specific behavior.",
    usagePolicy: [
      "Community posts are supporting evidence by default.",
      "This is the only approved SoftOne community forum source.",
      "Do not ingest SoftOne forum evidence from any other forum, discussion board or Q&A community.",
      "Do not promote a forum statement to VERIFIED solely because it appears in the group.",
      "Record author, post URL and date when available.",
      "Preserve the complete thread and reply chronology whenever available.",
      "Prefer independently verified working code or official documentation for promotion.",
      "Treat old posts as potentially version-specific.",
    ],
    tags: [
      "community",
      "developers",
      "customization",
    ],
  },

  {
    id: "IMPLEMENTATION_REPOSITORY",
    title: "Internal Implementation Repository",
    type: "GITHUB",
    authority: "INFERRED",
    productAreas: [
      "WEB_SERVICES",
      "OBJECT_MODEL",
      "DATA_FLOWS",
      "SCRIPTING",
      "EVENTS",
      "SQL",
      "SQLDATA",
      "CUSTOMIZATION",
      "INTEGRATIONS",
      "SCHEMA",
      "RELATIONS",
      "PHYSICAL_DATABASE",
      "TENANT_CONFIGURATION",
    ],
    verificationEffects: [
      "CAN_VERIFY_WORKING_IMPLEMENTATION",
    ],
    description:
      "Read-only evidence extracted from pinned internal implementation repositories. It proves that a pattern was implemented in a working project; it does not independently establish canonical SoftOne behavior.",
    usagePolicy: [
      "Read repositories only at the exact recorded commit.",
      "Record repository, commit and exact source file for every extracted claim.",
      "Treat implementation-specific configuration and tenant assumptions as non-canonical.",
      "Never promote implementation evidence directly to VERIFIED.",
      "Require human review before ingestion.",
      "Prefer official documentation or independent verified evidence for canonical SoftOne behavior.",
    ],
    tags: [
      "implementation",
      "github",
      "internal",
      "working-code",
      "evidence",
    ],
  },

  {
    id: "SOFTONE_DEVELOPERS_GITHUB",
    title: "SoftOne Developers Network GitHub",
    type: "GITHUB",
    authority: "COMMUNITY_EXPERT",
    url: "https://github.com/SoftOne-Developers-Network",
    productAreas: [
      "SCRIPTING",
      "WEB_SERVICES",
      "INTEGRATIONS",
      "CUSTOMIZATION",
    ],
    verificationEffects: [
      "SUPPORTING_EVIDENCE_ONLY",
    ],
    description:
      "SoftOne Developers Network source-code and integration examples.",
    usagePolicy: [
      "Use repository code as implementation evidence.",
      "Record repository, path and commit when ingesting knowledge.",
      "Do not assume sample configuration values apply to another tenant.",
    ],
    tags: [
      "github",
      "developers",
      "examples",
    ],
  },

  {
    id: "SCHEMA_CACHE",
    title: "SoftOne Cached Schema",
    type: "SCHEMA_CACHE",
    authority: "CANONICAL_INTERNAL",
    productAreas: [
      "SCHEMA",
      "OBJECT_MODEL",
    ],
    verificationEffects: [
      "CAN_VERIFY_STRUCTURE",
    ],
    description:
      "Cached SoftOne object/table/field metadata pulled from the installation.",
    usagePolicy: [
      "Authoritative for cached table and field metadata.",
      "required=true means schema-required only.",
      "Do not infer physical SQL mappings solely from schema object names.",
    ],
  },

  {
    id: "RELATIONS_CACHE",
    title: "SoftOne Cached Relations",
    type: "RELATIONS_CACHE",
    authority: "CANONICAL_INTERNAL",
    productAreas: [
      "RELATIONS",
      "OBJECT_MODEL",
    ],
    verificationEffects: [
      "CAN_VERIFY_STRUCTURE",
    ],
    description:
      "Cached explicit SoftOne relation metadata.",
    usagePolicy: [
      "Authoritative only for relationships explicitly present in the cache.",
      "Do not invent missing relationships.",
    ],
  },

  {
    id: "CANONICAL_REGISTRY",
    title: "Canonical SoftOne Object Registry",
    type: "REGISTRY",
    authority: "CANONICAL_INTERNAL",
    productAreas: [
      "OBJECT_MODEL",
      "PHYSICAL_DATABASE",
    ],
    verificationEffects: [
      "CAN_VERIFY_PHYSICAL_MAPPING",
    ],
    description:
      "Application-maintained canonical mappings for SoftOne objects, physical tables and primary keys.",
    usagePolicy: [
      "Authoritative for explicit physical SQL mappings maintained in the registry.",
      "Do not infer mappings that are absent.",
    ],
  },

  {
    id: "LIVE_TENANT_VERIFICATION",
    title: "Live Tenant Verification",
    type: "LIVE_API",
    authority: "TENANT_VERIFIED",
    productAreas: [
      "WEB_SERVICES",
      "TENANT_CONFIGURATION",
      "OBJECT_MODEL",
    ],
    verificationEffects: [
      "CAN_VERIFY_TENANT_BEHAVIOR",
    ],
    description:
      "Controlled read-only verification against a specific SoftOne tenant.",
    usagePolicy: [
      "Always scope to connectionId/tenant.",
      "Never promote tenant-specific identifiers to global knowledge.",
      "Analyst write operations remain forbidden.",
    ],
  },

  {
    id: "USER_VERIFIED_SQL",
    title: "User Verified SoftOne SQL",
    type: "SQL",
    authority: "USER_VERIFIED",
    productAreas: [
      "SQL",
      "SQLDATA",
      "PHYSICAL_DATABASE",
      "TENANT_CONFIGURATION",
    ],
    verificationEffects: [
      "CAN_VERIFY_WORKING_IMPLEMENTATION",
    ],
    description:
      "SQL explicitly supplied as working against a known SoftOne installation.",
    usagePolicy: [
      "Preserve tenant scope for numeric IDs and business mappings.",
      "Separate structural facts from tenant-specific rules.",
      "Working SQL is implementation evidence, not universal product documentation.",
    ],
  },

  {
    id: "USER_PROVIDED_WORKING_SOFTONE_JS",
    title: "User Provided Working SoftOne JavaScript",
    type: "JAVASCRIPT",
    authority: "USER_VERIFIED",
    productAreas: [
      "SCRIPTING",
      "EVENTS",
      "CUSTOMIZATION",
      "INTEGRATIONS",
    ],
    verificationEffects: [
      "CAN_VERIFY_WORKING_IMPLEMENTATION",
    ],
    description:
      "SoftOne JavaScript explicitly supplied as working implementation evidence.",
    usagePolicy: [
      "Preserve tenant and version context.",
      "Do not generalize embedded numeric IDs.",
      "Separate documented function semantics from observed usage.",
    ],
  },
] as const;

export function getSoftOneSource(
  id: string,
): SoftOneSourceDefinition | undefined {
  const normalized = id.trim().toUpperCase();

  return SOFTONE_SOURCE_REGISTRY.find(
    source => source.id.toUpperCase() === normalized,
  );
}

export function searchSoftOneSources(
  query: string,
  options?: {
    authority?: SoftOneSourceAuthority;
    type?: SoftOneSourceType;
    productArea?: SoftOneProductArea;
  },
): SoftOneSourceDefinition[] {
  const normalized = query.trim().toLowerCase();

  return SOFTONE_SOURCE_REGISTRY.filter(source => {
    if (
      options?.authority &&
      source.authority !== options.authority
    ) {
      return false;
    }

    if (
      options?.type &&
      source.type !== options.type
    ) {
      return false;
    }

    if (
      options?.productArea &&
      !source.productAreas.includes(options.productArea)
    ) {
      return false;
    }

    if (!normalized) {
      return true;
    }

    const haystack = [
      source.id,
      source.title,
      source.description,
      source.url ?? "",
      ...source.productAreas,
      ...(source.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function getSoftOneSourcesForArea(
  productArea: SoftOneProductArea,
): SoftOneSourceDefinition[] {
  return SOFTONE_SOURCE_REGISTRY.filter(
    source => source.productAreas.includes(productArea),
  );
}
