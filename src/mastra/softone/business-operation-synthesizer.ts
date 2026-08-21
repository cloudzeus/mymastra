import type {
  SoftOneDecodedScript,
  SoftOneDetectedFieldUsage,
  SoftOneDetectedObjectUsage,
} from "./advanced-javascript-decoder";

import type {
  SoftOneRuntimeInvocationAnalysis,
} from "./script-runtime-invocation-analyzer";


export type SoftOneBusinessOperationType =
  | "CREATE_SALES_DOCUMENT"
  | "UPDATE_SALES_DOCUMENT"
  | "DELETE_SALES_DOCUMENT"
  | "CREATE_PURCHASE_DOCUMENT"
  | "UPDATE_PURCHASE_DOCUMENT"
  | "DELETE_PURCHASE_DOCUMENT"
  | "CREATE_CUSTOMER"
  | "UPDATE_CUSTOMER"
  | "DELETE_CUSTOMER"
  | "CREATE_ITEM"
  | "UPDATE_ITEM"
  | "DELETE_ITEM"
  | "OBJECT_CREATE"
  | "OBJECT_UPDATE"
  | "OBJECT_DELETE"
  | "OBJECT_READ"
  | "DIRECT_SQL_READ"
  | "DIRECT_SQL_WRITE"
  | "WEB_SERVICE_CALL"
  | "CUSTOM_WEB_SERVICE_CALL"
  | "UNKNOWN";


export type SoftOneBusinessOperationConfidence =
  | "VERIFIED"
  | "DERIVED"
  | "PARTIAL";


export interface SoftOneBusinessFieldAssignment {
  canonical: string;

  valueExpression: string;

  resolvedValue?: string;

  meaning?: string;

  semanticStatus?:
    "VERIFIED"
    | "DERIVED";
}


export interface SoftOneBusinessOperation {
  type:
    SoftOneBusinessOperationType;

  confidence:
    SoftOneBusinessOperationConfidence;

  object?: string;

  functionName?: string;

  sourceIndex?: number;

  /*
   * Project-level provenance.
   * Populated by the project analyzer after cross-file linking.
   */
  functionId?: string;

  active?: boolean;



  access:
    | "READ"
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "MIXED";

  mechanism:
    | "SOFTONE_OBJECT_LAYER"
    | "DIRECT_SQL"
    | "SOFTONE_WEB_SERVICE"
    | "CUSTOM_WEB_SERVICE"
    | "UNKNOWN";

  headerAssignments:
    SoftOneBusinessFieldAssignment[];

  lineAssignments:
    Array<{
      table: string;

      assignments:
        SoftOneBusinessFieldAssignment[];
    }>;

  persistence: string[];

  evidence: string[];

  cautions: string[];

  summary: string;
}


function operationTypeForObject(
  object: string,
  access:
    SoftOneDetectedObjectUsage["access"],
): SoftOneBusinessOperationType {
  const normalized =
    object.toUpperCase();


  if (
    normalized ===
      "SALDOC"
  ) {
    if (
      (
      access ===
        "INSERT" ||
      access ===
        "CREATE"
    )
    ) {
      return "CREATE_SALES_DOCUMENT";
    }

    if (
      access ===
        "UPDATE"
    ) {
      return "UPDATE_SALES_DOCUMENT";
    }

    if (
      access ===
        "DELETE"
    ) {
      return "DELETE_SALES_DOCUMENT";
    }
  }


  if (
    normalized ===
      "PURDOC"
  ) {
    if (
      access ===
        "INSERT"
    ) {
      return "CREATE_PURCHASE_DOCUMENT";
    }

    if (
      access ===
        "UPDATE"
    ) {
      return "UPDATE_PURCHASE_DOCUMENT";
    }

    if (
      access ===
        "DELETE"
    ) {
      return "DELETE_PURCHASE_DOCUMENT";
    }
  }


  if (
    normalized ===
      "CUSTOMER"
  ) {
    if (
      access ===
        "INSERT"
    ) {
      return "CREATE_CUSTOMER";
    }

    if (
      access ===
        "UPDATE"
    ) {
      return "UPDATE_CUSTOMER";
    }

    if (
      access ===
        "DELETE"
    ) {
      return "DELETE_CUSTOMER";
    }
  }


  if (
    normalized ===
      "ITEM"
  ) {
    if (
      access ===
        "INSERT"
    ) {
      return "CREATE_ITEM";
    }

    if (
      access ===
        "UPDATE"
    ) {
      return "UPDATE_ITEM";
    }

    if (
      access ===
        "DELETE"
    ) {
      return "DELETE_ITEM";
    }
  }


  if (
    access ===
      "INSERT"
  ) {
    return "OBJECT_CREATE";
  }


  if (
    access ===
      "UPDATE"
  ) {
    return "OBJECT_UPDATE";
  }


  if (
    access ===
      "DELETE"
  ) {
    return "OBJECT_DELETE";
  }


  if (
    access ===
      "READ"
  ) {
    return "OBJECT_READ";
  }


  return "UNKNOWN";
}


function businessAccess(
  access:
    SoftOneDetectedObjectUsage["access"],
): SoftOneBusinessOperation["access"] {
  switch (
    access
  ) {
    case "INSERT":
      return "CREATE";

    case "UPDATE":
      return "UPDATE";

    case "DELETE":
      return "DELETE";

    case "READ":
      return "READ";

    case "MIXED":
      return "MIXED";

    case "CREATE":
      return "CREATE";

    default:
      return "MIXED";
  }
}


function assignmentFromField(
  field:
    SoftOneDetectedFieldUsage,
): SoftOneBusinessFieldAssignment {
  return {
    canonical:
      field.canonical,

    valueExpression:
      field.expression ??
      "",

    resolvedValue:
      field.resolvedValue,

    meaning:
      field.meaning,

    semanticStatus:
      field.semanticStatus,
  };
}


function confidenceFromFields(
  fields:
    SoftOneDetectedFieldUsage[],
): SoftOneBusinessOperationConfidence {
  if (
    fields.length ===
    0
  ) {
    return "PARTIAL";
  }


  const statuses =
    fields
      .map(
        field =>
          field.semanticStatus,
      )
      .filter(
        Boolean,
      );


  if (
    statuses.length ===
    0
  ) {
    return "PARTIAL";
  }


  if (
    statuses.every(
      status =>
        status ===
        "VERIFIED",
    )
  ) {
    return "VERIFIED";
  }


  return "DERIVED";
}


function summaryForObjectOperation(
  type:
    SoftOneBusinessOperationType,
  object:
    string,
): string {
  switch (
    type
  ) {
    case "CREATE_SALES_DOCUMENT":
      return "Creates a Sales Document through the SoftOne Object Layer.";

    case "UPDATE_SALES_DOCUMENT":
      return "Updates a Sales Document through the SoftOne Object Layer.";

    case "DELETE_SALES_DOCUMENT":
      return "Deletes a Sales Document through the SoftOne Object Layer.";

    case "CREATE_PURCHASE_DOCUMENT":
      return "Creates a Purchase Document through the SoftOne Object Layer.";

    case "UPDATE_PURCHASE_DOCUMENT":
      return "Updates a Purchase Document through the SoftOne Object Layer.";

    case "DELETE_PURCHASE_DOCUMENT":
      return "Deletes a Purchase Document through the SoftOne Object Layer.";

    case "CREATE_CUSTOMER":
      return "Creates a Customer through the SoftOne Object Layer.";

    case "UPDATE_CUSTOMER":
      return "Updates a Customer through the SoftOne Object Layer.";

    case "DELETE_CUSTOMER":
      return "Deletes a Customer through the SoftOne Object Layer.";

    case "CREATE_ITEM":
      return "Creates an Item through the SoftOne Object Layer.";

    case "UPDATE_ITEM":
      return "Updates an Item through the SoftOne Object Layer.";

    case "DELETE_ITEM":
      return "Deletes an Item through the SoftOne Object Layer.";

    default:
      return `Performs ${type} on SoftOne object ${object}.`;
  }
}


export function synthesizeSoftOneBusinessOperations(
  decoded:
    SoftOneDecodedScript,

  runtimeInvocations?:
    SoftOneRuntimeInvocationAnalysis,
): SoftOneBusinessOperation[] {
  const result:
    SoftOneBusinessOperation[] = [];


  for (
    const objectUsage
    of decoded.objectUsages
  ) {
    const fields =
      decoded.fieldUsages.filter(
        field =>
          field.object ===
            objectUsage.object,
      );


    const headerFields =
      fields.filter(
        field =>
          field.table ===
            "FINDOC",
      );


    const lineGroups =
      new Map<
        string,
        SoftOneDetectedFieldUsage[]
      >();


    for (
      const field
      of fields
    ) {
      if (
        field.table ===
          "FINDOC"
      ) {
        continue;
      }


      const group =
        lineGroups.get(
          field.table,
        ) ??
        [];

      group.push(
        field,
      );

      lineGroups.set(
        field.table,
        group,
      );
    }


    const persistence:
      string[] = [];


    if (
      objectUsage.methods.includes(
        "DBINSERT",
      )
    ) {
      persistence.push(
        "DBINSERT",
      );
    }


    for (
      const dataset
      of decoded.datasetUsages.filter(
        item =>
          item.object ===
            objectUsage.object,
      )
    ) {
      if (
        dataset.methods.includes(
          "APPEND",
        )
      ) {
        persistence.push(
          `${dataset.table}.APPEND`,
        );
      }


      if (
        dataset.methods.includes(
          "EDIT",
        )
      ) {
        persistence.push(
          `${dataset.table}.EDIT`,
        );
      }


      if (
        dataset.methods.includes(
          "POST",
        )
      ) {
        persistence.push(
          `${dataset.table}.POST`,
        );
      }


      if (
        dataset.methods.includes(
          "DELETE",
        )
      ) {
        persistence.push(
          `${dataset.table}.DELETE`,
        );
      }
    }


    if (
      objectUsage.methods.includes(
        "DBPOST",
      )
    ) {
      persistence.push(
        "DBPOST",
      );
    }


    if (
      objectUsage.methods.includes(
        "DBDELETE",
      )
    ) {
      persistence.push(
        "DBDELETE",
      );
    }


    const type =
      operationTypeForObject(
        objectUsage.object,
        objectUsage.access,
      );


    const evidence =
      [
        `OBJECT:${objectUsage.object}`,
        ...fields.map(
          field =>
            field.canonical,
        ),
      ];


    const cautions:
      string[] = [];


    const series =
      fields.find(
        field =>
          field.canonical ===
            "FIELD:FINDOC.SERIES",
      );


    if (
      series?.resolvedValue
    ) {
      cautions.push(
        `Series ${series.resolvedValue} is detected as a document-series identifier, but its tenant-specific business meaning is not inferred.`,
      );
    }


    result.push({
      type,

      confidence:
        confidenceFromFields(
          fields,
        ),

      object:
        objectUsage.object,

      functionName:

        objectUsage.functionName,

      sourceIndex:

        objectUsage.sourceIndex,


      access:
        businessAccess(
          objectUsage.access,
        ),

      mechanism:
        "SOFTONE_OBJECT_LAYER",

      headerAssignments:
        headerFields.map(
          assignmentFromField,
        ),

      lineAssignments:
        [
          ...lineGroups.entries(),
        ].map(
          (
            [
              table,
              tableFields,
            ],
          ) => ({
            table,

            assignments:
              tableFields.map(
                assignmentFromField,
              ),
          }),
        ),

      persistence:
        [
          ...new Set(
            persistence,
          ),
        ],

      evidence:
        [
          ...new Set(
            evidence,
          ),
        ],

      cautions,

      summary:
        summaryForObjectOperation(
          type,
          objectUsage.object,
        ),
    });
  }


  /*
   * When runtime invocation evidence exists, use actual
   * X.GETSQLDATASET calls instead of decoded SQL representations.
   */
  if (
    runtimeInvocations
  ) {
    for (
      const invocation
      of runtimeInvocations.invocations
    ) {
      if (
        invocation.kind !==
          "DIRECT_SQL_READ"
      ) {
        continue;
      }

      result.push({
        type:
          "DIRECT_SQL_READ",

        confidence:
          "VERIFIED",

        functionName:
          invocation.functionName,

        sourceIndex:
          invocation.sourceIndex,

        access:
          "READ",

        mechanism:
          "DIRECT_SQL",

        headerAssignments:
          [],

        lineAssignments:
          [],

        persistence:
          [invocation.function],

        evidence:
          [],

        cautions:
          [],

        summary:
          `Reads database data directly using ${invocation.function}.`,
      });
    }
  }


  /*
   * Keep decoded SQL as fallback for callers without runtime
   * invocation analysis, and retain non-read SQL detection.
   */
  for (
    const query
    of decoded.sql
  ) {
    const operation =
      query.operation.toUpperCase();


    const isRead =
      operation ===
        "SELECT";


    if (
      isRead &&
      runtimeInvocations
    ) {
      continue;
    }


    result.push({
      type:
        isRead
          ? "DIRECT_SQL_READ"
          : "DIRECT_SQL_WRITE",

      confidence:
        "VERIFIED",

      access:
        isRead
          ? "READ"
          : "UPDATE",

      mechanism:
        "DIRECT_SQL",

      headerAssignments:
        [],

      lineAssignments:
        [],

      persistence: [
        query.source,
      ],

      evidence:
        query.tables.map(
          table =>
            `TABLE:${table}`,
        ),

      cautions:
        isRead
          ? []
          : [
              "Direct SQL write bypasses SoftOne Object Layer semantics unless separately proven otherwise.",
            ],

      summary:
        isRead
          ? `Reads database data directly using ${query.source}.`
          : `Writes database data directly using ${query.source}.`,
    });
  }


  return result;
}
