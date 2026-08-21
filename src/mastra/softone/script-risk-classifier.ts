import type {
  SoftOneDecodedScript,
} from "./advanced-javascript-decoder";

import type {
  SoftOneBusinessOperation,
} from "./business-operation-synthesizer";


export type SoftOneWriteMechanism =
  | "OBJECT_LAYER_WRITE"
  | "DIRECT_SQL_WRITE"
  | "WEB_SERVICE_WRITE"
  | "CUSTOM_WEB_SERVICE_WRITE"
  | "DATASET_WRITE"
  | "CONFIGURATION_CHANGE"
  | "UI_ONLY";


export type SoftOneScriptRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";


export interface SoftOneScriptRiskAssessment {
  mutatesBusinessData: boolean;

  bypassesObjectLayer: boolean;

  writeMechanisms:
    SoftOneWriteMechanism[];

  destructiveOperations: string[];

  externalSideEffects: boolean;

  configurationChanges: boolean;

  riskLevel:
    SoftOneScriptRiskLevel;

  requiresAdminReview: boolean;

  reasons: string[];
}


function unique<T>(
  values: T[],
): T[] {
  return [
    ...new Set(
      values,
    ),
  ];
}


export function classifySoftOneScriptRisk(
  decoded:
    SoftOneDecodedScript,

  businessOperations:
    SoftOneBusinessOperation[],
): SoftOneScriptRiskAssessment {
  const writeMechanisms:
    SoftOneWriteMechanism[] = [];

  const destructiveOperations:
    string[] = [];

  const reasons:
    string[] = [];


  const hasObjectWrite =
    decoded.operations.includes(
      "OBJECT_WRITE",
    ) ||
    decoded.operations.includes(
      "OBJECT_INSERT",
    ) ||
    decoded.operations.includes(
      "OBJECT_UPDATE",
    ) ||
    decoded.operations.includes(
      "OBJECT_DELETE",
    );


  const hasDatasetWrite =
    decoded.operations.includes(
      "DATASET_WRITE",
    );


  const hasObjectDelete =
    decoded.operations.includes(
      "OBJECT_DELETE",
    ) ||
    decoded.objectUsages.some(
      usage =>
        usage.methods.includes(
          "DBDELETE",
        ),
    );


  const directSqlWrites =
    businessOperations.filter(
      operation =>
        operation.type ===
          "DIRECT_SQL_WRITE",
    );


  const hasDirectSqlWrite =
    directSqlWrites.length >
      0;


  const hasCustomWebService =
    decoded.operations.includes(
      "CUSTOM_WEB_SERVICE_CALL",
    );


  const hasBuiltInWebService =
    decoded.operations.includes(
      "BUILTIN_WEB_SERVICE_CALL",
    );


  const hasHttpApi =
    decoded.operations.includes(
      "HTTP_API_CALL",
    );


  const hasConfigurationChange =
    decoded.operations.includes(
      "OBJECT_PARAMETER_SET",
    );


  if (
    hasObjectWrite
  ) {
    writeMechanisms.push(
      "OBJECT_LAYER_WRITE",
    );

    reasons.push(
      "SoftOne Object Layer business-data write detected.",
    );
  }


  if (
    hasDatasetWrite
  ) {
    writeMechanisms.push(
      "DATASET_WRITE",
    );

    reasons.push(
      "Dataset mutation detected.",
    );
  }


  if (
    hasDirectSqlWrite
  ) {
    writeMechanisms.push(
      "DIRECT_SQL_WRITE",
    );

    reasons.push(
      "Direct database write detected; SoftOne Object Layer may be bypassed.",
    );
  }


  if (
    hasCustomWebService
  ) {
    /*
     * We know a custom WS is called, but not necessarily
     * whether that endpoint mutates data.
     */
    reasons.push(
      "Custom Web Service call detected; side effects depend on endpoint implementation.",
    );
  }


  if (
    hasBuiltInWebService
  ) {
    reasons.push(
      "Built-in SoftOne Web Service call detected.",
    );
  }


  if (
    hasHttpApi
  ) {
    reasons.push(
      "External HTTP API call detected.",
    );
  }


  if (
    hasConfigurationChange
  ) {
    writeMechanisms.push(
      "CONFIGURATION_CHANGE",
    );

    reasons.push(
      "SoftOne runtime/object parameter change detected.",
    );
  }


  if (
    hasObjectDelete
  ) {
    destructiveOperations.push(
      "OBJECT_DELETE",
    );

    reasons.push(
      "Object deletion detected.",
    );
  }


  for (
    const dataset
    of decoded.datasetUsages
  ) {
    if (
      dataset.methods.includes(
        "DELETE",
      )
    ) {
      destructiveOperations.push(
        `${dataset.table}.DELETE`,
      );

      reasons.push(
        `Dataset deletion detected on ${dataset.table}.`,
      );
    }
  }


  const mutatesBusinessData =
    hasObjectWrite ||
    hasDatasetWrite ||
    hasDirectSqlWrite;


  const bypassesObjectLayer =
    hasDirectSqlWrite;


  const externalSideEffects =
    hasHttpApi ||
    hasCustomWebService;


  let riskLevel:
    SoftOneScriptRiskLevel =
    "LOW";


  if (
    hasDirectSqlWrite &&
    destructiveOperations.length >
      0
  ) {
    riskLevel =
      "CRITICAL";
  }
  else if (
    hasDirectSqlWrite
  ) {
    riskLevel =
      "HIGH";
  }
  else if (
    destructiveOperations.length >
      0
  ) {
    riskLevel =
      "HIGH";
  }
  else if (
    mutatesBusinessData
  ) {
    riskLevel =
      "MEDIUM";
  }
  else if (
    externalSideEffects ||
    hasConfigurationChange
  ) {
    riskLevel =
      "MEDIUM";
  }


  const requiresAdminReview =
    riskLevel ===
      "HIGH" ||
    riskLevel ===
      "CRITICAL" ||
    bypassesObjectLayer;


  return {
    mutatesBusinessData,

    bypassesObjectLayer,

    writeMechanisms:
      unique(
        writeMechanisms,
      ),

    destructiveOperations:
      unique(
        destructiveOperations,
      ),

    externalSideEffects,

    configurationChanges:
      hasConfigurationChange,

    riskLevel,

    requiresAdminReview,

    reasons:
      unique(
        reasons,
      ),
  };
}
