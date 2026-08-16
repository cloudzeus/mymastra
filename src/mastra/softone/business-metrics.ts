import type {
  SoftOneEvidenceStatus,
  SoftOneProvenance,
} from "./semantic-facts";

export type SoftOneBusinessMetric = {
  id: string;
  concept: string;
  description: string;

  businessObject: string;
  outputAlias: string;
  outputType: "QUANTITY" | "VALUE" | "COUNT" | "TEXT";

  factDependencies: string[];

  physicalSources: string[];

  dimensions: string[];

  aggregate?: "SUM" | "COUNT" | "MIN" | "MAX" | "NONE";

  expressionDescription: string;

  evidenceStatus: SoftOneEvidenceStatus;
  provenance: SoftOneProvenance[];

  composableWith?: string[];

  notes?: string[];
};

export const SOFTONE_BUSINESS_METRICS: SoftOneBusinessMetric[] = [
  {
    id: "ITEM_AVAILABLE",
    concept: "available stock",
    description:
      "Available quantity per item from MTRDATA.QTY1 in the verified stock query.",

    businessObject: "ITEM",
    outputAlias: "AVAILABLE",
    outputType: "QUANTITY",

    factDependencies: [
      "ITEM_AVAILABLE_QTY",
    ],

    physicalSources: [
      "MTRL",
      "MTRDATA",
    ],

    dimensions: [
      "COMPANY",
      "FISCPRD",
      "MTRL",
    ],

    aggregate: "NONE",

    expressionDescription:
      "ISNULL(MTRDATA.QTY1, 0)",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "ITEM_RESERVED",
      "ITEM_SUPPLIER_ORDER",
    ],
  },

  {
    id: "ITEM_SUPPLIER_ORDER",
    concept: "pending supplier order quantity",
    description:
      "Sum of SoftOne pending line quantities for pending MTRLINES whose RESTMODE belongs to RESTCATEG=1.",

    businessObject: "ITEM",
    outputAlias: "SUPPLIERORDER",
    outputType: "QUANTITY",

    factDependencies: [
      "PENDING_MTRL_LINE_QTY",
      "PENDING_LINE_SCOPE",
      "MTRLINES_RESTMODE_JOIN",
      "RESTMODE_SUPPLIER_PENDING_CATEGORY",
    ],

    physicalSources: [
      "MTRL",
      "MTRLINES",
      "RESTMODE",
    ],

    dimensions: [
      "COMPANY",
      "WHOUSE",
      "MTRL",
    ],

    aggregate: "SUM",

    expressionDescription:
      "SUM(dbo.fnSOGetLinePend(MTRLINES.FINDOC, MTRLINES.MTRLINES)) for PENDING=1 and RESTCATEG=1",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "ITEM_AVAILABLE",
      "ITEM_RESERVED",
    ],
  },

  {
    id: "ITEM_RESERVED",
    concept: "reserved stock quantity",
    description:
      "Sum of SoftOne pending line quantities for pending MTRLINES whose RESTMODE belongs to RESTCATEG=2.",

    businessObject: "ITEM",
    outputAlias: "RESERVED",
    outputType: "QUANTITY",

    factDependencies: [
      "PENDING_MTRL_LINE_QTY",
      "PENDING_LINE_SCOPE",
      "MTRLINES_RESTMODE_JOIN",
      "RESTMODE_RESERVED_CATEGORY",
    ],

    physicalSources: [
      "MTRL",
      "MTRLINES",
      "RESTMODE",
    ],

    dimensions: [
      "COMPANY",
      "WHOUSE",
      "MTRL",
    ],

    aggregate: "SUM",

    expressionDescription:
      "SUM(dbo.fnSOGetLinePend(MTRLINES.FINDOC, MTRLINES.MTRLINES)) for PENDING=1 and RESTCATEG=2",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "ITEM_AVAILABLE",
      "ITEM_SUPPLIER_ORDER",
    ],

    notes: [
      "This verified metric takes precedence over inferring reserved quantity solely from ITEM.SoReserved.",
    ],
  },
  {
    id: "CUSTOMER_DEBIT_NET",
    concept: "customer debit net value",
    description:
      "Net value of customer documents classified by the verified debit FPRMS set.",

    businessObject: "CUSTOMER",
    outputAlias: "DEBIT_NET",
    outputType: "VALUE",

    factDependencies: [
      "CUSTOMER_DOCUMENT_JOIN",
      "CUSTOMER_FINANCIAL_DOCUMENT_SCOPE",
      "CUSTOMER_DEBIT_FPRMS_SET",
      "CUSTOMER_NET_VALUE",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "FISCPRD",
      "TRDR",
      "AFM",
    ],

    aggregate: "SUM",

    expressionDescription:
      "SUM(FINDOC.NETAMNT) for documents whose FPRMS belongs to the verified debit set",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "CUSTOMER_CREDIT_NET",
      "CUSTOMER_DEBIT_VAT",
      "CUSTOMER_CREDIT_VAT",
    ],
  },

  {
    id: "CUSTOMER_CREDIT_NET",
    concept: "customer credit net value",
    description:
      "Net value of customer documents classified by the verified credit FPRMS set.",

    businessObject: "CUSTOMER",
    outputAlias: "CREDIT_NET",
    outputType: "VALUE",

    factDependencies: [
      "CUSTOMER_DOCUMENT_JOIN",
      "CUSTOMER_FINANCIAL_DOCUMENT_SCOPE",
      "CUSTOMER_CREDIT_FPRMS_SET",
      "CUSTOMER_NET_VALUE",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "FISCPRD",
      "TRDR",
      "AFM",
    ],

    aggregate: "SUM",

    expressionDescription:
      "SUM(FINDOC.NETAMNT) for documents whose FPRMS belongs to the verified credit set",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "CUSTOMER_DEBIT_NET",
      "CUSTOMER_DEBIT_VAT",
      "CUSTOMER_CREDIT_VAT",
    ],
  },

  {
    id: "CUSTOMER_DEBIT_VAT",
    concept: "customer debit VAT value",
    description:
      "VAT value of customer documents classified by the verified debit FPRMS set.",

    businessObject: "CUSTOMER",
    outputAlias: "DEBIT_VAT",
    outputType: "VALUE",

    factDependencies: [
      "CUSTOMER_DOCUMENT_JOIN",
      "CUSTOMER_FINANCIAL_DOCUMENT_SCOPE",
      "CUSTOMER_DEBIT_FPRMS_SET",
      "CUSTOMER_VAT_VALUE",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "FISCPRD",
      "TRDR",
      "AFM",
    ],

    aggregate: "SUM",

    expressionDescription:
      "SUM(FINDOC.VATAMNT) for documents whose FPRMS belongs to the verified debit set",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "CUSTOMER_DEBIT_NET",
      "CUSTOMER_CREDIT_NET",
      "CUSTOMER_CREDIT_VAT",
    ],
  },

  {
    id: "CUSTOMER_CREDIT_VAT",
    concept: "customer credit VAT value",
    description:
      "VAT value of customer documents classified by the verified credit FPRMS set.",

    businessObject: "CUSTOMER",
    outputAlias: "CREDIT_VAT",
    outputType: "VALUE",

    factDependencies: [
      "CUSTOMER_DOCUMENT_JOIN",
      "CUSTOMER_FINANCIAL_DOCUMENT_SCOPE",
      "CUSTOMER_CREDIT_FPRMS_SET",
      "CUSTOMER_VAT_VALUE",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "FISCPRD",
      "TRDR",
      "AFM",
    ],

    aggregate: "SUM",

    expressionDescription:
      "SUM(FINDOC.VATAMNT) for documents whose FPRMS belongs to the verified credit set",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "CUSTOMER_DEBIT_NET",
      "CUSTOMER_CREDIT_NET",
      "CUSTOMER_DEBIT_VAT",
    ],
  },

  {
    id: "ITEM_LAST_PURCHASE",
    concept: "last item purchase",
    description:
      "Most recent qualifying purchase transaction for an item, exposing purchase price, transaction date and document code.",

    businessObject: "ITEM",
    outputAlias: "LAST_PURCHASE",
    outputType: "VALUE",

    factDependencies: [
      "ITEM_PURCHASE_STAT_SOURCE",
      "ITEM_PURCHASE_ROW_FILTER",
      "SOFTONE_SQL_CURRENT_COMPANY",
      "ITEM_LAST_PURCHASE_ORDERING",
      "ITEM_LAST_PURCHASE_OPTIONAL_FILTERS",
    ],

    physicalSources: [
      "VMTRSTAT",
    ],

    dimensions: [
      "COMPANY",
      "MTRL",
      "FISCPRD",
      "TRNDATE",
    ],

    aggregate: "NONE",

    expressionDescription:
      "TOP 1 qualifying VMTRSTAT purchase row ordered by TRNDATE DESC, returning PURLPRICE, TRNDATE and FINCODE",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "ITEM_AVAILABLE",
      "ITEM_RESERVED",
      "ITEM_SUPPLIER_ORDER",
    ],

    notes: [
      "PURLPRICE is the purchase-price output used by the verified last-purchase query.",
      "No currency or tax interpretation of PURLPRICE is inferred without further evidence.",
    ],
  },

  {
    id: "OPEN_SUPPLIER_ORDERS",
    concept: "open supplier orders",
    description:
      "Supplier-order documents that satisfy the verified open-order document filters within a requested transaction-date range.",

    businessObject: "PURDOC",
    outputAlias: "OPEN_SUPPLIER_ORDERS",
    outputType: "COUNT",

    factDependencies: [
      "SUPPLIER_ORDER_DOCUMENT_RELATIONS",
      "OPEN_SUPPLIER_ORDER_DOCUMENT_FILTER",
      "SUPPLIER_ORDER_DATE_RANGE",
      "SUPPLIER_ORDER_OUTPUT_FIELDS",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "COMPANY",
      "FROM_DATE",
      "TO_DATE",
      "TRDR",
      "FINDOC",
    ],

    aggregate: "NONE",

    expressionDescription:
      "Qualifying FINDOC supplier-order rows with FULLYTRANSF in (0,2), enriched with supplier CODE and NAME from TRDR",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "Although the original SQL also joins MTRDOC, TRDEXTRA and PRSN, the current result set and filters only require FINDOC and TRDR.",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_NET",
    concept: "customer turnover net",
    description:
      "Net turnover per customer for a selected fiscal year and accounting-period range.",

    businessObject: "CUSTOMER",
    outputAlias: "NETTURNOVER",
    outputType: "VALUE",

    factDependencies: [
      "CUSTOMER_DOCUMENT_JOIN",
      "CUSTOMER_TURNOVER_DOCUMENT_FILTER",
      "CUSTOMER_TURNOVER_PERIOD_SCOPE",
      "CUSTOMER_TURNOVER_GROUPING",
      "CUSTOMER_TURNOVER_NET_VALUE",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "FISCPRD",
      "FROM_PERIOD",
      "TO_PERIOD",
      "AFM",
      "TRDR",
    ],

    aggregate: "SUM",

    expressionDescription:
      "SUM(FINDOC.NETAMNT) for FPRMS=7062 grouped by customer AFM, NAME and CITY",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "CUSTOMER_TURNOVER_VAT",
      "CUSTOMER_TURNOVER_DOCUMENT_COUNT",
      "CUSTOMER_DEBIT_NET",
      "CUSTOMER_CREDIT_NET",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_VAT",
    concept: "customer turnover VAT",
    description:
      "VAT total associated with the verified customer-turnover document scope.",

    businessObject: "CUSTOMER",
    outputAlias: "TURNOVERVAT",
    outputType: "VALUE",

    factDependencies: [
      "CUSTOMER_DOCUMENT_JOIN",
      "CUSTOMER_TURNOVER_DOCUMENT_FILTER",
      "CUSTOMER_TURNOVER_PERIOD_SCOPE",
      "CUSTOMER_TURNOVER_GROUPING",
      "CUSTOMER_TURNOVER_VAT_VALUE",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "FISCPRD",
      "FROM_PERIOD",
      "TO_PERIOD",
      "AFM",
      "TRDR",
    ],

    aggregate: "SUM",

    expressionDescription:
      "SUM(FINDOC.VATAMNT) for the verified customer-turnover scope",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "CUSTOMER_TURNOVER_NET",
      "CUSTOMER_TURNOVER_DOCUMENT_COUNT",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_DOCUMENT_COUNT",
    concept: "customer turnover document count",
    description:
      "Number of qualifying FINDOC rows per customer in the verified turnover query.",

    businessObject: "CUSTOMER",
    outputAlias: "DOCUMENTCOUNT",
    outputType: "COUNT",

    factDependencies: [
      "CUSTOMER_DOCUMENT_JOIN",
      "CUSTOMER_TURNOVER_DOCUMENT_FILTER",
      "CUSTOMER_TURNOVER_PERIOD_SCOPE",
      "CUSTOMER_TURNOVER_GROUPING",
      "CUSTOMER_TURNOVER_DOCUMENT_COUNT",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    dimensions: [
      "FISCPRD",
      "FROM_PERIOD",
      "TO_PERIOD",
      "AFM",
      "TRDR",
    ],

    aggregate: "COUNT",

    expressionDescription:
      "COUNT(TRDR.AFM) per grouped customer",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    composableWith: [
      "CUSTOMER_TURNOVER_NET",
      "CUSTOMER_TURNOVER_VAT",
    ],
  },

  {
    id: "DOCUMENT_ITEM_LINES",
    concept: "document item lines",
    description:
      "Material/item lines of a SoftOne document including quantities, price, discount, net value, VAT value and item primary unit.",

    businessObject: "ITEDOC",
    outputAlias: "DOCUMENT_ITEM_LINES",
    outputType: "COUNT",

    factDependencies: [
      "DOCUMENT_MATERIAL_LINES",
      "DOCUMENT_LINE_ITEM_JOIN",
      "DOCUMENT_LINE_QUANTITIES",
      "DOCUMENT_LINE_PRICE",
      "DOCUMENT_LINE_DISCOUNT_VALUE",
      "DOCUMENT_LINE_NET_VALUE",
      "DOCUMENT_LINE_VAT_VALUE",
      "ITEM_PRIMARY_UNIT_JOIN",
      "DOCUMENT_LINE_NUM02",
    ],

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

    aggregate: "NONE",

    expressionDescription:
      "MTRLINES belonging to a FINDOC enriched with MTRL item information and primary MTRUNIT information",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "This represents a row-set/dataset rather than a scalar business metric.",
      "MTRL is the internal item identifier; it must not be confused with MTRL.CODE.",
    ],
  },

];

export function getSoftOneBusinessMetric(
  id: string,
): SoftOneBusinessMetric | undefined {
  const normalized = id.trim().toUpperCase();

  return SOFTONE_BUSINESS_METRICS.find(
    (metric) => metric.id.toUpperCase() === normalized,
  );
}
