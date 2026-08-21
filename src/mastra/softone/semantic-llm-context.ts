import type {
  SoftOneProjectSemanticGraph,
} from "./script-project-semantic-graph";


export interface SoftOneSemanticLlmContext {
  rules: {
    verifiedMeansAuthoritative:
      true;

    derivedMeansSupportedInference:
      true;

    unresolvedMustRemainUnresolved:
      true;

    llmInferenceMayNotVerify:
      true;
  };

  activeFunctions:
    string[];

  potentialFunctions:
    string[];

  activeOperations:
    SoftOneProjectSemanticGraph[
      "compactContext"
    ][
      "activeOperations"
    ];

  potentialOperations:
    SoftOneProjectSemanticGraph[
      "compactContext"
    ][
      "potentialOperations"
    ];

  knownFields:
    SoftOneProjectSemanticGraph[
      "compactContext"
    ][
      "knownFields"
    ];

  unresolvedFields:
    string[];

  guardedEffects:
    SoftOneProjectSemanticGraph[
      "compactContext"
    ][
      "guardedEffects"
    ];

  resultFlows:
    SoftOneProjectSemanticGraph[
      "compactContext"
    ][
      "resultFlows"
    ];

  objectTableRelations:
    Array<{
      object: string;
      table: string;
      active: boolean;
      relation: string;
    }>;
}


export function createSoftOneSemanticLlmContext(
  graph:
    SoftOneProjectSemanticGraph,
): SoftOneSemanticLlmContext {
  const compact =
    graph.compactContext;


  const objectTableRelations =
    graph.edges
      .filter(
        edge =>
          edge.kind ===
            "USES_TABLE" &&
          edge.from.startsWith(
            "OBJECT:",
          ) &&
          edge.to.startsWith(
            "TABLE:",
          ),
      )
      .map(
        edge => ({
          object:
            edge.from.slice(
              "OBJECT:".length,
            ),

          table:
            edge.to.slice(
              "TABLE:".length,
            ),

          active:
            edge.active === true,

          relation:
            String(
              edge.metadata
                ?.relation ??
              "OBSERVED_RUNTIME_USAGE",
            ),
        }),
      );


  return {
    rules: {
      verifiedMeansAuthoritative:
        true,

      derivedMeansSupportedInference:
        true,

      unresolvedMustRemainUnresolved:
        true,

      llmInferenceMayNotVerify:
        true,
    },

    activeFunctions:
      compact.activeFunctions,

    potentialFunctions:
      compact.potentialFunctions,

    activeOperations:
      compact.activeOperations,

    potentialOperations:
      compact.potentialOperations,

    knownFields:
      compact.knownFields,

    unresolvedFields:
      compact.unresolvedFields,

    guardedEffects:
      compact.guardedEffects,

    resultFlows:
      compact.resultFlows,

    objectTableRelations,
  };
}
