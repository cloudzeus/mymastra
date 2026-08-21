import {
  maskJavaScriptStringsAndComments,
} from "./script-structure-analyzer";

import type {
  SoftOneScriptStructure,
} from "./script-structure-analyzer";


export type SoftOneRuntimeInvocationKind =
  | "DIRECT_SQL_READ"
  | "DIRECT_SQL_EXECUTION";


export interface SoftOneRuntimeInvocation {
  function:
    "X.GETSQLDATASET"
    | "X.SQL";

  kind:
    SoftOneRuntimeInvocationKind;

  sourceIndex:
    number;

  /**
   * Enclosing project function, when the invocation occurs
   * inside a named function.
   */
  functionName?:
    string;
}


export interface SoftOneRuntimeInvocationAnalysis {
  invocations:
    SoftOneRuntimeInvocation[];

  directSqlReadCount:
    number;

  directSqlExecutionCount:
    number;
}


export function analyzeSoftOneRuntimeInvocations(
  source: string,
  structure?: SoftOneScriptStructure,
): SoftOneRuntimeInvocationAnalysis {
  const maskedSource =
    maskJavaScriptStringsAndComments(
      source,
    );


  const invocations:
    SoftOneRuntimeInvocation[] = [];


  const patterns: Array<{
    function:
      SoftOneRuntimeInvocation["function"];

    kind:
      SoftOneRuntimeInvocationKind;

    pattern:
      RegExp;
  }> = [
    {
      function:
        "X.GETSQLDATASET",

      kind:
        "DIRECT_SQL_READ",

      pattern:
        /\bX\.GETSQLDATASET\s*\(/g,
    },

    {
      function:
        "X.SQL",

      kind:
        "DIRECT_SQL_EXECUTION",

      pattern:
        /\bX\.SQL\s*\(/g,
    },
  ];


  for (
    const definition
    of patterns
  ) {
    for (
      const match
      of maskedSource.matchAll(
        definition.pattern,
      )
    ) {
      const sourceIndex =
        match.index ??
        0;

      const containingFunction =
        structure?.functions
          .filter(
            fn =>
              sourceIndex >= fn.sourceStart &&
              sourceIndex <= fn.sourceEnd,
          )
          .sort(
            (a, b) =>
              (a.sourceEnd - a.sourceStart) -
              (b.sourceEnd - b.sourceStart),
          )[0];

      invocations.push({
        function:
          definition.function,

        kind:
          definition.kind,

        sourceIndex,

        functionName:
          containingFunction?.name,
      });
    }
  }


  invocations.sort(
    (
      a,
      b,
    ) =>
      a.sourceIndex -
      b.sourceIndex,
  );


  return {
    invocations,

    directSqlReadCount:
      invocations.filter(
        invocation =>
          invocation.function ===
            "X.GETSQLDATASET",
      ).length,

    directSqlExecutionCount:
      invocations.filter(
        invocation =>
          invocation.function ===
            "X.SQL",
      ).length,
  };
}
