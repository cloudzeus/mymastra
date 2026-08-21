export interface SoftOneImplicitFieldAccess {
  receiver: string;

  field: string;

  canonical: string;

  access:
    | "READ"
    | "WRITE";

  expression?: string;

  functionName?: string;

  sourceIndex: number;
}


export interface SoftOneScriptFunction {
  name: string;

  parameters: string[];

  sourceStart: number;

  sourceEnd: number;

  bodyStart: number;

  bodyEnd: number;

  eventHandler: boolean;

  calls: string[];

  /*
   * Every plain function-call identifier detected in this function.
   *
   * Unlike calls[], these are not restricted to functions defined
   * in the same source file. The project linker uses this list to
   * resolve cross-file calls.
   */
  callIdentifiers: string[];

  reachableFromEvents: boolean;
}


export interface SoftOneScriptInclude {
  library: string;
}


export interface SoftOneScriptStructure {
  functions:
    SoftOneScriptFunction[];

  eventHandlers:
    string[];

  includes:
    SoftOneScriptInclude[];

  implicitFieldAccesses:
    SoftOneImplicitFieldAccess[];

  reachableFunctions:
    string[];

  unreachableFunctions:
    string[];
}


interface FunctionScope {
  name: string;

  parameters: string[];

  start: number;

  end: number;

  bodyStart: number;

  bodyEnd: number;

  body: string;

  maskedBody: string;
}


/*
 * Replace strings and comments with spaces while preserving:
 *
 * - exact string length;
 * - offsets;
 * - newlines.
 *
 * This lets lexical analyzers inspect JavaScript syntax without
 * accidentally treating SQL text or comments as executable JS.
 */
export function maskJavaScriptStringsAndComments(
  source: string,
): string {
  const chars =
    source.split("");


  let mode:
    | "CODE"
    | "SINGLE"
    | "DOUBLE"
    | "TEMPLATE"
    | "LINE_COMMENT"
    | "BLOCK_COMMENT" =
      "CODE";


  let escaped =
    false;


  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const char =
      source[index];

    const next =
      source[index + 1];


    if (
      mode === "CODE"
    ) {
      if (
        char === "'"
      ) {
        chars[index] =
          " ";

        mode =
          "SINGLE";

        escaped =
          false;

        continue;
      }


      if (
        char === '"'
      ) {
        chars[index] =
          " ";

        mode =
          "DOUBLE";

        escaped =
          false;

        continue;
      }


      if (
        char === "`"
      ) {
        chars[index] =
          " ";

        mode =
          "TEMPLATE";

        escaped =
          false;

        continue;
      }


      if (
        char === "/" &&
        next === "/"
      ) {
        chars[index] =
          " ";

        chars[index + 1] =
          " ";

        mode =
          "LINE_COMMENT";

        index +=
          1;

        continue;
      }


      if (
        char === "/" &&
        next === "*"
      ) {
        chars[index] =
          " ";

        chars[index + 1] =
          " ";

        mode =
          "BLOCK_COMMENT";

        index +=
          1;

        continue;
      }


      continue;
    }


    if (
      mode === "LINE_COMMENT"
    ) {
      if (
        char === "\n"
      ) {
        mode =
          "CODE";
      }
      else {
        chars[index] =
          " ";
      }

      continue;
    }


    if (
      mode === "BLOCK_COMMENT"
    ) {
      if (
        char === "*" &&
        next === "/"
      ) {
        chars[index] =
          " ";

        chars[index + 1] =
          " ";

        mode =
          "CODE";

        index +=
          1;

        continue;
      }


      if (
        char !== "\n" &&
        char !== "\r"
      ) {
        chars[index] =
          " ";
      }

      continue;
    }


    /*
     * String / template content.
     *
     * At this stage template interpolation is intentionally not
     * parsed as executable JS. We prefer a conservative result.
     */
    if (
      escaped
    ) {
      if (
        char !== "\n" &&
        char !== "\r"
      ) {
        chars[index] =
          " ";
      }

      escaped =
        false;

      continue;
    }


    if (
      char === "\\"
    ) {
      chars[index] =
        " ";

      escaped =
        true;

      continue;
    }


    const closingQuote =
      mode === "SINGLE"
        ? "'"
        : mode === "DOUBLE"
          ? '"'
          : "`";


    if (
      char === closingQuote
    ) {
      chars[index] =
        " ";

      mode =
        "CODE";

      continue;
    }


    if (
      char !== "\n" &&
      char !== "\r"
    ) {
      chars[index] =
        " ";
    }
  }


  return chars.join(
    "",
  );
}


function findMatchingBrace(
  maskedSource: string,
  openIndex: number,
): number {
  let depth =
    0;


  for (
    let index = openIndex;
    index < maskedSource.length;
    index += 1
  ) {
    const char =
      maskedSource[index];


    if (
      char === "{"
    ) {
      depth +=
        1;
    }
    else if (
      char === "}"
    ) {
      depth -=
        1;


      if (
        depth === 0
      ) {
        return index;
      }
    }
  }


  return maskedSource.length -
    1;
}


function detectFunctionScopes(
  source: string,
  maskedSource: string,
): FunctionScope[] {
  const result:
    FunctionScope[] = [];


  const pattern =
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;


  for (
    const match
    of maskedSource.matchAll(
      pattern,
    )
  ) {
    const start =
      match.index ??
      0;

    const relativeOpenBrace =
      match[0].lastIndexOf(
        "{",
      );

    const openBrace =
      start +
      relativeOpenBrace;

    const end =
      findMatchingBrace(
        maskedSource,
        openBrace,
      );

    const bodyStart =
      openBrace + 1;

    const bodyEnd =
      end;


    result.push({
      name:
        match[1],

      parameters:
        (
          match[2] ??
          ""
        )
          .split(",")
          .map(
            item =>
              item.trim(),
          )
          .filter(
            Boolean,
          ),

      start,

      end,

      bodyStart,

      bodyEnd,

      body:
        source.slice(
          bodyStart,
          bodyEnd,
        ),

      maskedBody:
        maskedSource.slice(
          bodyStart,
          bodyEnd,
        ),
    });
  }


  return result;
}


function scopeForIndex(
  scopes:
    FunctionScope[],

  index:
    number,
): FunctionScope | undefined {
  return scopes.find(
    scope =>
      index >= scope.start &&
      index <= scope.end,
  );
}


function detectIncludes(
  source: string,
): SoftOneScriptInclude[] {
  const result:
    SoftOneScriptInclude[] = [];


  /*
   * Includes intentionally use the RAW source because the
   * library identifier itself lives inside a string literal.
   */
  const pattern =
    /\blib\.include\s*\(\s*["']([^"']+)["']\s*\)/gi;


  for (
    const match
    of source.matchAll(
      pattern,
    )
  ) {
    const library =
      match[1]
        ?.trim();


    if (
      library
    ) {
      result.push({
        library,
      });
    }
  }


  return result;
}


function detectCallIdentifiers(
  scope:
    FunctionScope,
): string[] {
  const calls =
    new Set<string>();


  /*
   * Candidate project calls must be plain calls:
   *
   *   helper(...)
   *
   * Not:
   *
   *   object.helper(...)
   *   X.GETSQLDATASET(...)
   *   Math.ceil(...)
   *   new Date(...)
   *
   * We intentionally leave member/runtime calls to the
   * deterministic SoftOne/runtime analyzers.
   */
  const pattern =
    /\b([A-Za-z_$][\w$]*)\s*\(/g;


  const languageKeywords =
    new Set([
      "if",
      "for",
      "while",
      "switch",
      "catch",
      "function",
      "return",
      "typeof",
      "delete",
      "void",
      "with",
    ]);


  for (
    const match
    of scope.maskedBody.matchAll(
      pattern,
    )
  ) {
    const name =
      match[1];

    const relativeIndex =
      match.index ??
      0;


    if (
      languageKeywords.has(
        name,
      )
    ) {
      continue;
    }


    /*
     * Skip member calls.
     *
     * Examples:
     *   X.GETSQLDATASET(
     *     ^
     *
     *   SOACTION.ISNULL(
     *
     *   str.toUpperCase(
     */
    let previousIndex =
      relativeIndex - 1;


    while (
      previousIndex >= 0 &&
      /\s/.test(
        scope.maskedBody[
          previousIndex
        ],
      )
    ) {
      previousIndex -=
        1;
    }


    if (
      previousIndex >= 0 &&
      scope.maskedBody[
        previousIndex
      ] === "."
    ) {
      continue;
    }


    /*
     * Skip constructors:
     *
     *   new Date(...)
     *   new RegExp(...)
     */
    const before =
      scope.maskedBody.slice(
        Math.max(
          0,
          relativeIndex - 16,
        ),
        relativeIndex,
      );


    if (
      /\bnew\s*$/.test(
        before,
      )
    ) {
      continue;
    }


    calls.add(
      name,
    );
  }


  return [
    ...calls,
  ];
}

function detectFunctionCalls(
  scope:
    FunctionScope,

  knownFunctions:
    Set<string>,
): string[] {
  const calls =
    new Set<string>();


  const pattern =
    /\b([A-Za-z_$][\w$]*)\s*\(/g;


  for (
    const match
    of scope.maskedBody.matchAll(
      pattern,
    )
  ) {
    const name =
      match[1];


    if (
      knownFunctions.has(
        name,
      ) &&
      name !== scope.name
    ) {
      calls.add(
        name,
      );
    }
  }


  return [
    ...calls,
  ];
}


/*
 * Read the RHS of an assignment until the first top-level
 * semicolon/newline.
 *
 * Parentheses, brackets, braces and string literals are respected.
 */
function extractBalancedAssignmentExpression(
  source: string,
  startIndex: number,
): string | undefined {
  let index =
    startIndex;


  while (
    index < source.length &&
    /\s/.test(
      source[index],
    )
  ) {
    index +=
      1;
  }


  const expressionStart =
    index;


  let parenDepth =
    0;

  let bracketDepth =
    0;

  let braceDepth =
    0;

  let quote:
    "'" | '"' | "`" | undefined;

  let escaped =
    false;


  for (
    ;
    index < source.length;
    index += 1
  ) {
    const char =
      source[index];


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
      parenDepth +=
        1;

      continue;
    }


    if (
      char === ")"
    ) {
      if (
        parenDepth >
        0
      ) {
        parenDepth -=
          1;
      }

      continue;
    }


    if (
      char === "["
    ) {
      bracketDepth +=
        1;

      continue;
    }


    if (
      char === "]"
    ) {
      if (
        bracketDepth >
        0
      ) {
        bracketDepth -=
          1;
      }

      continue;
    }


    if (
      char === "{"
    ) {
      braceDepth +=
        1;

      continue;
    }


    if (
      char === "}"
    ) {
      if (
        braceDepth >
        0
      ) {
        braceDepth -=
          1;

        continue;
      }


      break;
    }


    const topLevel =
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0;


    if (
      topLevel &&
      (
        char === ";" ||
        char === "\n" ||
        char === "\r"
      )
    ) {
      break;
    }
  }


  const expression =
    source
      .slice(
        expressionStart,
        index,
      )
      .trim();


  return expression ||
    undefined;
}


function detectImplicitFieldAccesses(
  source:
    string,

  maskedSource:
    string,

  scopes:
    FunctionScope[],
): SoftOneImplicitFieldAccess[] {
  const result:
    SoftOneImplicitFieldAccess[] = [];


  /*
   * Upper-case receiver is intentional.
   *
   * SOACTION.FIELD
   * CUSTOMER.FIELD
   * ITELINES.FIELD
   *
   * SQL strings have already been masked, therefore aliases such
   * as I.INST inside SQL do not leak into this detector.
   */
  const pattern =
    /\b([A-Z][A-Z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b/g;


  const excludedReceivers =
    new Set([
      "X",
    ]);


  const methodNames =
    new Set([
      "APPEND",
      "EDIT",
      "POST",
      "DELETE",
      "FIRST",
      "LAST",
      "NEXT",
      "PRIOR",
      "LOCATE",
      "ISNULL",
      "FINDTABLE",
      "DBINSERT",
      "DBPOST",
      "DBDELETE",
      "DBLOCATE",
      "SHOWOBJFORM",
      "FREE",
    ]);


  for (
    const match
    of maskedSource.matchAll(
      pattern,
    )
  ) {
    const receiver =
      match[1];

    const field =
      match[2];

    const sourceIndex =
      match.index ??
      0;


    if (
      excludedReceivers.has(
        receiver,
      ) ||
      methodNames.has(
        field.toUpperCase(),
      )
    ) {
      continue;
    }


    const afterFieldIndex =
      sourceIndex +
      match[0].length;


    const tail =
      maskedSource.slice(
        afterFieldIndex,
        afterFieldIndex +
          100,
      );


    /*
     * Exactly one assignment '='.
     *
     * Do not treat ==, ===, =>, >=, <=, != as writes.
     */
    const assignmentMatch =
      tail.match(
        /^\s*=(?!=|>)/,
      );


    const access:
      "READ" | "WRITE" =
        assignmentMatch
          ? "WRITE"
          : "READ";


    let expression:
      string | undefined;


    if (
      assignmentMatch
    ) {
      const equalsOffset =
        assignmentMatch[0]
          .lastIndexOf(
            "=",
          );

      const expressionStart =
        afterFieldIndex +
        equalsOffset +
        1;


      expression =
        extractBalancedAssignmentExpression(
          source,
          expressionStart,
        );
    }


    const scope =
      scopeForIndex(
        scopes,
        sourceIndex,
      );


    result.push({
      receiver,

      field,

      canonical:
        `FIELD:${receiver}.${field}`
          .toUpperCase(),

      access,

      expression,

      functionName:
        scope?.name,

      sourceIndex,
    });
  }


  return result;
}


function resolveReachability(
  functions:
    SoftOneScriptFunction[],
): Set<string> {
  const byName =
    new Map(
      functions.map(
        fn => [
          fn.name,
          fn,
        ],
      ),
    );


  const reachable =
    new Set<string>();


  const queue =
    functions
      .filter(
        fn =>
          fn.eventHandler,
      )
      .map(
        fn =>
          fn.name,
      );


  while (
    queue.length >
    0
  ) {
    const name =
      queue.shift();


    if (
      !name ||
      reachable.has(
        name,
      )
    ) {
      continue;
    }


    reachable.add(
      name,
    );


    const fn =
      byName.get(
        name,
      );


    for (
      const call
      of fn?.calls ??
        []
    ) {
      if (
        !reachable.has(
          call,
        )
      ) {
        queue.push(
          call,
        );
      }
    }
  }


  return reachable;
}


export function analyzeSoftOneScriptStructure(
  source: string,
): SoftOneScriptStructure {
  const maskedSource =
    maskJavaScriptStringsAndComments(
      source,
    );


  const scopes =
    detectFunctionScopes(
      source,
      maskedSource,
    );


  const knownFunctions =
    new Set(
      scopes.map(
        scope =>
          scope.name,
      ),
    );


  const functions:
    SoftOneScriptFunction[] =
      scopes.map(
        scope => ({
          name:
            scope.name,

          parameters:
            scope.parameters,

          sourceStart:
            scope.start,

          sourceEnd:
            scope.end,

          bodyStart:
            scope.bodyStart,

          bodyEnd:
            scope.bodyEnd,

          eventHandler:
            /^ON_/i.test(
              scope.name,
            ),

          calls:
            detectFunctionCalls(
              scope,
              knownFunctions,
            ),

          callIdentifiers:
            detectCallIdentifiers(
              scope,
            ),

          reachableFromEvents:
            false,
        }),
      );


  const reachable =
    resolveReachability(
      functions,
    );


  for (
    const fn
    of functions
  ) {
    fn.reachableFromEvents =
      reachable.has(
        fn.name,
      );
  }


  return {
    functions,

    eventHandlers:
      functions
        .filter(
          fn =>
            fn.eventHandler,
        )
        .map(
          fn =>
            fn.name,
        ),

    includes:
      detectIncludes(
        source,
      ),

    implicitFieldAccesses:
      detectImplicitFieldAccesses(
        source,
        maskedSource,
        scopes,
      ),

    reachableFunctions:
      [
        ...reachable,
      ],

    unreachableFunctions:
      functions
        .filter(
          fn =>
            !reachable.has(
              fn.name,
            ),
        )
        .map(
          fn =>
            fn.name,
        ),
  };
}
