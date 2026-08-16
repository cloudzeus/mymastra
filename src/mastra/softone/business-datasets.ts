import type { SoftOneSemanticNode } from "./semantic-types";

export const SOFTONE_BUSINESS_DATASETS: SoftOneSemanticNode[] = [
  {
    id: "DOCUMENT_ITEM_LINES",
    type: "DATASET",

    concept: "document item lines",
    description:
      "Material lines of a FINDOC enriched with item and primary-unit information.",

    businessObjects: ["ITEDOC", "ITEM"],

    scope: "GLOBAL",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: [
      "MTRLINES",
      "MTRL",
      "MTRUNIT",
    ],

    dimensions: [
      "FINDOC",
      "MTRLINES",
      "MTRL",
    ],

    outputs: [
      "MTRL",
      "MTRL.CODE",
      "MTRL.NAME",
      "MTRLINES.QTY",
      "MTRLINES.QTY1",
      "MTRLINES.PRICE",
      "MTRLINES.DISC1VAL",
      "MTRLINES.LINEVAL",
      "MTRLINES.VATAMNT",
      "MTRUNIT.NAME",
      "MTRUNIT.MTRUNIT",
      "MTRLINES.NUM02",
    ],

    executionStrategy: "SQLDATA",

    tags: [
      "document",
      "lines",
      "items",
    ],

    notes: [
      "MTRL is the internal item identifier and is not the same as MTRL.CODE.",
      "NUM02 is structurally known but its business semantics remain unresolved.",
    ],
  },

  {
    id: "OPEN_SUPPLIER_ORDERS",
    type: "DATASET",

    concept: "open supplier orders",
    description:
      "Supplier-order documents satisfying the verified open-order document state and date filters.",

    businessObjects: ["PURDOC"],

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "COMPANY",
      "TRNDATE",
      "TRDR",
      "FINDOC",
    ],

    outputs: [
      "FINDOC.TRNDATE",
      "FINDOC.FINCODE",
      "TRDR.CODE",
      "TRDR.NAME",
      "FINDOC.SUMAMNT",
    ],

    executionStrategy: "SQLDATA",

    tags: [
      "supplier",
      "orders",
      "pending",
      "purchase",
    ],
  },

  {
    id: "ITEM_SALES_PERFORMANCE",
    type: "DATASET",

    concept: "item sales performance",
    description:
      "Sales performance per item including quantity sold, net sales, cost of goods and gross profit.",

    businessObjects: ["ITEM", "SALDOC"],

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    dependsOn: [
      "CUSTOMER1_SALES_SERIES_SET",
    ],

    physicalSources: [
      "MTRLINES",
      "FINDOC",
      "MTRL",
      "MTRMARK",
      "MTRCATEGORY",
      "MTRGROUP",
      "MTRFINDATA",
      "MTREXTRA",
    ],

    dimensions: [
      "COMPANY",
      "MTRL",
      "MTRMARK",
      "MTRCATEGORY",
      "MTRGROUP",
    ],

    outputs: [
      "MTRL",
      "CODE",
      "CODE1",
      "CODE2",
      "NAME",
      "MTRMARK",
      "MTRCATEGORY",
      "MTRGROUP",
      "TOTAL_QTY_SOLD",
      "NET_SALES_VALUE",
      "COST_OF_GOODS",
      "GROSS_PROFIT",
      "PROFIT_MARGIN_PCT",
      "BALANCE",
    ],

    executionStrategy: "SQLDATA",

    tags: [
      "item",
      "sales",
      "profit",
      "quantity",
      "performance",
    ],
  },

  {
    id: "NEWEST_AVAILABLE_ITEMS",
    type: "DATASET",

    concept: "newest available items",
    description:
      "Newest inventory items by MTRL.INSDATE that satisfy the verified eligibility and positive-stock conditions.",

    businessObjects: ["ITEM"],

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    physicalSources: [
      "MTRL",
      "MTREXTRA",
      "MTRFINDATA",
      "MTRMARK",
      "MTRCATEGORY",
      "MTRGROUP",
    ],

    dimensions: [
      "COMPANY",
      "MTRL",
    ],

    outputs: [
      "MTRL",
      "INSDATE",
      "CODE",
      "CODE1",
      "CODE2",
      "NAME",
      "MTRMARK",
      "MTRCATEGORY",
      "MTRGROUP",
      "BALANCE",
    ],

    executionStrategy: "SQLDATA",

    tags: [
      "item",
      "newest",
      "stock",
    ],
  },

  {
    id: "EXPENSE_DOCUMENTS",
    type: "DATASET",

    concept: "expense documents",
    description:
      "Expense-related FINDOC rows according to the supplied verified expense-report scope.",

    businessObjects: ["FINDOC"],

    scope: "TENANT",
    tenantCode: "CUSTOMER1",

    evidence: "VERIFIED",
    provenance: ["USER_VERIFIED_SQL"],

    dependsOn: [
      "CUSTOMER1_EXPENSE_FPRMS_SET",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "FISCPRD",
      "TRDR",
      "TRNDATE",
    ],

    outputs: [
      "TRDR.AFM",
      "TRDR.NAME",
      "FINDOC.NETAMNT",
      "FINDOC.VATAMNT",
      "TRDR.TRDCATEGORY",
      "FINDOC.FPRMS",
      "FINDOC.EXPN",
      "FINDOC.TRNDATE",
    ],

    executionStrategy: "SQLDATA",

    tags: [
      "expenses",
      "financial",
      "findoc",
    ],

    notes: [
      "TRDR.KEPYOSTS is observed in the supplied report but its business meaning remains unresolved.",
    ],
  },
];
