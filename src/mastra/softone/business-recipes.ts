import type {
  SoftOneEvidenceStatus,
  SoftOneProvenance,
} from "./semantic-facts";

export type SoftOneExecutionStrategy =
  | "GETDATA"
  | "SQLDATA"
  | "WRITE_PLAN";

export type SoftOneBusinessRecipe = {
  id: string;
  version: number;

  intent: string[];
  description: string;

  businessObject: string;

  executionStrategy: SoftOneExecutionStrategy;

  metricDependencies: string[];

  physicalSources: string[];

  parameters: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;

  output: Array<{
    name: string;
    meaning: string;
  }>;

  sqlTemplate?: string;

  templateParameterStyle?:
    | "INTERNAL_SEMANTIC_TOKENS"
    | "SOFTONE_LITERAL_PLACEHOLDERS"
    | "SOFTONE_SYSTEM_CONTEXT";

  evidenceStatus: SoftOneEvidenceStatus;
  provenance: SoftOneProvenance[];

  status: "VERIFIED" | "DRAFT" | "DEPRECATED";

  notes?: string[];
};

export const SOFTONE_BUSINESS_RECIPES: SoftOneBusinessRecipe[] = [
  {
    id: "ITEM_STOCK_POSITION",
    version: 1,

    intent: [
      "δεσμευμένα είδη",
      "δεσμευμένη ποσότητα",
      "reserved stock",
      "reserved items",
      "διαθέσιμο απόθεμα",
      "εκκρεμείς παραγγελίες προμηθευτών",
      "supplier pending orders",
      "stock position",
    ],

    description:
      "Verified item stock-position query exposing available quantity, pending supplier quantity and reserved quantity.",

    businessObject: "ITEM",

    executionStrategy: "SQLDATA",

    metricDependencies: [
      "ITEM_AVAILABLE",
      "ITEM_SUPPLIER_ORDER",
      "ITEM_RESERVED",
    ],

    physicalSources: [
      "MTRL",
      "MTRDATA",
      "MTRLINES",
      "RESTMODE",
    ],

    parameters: [
      {
        name: "COMPANY",
        description: "SoftOne company identifier",
        required: true,
      },
      {
        name: "WHOUSE",
        description: "SoftOne warehouse identifier",
        required: true,
      },
      {
        name: "FISCPRD",
        description: "SoftOne fiscal period identifier",
        required: true,
      },
    ],

    output: [
      {
        name: "MTRL",
        meaning: "Material/item identifier",
      },
      {
        name: "ERPCODE",
        meaning: "ERP item code from MTRL.CODE",
      },
      {
        name: "EANCODE",
        meaning: "EAN code from MTRL.CODE1",
      },
      {
        name: "MANUFACTURECODE",
        meaning: "Manufacturer code from MTRL.CODE2",
      },
      {
        name: "NAME",
        meaning: "Item description from MTRL.NAME",
      },
      {
        name: "AVAILABLE",
        meaning: "Available quantity from ITEM_AVAILABLE metric",
      },
      {
        name: "SUPPLIERORDER",
        meaning: "Pending supplier order quantity",
      },
      {
        name: "RESERVED",
        meaning: "Reserved quantity",
      },
    ],

    templateParameterStyle: "INTERNAL_SEMANTIC_TOKENS",

    sqlTemplate: `
SELECT
    A.MTRL,
    A.CODE AS ERPCODE,
    A.CODE1 AS EANCODE,
    A.CODE2 AS MANUFACTURECODE,
    A.NAME,
    ISNULL(B.QTY1, 0) AS AVAILABLE,

    ISNULL((
        SELECT
            SUM(
                dbo.fnSOGetLinePend(
                    Z1.FINDOC,
                    Z1.MTRLINES
                )
            )
        FROM MTRLINES Z1
        INNER JOIN RESTMODE Z2
            ON Z2.COMPANY = Z1.COMPANY
           AND Z2.RESTMODE = Z1.RESTMODE
        WHERE
            Z1.MTRL = A.MTRL
            AND Z1.COMPANY = {{COMPANY}}
            AND Z1.PENDING = 1
            AND Z1.WHOUSE = {{WHOUSE}}
            AND Z2.RESTCATEG = 1
    ), 0) AS SUPPLIERORDER,

    ISNULL((
        SELECT
            SUM(
                dbo.fnSOGetLinePend(
                    Z1.FINDOC,
                    Z1.MTRLINES
                )
            )
        FROM MTRLINES Z1
        INNER JOIN RESTMODE Z2
            ON Z2.COMPANY = Z1.COMPANY
           AND Z2.RESTMODE = Z1.RESTMODE
        WHERE
            Z1.MTRL = A.MTRL
            AND Z1.COMPANY = {{COMPANY}}
            AND Z1.PENDING = 1
            AND Z1.WHOUSE = {{WHOUSE}}
            AND Z2.RESTCATEG = 2
    ), 0) AS RESERVED

FROM MTRL A

LEFT JOIN MTRDATA B
    ON B.COMPANY = {{COMPANY}}
   AND B.MTRL = A.MTRL
   AND B.FISCPRD = {{FISCPRD}}

WHERE
    A.COMPANY = {{COMPANY}}
    AND A.SODTYPE = 51
    AND A.ISACTIVE = 1
`.trim(),

    evidenceStatus: "VERIFIED",

    provenance: [
      "USER_VERIFIED_SQL",
    ],

    status: "VERIFIED",

    notes: [
      "SQL originated from a user-provided working SoftOne query.",
      "Internal {{...}} placeholders are NOT SoftOne SqlData parameter syntax.",
      "An execution adapter must translate semantic parameters to a verified SqlData parameter contract before execution.",
      "Do not replace semantic tokens with @VARIABLE or another parameter syntax without verified evidence.",
    ],
  },
  {
    id: "ITEM_LAST_PURCHASE",
    version: 1,

    intent: [
      "τελευταία αγορά είδους",
      "τελευταία τιμή αγοράς",
      "πότε αγοράστηκε τελευταία φορά",
      "τελευταίο παραστατικό αγοράς",
      "last purchase",
      "last purchase price",
      "latest item purchase",
    ],

    description:
      "Verified SoftOne SQL query returning the latest qualifying purchase transaction for an item.",

    businessObject: "ITEM",

    executionStrategy: "SQLDATA",

    metricDependencies: [
      "ITEM_LAST_PURCHASE",
    ],

    physicalSources: [
      "VMTRSTAT",
    ],

    parameters: [
      {
        name: "MTRL",
        description: "Optional material/item identifier",
        required: false,
      },
      {
        name: "fromDate",
        description: "Optional minimum transaction date",
        required: false,
      },
      {
        name: "toDate",
        description: "Optional maximum transaction date",
        required: false,
      },
      {
        name: "fiscalYear",
        description: "Optional fiscal period identifier",
        required: false,
      },
    ],

    output: [
      {
        name: "MTRL",
        meaning: "Material/item identifier",
      },
      {
        name: "PURLPRICE",
        meaning: "Purchase price exposed by VMTRSTAT",
      },
      {
        name: "TRNDATE",
        meaning: "Transaction date",
      },
      {
        name: "FINCODE",
        meaning: "Document code",
      },
    ],

    templateParameterStyle: "SOFTONE_LITERAL_PLACEHOLDERS",

    sqlTemplate: `
SELECT TOP 1
    VS.MTRL,
    VS.PURLPRICE,
    VS.TRNDATE,
    VS.FINCODE
FROM
    VMTRSTAT VS
WHERE
    VS.MSODTYPE = 51
    AND VS.PURQTY1 > 0
    AND (VS.MTRL = '{MTRL}' OR '{MTRL}' = CHAR(123) + 'MTRL' + CHAR(125))
    AND VS.TRNDATE BETWEEN
        ISNULL(
            NULLIF(
                '{fromDate}',
                CHAR(123) + 'fromDate' + CHAR(125)
            ),
            '1900-01-01'
        )
        AND
        ISNULL(
            NULLIF(
                '{toDate}',
                CHAR(123) + 'toDate' + CHAR(125)
            ),
            '9999-12-31'
        )
    AND (
        VS.FISCPRD = '{fiscalYear}'
        OR '{fiscalYear}' = CHAR(123) + 'fiscalYear' + CHAR(125)
    )
    AND VS.SOSOURCE = 1251
    AND VS.COMPANY = :X.SYS.COMPANY
ORDER BY
    VS.TRNDATE DESC
`.trim(),

    evidenceStatus: "VERIFIED",

    provenance: [
      "USER_VERIFIED_SQL",
    ],

    status: "VERIFIED",

    notes: [
      "SQL preserves the supplied working SoftOne placeholder mechanism.",
      ":X.SYS.COMPANY is a verified SoftOne SQL context expression.",
      "SOSOURCE=1251 is recipe-scoped verified knowledge, not automatically a universal SoftOne constant.",
      "The query defines latest by TRNDATE DESC only; no secondary ordering is verified.",
    ],
  },

  {
    id: "OPEN_SUPPLIER_ORDERS",
    version: 1,

    intent: [
      "εκκρεμείς παραγγελίες προμηθευτών",
      "ανοιχτές παραγγελίες προμηθευτών",
      "παραγγελίες αγορών που δεν έχουν ολοκληρωθεί",
      "open supplier orders",
      "pending supplier orders",
      "unfulfilled purchase orders",
    ],

    description:
      "Verified SoftOne SQL report returning open supplier-order documents for a parameterized transaction-date range.",

    businessObject: "PURDOC",

    executionStrategy: "SQLDATA",

    metricDependencies: [
      "OPEN_SUPPLIER_ORDERS",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    parameters: [
      {
        name: "fromDate",
        description: "Inclusive minimum FINDOC.TRNDATE",
        required: true,
      },
      {
        name: "toDate",
        description: "Exclusive maximum FINDOC.TRNDATE",
        required: true,
      },
    ],

    output: [
      {
        name: "TRNDATE",
        meaning: "Supplier order transaction date",
      },
      {
        name: "FINCODE",
        meaning: "Supplier order document code",
      },
      {
        name: "SUPPLIERCODE",
        meaning: "Supplier code from TRDR.CODE",
      },
      {
        name: "SUPPLIERNAME",
        meaning: "Supplier name from TRDR.NAME",
      },
      {
        name: "SUMAMNT",
        meaning: "Document SUMAMNT exposed by the verified report",
      },
    ],

    templateParameterStyle: "SOFTONE_LITERAL_PLACEHOLDERS",

    sqlTemplate: `
SELECT
    A.TRNDATE AS TRNDATE,
    A.FINCODE AS FINCODE,
    C.CODE AS SUPPLIERCODE,
    C.NAME AS SUPPLIERNAME,
    ISNULL(A.SUMAMNT, 0) AS SUMAMNT
FROM FINDOC A
LEFT OUTER JOIN TRDR C
    ON A.TRDR = C.TRDR
WHERE
    A.COMPANY = :X.SYS.COMPANY
    AND A.SOSOURCE = 1251
    AND A.TRNDATE >= '{fromDate}'
    AND A.TRNDATE < '{toDate}'
    AND A.TFPRMS = 201
    AND A.SODTYPE = 12
    AND A.FULLYTRANSF IN (0,2)
ORDER BY
    A.TRNDATE DESC,
    A.FINDOC,
    C.NAME
`.trim(),

    evidenceStatus: "VERIFIED",

    provenance: [
      "USER_VERIFIED_SQL",
    ],

    status: "VERIFIED",

    notes: [
      "The original supplied SQL also joined MTRDOC, TRDEXTRA and PRSN, but those joins were not required by any selected column or filter and are therefore omitted from this normalized recipe.",
      "Date range preserves the verified inclusive-from / exclusive-to behavior.",
      "COMPANY uses the verified SoftOne system context expression :X.SYS.COMPANY.",
      "SOSOURCE=1251, TFPRMS=201, SODTYPE=12 and FULLYTRANSF in (0,2) remain recipe-scoped verified knowledge.",
    ],
  },

  {
    id: "CUSTOMER_TURNOVER_BY_PERIOD",
    version: 1,

    intent: [
      "τζίρος πελάτη",
      "τζίρος πελατών ανά χρονιά",
      "πωλήσεις ανά πελάτη",
      "καθαρή αξία ανά πελάτη",
      "customer turnover",
      "customer turnover by year",
      "sales by customer",
    ],

    description:
      "Verified customer-turnover report grouped by AFM, customer name and city for a selected fiscal year and accounting-period range.",

    businessObject: "CUSTOMER",

    executionStrategy: "SQLDATA",

    metricDependencies: [
      "CUSTOMER_TURNOVER_NET",
      "CUSTOMER_TURNOVER_VAT",
      "CUSTOMER_TURNOVER_DOCUMENT_COUNT",
    ],

    physicalSources: [
      "FINDOC",
      "TRDR",
    ],

    parameters: [
      {
        name: "fiscalYear",
        description: "SoftOne fiscal period/year identifier",
        required: true,
      },
      {
        name: "fromPeriod",
        description: "First accounting period, inclusive",
        required: true,
      },
      {
        name: "toPeriod",
        description: "Last accounting period, inclusive",
        required: true,
      },
    ],

    output: [
      {
        name: "AFM",
        meaning: "Customer VAT/tax number",
      },
      {
        name: "NAME",
        meaning: "Customer name",
      },
      {
        name: "NETTURNOVER",
        meaning: "SUM(FINDOC.NETAMNT)",
      },
      {
        name: "VAT",
        meaning: "SUM(FINDOC.VATAMNT)",
      },
      {
        name: "DOCUMENTCOUNT",
        meaning: "Number of qualifying rows/documents in the grouped result",
      },
      {
        name: "CITY",
        meaning: "Customer city",
      },
    ],

    templateParameterStyle: "SOFTONE_LITERAL_PLACEHOLDERS",

    sqlTemplate: `
SELECT
    C.AFM AS AFM,
    C.NAME AS NAME,
    SUM(A.NETAMNT) AS NETTURNOVER,
    SUM(A.VATAMNT) AS VAT,
    COUNT(C.AFM) AS DOCUMENTCOUNT,
    C.CITY AS CITY
FROM FINDOC A
LEFT JOIN TRDR C
    ON A.TRDR = C.TRDR
WHERE
    A.FPRMS = 7062
    AND A.FISCPRD = '{fiscalYear}'
    AND A.PERIOD BETWEEN '{fromPeriod}' AND '{toPeriod}'
    AND C.AFM <> ' '
GROUP BY
    C.AFM,
    C.NAME,
    C.CITY
ORDER BY
    SUM(A.NETAMNT) DESC
`.trim(),

    evidenceStatus: "VERIFIED",

    provenance: [
      "USER_VERIFIED_SQL",
    ],

    status: "VERIFIED",

    notes: [
      "FPRMS=7062 is recipe-scoped verified knowledge from the supplied working query.",
      "The original ORDER BY 'ΝΕΤΟ' was normalized to ORDER BY SUM(A.NETAMNT) DESC because a quoted string literal does not sort by the aggregate alias.",
      "COUNT(C.AFM) represents qualifying grouped rows, not distinct customer count.",
      "Accounting-period range uses BETWEEN and is therefore inclusive at both ends.",
    ],
  },

  {
    id: "DOCUMENT_ITEM_LINES",
    version: 1,

    intent: [
      "γραμμές παραστατικού",
      "είδη παραστατικού",
      "τι περιέχει το παραστατικό",
      "γραμμές ενός παραστατικού",
      "document lines",
      "document item lines",
      "invoice lines",
      "items in document",
    ],

    description:
      "Verified SoftOne SQL query returning material/item lines for a specific FINDOC.",

    businessObject: "ITEDOC",

    executionStrategy: "SQLDATA",

    metricDependencies: [
      "DOCUMENT_ITEM_LINES",
    ],

    physicalSources: [
      "MTRLINES",
      "MTRL",
      "MTRUNIT",
    ],

    parameters: [
      {
        name: "findoc",
        description: "SoftOne FINDOC document identifier",
        required: true,
      },
    ],

    output: [
      {
        name: "MTRL",
        meaning: "Internal material/item identifier",
      },
      {
        name: "CODE",
        meaning: "ERP item code from MTRL.CODE",
      },
      {
        name: "DESCRIPTION",
        meaning: "Item description from MTRL.NAME",
      },
      {
        name: "QTY",
        meaning: "MTRLINES.QTY",
      },
      {
        name: "QTY1",
        meaning: "MTRLINES.QTY1",
      },
      {
        name: "PRICE",
        meaning: "MTRLINES.PRICE",
      },
      {
        name: "DISC1VAL",
        meaning: "First discount value",
      },
      {
        name: "LINEVAL",
        meaning: "Net line value in the supplied verified query",
      },
      {
        name: "VATAMNT",
        meaning: "Line VAT amount",
      },
      {
        name: "UNITNAME",
        meaning: "Primary item unit name",
      },
      {
        name: "UNITCODE",
        meaning: "Primary item unit identifier",
      },
      {
        name: "NUM02",
        meaning: "MTRLINES.NUM02; business meaning unresolved",
      },
    ],

    templateParameterStyle: "SOFTONE_LITERAL_PLACEHOLDERS",

    sqlTemplate: `
SELECT
    M.MTRL AS MTRL,
    M.CODE AS CODE,
    M.NAME AS DESCRIPTION,
    F.QTY AS QTY,
    F.QTY1 AS QTY1,
    F.PRICE AS PRICE,
    F.DISC1VAL AS DISC1VAL,
    F.LINEVAL AS LINEVAL,
    F.VATAMNT AS VATAMNT,
    MU.NAME AS UNITNAME,
    MU.MTRUNIT AS UNITCODE,
    F.NUM02 AS NUM02
FROM MTRLINES F
INNER JOIN MTRL M
    ON M.MTRL = F.MTRL
INNER JOIN MTRUNIT MU
    ON M.MTRUNIT1 = MU.MTRUNIT
WHERE
    F.FINDOC = '{findoc}'
`.trim(),

    evidenceStatus: "VERIFIED",

    provenance: [
      "USER_VERIFIED_SQL",
    ],

    status: "VERIFIED",

    notes: [
      "The supplied query aliased MTRL.MTRL as code; this normalized recipe preserves MTRL separately and exposes actual MTRL.CODE as CODE.",
      "The supplied MTRUNIT scalar subqueries were normalized to fields from the already verified MTRUNIT join.",
      "NUM02 is exposed but its business semantics remain unresolved.",
      "QTY and QTY1 are both exposed without inventing their unit semantics.",
    ],
  },

];

export function getSoftOneBusinessRecipe(
  id: string,
): SoftOneBusinessRecipe | undefined {
  const normalized = id.trim().toUpperCase();

  return SOFTONE_BUSINESS_RECIPES.find(
    (recipe) => recipe.id.toUpperCase() === normalized,
  );
}
