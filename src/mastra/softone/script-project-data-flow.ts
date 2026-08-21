import type {
  SoftOneProjectScriptAnalysis,
} from "./script-project-analyzer";

import type {
  SoftOneProjectLinkGraph,
} from "./script-project-linker";


export type SoftOneProjectDataFlowKind =
  | "FIELD_TO_FIELD"
  | "FUNCTION_RESULT_TO_FIELD"
  | "CONSTANT_TO_FIELD"
  | "VARIABLE_TO_FIELD"
  | "EXPRESSION_TO_FIELD";


export interface SoftOneProjectDataFlowEndpoint {
  canonical?: string;

  expression?: string;

  file?: string;

  functionName?: string;
}


export interface SoftOneProjectDataFlowEdge {
  kind:
    SoftOneProjectDataFlowKind;

  from:
    SoftOneProjectDataFlowEndpoint;

  to:
    SoftOneProjectDataFlowEndpoint;

  active:
    boolean;

  source:
    | "IMPLICIT_SCRIPT_CONTEXT"
    | "OBJECT_DATASET";
}


export interface SoftOneProjectDataFlowGraph {
  edges:
    SoftOneProjectDataFlowEdge[];

  activeEdges:
    SoftOneProjectDataFlowEdge[];

  potentialEdges:
    SoftOneProjectDataFlowEdge[];
}


function functionId(
  file: string,
  functionName?: string,
): string | undefined {
  if (
    !functionName
  ) {
    return undefined;
  }

  return `${file}::${functionName}`;
}


function isFieldReference(
  expression?: string,
): boolean {
  if (
    !expression
  ) {
    return false;
  }

  return /^[A-Z][A-Z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(
    expression.trim(),
  );
}


function isConstant(
  expression?: string,
): boolean {
  if (
    !expression
  ) {
    return false;
  }

  const value =
    expression.trim();

  return (
    /^-?\d+(?:\.\d+)?$/.test(
      value,
    ) ||
    value === "null" ||
    value === "true" ||
    value === "false" ||
    /^["'].*["']$/.test(
      value,
    )
  );
}


function isFunctionCall(
  expression?: string,
): boolean {
  if (
    !expression
  ) {
    return false;
  }

  return /^[A-Za-z_$][\w$]*\s*\(/.test(
    expression.trim(),
  );
}


function classifyKind(
  expression?: string,
): SoftOneProjectDataFlowKind {
  if (
    isFieldReference(
      expression,
    )
  ) {
    return "FIELD_TO_FIELD";
  }

  if (
    isFunctionCall(
      expression,
    )
  ) {
    return "FUNCTION_RESULT_TO_FIELD";
  }

  if (
    isConstant(
      expression,
    )
  ) {
    return "CONSTANT_TO_FIELD";
  }

  if (
    expression &&
    /^[A-Za-z_$][\w$]*$/.test(
      expression.trim(),
    )
  ) {
    return "VARIABLE_TO_FIELD";
  }

  return "EXPRESSION_TO_FIELD";
}


function sourceEndpoint(
  expression?: string,
): SoftOneProjectDataFlowEndpoint {
  if (
    isFieldReference(
      expression,
    )
  ) {
    return {
      canonical:
        `FIELD:${expression}`
          .toUpperCase(),
    };
  }

  return {
    expression:
      expression?.trim(),
  };
}


export function buildSoftOneProjectDataFlowGraph(
  files:
    SoftOneProjectScriptAnalysis[],

  linkGraph:
    SoftOneProjectLinkGraph,
): SoftOneProjectDataFlowGraph {
  const reachable =
    new Set(
      linkGraph
        .projectReachableFunctions,
    );


  const edges:
    SoftOneProjectDataFlowEdge[] = [];


  for (
    const file
    of files
  ) {
    for (
      const access
      of file.structure
        .implicitFieldAccesses
    ) {
      if (
        access.access !==
          "WRITE"
      ) {
        continue;
      }


      const id =
        functionId(
          file.file,
          access.functionName,
        );


      edges.push({
        kind:
          classifyKind(
            access.expression,
          ),

        from:
          sourceEndpoint(
            access.expression,
          ),

        to: {
          canonical:
            access.canonical,

          file:
            file.file,

          functionName:
            access.functionName,
        },

        active:
          id
            ? reachable.has(
                id,
              )
            : false,

        source:
          "IMPLICIT_SCRIPT_CONTEXT",
      });
    }


    for (
      const field
      of file.decoded.fieldUsages
    ) {
      if (
        field.access !==
          "WRITE"
      ) {
        continue;
      }


      const functionName =
        field.valueOrigin
          ?.functionName;

      const id =
        functionId(
          file.file,
          functionName,
        );


      edges.push({
        kind:
          classifyKind(
            field.expression,
          ),

        from:
          sourceEndpoint(
            field.expression,
          ),

        to: {
          canonical:
            field.canonical,

          file:
            file.file,

          functionName,
        },

        active:
          id
            ? reachable.has(
                id,
              )
            : false,

        source:
          "OBJECT_DATASET",
      });
    }
  }


  return {
    edges,

    activeEdges:
      edges.filter(
        edge =>
          edge.active,
      ),

    potentialEdges:
      edges.filter(
        edge =>
          !edge.active,
      ),
  };
}
