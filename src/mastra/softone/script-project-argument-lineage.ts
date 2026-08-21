import type {
  SoftOneProjectScriptAnalysis,
} from "./script-project-analyzer";

import type {
  SoftOneProjectLinkGraph,
} from "./script-project-linker";


export interface SoftOneFunctionArgumentValue {
  raw: string;

  index: number;
}


export interface SoftOneFunctionCallSite {
  file: string;

  callerFunction: string;

  calleeName: string;

  sourceIndex: number;

  arguments:
    SoftOneFunctionArgumentValue[];
}


export interface SoftOneArgumentParameterBinding {
  from: {
    file: string;

    functionName: string;

    expression: string;

    argumentIndex: number;
  };

  to: {
    file: string;

    functionName: string;

    parameter: string;

    parameterIndex: number;
  };

  active: boolean;

  resolution:
    | "LOCAL"
    | "CROSS_FILE";
}


export interface SoftOneArgumentFieldFlow {
  binding:
    SoftOneArgumentParameterBinding;

  targetField: string;

  targetExpression: string;

  targetFunction: string;

  active: boolean;
}


export interface SoftOneProjectArgumentLineage {
  callSites:
    SoftOneFunctionCallSite[];

  bindings:
    SoftOneArgumentParameterBinding[];

  fieldFlows:
    SoftOneArgumentFieldFlow[];
}


function functionId(
  file: string,
  functionName: string,
): string {
  return `${file}::${functionName}`;
}


function splitArguments(
  raw: string,
): string[] {
  const args:
    string[] = [];


  let start =
    0;

  let paren =
    0;

  let bracket =
    0;

  let brace =
    0;

  let quote:
    "'" | '"' | "`" | undefined;

  let escaped =
    false;


  for (
    let i = 0;
    i < raw.length;
    i += 1
  ) {
    const char =
      raw[i];


    if (
      quote
    ) {
      if (
        escaped
      ) {
        escaped =
          false;

        continue;
      }


      if (
        char === "\\"
      ) {
        escaped =
          true;

        continue;
      }


      if (
        char === quote
      ) {
        quote =
          undefined;
      }


      continue;
    }


    if (
      char === "'" ||
      char === '"' ||
      char === "`"
    ) {
      quote =
        char;

      continue;
    }


    if (
      char === "("
    ) {
      paren +=
        1;

      continue;
    }


    if (
      char === ")"
    ) {
      if (
        paren >
        0
      ) {
        paren -=
          1;
      }

      continue;
    }


    if (
      char === "["
    ) {
      bracket +=
        1;

      continue;
    }


    if (
      char === "]"
    ) {
      if (
        bracket >
        0
      ) {
        bracket -=
          1;
      }

      continue;
    }


    if (
      char === "{"
    ) {
      brace +=
        1;

      continue;
    }


    if (
      char === "}"
    ) {
      if (
        brace >
        0
      ) {
        brace -=
          1;
      }

      continue;
    }


    if (
      char === "," &&
      paren === 0 &&
      bracket === 0 &&
      brace === 0
    ) {
      const value =
        raw
          .slice(
            start,
            i,
          )
          .trim();


      args.push(
        value,
      );


      start =
        i + 1;
    }
  }


  const tail =
    raw
      .slice(
        start,
      )
      .trim();


  if (
    tail.length >
    0
  ) {
    args.push(
      tail,
    );
  }


  return args;
}


function findMatchingParen(
  source: string,
  openIndex: number,
): number {
  let depth =
    0;

  let quote:
    "'" | '"' | "`" | undefined;

  let escaped =
    false;


  for (
    let i = openIndex;
    i < source.length;
    i += 1
  ) {
    const char =
      source[i];


    if (
      quote
    ) {
      if (
        escaped
      ) {
        escaped =
          false;

        continue;
      }


      if (
        char === "\\"
      ) {
        escaped =
          true;

        continue;
      }


      if (
        char === quote
      ) {
        quote =
          undefined;
      }


      continue;
    }


    if (
      char === "'" ||
      char === '"' ||
      char === "`"
    ) {
      quote =
        char;

      continue;
    }


    if (
      char === "("
    ) {
      depth +=
        1;
    }
    else if (
      char === ")"
    ) {
      depth -=
        1;


      if (
        depth === 0
      ) {
        return i;
      }
    }
  }


  return -1;
}


function findCallSites(
  file:
    SoftOneProjectScriptAnalysis,
): SoftOneFunctionCallSite[] {
  const source =
    file.source;


  const result:
    SoftOneFunctionCallSite[] = [];


  for (
    const fn
    of file.structure.functions
  ) {
    const body =
      source.slice(
        fn.bodyStart,
        fn.bodyEnd,
      );


    for (
      const callName
      of fn.callIdentifiers
    ) {
      const escapedName =
        callName.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );


      const pattern =
        new RegExp(
          `\\b${escapedName}\\s*\\(`,
          "g",
        );


      for (
        const match
        of body.matchAll(
          pattern,
        )
      ) {
        const relativeIndex =
          match.index ??
          0;


        /*
         * Absolute index in the original source file.
         */
        const sourceIndex =
          fn.bodyStart +
          relativeIndex;


        /*
         * Defensive check: this call must actually belong to
         * the current function body.
         */
        if (
          sourceIndex <
            fn.bodyStart ||
          sourceIndex >=
            fn.bodyEnd
        ) {
          continue;
        }


        const openParen =
          source.indexOf(
            "(",
            sourceIndex,
          );


        if (
          openParen <
            fn.bodyStart ||
          openParen >=
            fn.bodyEnd
        ) {
          continue;
        }


        const closeParen =
          findMatchingParen(
            source,
            openParen,
          );


        if (
          closeParen <
            0 ||
          closeParen >
            fn.bodyEnd
        ) {
          continue;
        }


        const rawArgs =
          source.slice(
            openParen + 1,
            closeParen,
          );


        result.push({
          file:
            file.file,

          callerFunction:
            fn.name,

          calleeName:
            callName,

          sourceIndex,

          arguments:
            splitArguments(
              rawArgs,
            ).map(
              (
                raw,
                index,
              ) => ({
                raw,

                index,
              }),
            ),
        });
      }
    }
  }


  return result.sort(
    (
      a,
      b,
    ) =>
      a.sourceIndex -
      b.sourceIndex,
  );
}

export function buildSoftOneProjectArgumentLineage(
  files:
    SoftOneProjectScriptAnalysis[],

  linkGraph:
    SoftOneProjectLinkGraph,
): SoftOneProjectArgumentLineage {
  const callSites =
    files.flatMap(
      file =>
        findCallSites(
          file,
        ),
    );


  const bindings:
    SoftOneArgumentParameterBinding[] = [];


  for (
    const callSite
    of callSites
  ) {
    const callerId =
      functionId(
        callSite.file,
        callSite.callerFunction,
      );


    const edge =
      linkGraph.callEdges.find(
        candidate =>
          candidate.from ===
            callerId &&
          candidate.call ===
            callSite.calleeName &&
          (
            candidate.resolution ===
              "LOCAL" ||
            candidate.resolution ===
              "CROSS_FILE"
          ),
      );


    if (
      !edge ||
      edge.targets.length !==
        1
    ) {
      continue;
    }


    const targetId =
      edge.targets[0];

    const target =
      linkGraph.functions.find(
        fn =>
          fn.id ===
          targetId,
      );


    if (
      !target
    ) {
      continue;
    }


    const targetFile =
      files.find(
        file =>
          file.file ===
          target.file,
      );


    const targetFunction =
      targetFile
        ?.structure.functions.find(
          fn =>
            fn.name ===
            target.name,
        );


    if (
      !targetFunction
    ) {
      continue;
    }


    for (
      let index = 0;
      index <
      Math.min(
        callSite.arguments.length,
        targetFunction.parameters.length,
      );
      index += 1
    ) {
      const argument =
        callSite.arguments[index];

      const parameter =
        targetFunction.parameters[index];


            if (
        edge.resolution ===
          "UNRESOLVED" ||
        edge.resolution ===
          "AMBIGUOUS"
      ) {
        continue;
      }


bindings.push({
        from: {
          file:
            callSite.file,

          functionName:
            callSite.callerFunction,

          expression:
            argument.raw,

          argumentIndex:
            index,
        },

        to: {
          file:
            target.file,

          functionName:
            target.name,

          parameter,

          parameterIndex:
            index,
        },

        active:
          linkGraph
            .projectReachableFunctions
            .includes(
              callerId,
            ) &&
          linkGraph
            .projectReachableFunctions
            .includes(
              targetId,
            ),

        resolution:
          edge.resolution,
      });
    }
  }


  const fieldFlows:
    SoftOneArgumentFieldFlow[] = [];


  for (
    const binding
    of bindings
  ) {
    const targetFile =
      files.find(
        file =>
          file.file ===
          binding.to.file,
      );


    if (
      !targetFile
    ) {
      continue;
    }


    for (
      const field
      of targetFile.decoded.fieldUsages
    ) {
      if (
        field.valueOrigin
          ?.functionName !==
        binding.to.functionName
      ) {
        continue;
      }


      const parameterUsed =
        field.valueOrigin
          ?.kind ===
          "FUNCTION_PARAMETER" &&
        field.valueOrigin
          ?.parameterName ===
          binding.to.parameter;


      const expressionUsesParameter =
        field.expression
          ?.includes(
            binding.to.parameter,
          ) ??
        false;


      if (
        !parameterUsed &&
        !expressionUsesParameter
      ) {
        continue;
      }


      fieldFlows.push({
        binding,

        targetField:
          field.canonical,

        targetExpression:
          field.expression ??
          binding.to.parameter,

        targetFunction:
          binding.to.functionName,

        active:
          binding.active,
      });
    }
  }


  return {
    callSites,

    bindings,

    fieldFlows,
  };
}
