import type {
  SoftOneDecodedScript,
  SoftOneDetectedFieldUsage,
} from "./advanced-javascript-decoder";

import type {
  SoftOneBusinessOperation,
} from "./business-operation-synthesizer";

import type {
  SoftOneScriptRiskAssessment,
} from "./script-risk-classifier";


export interface SoftOneSemanticReport {
  title: string;

  summary: string;

  businessOperations: string[];

  dataFlow: string[];

  persistence: string[];

  integrations: string[];

  risk: {
    level: string;

    mutatesBusinessData: boolean;

    bypassesObjectLayer: boolean;

    requiresAdminReview: boolean;

    notes: string[];
  };

  cautions: string[];
}


function describeValueOrigin(
  field:
    SoftOneDetectedFieldUsage,
): string {
  const origin =
    field.valueOrigin;


  if (
    !origin
  ) {
    return field.expression ??
      "άγνωστη τιμή";
  }


  switch (
    origin.kind
  ) {
    case "FUNCTION_PARAMETER":
      return (
        `παράμετρο ${origin.parameterName}` +
        (
          origin.functionName
            ? ` της function ${origin.functionName}`
            : ""
        )
      );

    case "CONSTANT":
      return `σταθερή τιμή ${origin.resolvedValue ?? origin.raw}`;

    case "SYSTEM_PARAMETER":
      return `SoftOne system parameter ${origin.symbol ?? origin.raw}`;

    case "FIELD_REFERENCE":
      return `τιμή πεδίου ${origin.symbol ?? origin.raw}`;

    case "VARIABLE":
      return `μεταβλητή ${origin.symbol ?? origin.raw}`;

    case "FUNCTION_CALL":
      return `αποτέλεσμα function call ${origin.raw}`;

    case "EXPRESSION":
      return `έκφραση ${origin.raw}`;

    default:
      return origin.raw;
  }
}


function describeField(
  field:
    SoftOneDetectedFieldUsage,
): string {
  const semantic =
    field.meaning
      ? ` — ${field.meaning}`
      : "";


  return (
    `${field.canonical} <- ` +
    `${describeValueOrigin(field)}` +
    semantic
  );
}


function greekOperationSummary(
  operation:
    SoftOneBusinessOperation,
): string {
  switch (
    operation.type
  ) {
    case "CREATE_SALES_DOCUMENT":
      return "Δημιουργεί παραστατικό πωλήσεων μέσω του SoftOne Object Layer.";

    case "UPDATE_SALES_DOCUMENT":
      return "Ενημερώνει παραστατικό πωλήσεων μέσω του SoftOne Object Layer.";

    case "DELETE_SALES_DOCUMENT":
      return "Διαγράφει παραστατικό πωλήσεων μέσω του SoftOne Object Layer.";

    case "CREATE_PURCHASE_DOCUMENT":
      return "Δημιουργεί παραστατικό αγορών μέσω του SoftOne Object Layer.";

    case "UPDATE_PURCHASE_DOCUMENT":
      return "Ενημερώνει παραστατικό αγορών μέσω του SoftOne Object Layer.";

    case "DELETE_PURCHASE_DOCUMENT":
      return "Διαγράφει παραστατικό αγορών μέσω του SoftOne Object Layer.";

    case "CREATE_CUSTOMER":
      return "Δημιουργεί πελάτη μέσω του SoftOne Object Layer.";

    case "UPDATE_CUSTOMER":
      return "Ενημερώνει πελάτη μέσω του SoftOne Object Layer.";

    case "DELETE_CUSTOMER":
      return "Διαγράφει πελάτη μέσω του SoftOne Object Layer.";

    case "CREATE_ITEM":
      return "Δημιουργεί είδος μέσω του SoftOne Object Layer.";

    case "UPDATE_ITEM":
      return "Ενημερώνει είδος μέσω του SoftOne Object Layer.";

    case "DELETE_ITEM":
      return "Διαγράφει είδος μέσω του SoftOne Object Layer.";

    case "OBJECT_CREATE":
      return `Δημιουργεί εγγραφή μέσω του SoftOne Object Layer${operation.object ? ` (${operation.object})` : ""}.`;

    case "OBJECT_UPDATE":
      return `Ενημερώνει εγγραφή μέσω του SoftOne Object Layer${operation.object ? ` (${operation.object})` : ""}.`;

    case "OBJECT_DELETE":
      return `Διαγράφει εγγραφή μέσω του SoftOne Object Layer${operation.object ? ` (${operation.object})` : ""}.`;

    case "OBJECT_READ":
      return `Διαβάζει εγγραφή μέσω του SoftOne Object Layer${operation.object ? ` (${operation.object})` : ""}.`;

    case "DIRECT_SQL_READ":
      return "Διαβάζει δεδομένα απευθείας από τη βάση μέσω SQL.";

    case "DIRECT_SQL_WRITE":
      return "Μεταβάλλει δεδομένα απευθείας στη βάση μέσω SQL.";

    default:
      return operation.summary;
  }
}


export function createSoftOneSemanticReport(
  decoded:
    SoftOneDecodedScript,

  businessOperations:
    SoftOneBusinessOperation[],

  risk:
    SoftOneScriptRiskAssessment,
): SoftOneSemanticReport {
  const business =
    businessOperations.map(
      operation => {
        const status =
          operation.active === true
            ? "[ACTIVE] "
            : operation.active === false
              ? "[POTENTIAL] "
              : "";

        return (
          status +
          greekOperationSummary(
            operation,
          )
        );
      },
    );


  const dataFlow =
    decoded.fieldUsages.map(
      describeField,
    );


  const persistence =
    [
      ...new Set(
        businessOperations.flatMap(
          operation =>
            operation.persistence,
        ),
      ),
    ];


  const integrations:
    string[] = [];


  for (
    const ws
    of decoded.webServices
  ) {
    integrations.push(
      `SoftOne Web Service: ${ws.service}`,
    );
  }


  for (
    const call
    of decoded.internalCalls
  ) {
    integrations.push(
      `Internal SoftOne call: ${call.library}.${call.function}`,
    );
  }


  const cautions =
    [
      ...new Set(
        businessOperations.flatMap(
          operation =>
            operation.cautions,
        ),
      ),
    ];


  const primary =
    business[0] ??
    "Αναλύθηκε SoftOne Advanced JavaScript χωρίς αναγνωρισμένη business operation.";


  return {
    title:
      "SoftOne Advanced JavaScript Analysis",

    summary:
      primary,

    businessOperations:
      business,

    dataFlow,

    persistence,

    integrations:
      [
        ...new Set(
          integrations,
        ),
      ],

    risk: {
      level:
        risk.riskLevel,

      mutatesBusinessData:
        risk.mutatesBusinessData,

      bypassesObjectLayer:
        risk.bypassesObjectLayer,

      requiresAdminReview:
        risk.requiresAdminReview,

      notes:
        risk.reasons,
    },

    cautions,
  };
}


export function formatSoftOneSemanticReport(
  report:
    SoftOneSemanticReport,
): string {
  const lines:
    string[] = [];


  lines.push(
    report.title,
    "",
    report.summary,
    "",
  );


  if (
    report.businessOperations.length >
      0
  ) {
    lines.push(
      "Business operations:",
    );

    for (
      const operation
      of report.businessOperations
    ) {
      lines.push(
        `- ${operation}`,
      );
    }

    lines.push(
      "",
    );
  }


  if (
    report.dataFlow.length >
      0
  ) {
    lines.push(
      "Data flow:",
    );

    for (
      const item
      of report.dataFlow
    ) {
      lines.push(
        `- ${item}`,
      );
    }

    lines.push(
      "",
    );
  }


  if (
    report.persistence.length >
      0
  ) {
    lines.push(
      "Persistence:",
    );

    for (
      const item
      of report.persistence
    ) {
      lines.push(
        `- ${item}`,
      );
    }

    lines.push(
      "",
    );
  }


  if (
    report.integrations.length >
      0
  ) {
    lines.push(
      "Integrations:",
    );

    for (
      const item
      of report.integrations
    ) {
      lines.push(
        `- ${item}`,
      );
    }

    lines.push(
      "",
    );
  }


  lines.push(
    `Risk: ${report.risk.level}`,
    `Mutates business data: ${report.risk.mutatesBusinessData ? "YES" : "NO"}`,
    `Bypasses SoftOne Object Layer: ${report.risk.bypassesObjectLayer ? "YES" : "NO"}`,
    `Requires admin review: ${report.risk.requiresAdminReview ? "YES" : "NO"}`,
  );


  if (
    report.cautions.length >
      0
  ) {
    lines.push(
      "",
      "Cautions:",
    );

    for (
      const caution
      of report.cautions
    ) {
      lines.push(
        `- ${caution}`,
      );
    }
  }


  return lines.join(
    "\n",
  );
}
