export type SoftOneFieldSemanticStatus =
  | "VERIFIED"
  | "DERIVED";


export interface SoftOneFieldSemantic {
  canonical: string;

  table: string;

  field: string;

  meaning: string;

  status:
    SoftOneFieldSemanticStatus;

  appliesToObjects?: string[];

  semanticRole:
    | "PRIMARY_KEY"
    | "FOREIGN_KEY"
    | "DOMAIN_VALUE"
    | "QUANTITY"
    | "PRICE"
    | "CODE"
    | "DESCRIPTION"
    | "DOCUMENT_SERIES"
    | "VALUE"
    | "UNKNOWN";

  references?: {
    object?: string;

    table?: string;
  };

  evidence: string[];

  notes?: string[];
}


export const SOFTONE_FIELD_SEMANTICS:
  SoftOneFieldSemantic[] = [
    {
      canonical:
        "FIELD:FINDOC.TRDR",

      table:
        "FINDOC",

      field:
        "TRDR",

      meaning:
        "Trader reference of the document; in SALDOC context this is the Customer field.",

      status:
        "VERIFIED",

      appliesToObjects: [
        "SALDOC",
      ],

      semanticRole:
        "FOREIGN_KEY",

      references: {
        table:
          "TRDR",
      },

      evidence: [
        "BLACKBOOK_FINDOC_TRDR_CUSTOMER",
        "BLACKBOOK_SALDOC_CREATE_EXAMPLE",
      ],

      notes: [
        "Do not globally label FINDOC.TRDR as Customer outside document context; the trader domain depends on the document/object.",
      ],
    },

    {
      canonical:
        "FIELD:ITELINES.MTRL",

      table:
        "ITELINES",

      field:
        "MTRL",

      meaning:
        "Item/material reference of the document item line.",

      status:
        "VERIFIED",

      semanticRole:
        "FOREIGN_KEY",

      references: {
        object:
          "ITEM",

        table:
          "MTRL",
      },

      evidence: [
        "BLACKBOOK_ITELINES_APPEND_ITEM_EXAMPLE",
        "BLACKBOOK_ITELINES_MTRL_EDITOR",
      ],
    },

    {
      canonical:
        "FIELD:ITELINES.QTY1",

      table:
        "ITELINES",

      field:
        "QTY1",

      meaning:
        "Primary quantity of the document item line.",

      status:
        "VERIFIED",

      semanticRole:
        "QUANTITY",

      evidence: [
        "BLACKBOOK_ITELINES_APPEND_ITEM_EXAMPLE",
        "BLACKBOOK_FILTERSUM_QTY1",
      ],
    },

    {
      canonical:
        "FIELD:ITELINES.PRICE",

      table:
        "ITELINES",

      field:
        "PRICE",

      meaning:
        "Item line price.",

      status:
        "VERIFIED",

      semanticRole:
        "PRICE",

      evidence: [
        "BLACKBOOK_KEEPHANDPRC_ITEM_PRICE",
        "BLACKBOOK_SALDOC_CREATE_EXAMPLE",
      ],
    },

    {
      canonical:
        "FIELD:FINDOC.SERIES",

      table:
        "FINDOC",

      field:
        "SERIES",

      meaning:
        "Document series identifier.",

      status:
        "DERIVED",

      semanticRole:
        "DOCUMENT_SERIES",

      evidence: [
        "BLACKBOOK_SALDOC_CREATE_EXAMPLE",
        "BLACKBOOK_PURDOC_CREATE_EXAMPLE",
      ],

      notes: [
        "Repeatedly used as the document series in documented object examples; retain DERIVED until a formal field-definition source is ingested.",
      ],
    },
  ];


function normalize(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
}


export function findSoftOneFieldSemantic(
  canonical: string,
  object?: string,
): SoftOneFieldSemantic | undefined {
  const key =
    normalize(
      canonical,
    );


  const candidates =
    SOFTONE_FIELD_SEMANTICS.filter(
      entry =>
        normalize(
          entry.canonical,
        ) ===
          key,
    );


  if (
    !object
  ) {
    /*
     * Never leak object-specific semantics into an unknown context.
     *
     * Example:
     *   FINDOC.TRDR may have a SALDOC-specific interpretation,
     *   but that must not automatically apply to ITEDOC/PURDOC
     *   or any other object using FINDOC.
     */
    return candidates.find(
      entry =>
        !entry.appliesToObjects ||
        entry.appliesToObjects.length ===
          0,
    );
  }


  const normalizedObject =
    normalize(
      object,
    );


  return (
    candidates.find(
      entry =>
        entry.appliesToObjects?.some(
          candidate =>
            normalize(
              candidate,
            ) ===
              normalizedObject,
        ),
    ) ??
    candidates.find(
      entry =>
        !entry.appliesToObjects ||
        entry.appliesToObjects.length ===
          0,
    )
  );
}
