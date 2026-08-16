export type SoftOneEvidenceStatus =
  | "VERIFIED"
  | "DERIVED"
  | "HYPOTHESIS";

export type SoftOneProvenance =
  | "USER_VERIFIED_SQL"
  | "SCHEMA_CACHE"
  | "RELATIONS_CACHE"
  | "CANONICAL_REGISTRY"
  | "LIVE_TENANT_VERIFICATION";

export type SoftOneSemanticFact = {
  id: string;
  concept: string;
  description: string;

  businessObject?: string;

  sources: string[];

  expression?: string;

  conditions?: string[];

  joins?: string[];

  dimensions?: string[];

  evidenceStatus: SoftOneEvidenceStatus;
  provenance: SoftOneProvenance[];

  notes?: string[];
};

export const SOFTONE_SEMANTIC_FACTS: SoftOneSemanticFact[] = [
  {
    id: "ITEM_ACTIVE_INVENTORY_FILTER",
    concept: "active inventory item",
    description:
      "Active inventory items are MTRL rows for the selected company with SODTYPE=51 and ISACTIVE=1.",
    businessObject: "ITEM",

    sources: [
      "MTRL.COMPANY",
      "MTRL.SODTYPE",
      "MTRL.ISACTIVE",
    ],

    conditions: [
      "MTRL.COMPANY = COMPANY",
      "MTRL.SODTYPE = 51",
      "MTRL.ISACTIVE = 1",
    ],

    dimensions: [
      "COMPANY",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "ITEM_AVAILABLE_QTY",
    concept: "available quantity",
    description:
      "The verified source query exposes MTRDATA.QTY1 as AVAILABLE for the requested stock view.",
    businessObject: "ITEM",

    sources: [
      "MTRL.MTRL",
      "MTRDATA.MTRL",
      "MTRDATA.COMPANY",
      "MTRDATA.FISCPRD",
      "MTRDATA.QTY1",
    ],

    expression:
      "ISNULL(MTRDATA.QTY1, 0)",

    joins: [
      "MTRDATA.COMPANY = MTRL.COMPANY",
      "MTRDATA.MTRL = MTRL.MTRL",
      "MTRDATA.FISCPRD = FISCPRD",
    ],

    dimensions: [
      "COMPANY",
      "FISCPRD",
      "MTRL",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "AVAILABLE is the business alias used by the verified source query.",
      "Do not infer broader SoftOne semantics for QTY1 beyond this verified recipe without additional evidence.",
    ],
  },

  {
    id: "PENDING_MTRL_LINE_QTY",
    concept: "pending material line quantity",
    description:
      "Pending quantity for a material line is calculated by SoftOne function dbo.fnSOGetLinePend using FINDOC and MTRLINES identifiers.",

    sources: [
      "MTRLINES.FINDOC",
      "MTRLINES.MTRLINES",
    ],

    expression:
      "dbo.fnSOGetLinePend(MTRLINES.FINDOC, MTRLINES.MTRLINES)",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "The internal implementation of fnSOGetLinePend is not inferred.",
      "Only its verified use in the supplied query is recorded.",
    ],
  },

  {
    id: "RESTMODE_SUPPLIER_PENDING_CATEGORY",
    concept: "supplier pending category",
    description:
      "RESTMODE.RESTCATEG=1 is used by the verified query for supplier pending quantity.",

    sources: [
      "RESTMODE.RESTCATEG",
      "RESTMODE.RESTMODE",
      "RESTMODE.COMPANY",
    ],

    conditions: [
      "RESTMODE.RESTCATEG = 1",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "RESTMODE_RESERVED_CATEGORY",
    concept: "reserved quantity category",
    description:
      "RESTMODE.RESTCATEG=2 is used by the verified query for reserved quantity.",

    sources: [
      "RESTMODE.RESTCATEG",
      "RESTMODE.RESTMODE",
      "RESTMODE.COMPANY",
    ],

    conditions: [
      "RESTMODE.RESTCATEG = 2",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "PENDING_LINE_SCOPE",
    concept: "pending line scope",
    description:
      "Pending material lines in the verified calculation are restricted by company, warehouse and PENDING=1.",

    sources: [
      "MTRLINES.COMPANY",
      "MTRLINES.WHOUSE",
      "MTRLINES.PENDING",
      "MTRLINES.MTRL",
    ],

    conditions: [
      "MTRLINES.COMPANY = COMPANY",
      "MTRLINES.WHOUSE = WHOUSE",
      "MTRLINES.PENDING = 1",
    ],

    dimensions: [
      "COMPANY",
      "WHOUSE",
      "MTRL",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "MTRLINES_RESTMODE_JOIN",
    concept: "material line restriction mode relation",
    description:
      "The verified query associates MTRLINES with RESTMODE by COMPANY and RESTMODE.",

    sources: [
      "MTRLINES.COMPANY",
      "MTRLINES.RESTMODE",
      "RESTMODE.COMPANY",
      "RESTMODE.RESTMODE",
    ],

    joins: [
      "MTRLINES.COMPANY = RESTMODE.COMPANY",
      "MTRLINES.RESTMODE = RESTMODE.RESTMODE",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },
  {
    id: "CUSTOMER_DOCUMENT_JOIN",
    concept: "customer document relation",
    description:
      "Customer documents in FINDOC are related to customer records in TRDR through FINDOC.TRDR = TRDR.TRDR.",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.TRDR",
      "TRDR.TRDR",
    ],

    joins: [
      "FINDOC.TRDR = TRDR.TRDR",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_FINANCIAL_DOCUMENT_SCOPE",
    concept: "customer financial document scope",
    description:
      "The verified customer debit/credit query includes non-cancelled FINDOC rows with non-zero NETAMNT, a selected fiscal period, customer AFM present, and TRDCATEGORY in 3000 or 3005.",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.ISCANCEL",
      "FINDOC.NETAMNT",
      "FINDOC.FISCPRD",
      "TRDR.AFM",
      "TRDR.TRDCATEGORY",
    ],

    conditions: [
      "FINDOC.ISCANCEL = 0",
      "FINDOC.NETAMNT <> 0",
      "FINDOC.FISCPRD = FISCPRD",
      "TRDR.AFM IS NOT NULL",
      "TRDR.TRDCATEGORY IN (3000, 3005)",
    ],

    dimensions: [
      "FISCPRD",
      "TRDR",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_DEBIT_FPRMS_SET",
    concept: "customer debit document forms",
    description:
      "The verified query classifies these FINDOC.FPRMS values as debit documents.",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.FPRMS",
    ],

    conditions: [
      "FINDOC.FPRMS IN (7061,7062,7067,7074,7077,7078,7081,7082,7083,7091,7092,7760)",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_CREDIT_FPRMS_SET",
    concept: "customer credit document forms",
    description:
      "The verified query classifies these FINDOC.FPRMS values as credit documents.",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.FPRMS",
    ],

    conditions: [
      "FINDOC.FPRMS IN (7063,7064,7066,7068,7069)",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_NET_VALUE",
    concept: "customer net document value",
    description:
      "Customer net value is aggregated from FINDOC.NETAMNT in the verified debit/credit report.",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.NETAMNT",
    ],

    expression:
      "SUM(FINDOC.NETAMNT)",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_VAT_VALUE",
    concept: "customer VAT document value",
    description:
      "Customer VAT value is aggregated from FINDOC.VATAMNT in the verified debit/credit report.",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.VATAMNT",
    ],

    expression:
      "SUM(FINDOC.VATAMNT)",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "ITEM_PURCHASE_STAT_SOURCE",
    concept: "item purchase statistics source",
    description:
      "VMTRSTAT is used by the verified query as the source for item purchase history including purchase quantity, purchase price, transaction date and document code.",

    businessObject: "ITEM",

    sources: [
      "VMTRSTAT.MTRL",
      "VMTRSTAT.MSODTYPE",
      "VMTRSTAT.PURQTY1",
      "VMTRSTAT.PURLPRICE",
      "VMTRSTAT.TRNDATE",
      "VMTRSTAT.FINCODE",
      "VMTRSTAT.FISCPRD",
      "VMTRSTAT.SOSOURCE",
      "VMTRSTAT.COMPANY",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "VMTRSTAT is treated as a verified SQL/reporting source from the supplied working query.",
      "Its underlying physical implementation is not inferred here.",
    ],
  },

  {
    id: "ITEM_PURCHASE_ROW_FILTER",
    concept: "item purchase transaction",
    description:
      "The verified last-purchase query identifies item purchase rows using MSODTYPE=51, PURQTY1>0 and SOSOURCE=1251.",

    businessObject: "ITEM",

    sources: [
      "VMTRSTAT.MSODTYPE",
      "VMTRSTAT.PURQTY1",
      "VMTRSTAT.SOSOURCE",
    ],

    conditions: [
      "VMTRSTAT.MSODTYPE = 51",
      "VMTRSTAT.PURQTY1 > 0",
      "VMTRSTAT.SOSOURCE = 1251",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "SOSOURCE=1251 is verified for this supplied business query and must not automatically be treated as a universal SoftOne constant across all tenants/configurations.",
    ],
  },

  {
    id: "SOFTONE_SQL_CURRENT_COMPANY",
    concept: "current SoftOne company SQL context",
    description:
      "The verified SoftOne SQL script uses :X.SYS.COMPANY to scope data to the current SoftOne company.",

    sources: [
      "VMTRSTAT.COMPANY",
    ],

    expression:
      ":X.SYS.COMPANY",

    conditions: [
      "VMTRSTAT.COMPANY = :X.SYS.COMPANY",
    ],

    dimensions: [
      "COMPANY",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      ":X.SYS.COMPANY is SoftOne SQL-script context syntax and is distinct from application/runtime SqlData parameters.",
    ],
  },

  {
    id: "ITEM_LAST_PURCHASE_ORDERING",
    concept: "last item purchase",
    description:
      "The latest qualifying item purchase is selected by ordering qualifying VMTRSTAT rows by TRNDATE descending and taking TOP 1.",

    businessObject: "ITEM",

    sources: [
      "VMTRSTAT.TRNDATE",
    ],

    expression:
      "TOP 1 ... ORDER BY VMTRSTAT.TRNDATE DESC",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "If multiple purchase rows share the same TRNDATE, this query does not define an additional deterministic tie-breaker.",
    ],
  },

  {
    id: "ITEM_LAST_PURCHASE_OPTIONAL_FILTERS",
    concept: "last purchase optional filters",
    description:
      "The verified query supports optional filtering by MTRL, transaction date range and fiscal period using unresolved-template sentinel checks.",

    businessObject: "ITEM",

    sources: [
      "VMTRSTAT.MTRL",
      "VMTRSTAT.TRNDATE",
      "VMTRSTAT.FISCPRD",
    ],

    conditions: [
      "MTRL may be omitted using the literal unresolved {MTRL} sentinel",
      "fromDate defaults to 1900-01-01 when unresolved",
      "toDate defaults to 9999-12-31 when unresolved",
      "FISCPRD may be omitted using the literal unresolved {fiscalYear} sentinel",
    ],

    dimensions: [
      "MTRL",
      "TRNDATE",
      "FISCPRD",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "The CHAR(123)/CHAR(125) comparisons are part of the verified SoftOne SQL-template pattern.",
      "Do not replace this optional-parameter mechanism with @variables unless a different execution contract is explicitly verified.",
    ],
  },

  {
    id: "SUPPLIER_ORDER_DOCUMENT_RELATIONS",
    concept: "supplier order document relations",
    description:
      "The verified open supplier orders query uses FINDOC as the document source and relates it to MTRDOC, TRDR, TRDEXTRA and PRSN.",

    sources: [
      "FINDOC.FINDOC",
      "FINDOC.TRDR",
      "FINDOC.SALESMAN",
      "MTRDOC.FINDOC",
      "TRDR.TRDR",
      "TRDEXTRA.TRDR",
      "PRSN.PRSN",
    ],

    joins: [
      "FINDOC.FINDOC = MTRDOC.FINDOC",
      "FINDOC.TRDR = TRDR.TRDR",
      "FINDOC.TRDR = TRDEXTRA.TRDR",
      "FINDOC.SALESMAN = PRSN.PRSN",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "Only TRDR fields are required by the currently verified output; MTRDOC, TRDEXTRA and PRSN are present in the supplied query but are not currently required for its selected columns or filters.",
    ],
  },

  {
    id: "OPEN_SUPPLIER_ORDER_DOCUMENT_FILTER",
    concept: "open supplier order",
    description:
      "The supplied verified query identifies open supplier-order documents using SOSOURCE=1251, TFPRMS=201, SODTYPE=12 and FULLYTRANSF in (0,2).",

    sources: [
      "FINDOC.SOSOURCE",
      "FINDOC.TFPRMS",
      "FINDOC.SODTYPE",
      "FINDOC.FULLYTRANSF",
    ],

    conditions: [
      "FINDOC.SOSOURCE = 1251",
      "FINDOC.TFPRMS = 201",
      "FINDOC.SODTYPE = 12",
      "FINDOC.FULLYTRANSF IN (0,2)",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "These numeric values are verified for the supplied business query and are not promoted to universal SoftOne constants.",
      "The exact semantic distinction between FULLYTRANSF=0 and FULLYTRANSF=2 is not inferred beyond both being included in the verified open-order query.",
    ],
  },

  {
    id: "SUPPLIER_ORDER_DATE_RANGE",
    concept: "supplier order date range",
    description:
      "Open supplier orders are filtered by FINDOC.TRNDATE using an inclusive lower bound and exclusive upper bound.",

    sources: [
      "FINDOC.TRNDATE",
    ],

    conditions: [
      "FINDOC.TRNDATE >= FROM_DATE",
      "FINDOC.TRNDATE < TO_DATE",
    ],

    dimensions: [
      "FROM_DATE",
      "TO_DATE",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "The upper date boundary is exclusive, matching the supplied working SQL.",
    ],
  },

  {
    id: "SUPPLIER_ORDER_OUTPUT_FIELDS",
    concept: "supplier order output",
    description:
      "The verified open supplier-order report exposes order date, document code, supplier code, supplier name and SUMAMNT.",

    sources: [
      "FINDOC.TRNDATE",
      "FINDOC.FINCODE",
      "TRDR.CODE",
      "TRDR.NAME",
      "FINDOC.SUMAMNT",
    ],

    expression:
      "ISNULL(FINDOC.SUMAMNT, 0)",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "No broader accounting interpretation of SUMAMNT is inferred beyond its use as the amount exposed by this verified report.",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_DOCUMENT_FILTER",
    concept: "customer turnover document scope",
    description:
      "The verified customer-turnover query uses FINDOC.FPRMS=7062 and excludes customers with blank AFM.",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.FPRMS",
      "TRDR.AFM",
    ],

    conditions: [
      "FINDOC.FPRMS = 7062",
      "TRDR.AFM <> ' '",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "FPRMS=7062 is verified for this supplied turnover recipe and must not automatically be treated as the universal SoftOne definition of turnover.",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_PERIOD_SCOPE",
    concept: "customer turnover fiscal period",
    description:
      "The verified turnover query scopes FINDOC by fiscal period and accounting period range.",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.FISCPRD",
      "FINDOC.PERIOD",
    ],

    conditions: [
      "FINDOC.FISCPRD = FISCPRD",
      "FINDOC.PERIOD BETWEEN FROM_PERIOD AND TO_PERIOD",
    ],

    dimensions: [
      "FISCPRD",
      "FROM_PERIOD",
      "TO_PERIOD",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_GROUPING",
    concept: "customer turnover grouping",
    description:
      "The verified turnover query aggregates results by customer AFM, name and city.",

    businessObject: "CUSTOMER",

    sources: [
      "TRDR.AFM",
      "TRDR.NAME",
      "TRDR.CITY",
    ],

    dimensions: [
      "AFM",
      "NAME",
      "CITY",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_NET_VALUE",
    concept: "customer turnover net value",
    description:
      "Net customer turnover in the verified recipe is SUM(FINDOC.NETAMNT).",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.NETAMNT",
    ],

    expression:
      "SUM(FINDOC.NETAMNT)",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_VAT_VALUE",
    concept: "customer turnover VAT value",
    description:
      "VAT value in the verified customer-turnover recipe is SUM(FINDOC.VATAMNT).",

    businessObject: "CUSTOMER",

    sources: [
      "FINDOC.VATAMNT",
    ],

    expression:
      "SUM(FINDOC.VATAMNT)",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_DOCUMENT_COUNT",
    concept: "customer turnover document row count",
    description:
      "COUNT(TRDR.AFM) in the supplied grouped query counts qualifying joined FINDOC rows per customer group; it does not count distinct customers.",

    businessObject: "CUSTOMER",

    sources: [
      "TRDR.AFM",
      "FINDOC.FINDOC",
    ],

    expression:
      "COUNT(TRDR.AFM)",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "DOCUMENT_MATERIAL_LINES",
    concept: "document material lines",
    description:
      "Material lines belonging to a SoftOne document are selected from MTRLINES by matching MTRLINES.FINDOC to the document FINDOC identifier.",

    sources: [
      "MTRLINES.FINDOC",
      "MTRLINES.MTRLINES",
      "MTRLINES.MTRL",
    ],

    conditions: [
      "MTRLINES.FINDOC = FINDOC",
    ],

    dimensions: [
      "FINDOC",
      "MTRLINES",
      "MTRL",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "DOCUMENT_LINE_ITEM_JOIN",
    concept: "document line item relation",
    description:
      "A material document line is related to its item through MTRLINES.MTRL = MTRL.MTRL.",

    businessObject: "ITEM",

    sources: [
      "MTRLINES.MTRL",
      "MTRL.MTRL",
    ],

    joins: [
      "MTRLINES.MTRL = MTRL.MTRL",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "DOCUMENT_LINE_QUANTITIES",
    concept: "document line quantities",
    description:
      "The verified document-line query exposes MTRLINES.QTY and MTRLINES.QTY1 as line quantity fields.",

    sources: [
      "MTRLINES.QTY",
      "MTRLINES.QTY1",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "The exact semantic distinction or unit interpretation between QTY and QTY1 is not inferred from this query alone.",
    ],
  },

  {
    id: "DOCUMENT_LINE_PRICE",
    concept: "document line price",
    description:
      "The verified document-line query exposes MTRLINES.PRICE as the line price field.",

    sources: [
      "MTRLINES.PRICE",
    ],

    expression:
      "MTRLINES.PRICE",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "Tax inclusion, currency and price-list semantics are not inferred from this query alone.",
    ],
  },

  {
    id: "DOCUMENT_LINE_DISCOUNT_VALUE",
    concept: "document line discount value",
    description:
      "The verified document-line query exposes MTRLINES.DISC1VAL as the first discount value.",

    sources: [
      "MTRLINES.DISC1VAL",
    ],

    expression:
      "MTRLINES.DISC1VAL",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "DOCUMENT_LINE_NET_VALUE",
    concept: "document line net value",
    description:
      "The supplied verified query exposes MTRLINES.LINEVAL as the line value labelled καθαρή αξία.",

    sources: [
      "MTRLINES.LINEVAL",
    ],

    expression:
      "MTRLINES.LINEVAL",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "LINEVAL is treated as net line value within the supplied business query.",
    ],
  },

  {
    id: "DOCUMENT_LINE_VAT_VALUE",
    concept: "document line VAT value",
    description:
      "The verified document-line query exposes MTRLINES.VATAMNT as the line VAT amount.",

    sources: [
      "MTRLINES.VATAMNT",
    ],

    expression:
      "MTRLINES.VATAMNT",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "ITEM_PRIMARY_UNIT_JOIN",
    concept: "item primary unit",
    description:
      "The verified query resolves the item's primary unit through MTRL.MTRUNIT1 = MTRUNIT.MTRUNIT.",

    businessObject: "ITEM",

    sources: [
      "MTRL.MTRUNIT1",
      "MTRUNIT.MTRUNIT",
      "MTRUNIT.NAME",
    ],

    joins: [
      "MTRL.MTRUNIT1 = MTRUNIT.MTRUNIT",
    ],

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],
  },

  {
    id: "DOCUMENT_LINE_NUM02",
    concept: "document line NUM02",
    description:
      "The verified document-line query exposes MTRLINES.NUM02.",

    sources: [
      "MTRLINES.NUM02",
    ],

    expression:
      "MTRLINES.NUM02",

    evidenceStatus: "VERIFIED",
    provenance: [
      "USER_VERIFIED_SQL",
    ],

    notes: [
      "No business meaning for NUM02 is inferred because the supplied query does not establish one.",
    ],
  },

];

export function getSoftOneSemanticFact(
  id: string,
): SoftOneSemanticFact | undefined {
  const normalized = id.trim().toUpperCase();

  return SOFTONE_SEMANTIC_FACTS.find(
    (fact) => fact.id.toUpperCase() === normalized,
  );
}
