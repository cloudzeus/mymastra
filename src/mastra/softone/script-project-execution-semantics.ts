import type {
  SoftOneProjectScriptAnalysis,
} from "./script-project-analyzer";

import type {
  SoftOneProjectLinkGraph,
} from "./script-project-linker";

import {
  maskJavaScriptStringsAndComments,
} from "./script-structure-analyzer";


export interface SoftOneFunctionReturn {
  file: string;
  functionName: string;
  expression: string;
  resolvedExpression?: string;
  sourceIndex: number;
  active: boolean;
}


export interface SoftOneFunctionResultFlow {
  file: string;
  callerFunction: string;
  calleeFunction: string;
  destinationField: string;
  callExpression: string;
  returns: string[];
  active: boolean;
}


export interface SoftOneVariableResolution {
  file: string;
  functionName: string;
  variable: string;
  expression: string;
  resolvedExpression?: string;
  destinationField?: string;
  active: boolean;
}


export interface SoftOneExecutionGuard {
  file: string;
  functionName: string;
  condition: string;
  kind:
    | "ENCLOSING_IF"
    | "ELSE_BRANCH"
    | "EARLY_RETURN_EXCLUSION";
  sourceIndex: number;
  appliesFrom?: number;
  appliesTo?: number;
  active: boolean;
}


export interface SoftOneGuardedEffect {
  file: string;
  functionName: string;
  effectKind:
    | "BUSINESS_OPERATION"
    | "FIELD_WRITE";
  target: string;
  sourceIndex: number;
  guards: Array<{
    condition: string;
    kind:
      | "ENCLOSING_IF" | "ELSE_BRANCH" | "EARLY_RETURN_EXCLUSION";
  }>;
  active: boolean;
}


export interface SoftOneProjectExecutionSemantics {
  returns: SoftOneFunctionReturn[];
  functionResultFlows:
    SoftOneFunctionResultFlow[];
  variableResolutions:
    SoftOneVariableResolution[];
  guards:
    SoftOneExecutionGuard[];

  guardedEffects:
    SoftOneGuardedEffect[];
}


function functionId(
  file: string,
  functionName: string,
): string {
  return `${file}::${functionName}`;
}


function findMatching(
  source: string,
  openIndex: number,
  open: string,
  close: string,
): number {
  let depth = 0;

  for (
    let i = openIndex;
    i < source.length;
    i += 1
  ) {
    if (
      source[i] === open
    ) {
      depth += 1;
    }
    else if (
      source[i] === close
    ) {
      depth -= 1;

      if (
        depth === 0
      ) {
        return i;
      }
    }
  }

  return source.length - 1;
}


function lastVariableAssignment(
  source: string,
  maskedSource: string,
  variable: string,
  beforeIndex: number,
): string | undefined {
  const escaped =
    variable.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const pattern =
    new RegExp(
      `\\b(?:var\\s+|let\\s+|const\\s+)?${escaped}\\s*=\\s*(?!=)`,
      "g",
    );

  let result:
    string | undefined;

  for (
    const match
    of maskedSource.matchAll(
      pattern,
    )
  ) {
    const index =
      match.index ??
      0;

    if (
      index >= beforeIndex
    ) {
      break;
    }

    const rhsStart =
      index +
      match[0].length;

    let i =
      rhsStart;

    let paren = 0;
    let bracket = 0;
    let brace = 0;

    while (
      i < source.length
    ) {
      const char =
        source[i];

      if (char === "(") paren += 1;
      else if (char === ")") paren -= 1;
      else if (char === "[") bracket += 1;
      else if (char === "]") bracket -= 1;
      else if (char === "{") brace += 1;
      else if (char === "}") brace -= 1;

      if (
        paren === 0 &&
        bracket === 0 &&
        brace === 0 &&
        (
          char === ";" ||
          char === "\n" ||
          char === "\r"
        )
      ) {
        break;
      }

      i += 1;
    }

    result =
      source
        .slice(
          rhsStart,
          i,
        )
        .trim();
  }

  return result;
}


function resolveSimpleVariable(
  source: string,
  maskedSource: string,
  expression: string,
  beforeIndex: number,
): string | undefined {
  let current =
    expression.trim();

  const seen =
    new Set<string>();

  for (
    let depth = 0;
    depth < 5;
    depth += 1
  ) {
    if (
      !/^[A-Za-z_$][\w$]*$/.test(
        current,
      ) ||
      seen.has(
        current,
      )
    ) {
      return current ===
        expression.trim()
        ? undefined
        : current;
    }

    seen.add(
      current,
    );

    const assignment =
      lastVariableAssignment(
        source,
        maskedSource,
        current,
        beforeIndex,
      );

    if (
      !assignment
    ) {
      return current ===
        expression.trim()
        ? undefined
        : current;
    }

    current =
      assignment.trim();
  }

  return current;
}


function detectReturns(
  file:
    SoftOneProjectScriptAnalysis,
  reachable:
    Set<string>,
): SoftOneFunctionReturn[] {
  const result:
    SoftOneFunctionReturn[] = [];

  const masked =
    maskJavaScriptStringsAndComments(
      file.source,
    );

  for (
    const fn
    of file.structure.functions
  ) {
    const functionSource =
      file.source.slice(
        fn.bodyStart,
        fn.bodyEnd,
      );

    const functionMasked =
      masked.slice(
        fn.bodyStart,
        fn.bodyEnd,
      );

    const pattern =
      /\breturn(?:\s+([^;\n\r]+))?/g;

    for (
      const match
      of functionMasked.matchAll(
        pattern,
      )
    ) {
      const relativeIndex =
        match.index ??
        0;

      const sourceIndex =
        fn.bodyStart +
        relativeIndex;

      const rawMatch =
        functionSource.slice(
          relativeIndex,
        );

      const expressionMatch =
        rawMatch.match(
          /^return(?:\s+([^;\n\r]+))?/,
        );

      const expression =
        (
          expressionMatch?.[1] ??
          ""
        ).trim();

      if (
        !expression
      ) {
        continue;
      }

      result.push({
        file:
          file.file,

        functionName:
          fn.name,

        expression,

        resolvedExpression:
          resolveSimpleVariable(
            file.source,
            masked,
            expression,
            sourceIndex,
          ),

        sourceIndex,

        active:
          reachable.has(
            functionId(
              file.file,
              fn.name,
            ),
          ),
      });
    }
  }

  return result;
}


function detectVariableResolutions(
  file:
    SoftOneProjectScriptAnalysis,
  reachable:
    Set<string>,
): SoftOneVariableResolution[] {
  const result:
    SoftOneVariableResolution[] = [];

  const masked =
    maskJavaScriptStringsAndComments(
      file.source,
    );

  for (
    const access
    of file.structure
      .implicitFieldAccesses
  ) {
    if (
      access.access !==
        "WRITE" ||
      !access.expression ||
      !access.functionName
    ) {
      continue;
    }

    const expression =
      access.expression.trim();

    if (
      !/^[A-Za-z_$][\w$]*$/.test(
        expression,
      )
    ) {
      continue;
    }

    const resolved =
      resolveSimpleVariable(
        file.source,
        masked,
        expression,
        access.sourceIndex,
      );

    if (
      !resolved
    ) {
      continue;
    }

    result.push({
      file:
        file.file,

      functionName:
        access.functionName,

      variable:
        expression,

      expression,

      resolvedExpression:
        resolved,

      destinationField:
        access.canonical,

      active:
        reachable.has(
          functionId(
            file.file,
            access.functionName,
          ),
        ),
    });
  }

  return result;
}


function skipWhitespace(
  source: string,
  start: number,
  end: number,
): number {
  let index =
    start;

  while (
    index < end &&
    /\s/.test(
      source[index] ??
      "",
    )
  ) {
    index += 1;
  }

  return index;
}


interface StatementRange {
  from: number;
  to: number;
  next: number;
}


function statementRange(
  masked: string,
  start: number,
  end: number,
): StatementRange {
  const index =
    skipWhitespace(
      masked,
      start,
      end,
    );


  if (
    masked[index] ===
      "{"
  ) {
    const close =
      findMatching(
        masked,
        index,
        "{",
        "}",
      );

    return {
      from:
        index + 1,

      to:
        Math.max(
          index + 1,
          close - 1,
        ),

      next:
        close + 1,
    };
  }


  /*
   * Nested if / else-if is treated as one complete statement.
   * This allows the parent ELSE condition to cover the entire
   * nested branch without leaking to statements after it.
   */
  if (
    /\bif\s*\(/.test(
      masked.slice(
        index,
        Math.min(
          index + 16,
          end,
        ),
      ),
    )
  ) {
    const openParen =
      masked.indexOf(
        "(",
        index,
      );

    if (
      openParen >= 0
    ) {
      const closeParen =
        findMatching(
          masked,
          openParen,
          "(",
          ")",
        );

      const thenRange =
        statementRange(
          masked,
          closeParen + 1,
          end,
        );

      let next =
        skipWhitespace(
          masked,
          thenRange.next,
          end,
        );


      if (
        masked.slice(
          next,
          next + 4,
        ) ===
          "else" &&
        !/[A-Za-z0-9_$]/.test(
          masked[next + 4] ??
          "",
        )
      ) {
        const elseStart =
          skipWhitespace(
            masked,
            next + 4,
            end,
          );

        const elseRange =
          statementRange(
            masked,
            elseStart,
            end,
          );

        return {
          from:
            index,

          to:
            elseRange.to,

          next:
            elseRange.next,
        };
      }


      return {
        from:
          index,

        to:
          thenRange.to,

        next:
          thenRange.next,
      };
    }
  }


  /*
   * Ordinary single JavaScript statement.
   */
  let cursor =
    index;

  let paren =
    0;

  let bracket =
    0;

  while (
    cursor < end
  ) {
    const char =
      masked[cursor];

    if (
      char === "("
    ) {
      paren += 1;
    }
    else if (
      char === ")"
    ) {
      paren =
        Math.max(
          0,
          paren - 1,
        );
    }
    else if (
      char === "["
    ) {
      bracket += 1;
    }
    else if (
      char === "]"
    ) {
      bracket =
        Math.max(
          0,
          bracket - 1,
        );
    }


    if (
      paren === 0 &&
      bracket === 0 &&
      (
        char === ";" ||
        char === "\n" ||
        char === "\r"
      )
    ) {
      return {
        from:
          index,

        to:
          Math.max(
            index,
            cursor - 1,
          ),

        next:
          cursor + 1,
      };
    }


    cursor += 1;
  }


  return {
    from:
      index,

    to:
      Math.max(
        index,
        end - 1,
      ),

    next:
      end,
  };
}


function detectGuards(
  file:
    SoftOneProjectScriptAnalysis,

  reachable:
    Set<string>,
): SoftOneExecutionGuard[] {
  const result:
    SoftOneExecutionGuard[] = [];

  const masked =
    maskJavaScriptStringsAndComments(
      file.source,
    );


  for (
    const fn
    of file.structure.functions
  ) {
    const functionActive =
      reachable.has(
        functionId(
          file.file,
          fn.name,
        ),
      );


    const bodyMasked =
      masked.slice(
        fn.bodyStart,
        fn.bodyEnd,
      );


    const pattern =
      /\bif\s*\(/g;


    for (
      const match
      of bodyMasked.matchAll(
        pattern,
      )
    ) {
      const relativeIndex =
        match.index ??
        0;

      const ifIndex =
        fn.bodyStart +
        relativeIndex;


      const openParen =
        masked.indexOf(
          "(",
          ifIndex,
        );

      if (
        openParen < 0 ||
        openParen >=
          fn.bodyEnd
      ) {
        continue;
      }


      const closeParen =
        findMatching(
          masked,
          openParen,
          "(",
          ")",
        );


      const condition =
        file.source
          .slice(
            openParen + 1,
            closeParen,
          )
          .trim();


      const thenRange =
        statementRange(
          masked,
          closeParen + 1,
          fn.bodyEnd,
        );


      let afterThen =
        skipWhitespace(
          masked,
          thenRange.next,
          fn.bodyEnd,
        );


      let elseRange:
        StatementRange | undefined;


      if (
        masked.slice(
          afterThen,
          afterThen + 4,
        ) ===
          "else" &&
        !/[A-Za-z0-9_$]/.test(
          masked[
            afterThen + 4
          ] ??
          "",
        )
      ) {
        const elseStart =
          skipWhitespace(
            masked,
            afterThen + 4,
            fn.bodyEnd,
          );


        elseRange =
          statementRange(
            masked,
            elseStart,
            fn.bodyEnd,
          );
      }


      const thenText =
        file.source
          .slice(
            thenRange.from,
            thenRange.to + 1,
          )
          .trim();


      /*
       * if (condition) return ...
       *
       * Everything after the complete if/else statement can only
       * execute when the early-return condition did NOT terminate
       * execution.
       */
      if (
        /^return\b/.test(
          thenText,
        )
      ) {
        const statementEnd =
          elseRange
            ? elseRange.next
            : thenRange.next;


        result.push({
          file:
            file.file,

          functionName:
            fn.name,

          condition,

          kind:
            "EARLY_RETURN_EXCLUSION",

          sourceIndex:
            ifIndex,

          appliesFrom:
            statementEnd,

          appliesTo:
            fn.bodyEnd,

          active:
            functionActive,
        });
      }
      else {
        result.push({
          file:
            file.file,

          functionName:
            fn.name,

          condition,

          kind:
            "ENCLOSING_IF",

          sourceIndex:
            ifIndex,

          appliesFrom:
            thenRange.from,

          appliesTo:
            thenRange.to,

          active:
            functionActive,
        });
      }


      /*
       * ELSE means the original condition is false.
       *
       * We retain the original expression and encode polarity in
       * the guard kind rather than rewriting JavaScript syntax.
       */
      if (
        elseRange
      ) {
        result.push({
          file:
            file.file,

          functionName:
            fn.name,

          condition,

          kind:
            "ELSE_BRANCH",

          sourceIndex:
            afterThen,

          appliesFrom:
            elseRange.from,

          appliesTo:
            elseRange.to,

          active:
            functionActive,
        });
      }
    }
  }


  return result;
}


export function analyzeSoftOneProjectExecutionSemantics(
  files:
    SoftOneProjectScriptAnalysis[],

  linkGraph:
    SoftOneProjectLinkGraph,
): SoftOneProjectExecutionSemantics {
  const reachable =
    new Set(
      linkGraph.projectReachableFunctions,
    );

  const returns =
    files.flatMap(
      file =>
        detectReturns(
          file,
          reachable,
        ),
    );

  const variableResolutions =
    files.flatMap(
      file =>
        detectVariableResolutions(
          file,
          reachable,
        ),
    );

  const guards =
    files.flatMap(
      file =>
        detectGuards(
          file,
          reachable,
        ),
    );

  const functionResultFlows:
    SoftOneFunctionResultFlow[] = [];

  for (
    const file
    of files
  ) {
    for (
      const edge
      of file.structure
        .implicitFieldAccesses
    ) {
      if (
        edge.access !==
          "WRITE" ||
        !edge.expression ||
        !edge.functionName
      ) {
        continue;
      }

      const call =
        edge.expression
          .trim()
          .match(
            /^([A-Za-z_$][\w$]*)\s*\(/,
          );

      if (
        !call?.[1]
      ) {
        continue;
      }

      const calleeName =
        call[1];

      const candidateReturns =
        returns.filter(
          item =>
            item.functionName ===
              calleeName,
        );

      if (
        candidateReturns.length ===
          0
      ) {
        continue;
      }

      functionResultFlows.push({
        file:
          file.file,

        callerFunction:
          edge.functionName,

        calleeFunction:
          calleeName,

        destinationField:
          edge.canonical,

        callExpression:
          edge.expression,

        returns:
          candidateReturns.map(
            item =>
              item.resolvedExpression ??
              item.expression,
          ),

        active:
          reachable.has(
            functionId(
              file.file,
              edge.functionName,
            ),
          ),
      });
    }
  }

  const guardedEffects:
    SoftOneGuardedEffect[] = [];


  const matchingGuards = (
    file: string,
    functionName: string,
    sourceIndex: number,
  ) =>
    guards
      .filter(
        guard =>
          guard.file === file &&
          guard.functionName === functionName &&
          guard.appliesFrom !== undefined &&
          guard.appliesTo !== undefined &&
          sourceIndex >= guard.appliesFrom &&
          sourceIndex <= guard.appliesTo,
      )
      .map(
        guard => ({
          condition:
            guard.condition,

          kind:
            guard.kind,
        }),
      );


  for (
    const file
    of files
  ) {
    for (
      const operation
      of file.businessOperations
    ) {
      if (
        !operation.functionName ||
        operation.sourceIndex === undefined
      ) {
        continue;
      }

      const effectGuards =
        matchingGuards(
          file.file,
          operation.functionName,
          operation.sourceIndex,
        );

      if (
        effectGuards.length === 0
      ) {
        continue;
      }

      guardedEffects.push({
        file:
          file.file,

        functionName:
          operation.functionName,

        effectKind:
          "BUSINESS_OPERATION",

        target:
          operation.object ??
          operation.type,

        sourceIndex:
          operation.sourceIndex,

        guards:
          effectGuards,

        active:
          operation.active === true,
      });
    }


    for (
      const access
      of file.structure
        .implicitFieldAccesses
    ) {
      if (
        access.access !== "WRITE" ||
        !access.functionName
      ) {
        continue;
      }

      const effectGuards =
        matchingGuards(
          file.file,
          access.functionName,
          access.sourceIndex,
        );

      if (
        effectGuards.length === 0
      ) {
        continue;
      }

      guardedEffects.push({
        file:
          file.file,

        functionName:
          access.functionName,

        effectKind:
          "FIELD_WRITE",

        target:
          access.canonical,

        sourceIndex:
          access.sourceIndex,

        guards:
          effectGuards,

        active:
          reachable.has(
            functionId(
              file.file,
              access.functionName,
            ),
          ),
      });
    }
  }


  return {
    returns,
    functionResultFlows,
    variableResolutions,
    guards,
    guardedEffects,
  };
}
