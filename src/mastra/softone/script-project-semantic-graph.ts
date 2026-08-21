import type {
  SoftOneProjectScriptAnalysis,
} from "./script-project-analyzer";

import type {
  SoftOneProjectLinkGraph,
} from "./script-project-linker";

import type {
  SoftOneProjectSemanticContext,
} from "./script-project-semantic-context";

import type {
  SoftOneProjectExecutionSemantics,
} from "./script-project-execution-semantics";

import type {
  SoftOneProjectDataFlowGraph,
} from "./script-project-data-flow";

import type {
  SoftOneProjectValueLineageGraph,
} from "./script-project-value-lineage";


export type SoftOneSemanticNodeKind =
  | "FUNCTION"
  | "OBJECT"
  | "TABLE"
  | "FIELD"
  | "CONTEXT"
  | "BUSINESS_OPERATION";


export type SoftOneSemanticEdgeKind =
  | "USES_FIELD"
  | "USES_TABLE"
  | "FIELD_REFERENCES"
  | "PERFORMS"
  | "WRITES_FIELD"
  | "VALUE_FLOWS_TO"
  | "RETURNS_TO_FIELD";


export interface SoftOneSemanticGraphNode {
  id: string;

  kind:
    SoftOneSemanticNodeKind;

  label: string;

  active?: boolean;

  meaning?: string;

  semanticStatus?:
    "VERIFIED"
    | "DERIVED";

  metadata?: Record<
    string,
    unknown
  >;
}


export interface SoftOneSemanticGraphEdge {
  from: string;

  to: string;

  kind:
    SoftOneSemanticEdgeKind;

  active?: boolean;

  metadata?: Record<
    string,
    unknown
  >;
}


export interface SoftOneCompactSemanticContext {
  activeFunctions: string[];

  potentialFunctions: string[];

  activeOperations: Array<{
    functionId?: string;
    operation: string;
    object?: string;
  }>;

  potentialOperations: Array<{
    functionId?: string;
    operation: string;
    object?: string;
  }>;

  knownFields: Array<{
    canonical: string;
    objectContext?: string;
    meaning: string;
    status:
      "VERIFIED"
      | "DERIVED";
  }>;

  unresolvedFields: string[];

  guardedEffects: Array<{
    functionName: string;
    target: string;
    active: boolean;
    guards: string[];
  }>;

  resultFlows: Array<{
    functionName: string;
    destinationField: string;
    returns: string[];
    active: boolean;
  }>;
}


export interface SoftOneProjectSemanticGraph {
  nodes:
    SoftOneSemanticGraphNode[];

  edges:
    SoftOneSemanticGraphEdge[];

  compactContext:
    SoftOneCompactSemanticContext;
}


function addNode(
  map:
    Map<
      string,
      SoftOneSemanticGraphNode
    >,

  node:
    SoftOneSemanticGraphNode,
): void {
  const existing =
    map.get(
      node.id,
    );

  if (
    !existing
  ) {
    map.set(
      node.id,
      node,
    );

    return;
  }


  if (
    node.active === true
  ) {
    existing.active =
      true;
  }


  if (
    !existing.meaning &&
    node.meaning
  ) {
    existing.meaning =
      node.meaning;
  }


  if (
    !existing.semanticStatus &&
    node.semanticStatus
  ) {
    existing.semanticStatus =
      node.semanticStatus;
  }
}


function addEdge(
  edges:
    SoftOneSemanticGraphEdge[],

  edge:
    SoftOneSemanticGraphEdge,
): void {
  const exists =
    edges.some(
      candidate =>
        candidate.from ===
          edge.from &&
        candidate.to ===
          edge.to &&
        candidate.kind ===
          edge.kind &&
        JSON.stringify(
          candidate.metadata ??
          {},
        ) ===
          JSON.stringify(
            edge.metadata ??
            {},
          ),
    );


  if (
    !exists
  ) {
    edges.push(
      edge,
    );
  }
}


export function buildSoftOneProjectSemanticGraph(
  files:
    SoftOneProjectScriptAnalysis[],

  linkGraph:
    SoftOneProjectLinkGraph,

  semanticContext:
    SoftOneProjectSemanticContext,

  executionSemantics:
    SoftOneProjectExecutionSemantics,

  dataFlow:
    SoftOneProjectDataFlowGraph,

  valueLineage:
    SoftOneProjectValueLineageGraph,
): SoftOneProjectSemanticGraph {
  const nodeMap =
    new Map<
      string,
      SoftOneSemanticGraphNode
    >();

  const edges:
    SoftOneSemanticGraphEdge[] =
    [];


  const reachable =
    new Set(
      linkGraph
        .projectReachableFunctions,
    );


  /*
   * Functions
   */
  for (
    const file
    of files
  ) {
    for (
      const fn
      of file.structure.functions
    ) {
      const id =
        `${file.file}::${fn.name}`;

      addNode(
        nodeMap,
        {
          id:
            `FUNCTION:${id}`,

          kind:
            "FUNCTION",

          label:
            id,

          active:
            reachable.has(
              id,
            ),
        },
      );
    }
  }


  /*
   * Current runtime contexts.
   */
  for (
    const context
    of semanticContext
      .currentContexts
  ) {
    addNode(
      nodeMap,
      {
        id:
          context.canonical,

        kind:
          "CONTEXT",

        label:
          context.receiver,

        active:
          context.activeFunctions
            .length > 0,

        metadata: {
          status:
            context.status,

          observedAsTable:
            context.observedAsTable,

          observedAsExplicitObject:
            context.observedAsExplicitObject,
        },
      },
    );


    for (
      const field
      of context.fields
    ) {
      addNode(
        nodeMap,
        {
          id:
            field,

          kind:
            "FIELD",

          label:
            field,
        },
      );


      addEdge(
        edges,
        {
          from:
            context.canonical,

          to:
            field,

          kind:
            "USES_FIELD",

          active:
            context.activeFunctions
              .length > 0,
        },
      );
    }
  }


  /*
   * Explicit runtime object -> table relationships.
   */
  for (
    const link
    of semanticContext
      .objectTableLinks
  ) {
    addNode(
      nodeMap,
      {
        id:
          link.objectCanonical,

        kind:
          "OBJECT",

        label:
          link.object,

        active:
          link.active,
      },
    );


    addNode(
      nodeMap,
      {
        id:
          link.tableCanonical,

        kind:
          "TABLE",

        label:
          link.table,

        active:
          link.active,
      },
    );


    addEdge(
      edges,
      {
        from:
          link.objectCanonical,

        to:
          link.tableCanonical,

        kind:
          "USES_TABLE",

        active:
          link.active,

        metadata: {
          relation:
            link.relation,

          file:
            link.file,

          functionName:
            link.functionName,
        },
      },
    );
  }


  /*
   * Field semantics.
   */
  for (
    const field
    of semanticContext
      .fieldSemantics
  ) {
    addNode(
      nodeMap,
      {
        id:
          field.canonical,

        kind:
          "FIELD",

        label:
          field.canonical,

        meaning:
          field.meaning,

        semanticStatus:
          field.semanticStatus,

        metadata: {
          objectContext:
            field.objectContext,

          resolution:
            field.resolution,

          evidence:
            field.evidence,
        },
      },
    );


    if (
      field.references?.object
    ) {
      const target =
        `OBJECT:${field.references.object.toUpperCase()}`;

      addNode(
        nodeMap,
        {
          id:
            target,

          kind:
            "OBJECT",

          label:
            field.references.object,
        },
      );


      addEdge(
        edges,
        {
          from:
            field.canonical,

          to:
            target,

          kind:
            "FIELD_REFERENCES",

          metadata: {
            objectContext:
              field.objectContext,
          },
        },
      );
    }


    if (
      field.references?.table
    ) {
      const target =
        `TABLE:${field.references.table.toUpperCase()}`;

      addNode(
        nodeMap,
        {
          id:
            target,

          kind:
            "TABLE",

          label:
            field.references.table,
        },
      );


      addEdge(
        edges,
        {
          from:
            field.canonical,

          to:
            target,

          kind:
            "FIELD_REFERENCES",

          metadata: {
            objectContext:
              field.objectContext,
          },
        },
      );
    }
  }


  /*
   * Business operations.
   */
  for (
    const file
    of files
  ) {
    for (
      const operation
      of file.businessOperations
    ) {
      const operationId =
        [
          "OPERATION",
          file.file,
          operation.functionName ??
            "GLOBAL",
          operation.sourceIndex ??
            "UNKNOWN",
          operation.type,
        ].join(":");


      addNode(
        nodeMap,
        {
          id:
            operationId,

          kind:
            "BUSINESS_OPERATION",

          label:
            operation.type,

          active:
            operation.active,

          metadata: {
            object:
              operation.object,

            access:
              operation.access,

            mechanism:
              operation.mechanism,

            sourceIndex:
              operation.sourceIndex,
          },
        },
      );


      if (
        operation.functionId
      ) {
        addEdge(
          edges,
          {
            from:
              `FUNCTION:${operation.functionId}`,

            to:
              operationId,

            kind:
              "PERFORMS",

            active:
              operation.active,
          },
        );
      }


      if (
        operation.object
      ) {
        const objectId =
          `OBJECT:${operation.object.toUpperCase()}`;

        addNode(
          nodeMap,
          {
            id:
              objectId,

            kind:
              "OBJECT",

            label:
              operation.object,

            active:
              operation.active,
          },
        );
      }
    }
  }


  /*
   * Guarded field effects.
   */
  for (
    const effect
    of executionSemantics
      .guardedEffects
  ) {
    if (
      effect.effectKind !==
        "FIELD_WRITE"
    ) {
      continue;
    }


    const fnId =
      `${effect.file}::${effect.functionName}`;

    addNode(
      nodeMap,
      {
        id:
          effect.target,

        kind:
          "FIELD",

        label:
          effect.target,

        active:
          effect.active,
      },
    );


    addEdge(
      edges,
      {
        from:
          `FUNCTION:${fnId}`,

        to:
          effect.target,

        kind:
          "WRITES_FIELD",

        active:
          effect.active,

        metadata: {
          guards:
            effect.guards,
        },
      },
    );
  }


  /*
   * Generic data-flow edges with canonical endpoints.
   */
  for (
    const flow
    of dataFlow.edges
  ) {
    const from =
      flow.from.canonical;

    const to =
      flow.to.canonical;


    if (
      !from ||
      !to
    ) {
      continue;
    }


    addNode(
      nodeMap,
      {
        id:
          from,

        kind:
          "FIELD",

        label:
          from,
      },
    );


    addNode(
      nodeMap,
      {
        id:
          to,

        kind:
          "FIELD",

        label:
          to,
      },
    );


    addEdge(
      edges,
      {
        from,

        to,

        kind:
          "VALUE_FLOWS_TO",

        active:
          flow.active,

        metadata: {
          source:
            flow.source,

          flowKind:
            flow.kind,
        },
      },
    );
  }


  /*
   * Function-result -> field lineage.
   */
  for (
    const flow
    of executionSemantics
      .functionResultFlows
  ) {
    const functionId =
      `${flow.file}::${flow.calleeFunction}`;

    addNode(
      nodeMap,
      {
        id:
          flow.destinationField,

        kind:
          "FIELD",

        label:
          flow.destinationField,

        active:
          flow.active,
      },
    );


    addEdge(
      edges,
      {
        from:
          `FUNCTION:${functionId}`,

        to:
          flow.destinationField,

        kind:
          "RETURNS_TO_FIELD",

        active:
          flow.active,

        metadata: {
          callExpression:
            flow.callExpression,

          returns:
            flow.returns,
        },
      },
    );
  }


  /*
   * Compact deterministic context intended for the later LLM layer.
   *
   * No raw source code and no invented semantics.
   */
  const activeFunctions =
    [
      ...linkGraph
        .projectReachableFunctions,
    ].sort();


  const potentialFunctions =
    [
      ...linkGraph
        .projectUnreachableFunctions,
    ].sort();


  const activeOperations:
    SoftOneCompactSemanticContext[
      "activeOperations"
    ] = [];

  const potentialOperations:
    SoftOneCompactSemanticContext[
      "potentialOperations"
    ] = [];


  for (
    const file
    of files
  ) {
    for (
      const operation
      of file.businessOperations
    ) {
      const item = {
        functionId:
          operation.functionId,

        operation:
          operation.type,

        object:
          operation.object,
      };


      if (
        operation.active === true
      ) {
        activeOperations.push(
          item,
        );
      }
      else {
        potentialOperations.push(
          item,
        );
      }
    }
  }


  const knownFields =
    semanticContext
      .fieldSemantics
      .filter(
        field =>
          field.resolution ===
            "KNOWN" &&
          !!field.meaning &&
          !!field.semanticStatus,
      )
      .map(
        field => ({
          canonical:
            field.canonical,

          objectContext:
            field.objectContext,

          meaning:
            field.meaning!,

          status:
            field.semanticStatus!,
        }),
      );


  const compactContext:
    SoftOneCompactSemanticContext = {
      activeFunctions,

      potentialFunctions,

      activeOperations,

      potentialOperations,

      knownFields,

      unresolvedFields:
        [
          ...semanticContext
            .unresolvedFields,
        ],

      guardedEffects:
        executionSemantics
          .guardedEffects
          .map(
            effect => ({
              functionName:
                effect.functionName,

              target:
                effect.target,

              active:
                effect.active,

              guards:
                effect.guards.map(
                  guard =>
                    (
                      guard.kind ===
                        "EARLY_RETURN_EXCLUSION" ||
                      guard.kind ===
                        "ELSE_BRANCH"
                    )
                      ? `NOT (${guard.condition})`
                      : guard.condition,
                ),
            }),
          ),

      resultFlows:
        executionSemantics
          .functionResultFlows
          .map(
            flow => ({
              functionName:
                flow.calleeFunction,

              destinationField:
                flow.destinationField,

              returns:
                flow.returns,

              active:
                flow.active,
            }),
          ),
    };


  /*
   * valueLineage is deliberately accepted now because it is part of
   * the semantic pipeline, even when not every lineage produces a
   * canonical graph edge yet.
   */
  void valueLineage;


  return {
    nodes:
      [
        ...nodeMap.values(),
      ].sort(
        (
          a,
          b,
        ) =>
          a.id.localeCompare(
            b.id,
          ),
      ),

    edges,

    compactContext,
  };
}
