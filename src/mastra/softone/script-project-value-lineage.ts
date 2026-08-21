import type {
  SoftOneProjectArgumentLineage,
  SoftOneArgumentFieldFlow,
} from "./script-project-argument-lineage";


export type SoftOneProjectLineageOriginKind =
  | "FIELD"
  | "CONSTANT"
  | "VARIABLE"
  | "EXPRESSION";


export interface SoftOneProjectLineageOrigin {
  kind:
    SoftOneProjectLineageOriginKind;

  expression: string;

  canonical?: string;

  value?: string;

  file: string;

  functionName: string;
}


export type SoftOneProjectLineageStep =
  | {
      kind:
        "FUNCTION_ARGUMENT";

      function:
        string;

      argumentIndex:
        number;

      file:
        string;
    }
  | {
      kind:
        "FUNCTION_PARAMETER";

      function:
        string;

      parameter:
        string;

      parameterIndex:
        number;

      file:
        string;
    }
  | {
      kind:
        "TRANSFORMATION";

      function?:
        string;

      expression:
        string;
    };


export interface SoftOneProjectLineageDestination {
  kind:
    "FIELD";

  canonical:
    string;

  expression:
    string;

  file:
    string;

  functionName:
    string;
}


export interface SoftOneProjectValueLineage {
  origin:
    SoftOneProjectLineageOrigin;

  via:
    SoftOneProjectLineageStep[];

  destination:
    SoftOneProjectLineageDestination;

  active:
    boolean;

  resolution:
    "LOCAL"
    | "CROSS_FILE";
}


export interface SoftOneProjectValueLineageGraph {
  lineages:
    SoftOneProjectValueLineage[];

  activeLineages:
    SoftOneProjectValueLineage[];

  potentialLineages:
    SoftOneProjectValueLineage[];
}


function classifyOrigin(
  expression: string,

  file: string,

  functionName: string,
): SoftOneProjectLineageOrigin {
  const value =
    expression.trim();


  if (
    /^[A-Z][A-Z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(
      value,
    )
  ) {
    return {
      kind:
        "FIELD",

      expression:
        value,

      canonical:
        `FIELD:${value}`
          .toUpperCase(),

      file,

      functionName,
    };
  }


  if (
    /^-?\d+(?:\.\d+)?$/.test(
      value,
    ) ||
    value === "null" ||
    value === "true" ||
    value === "false" ||
    /^["'].*["']$/.test(
      value,
    )
  ) {
    return {
      kind:
        "CONSTANT",

      expression:
        value,

      value,

      file,

      functionName,
    };
  }


  if (
    /^[A-Za-z_$][\w$]*$/.test(
      value,
    )
  ) {
    return {
      kind:
        "VARIABLE",

      expression:
        value,

      file,

      functionName,
    };
  }


  return {
    kind:
      "EXPRESSION",

    expression:
      value,

    file,

    functionName,
  };
}


function detectTransformationFunction(
  expression: string,

  parameter: string,
): string | undefined {
  const trimmed =
    expression.trim();


  /*
   * Direct parameter assignment:
   *
   *   FINDOC.SERIES = series
   *
   * has no transformation step.
   */
  if (
    trimmed ===
    parameter
  ) {
    return undefined;
  }


  /*
   * Function/member call:
   *
   *   X.FORMATDATE(..., date)
   *   normalize(date)
   */
  const match =
    trimmed.match(
      /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/,
    );


  return match?.[1];
}


function buildLineage(
  flow:
    SoftOneArgumentFieldFlow,
): SoftOneProjectValueLineage {
  const binding =
    flow.binding;


  const via:
    SoftOneProjectLineageStep[] = [
      {
        kind:
          "FUNCTION_ARGUMENT",

        function:
          binding.to.functionName,

        argumentIndex:
          binding.from.argumentIndex,

        file:
          binding.from.file,
      },

      {
        kind:
          "FUNCTION_PARAMETER",

        function:
          binding.to.functionName,

        parameter:
          binding.to.parameter,

        parameterIndex:
          binding.to.parameterIndex,

        file:
          binding.to.file,
      },
    ];


  const transformationFunction =
    detectTransformationFunction(
      flow.targetExpression,
      binding.to.parameter,
    );


  if (
    flow.targetExpression.trim() !==
    binding.to.parameter
  ) {
    via.push({
      kind:
        "TRANSFORMATION",

      function:
        transformationFunction,

      expression:
        flow.targetExpression,
    });
  }


  return {
    origin:
      classifyOrigin(
        binding.from.expression,
        binding.from.file,
        binding.from.functionName,
      ),

    via,

    destination: {
      kind:
        "FIELD",

      canonical:
        flow.targetField,

      expression:
        flow.targetExpression,

      file:
        binding.to.file,

      functionName:
        flow.targetFunction,
    },

    active:
      flow.active,

    resolution:
      binding.resolution,
  };
}


export function buildSoftOneProjectValueLineageGraph(
  argumentLineage:
    SoftOneProjectArgumentLineage,
): SoftOneProjectValueLineageGraph {
  const lineages =
    argumentLineage.fieldFlows.map(
      buildLineage,
    );


  return {
    lineages,

    activeLineages:
      lineages.filter(
        lineage =>
          lineage.active,
      ),

    potentialLineages:
      lineages.filter(
        lineage =>
          !lineage.active,
      ),
  };
}
