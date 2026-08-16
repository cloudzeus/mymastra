export type SoftOneLookupRecipeStatus =
  | "VERIFIED"
  | "NOT_VERIFIED"
  | "NOT_APPLICABLE";

export type SoftOneLookupRecipe = {
  target: string;

  status: SoftOneLookupRecipeStatus;

  operation: string | null;

  requestTemplate:
    Record<string, unknown> | null;

  valueField: string | null;

  labelFields: string[];

  tenantScoped: boolean;

  readOnly: true;

  provenance: string[];

  notes?: string[];
};

export const SOFTONE_LOOKUP_RECIPES:
  Record<string, SoftOneLookupRecipe> = {

  SERIES: {
    target: "SERIES",
    status: "NOT_VERIFIED",
    operation: null,
    requestTemplate: null,
    valueField: null,
    labelFields: [],
    tenantScoped: true,
    readOnly: true,
    provenance: [
      "SCHEMA_CACHE",
      "RELATIONS_CACHE",
    ],
    notes: [
      "Reference target verified.",
      "Live API lookup recipe not yet verified.",
    ],
  },

  CUSTOMER: {
    target: "CUSTOMER",
    status: "NOT_VERIFIED",
    operation: null,
    requestTemplate: null,
    valueField: null,
    labelFields: [],
    tenantScoped: true,
    readOnly: true,
    provenance: [
      "SCHEMA_CACHE",
      "RELATIONS_CACHE",
      "REGISTRY",
    ],
  },

  COMPANY: {
    target: "COMPANY",
    status: "NOT_VERIFIED",
    operation: null,
    requestTemplate: null,
    valueField: null,
    labelFields: [],
    tenantScoped: true,
    readOnly: true,
    provenance: [
      "SCHEMA_CACHE",
      "RELATIONS_CACHE",
    ],
  },

  SOCURRENCY: {
    target: "SOCURRENCY",
    status: "NOT_VERIFIED",
    operation: null,
    requestTemplate: null,
    valueField: null,
    labelFields: [],
    tenantScoped: true,
    readOnly: true,
    provenance: [
      "SCHEMA_CACHE",
      "RELATIONS_CACHE",
    ],
  },

  VAT: {
    target: "VAT",

    status: "VERIFIED",

    operation: "getData",

    requestTemplate: {
      OBJECT: "VAT",
      KEY: "<VAT_KEY>",
    },

    valueField: "VAT",

    labelFields: [
      "NAME",
      "PERCNT",
      "MYDATACODE",
    ],

    tenantScoped: true,

    readOnly: true,

    provenance: [
      "SCHEMA_CACHE",
      "RELATIONS_CACHE",
      "LIVE_TENANT_GETDATA_VERIFICATION",
    ],

    notes: [
      "Verified with live VAT getData.",
      "Requested KEY matched returned VAT.VAT.",
      "SoftOne response readOnly=false is not interpreted as a write operation.",
    ],
  },

  MTRUNIT: {
    target: "MTRUNIT",
    status: "NOT_VERIFIED",
    operation: null,
    requestTemplate: null,
    valueField: null,
    labelFields: [],
    tenantScoped: true,
    readOnly: true,
    provenance: [
      "SCHEMA_CACHE",
      "RELATIONS_CACHE",
    ],
  },

  BRANCH: {
    target: "BRANCH",
    status: "NOT_VERIFIED",
    operation: null,
    requestTemplate: null,
    valueField: null,
    labelFields: [],
    tenantScoped: true,
    readOnly: true,
    provenance: [
      "SCHEMA_CACHE_EDITOR_METADATA",
    ],
    notes: [
      "BRANCH is not currently verified as a top-level schema object or relation target.",
    ],
  },
};

export function getSoftOneLookupRecipe(
  target: string,
): SoftOneLookupRecipe | null {
  const normalized =
    target.trim().toUpperCase();

  return (
    SOFTONE_LOOKUP_RECIPES[
      normalized
    ] ?? null
  );
}
