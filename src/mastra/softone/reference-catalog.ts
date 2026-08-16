export type SoftOneReferenceAuthority =
  | "SCHEMA_OBJECT_AND_RELATION_TARGET"
  | "SCHEMA_OBJECT_ONLY"
  | "RELATION_TARGET_ONLY"
  | "EDITOR_ONLY"
  | "UNVERIFIED";

export type SoftOneReferenceCatalogEntry = {
  key: string;

  schemaObject: string | null;

  relationTarget: string | null;

  authority: SoftOneReferenceAuthority;

  physicalTable?: string | null;

  notes?: string[];
};

export const SOFTONE_REFERENCE_CATALOG:
  Record<string, SoftOneReferenceCatalogEntry> = {

  SERIES: {
    key: "SERIES",
    schemaObject: "SERIES",
    relationTarget: "SERIES",
    authority:
      "SCHEMA_OBJECT_AND_RELATION_TARGET",
    physicalTable: "SERIES",
    notes: [
      "Verified as top-level cached schema object.",
      "Verified as relations-cache target.",
    ],
  },

  CUSTOMER: {
    key: "CUSTOMER",
    schemaObject: "CUSTOMER",
    relationTarget: "CUSTOMER",
    authority:
      "SCHEMA_OBJECT_AND_RELATION_TARGET",
    physicalTable: "TRDR",
    notes: [
      "Verified as top-level cached schema object.",
      "Verified as relations-cache target.",
    ],
  },

  COMPANY: {
    key: "COMPANY",
    schemaObject: "COMPANY",
    relationTarget: "COMPANY",
    authority:
      "SCHEMA_OBJECT_AND_RELATION_TARGET",
    physicalTable: "COMPANY",
    notes: [
      "Verified as top-level cached schema object.",
      "Verified as relations-cache target.",
      "Do not automatically infer RELCOMPANY -> COMPANY.",
    ],
  },

  SOCURRENCY: {
    key: "SOCURRENCY",
    schemaObject: "SOCURRENCY",
    relationTarget: "SOCURRENCY",
    authority:
      "SCHEMA_OBJECT_AND_RELATION_TARGET",
    physicalTable: "SOCURRENCY",
  },

  VAT: {
    key: "VAT",
    schemaObject: "VAT",
    relationTarget: "VAT",
    authority:
      "SCHEMA_OBJECT_AND_RELATION_TARGET",
    physicalTable: "VAT",
  },

  MTRUNIT: {
    key: "MTRUNIT",
    schemaObject: "MTRUNIT",
    relationTarget: "MTRUNIT",
    authority:
      "SCHEMA_OBJECT_AND_RELATION_TARGET",
    physicalTable: "MTRUNIT",
  },

  BRANCH: {
    key: "BRANCH",
    schemaObject: null,
    relationTarget: null,
    authority: "EDITOR_ONLY",
    physicalTable: null,
    notes: [
      "BRANCH appears as schema editor metadata.",
      "No top-level BRANCH object was found in cached schema.",
      "No BRANCH relation target was found in cached relations.",
      "Live lookup behavior must be verified separately.",
    ],
  },

  RELCOMPANY: {
    key: "RELCOMPANY",
    schemaObject: null,
    relationTarget: null,
    authority: "EDITOR_ONLY",
    physicalTable: null,
    notes: [
      "RELCOMPANY is an editor identifier, not a verified SoftOne object.",
      "Do not automatically map RELCOMPANY to COMPANY.",
    ],
  },
};

export function getSoftOneReferenceCatalogEntry(
  key: string,
): SoftOneReferenceCatalogEntry | null {
  const normalized =
    key.trim().toUpperCase();

  return (
    SOFTONE_REFERENCE_CATALOG[
      normalized
    ] ?? null
  );
}
