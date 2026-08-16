import type { SoftOneSemanticNode } from "./semantic-types";

export const SOFTONE_TENANT_RULES: SoftOneSemanticNode[] = [
  {
    id: "CUSTOMER1_SALES_SERIES_SET",
    type: "TENANT_RULE",

    concept: "sales document series set",
    description:
      "Series used by the verified product-sales analysis queries for tenant CUSTOMER1.",

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: ["FINDOC.SERIES"],

    outputs: [
      "7061",
      "7071",
      "7073",
      "7072",
      "7077",
      "7081",
      "8061",
      "8161",
      "7062",
      "8062",
      "8063",
      "8064",
      "8163",
    ],

    tags: ["sales", "series", "findoc"],
  },

  {
    id: "CUSTOMER1_RESERVED_RESTCATEG",
    type: "TENANT_RULE",

    concept: "reserved stock restriction category",
    description:
      "RESTCATEG=2 is used by the verified reservation calculation.",

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: ["RESTMODE.RESTCATEG"],
    outputs: ["2"],

    tags: ["stock", "reserved"],
  },

  {
    id: "CUSTOMER1_SUPPLIER_PENDING_RESTCATEG",
    type: "TENANT_RULE",

    concept: "supplier pending restriction category",
    description:
      "RESTCATEG=1 is used by the verified supplier pending quantity calculation.",

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: ["RESTMODE.RESTCATEG"],
    outputs: ["1"],

    tags: ["purchase", "supplier", "pending"],
  },

  {
    id: "CUSTOMER1_CUSTOMER_TURNOVER_FPRMS",
    type: "TENANT_RULE",

    concept: "customer turnover document form",
    description:
      "FPRMS=7062 is used by the supplied verified customer-turnover query.",

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: ["FINDOC.FPRMS"],
    outputs: ["7062"],

    tags: ["customer", "turnover", "fprms"],
  },

  {
    id: "CUSTOMER1_EXPENSE_FPRMS_SET",
    type: "TENANT_RULE",

    concept: "expense document forms",
    description:
      "FPRMS set used by the supplied expense-report query.",

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: ["FINDOC.FPRMS"],
    outputs: ["8009", "1001", "3201", "1010"],

    tags: ["expenses", "fprms"],
  },

  {
    id: "CUSTOMER1_EXPENSE_CREDIT_FPRMS",
    type: "TENANT_RULE",

    concept: "expense credit form",
    description:
      "Within the supplied expense-report context, FPRMS=1010 is classified as credit.",

    scope: "RECIPE",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: ["FINDOC.FPRMS"],
    outputs: ["1010"],

    tags: ["expenses", "credit"],
  },
];
