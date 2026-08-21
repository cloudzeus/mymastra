import {
  findSoftOneAppendixByCode,
} from "./blackbook-appendix-registry";

import {
  qualifySoftOneConstruct,
} from "./qualified-construct";

import {
  resolveSoftOneConstructCompatibility,
} from "./construct-compatibility-resolver";

import {
  findSoftOneFieldSemantic,
} from "./field-semantics-registry";

import type {
  SoftOneFieldSemanticStatus,
} from "./field-semantics-registry";

import type {
  SoftOneExecutionSurface,
} from "./execution-context-types";


export type SoftOneDetectedOperation =
  | "DIRECT_DATABASE_QUERY"
  | "OBJECT_CREATE"
  | "OBJECT_READ"
  | "OBJECT_INSERT"
  | "OBJECT_UPDATE"
  | "OBJECT_DELETE"
  | "OBJECT_WRITE"
  | "OBJECT_PARAMETER_SET"
  | "DATASET_READ"
  | "DATASET_WRITE"
  | "BUILTIN_WEB_SERVICE_CALL"
  | "CUSTOM_WEB_SERVICE_CALL"
  | "HTTP_API_CALL"
  | "STRING_LIST_LOOKUP"
  | "COMMAND_EXECUTION"
  | "INTERNAL_LIBRARY_CALL"
  | "MODULE_BINDING"
  | "DATASET_OPERATION"
  | "UNKNOWN";


export interface SoftOneDetectedConstructCompatibility {
  authoritative:
    boolean;

  supportedSurfaces:
    SoftOneExecutionSurface[];

  indirectSurfaces:
    SoftOneExecutionSurface[];

  unsupportedSurfaces:
    SoftOneExecutionSurface[];

  unverifiedSurfaces:
    SoftOneExecutionSurface[];
}


export interface SoftOneDetectedConstruct {
  type:
    | "FUNCTION"
    | "SYSTEM_PARAMETER"
    | "SODTYPE"
    | "SOSOURCE"
    | "OBJECT"
    | "TABLE"
    | "FIELD"
    | "WEB_SERVICE"
    | "SQL_SCRIPT"
    | "CUSTOM_WEB_SERVICE"
    | "COMMAND";

  value: string;

  canonical?: string;

  meaning?: string;

  compatibility?:
    SoftOneDetectedConstructCompatibility;

  evidence:
    "DETERMINISTIC";
}


export interface SoftOneDetectedSql {
  source:
    | "GETSQLDATASET"
    | "X.SQL"
    | "SQLDATA";

  statement?: string;

  tables: string[];

  operation:
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "OTHER";

  parameterized:
    boolean;
}


export interface SoftOneDetectedWebService {
  mechanism:
    | "X.WEBREQUEST"
    | "X.WSCALL"
    | "DIRECT_REFERENCE";

  service?: string;

  sqlName?: string;

  object?: string;

  customUri?: string;
}


export interface SoftOneExecutionEdge {
  from:
    SoftOneExecutionSurface;

  to:
    SoftOneExecutionSurface;

  via: string;

  detail?: string;
}


export interface SoftOneDetectedObjectUsage {
  variable?: string;

  object: string;

  formOrOptions?: string;

  functionName?: string;

  sourceIndex?: number;


  methods: string[];

  tables: string[];

  access:
    | "CREATE"
    | "READ"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "MIXED";
}


export type SoftOneValueOriginKind =
  | "FUNCTION_PARAMETER"
  | "CONSTANT"
  | "SYSTEM_PARAMETER"
  | "FIELD_REFERENCE"
  | "VARIABLE"
  | "FUNCTION_CALL"
  | "EXPRESSION"
  | "UNKNOWN";


export interface SoftOneDetectedValueOrigin {
  kind:
    SoftOneValueOriginKind;

  raw: string;

  symbol?: string;

  canonical?: string;

  functionName?: string;

  parameterName?: string;

  resolvedValue?: string;
}


export interface SoftOneDetectedDatasetFieldWrite {
  field: string;

  expression: string;

  resolvedValue?: string;

  sourceIndex?: number;

  scopeName?: string;

  scopeParameters?: string[];
}


export interface SoftOneDetectedFieldUsage {
  table: string;

  field: string;

  canonical: string;

  datasetVariable?: string;

  object?: string;

  access:
    | "READ"
    | "WRITE";

  expression?: string;

  resolvedValue?: string;

  meaning?: string;

  semanticStatus?:
    SoftOneFieldSemanticStatus;

  semanticRole?: string;

  references?: {
    object?: string;

    table?: string;
  };

  semanticEvidence?: string[];

  valueOrigin?:
    SoftOneDetectedValueOrigin;
}


export interface SoftOneDetectedDatasetUsage {
  variable: string;

  table: string;

  canonical: string;

  objectVariable?: string;

  object?: string;

  methods: string[];

  fieldWrites:
    SoftOneDetectedDatasetFieldWrite[];

  access:
    | "READ"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "MIXED";
}


export interface SoftOneDetectedModuleBinding {
  object: string;

  module: string;
}


export interface SoftOneDetectedInternalCall {
  library:
    | "ModuleIntf"
    | "SysRequest"
    | "PiLib"
    | "OTHER";

  function: string;

  raw: string;
}


export interface SoftOneDecodedScript {
  hostSurface:
    SoftOneExecutionSurface;

  operations:
    SoftOneDetectedOperation[];

  executionChain:
    SoftOneExecutionSurface[];

  executionEdges:
    SoftOneExecutionEdge[];

  constructs:
    SoftOneDetectedConstruct[];

  sql:
    SoftOneDetectedSql[];

  webServices:
    SoftOneDetectedWebService[];

  objects:
    string[];

  objectUsages:
    SoftOneDetectedObjectUsage[];

  datasetUsages:
    SoftOneDetectedDatasetUsage[];

  fieldUsages:
    SoftOneDetectedFieldUsage[];

  moduleBindings:
    SoftOneDetectedModuleBinding[];

  internalCalls:
    SoftOneDetectedInternalCall[];

  tables:
    string[];

  systemParameters:
    string[];

  semanticValues: Array<{
    registry:
      "SODTYPE" | "SOSOURCE";

    code: string;

    meaning?: string;
  }>;

  warnings:
    string[];
}


const KNOWN_OBJECT_METHODS = [
  "CreateObj",
  "DBLocate",
  "DBPost",
  "DBInsert",
  "DBDelete",
  "SHOWOBJFORM",
  "FindTable",
];


const SQL_KEYWORDS =
  new Set([
    "SELECT",
    "FROM",
    "JOIN",
    "UPDATE",
    "INSERT",
    "INTO",
    "DELETE",
  ]);



interface ResolvedJsValue {
  kind:
    | "STRING"
    | "NUMBER"
    | "TEMPLATE";

  value: string;

  complete: boolean;
}


type ResolvedVariableMap =
  Map<string, ResolvedJsValue>;


function decodeQuotedString(
  source: string,
): string | null {
  const value =
    source.trim();


  if (
    value.length < 2
  ) {
    return null;
  }


  const quote =
    value[0];


  if (
    quote !== '"' &&
    quote !== "'" &&
    quote !== "`"
  ) {
    return null;
  }


  if (
    value[
      value.length - 1
    ] !== quote
  ) {
    return null;
  }


  const inner =
    value.slice(
      1,
      -1,
    );


  try {
    if (
      quote === '"'
    ) {
      return JSON.parse(
        value,
      );
    }


    /*
     * Conservative unescaping for JS single-quoted /
     * template literal strings.
     */
    return inner
      .replace(
        /\\\\/g,
        "\\",
      )
      .replace(
        quote === "'"
          ? /\\'/g
          : /\\`/g,
        quote,
      )
      .replace(
        /\\n/g,
        "\n",
      )
      .replace(
        /\\r/g,
        "\r",
      )
      .replace(
        /\\t/g,
        "\t",
      )
      .replace(
        /\\"/g,
        '"',
      );
  }
  catch {
    return inner;
  }
}


function splitTopLevelPlus(
  expression: string,
): string[] {
  const parts:
    string[] = [];

  let current =
    "";

  let quote:
    string | null =
    null;

  let escaped =
    false;

  let parenDepth =
    0;

  let bracketDepth =
    0;

  let braceDepth =
    0;


  for (
    let i = 0;
    i < expression.length;
    i += 1
  ) {
    const char =
      expression[i];


    if (
      escaped
    ) {
      current +=
        char;

      escaped =
        false;

      continue;
    }


    if (
      quote
    ) {
      current +=
        char;


      if (
        char ===
        "\\"
      ) {
        escaped =
          true;

        continue;
      }


      if (
        char ===
        quote
      ) {
        quote =
          null;
      }


      continue;
    }


    if (
      char === '"' ||
      char === "'" ||
      char === "`"
    ) {
      quote =
        char;

      current +=
        char;

      continue;
    }


    if (
      char === "("
    ) {
      parenDepth +=
        1;
    }
    else if (
      char === ")"
    ) {
      parenDepth -=
        1;
    }
    else if (
      char === "["
    ) {
      bracketDepth +=
        1;
    }
    else if (
      char === "]"
    ) {
      bracketDepth -=
        1;
    }
    else if (
      char === "{"
    ) {
      braceDepth +=
        1;
    }
    else if (
      char === "}"
    ) {
      braceDepth -=
        1;
    }


    if (
      char === "+" &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      parts.push(
        current.trim(),
      );

      current =
        "";

      continue;
    }


    current +=
      char;
  }


  if (
    current.trim()
  ) {
    parts.push(
      current.trim(),
    );
  }


  return parts;
}


function resolveExpression(
  expression: string,
  variables:
    ResolvedVariableMap,
): ResolvedJsValue | null {
  const value =
    expression
      .trim()
      .replace(
        /;\s*$/,
        "",
      );


  /*
   * IMPORTANT:
   * Split concatenation BEFORE trying to interpret the
   * whole expression as one quoted string.
   *
   * Example:
   *
   * "SELECT ..." +
   * "FROM ..." +
   * "WHERE ..."
   */
  const parts =
    splitTopLevelPlus(
      value,
    );


  if (
    parts.length > 1
  ) {
    let output =
      "";

    let complete =
      true;


    for (
      const part
      of parts
    ) {
      const resolved =
        resolveExpression(
          part,
          variables,
        );


      if (
        resolved
      ) {
        output +=
          resolved.value;

        complete =
          complete &&
          resolved.complete;

        continue;
      }


      const symbolic =
        part.trim();


      output +=
        `{{${symbolic}}}`;

      complete =
        false;
    }


    return {
      kind:
        complete
          ? "STRING"
          : "TEMPLATE",

      value:
        output,

      complete,
    };
  }


  const quoted =
    decodeQuotedString(
      value,
    );


  if (
    quoted !==
    null
  ) {
    return {
      kind:
        "STRING",

      value:
        quoted,

      complete:
        true,
    };
  }


  if (
    /^-?\d+(?:\.\d+)?$/.test(
      value,
    )
  ) {
    return {
      kind:
        "NUMBER",

      value,

      complete:
        true,
    };
  }


  if (
    /^[A-Za-z_$][\w$]*$/.test(
      value,
    )
  ) {
    return (
      variables.get(
        value,
      ) ??
      null
    );
  }


  return null;
}

function extractVariableAssignments(
  source: string,
): ResolvedVariableMap {
  const variables:
    ResolvedVariableMap =
      new Map();


  /*
   * Intentionally limited to simple var/let/const assignments.
   * Multi-pass resolution allows a = b; b = "..." patterns
   * without trying to execute JavaScript.
   */
  const assignmentPattern =
    /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);/g;


  const assignments =
    [
      ...source.matchAll(
        assignmentPattern,
      ),
    ]
      .map(
        match => ({
          name:
            match[1] ??
            "",

          expression:
            match[2] ??
            "",
        }),
      )
      .filter(
        item =>
          Boolean(
            item.name,
          ),
      );


  for (
    let pass = 0;
    pass < 5;
    pass += 1
  ) {
    let changed =
      false;


    for (
      const assignment
      of assignments
    ) {
      const resolved =
        resolveExpression(
          assignment.expression,
          variables,
        );


      if (
        !resolved
      ) {
        continue;
      }


      const previous =
        variables.get(
          assignment.name,
        );


      if (
        !previous ||
        previous.value !==
          resolved.value ||
        previous.complete !==
          resolved.complete
      ) {
        variables.set(
          assignment.name,
          resolved,
        );

        changed =
          true;
      }
    }


    if (
      !changed
    ) {
      break;
    }
  }


  return variables;
}


function extractCallFirstArgument(
  source: string,
  functionPattern: RegExp,
): string[] {
  const results:
    string[] = [];


  for (
    const match
    of source.matchAll(
      functionPattern,
    )
  ) {
    const start =
      (
        match.index ??
        0
      ) +
      match[0].length;


    let current =
      "";

    let quote:
      string | null =
      null;

    let escaped =
      false;

    let depth =
      0;


    for (
      let i = start;
      i < source.length;
      i += 1
    ) {
      const char =
        source[i];


      if (
        escaped
      ) {
        current +=
          char;

        escaped =
          false;

        continue;
      }


      if (
        quote
      ) {
        current +=
          char;


        if (
          char ===
          "\\"
        ) {
          escaped =
            true;
        }
        else if (
          char ===
          quote
        ) {
          quote =
            null;
        }


        continue;
      }


      if (
        char === '"' ||
        char === "'" ||
        char === "`"
      ) {
        quote =
          char;

        current +=
          char;

        continue;
      }


      if (
        char === "(" ||
        char === "[" ||
        char === "{"
      ) {
        depth +=
          1;

        current +=
          char;

        continue;
      }


      if (
        char === ")" ||
        char === "]" ||
        char === "}"
      ) {
        if (
          depth > 0
        ) {
          depth -=
            1;

          current +=
            char;

          continue;
        }


        break;
      }


      if (
        char === "," &&
        depth === 0
      ) {
        break;
      }


      current +=
        char;
    }


    if (
      current.trim()
    ) {
      results.push(
        current.trim(),
      );
    }
  }


  return results;
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


function compatibilityForCanonical(
  canonical: string,
): SoftOneDetectedConstructCompatibility {
  const resolved =
    resolveSoftOneConstructCompatibility(
      canonical,
    );


  return {
    authoritative:
      resolved.authoritative,

    supportedSurfaces:
      resolved.compatibility
        .filter(
          item =>
            item.support ===
            "SUPPORTED",
        )
        .map(
          item =>
            item.surface,
        ),

    indirectSurfaces:
      resolved.compatibility
        .filter(
          item =>
            item.support ===
            "INDIRECT",
        )
        .map(
          item =>
            item.surface,
        ),

    unsupportedSurfaces:
      resolved.compatibility
        .filter(
          item =>
            item.support ===
            "NOT_APPLICABLE",
        )
        .map(
          item =>
            item.surface,
        ),

    unverifiedSurfaces:
      resolved.compatibility
        .filter(
          item =>
            item.support ===
            "UNVERIFIED",
        )
        .map(
          item =>
            item.surface,
        ),
  };
}


function addConstruct(
  constructs:
    SoftOneDetectedConstruct[],
  construct:
    SoftOneDetectedConstruct,
): void {
  if (
    constructs.some(
      existing =>
        existing.type ===
          construct.type &&
        existing.value ===
          construct.value,
    )
  ) {
    return;
  }


  constructs.push(
    construct,
  );
}


function extractQuotedSql(
  source: string,
  functionName:
    "GETSQLDATASET" | "SQL",
): string[] {
  const results:
    string[] = [];


  const expression =
    new RegExp(
      `X\\.${functionName}\\s*\\(\\s*([\\s\\S]{0,4000}?)\\)`,
      "gi",
    );


  for (
    const match
    of source.matchAll(
      expression,
    )
  ) {
    const body =
      match[1] ??
      "";


    const pieces =
      [
        ...body.matchAll(
          /(['"`])([\s\S]*?)\1/g,
        ),
      ]
        .map(
          item =>
            item[2] ??
            "",
        )
        .filter(
          text =>
            /\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(
              text,
            ),
        );


    if (
      pieces.length > 0
    ) {
      results.push(
        pieces.join(
          " ",
        ),
      );
    }
  }


  return results;
}


function sqlOperation(
  statement: string,
): SoftOneDetectedSql["operation"] {
  const normalized =
    statement
      .trim()
      .toUpperCase();


  if (
    normalized.startsWith(
      "SELECT",
    )
  ) {
    return "SELECT";
  }


  if (
    normalized.startsWith(
      "INSERT",
    )
  ) {
    return "INSERT";
  }


  if (
    normalized.startsWith(
      "UPDATE",
    )
  ) {
    return "UPDATE";
  }


  if (
    normalized.startsWith(
      "DELETE",
    )
  ) {
    return "DELETE";
  }


  return "OTHER";
}


function extractSqlTables(
  statement: string,
): string[] {
  const tables:
    string[] = [];


  const patterns = [
    /\bFROM\s+([A-Z0-9_]+)/gi,
    /\bJOIN\s+([A-Z0-9_]+)/gi,
    /\bUPDATE\s+([A-Z0-9_]+)/gi,
    /\bINSERT\s+INTO\s+([A-Z0-9_]+)/gi,
    /\bDELETE\s+FROM\s+([A-Z0-9_]+)/gi,
  ];


  for (
    const pattern
    of patterns
  ) {
    for (
      const match
      of statement.matchAll(
        pattern,
      )
    ) {
      const table =
        match[1];


      if (
        !table ||
        SQL_KEYWORDS.has(
          table.toUpperCase(),
        )
      ) {
        continue;
      }


      tables.push(
        table.toUpperCase(),
      );
    }
  }


  return unique(
    tables,
  );
}


function decodeRegistryValue(
  registry:
    "SODTYPE" | "SOSOURCE",
  code: string,
): string | undefined {
  return findSoftOneAppendixByCode(
    registry,
    code,
  )[0]?.label;
}



function splitCallArguments(
  source: string,
  functionPattern: RegExp,
): string[][] {
  const calls:
    string[][] = [];


  for (
    const match
    of source.matchAll(
      functionPattern,
    )
  ) {
    const start =
      (
        match.index ??
        0
      ) +
      match[0].length;


    const args:
      string[] = [];

    let current =
      "";

    let quote:
      string | null =
      null;

    let escaped =
      false;

    let depth =
      0;


    for (
      let i = start;
      i < source.length;
      i += 1
    ) {
      const char =
        source[i];


      if (
        escaped
      ) {
        current +=
          char;

        escaped =
          false;

        continue;
      }


      if (
        quote
      ) {
        current +=
          char;


        if (
          char ===
          "\\"
        ) {
          escaped =
            true;
        }
        else if (
          char ===
          quote
        ) {
          quote =
            null;
        }


        continue;
      }


      if (
        char === '"' ||
        char === "'" ||
        char === "`"
      ) {
        quote =
          char;

        current +=
          char;

        continue;
      }


      if (
        char === "(" ||
        char === "[" ||
        char === "{"
      ) {
        depth +=
          1;

        current +=
          char;

        continue;
      }


      if (
        char === ")"
      ) {
        if (
          depth === 0
        ) {
          if (
            current.trim()
          ) {
            args.push(
              current.trim(),
            );
          }

          break;
        }


        depth -=
          1;

        current +=
          char;

        continue;
      }


      if (
        (
          char === "]" ||
          char === "}"
        ) &&
        depth > 0
      ) {
        depth -=
          1;

        current +=
          char;

        continue;
      }


      if (
        char === "," &&
        depth === 0
      ) {
        args.push(
          current.trim(),
        );

        current =
          "";

        continue;
      }


      current +=
        char;
    }


    calls.push(
      args,
    );
  }


  return calls;
}


function detectSqlParameterSemantics(
  source: string,
  variables:
    ResolvedVariableMap,
): Array<{
  registry:
    "SODTYPE" | "SOSOURCE";

  code: string;

  meaning?: string;
}> {
  const results:
    Array<{
      registry:
        "SODTYPE" | "SOSOURCE";

      code: string;

      meaning?: string;
    }> = [];


  const calls = [
    ...splitCallArguments(
      source,
      /X\.GETSQLDATASET\s*\(/gi,
    ),

    ...splitCallArguments(
      source,
      /X\.SQL\s*\(/gi,
    ),
  ];


  for (
    const args
    of calls
  ) {
    if (
      args.length <
      2
    ) {
      continue;
    }


    const sqlValue =
      resolveExpression(
        args[0],
        variables,
      );


    if (
      !sqlValue
    ) {
      continue;
    }


    for (
      const registry
      of [
        "SODTYPE",
        "SOSOURCE",
      ] as const
    ) {
      const expression =
        new RegExp(
          `\\b${registry}\\b\\s*=\\s*:(\\d+)`,
          "gi",
        );


      for (
        const match
        of sqlValue.value.matchAll(
          expression,
        )
      ) {
        const placeholder =
          Number(
            match[1],
          );


        if (
          !Number.isInteger(
            placeholder,
          ) ||
          placeholder <
            1
        ) {
          continue;
        }


        /*
         * SQL placeholder :1 corresponds to first
         * argument after SQL string, therefore args[1].
         */
        const argumentExpression =
          args[
            placeholder
          ];


        if (
          !argumentExpression
        ) {
          continue;
        }


        const argumentValue =
          resolveExpression(
            argumentExpression,
            variables,
          );


        if (
          !argumentValue ||
          !/^\d+$/.test(
            argumentValue.value,
          )
        ) {
          continue;
        }


        results.push({
          registry,

          code:
            argumentValue.value,

          meaning:
            decodeRegistryValue(
              registry,
              argumentValue.value,
            ),
        });
      }
    }
  }


  return results;
}


function detectSemanticValues(
  source: string,
  registry:
    "SODTYPE" | "SOSOURCE",
): Array<{
  registry:
    "SODTYPE" | "SOSOURCE";

  code: string;

  meaning?: string;
}> {
  const results:
    Array<{
      registry:
        "SODTYPE" | "SOSOURCE";

      code: string;

      meaning?: string;
    }> = [];


  const expression =
    new RegExp(
      `\\b${registry}\\b\\s*(?:=|==|===|:|,|IN\\s*\\()\\s*["']?(\\d+)`,
      "gi",
    );


  for (
    const match
    of source.matchAll(
      expression,
    )
  ) {
    const code =
      match[1];


    if (
      !code
    ) {
      continue;
    }


    results.push({
      registry,

      code,

      meaning:
        decodeRegistryValue(
          registry,
          code,
        ),
    });
  }


  /*
   * Also detect explicit X.STRINGS lookups.
   */
  const stringLookup =
    new RegExp(
      `X\\.STRINGS\\s*\\(\\s*["']${registry}["']\\s*,\\s*["']?(\\d+)`,
      "gi",
    );


  for (
    const match
    of source.matchAll(
      stringLookup,
    )
  ) {
    const code =
      match[1];


    if (
      code
    ) {
      results.push({
        registry,

        code,

        meaning:
          decodeRegistryValue(
            registry,
            code,
          ),
      });
    }
  }


  return [
    ...new Map(
      results.map(
        value => [
          `${value.registry}:${value.code}`,
          value,
        ],
      ),
    ).values(),
  ];
}


function detectHostSurface(
  source: string,
): SoftOneExecutionSurface {
  if (
    /CSTTYPE\s*=\s*16/i.test(
      source,
    )
  ) {
    return "ADVANCED_JAVASCRIPT";
  }


  if (
    /CSTTYPE\s*=\s*18/i.test(
      source,
    )
  ) {
    return "SQL_SCRIPT";
  }


  if (
    /\b(AddCode|JSMain|X\.GETSQLDATASET|X\.WSCALL|X\.WEBREQUEST|X\.CreateObj)\b/i.test(
      source,
    )
  ) {
    return "ADVANCED_JAVASCRIPT";
  }


  if (
    /\bON_(FORMLOAD|LOCATE|POST|AFTERPOST|BEFOREPOST|CREATE)\b/i.test(
      source,
    )
  ) {
    return "FORM_SCRIPT";
  }


  if (
    /\bconnect\s+Xplorer\b/i.test(
      source,
    )
  ) {
    return "SBSL";
  }


  return "ADVANCED_JAVASCRIPT";
}




interface SoftOneScriptScope {
  type:
    | "FUNCTION"
    | "TOP_LEVEL";

  name: string;

  parameters: string[];

  start: number;

  end: number;

  source: string;
}


function findMatchingJsBrace(
  source: string,
  openIndex: number,
): number {
  let depth =
    0;

  let quote:
    string | null =
    null;

  let escaped =
    false;

  let lineComment =
    false;

  let blockComment =
    false;


  for (
    let i = openIndex;
    i < source.length;
    i += 1
  ) {
    const char =
      source[i];

    const next =
      source[i + 1] ??
      "";


    if (
      lineComment
    ) {
      if (
        char === "\n"
      ) {
        lineComment =
          false;
      }

      continue;
    }


    if (
      blockComment
    ) {
      if (
        char === "*" &&
        next === "/"
      ) {
        blockComment =
          false;

        i +=
          1;
      }

      continue;
    }


    if (
      escaped
    ) {
      escaped =
        false;

      continue;
    }


    if (
      quote
    ) {
      if (
        char === "\\"
      ) {
        escaped =
          true;

        continue;
      }


      if (
        char ===
        quote
      ) {
        quote =
          null;
      }

      continue;
    }


    if (
      char === "/" &&
      next === "/"
    ) {
      lineComment =
        true;

      i +=
        1;

      continue;
    }


    if (
      char === "/" &&
      next === "*"
    ) {
      blockComment =
        true;

      i +=
        1;

      continue;
    }


    if (
      char === '"' ||
      char === "'" ||
      char === "`"
    ) {
      quote =
        char;

      continue;
    }


    if (
      char === "{"
    ) {
      depth +=
        1;

      continue;
    }


    if (
      char === "}"
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


  return (
    source.length -
    1
  );
}


function detectScriptScopes(
  source: string,
): SoftOneScriptScope[] {
  const scopes:
    SoftOneScriptScope[] = [];


  const functionPattern =
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;


  for (
    const match
    of source.matchAll(
      functionPattern,
    )
  ) {
    const matchIndex =
      match.index ??
      0;

    const openBrace =
      source.indexOf(
        "{",
        matchIndex,
      );


    if (
      openBrace <
      0
    ) {
      continue;
    }


    const closeBrace =
      findMatchingJsBrace(
        source,
        openBrace,
      );


    scopes.push({
      type:
        "FUNCTION",

      name:
        match[1] ??
        "anonymous",

      parameters:
        (
          match[2] ??
          ""
        )
          .split(
            ",",
          )
          .map(
            value =>
              value.trim(),
          )
          .filter(
            Boolean,
          ),

      start:
        matchIndex,

      end:
        closeBrace,

      source:
        source.slice(
          matchIndex,
          closeBrace + 1,
        ),
    });
  }


  return scopes;
}


function scopeForSourceIndex(
  source: string,
  scopes:
    SoftOneScriptScope[],
  index: number,
): SoftOneScriptScope {
  /*
   * Pick the smallest containing function.
   * This also behaves correctly for nested named functions.
   */
  const containing =
    scopes
      .filter(
        scope =>
          index >=
            scope.start &&
          index <=
            scope.end,
      )
      .sort(
        (
          a,
          b,
        ) =>
          (
            a.end -
            a.start
          ) -
          (
            b.end -
            b.start
          ),
      )[0];


  if (
    containing
  ) {
    return containing;
  }


  return {
    type:
      "TOP_LEVEL",

    name:
      "<top-level>",

    parameters:
      [],

    start:
      0,

    end:
      source.length,

    source,
  };
}


function detectObjectUsages(
  source: string,
): SoftOneDetectedObjectUsage[] {
  const results:
    SoftOneDetectedObjectUsage[] = [];


  const scopes =
    detectScriptScopes(
      source,
    );


  const createPattern =
    /(?:\bvar\s+|\blet\s+|\bconst\s+)?([A-Za-z_$][\w$]*)\s*=\s*X\.(CREATEOBJ|CREATEOBJFORM)\s*\(\s*["']([^"']+)["']/gi;


  for (
    const match
    of source.matchAll(
      createPattern,
    )
  ) {
    const variable =
      match[1];

    const createMethod =
      (
        match[2] ??
        "CREATEOBJ"
      ).toUpperCase();

    const rawObject =
      match[3];


    if (
      !variable ||
      !rawObject
    ) {
      continue;
    }


    const createIndex =
      match.index ??
      0;


    const scope =
      scopeForSourceIndex(
        source,
        scopes,
        createIndex,
      );


    const scopedSource =
      scope.source;


    const object =
      rawObject
        .split(
          /[;\[]/,
        )[0]
        .trim()
        .toUpperCase();


    const escapedVariable =
      variable.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );


    const methodPattern =
      new RegExp(
        `\\b${escapedVariable}\\.(DBLOCATE|DBINSERT|DBPOST|DBDELETE|FINDTABLE|SETPARAM|SHOWOBJFORM|BATCHEXECUTE|COPY|PASTE|PRINTFORM|FREE)\\b`,
        "gi",
      );


    const methods =
      [
        ...scopedSource.matchAll(
          methodPattern,
        ),
      ]
        .map(
          item =>
            (
              item[1] ??
              ""
            ).toUpperCase(),
        );


    const findTablePattern =
      new RegExp(
        `\\b${escapedVariable}\\.FINDTABLE\\s*\\(\\s*["']([^"']+)["']`,
        "gi",
      );


    const tableMatches =
      [
        ...scopedSource.matchAll(
          findTablePattern,
        ),
      ]
        .map(
          item =>
            (
              item[1] ??
              ""
            ).toUpperCase(),
        )
        .filter(
          Boolean,
        );


    const uniqueMethods =
      [
        ...new Set(
          methods,
        ),
      ];


    const hasInsert =
      uniqueMethods.includes(
        "DBINSERT",
      );

    const hasPost =
      uniqueMethods.includes(
        "DBPOST",
      );

    const hasDelete =
      uniqueMethods.includes(
        "DBDELETE",
      );

    const hasLocate =
      uniqueMethods.includes(
        "DBLOCATE",
      );


    let access:
      SoftOneDetectedObjectUsage["access"] =
      "CREATE";


    if (
      hasDelete &&
      (
        hasInsert ||
        hasPost
      )
    ) {
      access =
        "MIXED";
    }
    else if (
      hasDelete
    ) {
      access =
        "DELETE";
    }
    else if (
      hasInsert &&
      hasPost
    ) {
      access =
        "INSERT";
    }
    else if (
      hasLocate &&
      hasPost
    ) {
      access =
        "UPDATE";
    }
    else if (
      hasLocate
    ) {
      access =
        "READ";
    }


    results.push({
      variable,

      object,

      formOrOptions:
        rawObject.toUpperCase() !==
          object
          ? rawObject
          : undefined,

      functionName:

        scope.type === "FUNCTION"
          ? scope.name
          : undefined,

      sourceIndex:

        createIndex,


      methods:
        uniqueMethods,

      tables:
        [
          ...new Set(
            tableMatches,
          ),
        ],

      access,
    });


    /*
     * CREATEOBJFORM is still Object Runtime.
     * Keep createMethod available through methods for diagnostics.
     */
    if (
      createMethod ===
        "CREATEOBJFORM" &&
      !results[
        results.length -
        1
      ].methods.includes(
        "CREATEOBJFORM",
      )
    ) {
      results[
        results.length -
        1
      ].methods.unshift(
        "CREATEOBJFORM",
      );
    }
  }


  return results;
}


function detectDatasetUsages(
  source: string,
): SoftOneDetectedDatasetUsage[] {
  const results:
    SoftOneDetectedDatasetUsage[] = [];


  const scopes =
    detectScriptScopes(
      source,
    );


  /*
   * Dataset lineage starts from:
   *
   * var lines = obj.FINDTABLE('ITELINES');
   */
  const pattern =
    /(?:\bvar\s+|\blet\s+|\bconst\s+)?([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.FINDTABLE\s*\(\s*["']([^"']+)["']\s*\)/gi;


  for (
    const match
    of source.matchAll(
      pattern,
    )
  ) {
    const datasetVariable =
      match[1];

    const objectVariable =
      match[2];

    const table =
      (
        match[3] ??
        ""
      ).toUpperCase();


    if (
      !datasetVariable ||
      !objectVariable ||
      !table
    ) {
      continue;
    }


    const index =
      match.index ??
      0;


    const scope =
      scopeForSourceIndex(
        source,
        scopes,
        index,
      );


    const scopedSource =
      scope.source;


    const escapedDataset =
      datasetVariable.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );


    const escapedObject =
      objectVariable.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );


    /*
     * Resolve the owning SoftOne object within
     * the same lexical scope.
     */
    const objectPattern =
      new RegExp(
        `\\b${escapedObject}\\s*=\\s*X\\.(?:CREATEOBJ|CREATEOBJFORM)\\s*\\(\\s*["']([^"']+)["']`,
        "i",
      );


    const objectMatch =
      scopedSource.match(
        objectPattern,
      );


    const rawObject =
      objectMatch?.[1];


    const object =
      rawObject
        ? rawObject
            .split(
              /[;\[]/,
            )[0]
            .trim()
            .toUpperCase()
        : undefined;


    /*
     * Dataset navigation / mutation methods.
     *
     * SoftOne syntax often allows both:
     *   lines.APPEND;
     *   lines.APPEND();
     */
    const methodPattern =
      new RegExp(
        `\\b${escapedDataset}\\.(APPEND|EDIT|POST|DELETE|FIRST|LAST|NEXT|PRIOR|LOCATE|EMPTYDATASET)\\b`,
        "gi",
      );


    const methods =
      [
        ...scopedSource.matchAll(
          methodPattern,
        ),
      ]
        .map(
          item =>
            (
              item[1] ??
              ""
            ).toUpperCase(),
        );


    /*
     * Dataset field writes:
     *
     * lines.MTRL = 123;
     * lines.QTY1 = ITEM.QTY;
     */
    const fieldPattern =
      new RegExp(
        `\\b${escapedDataset}\\.([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*([^;\\r\\n]+)`,
        "gi",
      );


    const fieldWrites:
      SoftOneDetectedDatasetFieldWrite[] =
      [];


    for (
      const fieldMatch
      of scopedSource.matchAll(
        fieldPattern,
      )
    ) {
      const field =
        (
          fieldMatch[1] ??
          ""
        ).toUpperCase();

      const expression =
        (
          fieldMatch[2] ??
          ""
        ).trim();


      if (
        !field ||
        !expression
      ) {
        continue;
      }


      /*
       * Do not interpret known Dataset properties
       * as business-field writes.
       */
      if (
        [
          "FIRST",
          "LAST",
          "NEXT",
          "PRIOR",
          "APPEND",
          "EDIT",
          "POST",
          "DELETE",
        ].includes(
          field,
        )
      ) {
        continue;
      }


      const resolved =
        resolveExpression(
          expression,
          new Map(),
        );


      fieldWrites.push({
        field,

        expression,

        resolvedValue:
          resolved?.complete
            ? resolved.value
            : undefined,

        sourceIndex:
          scope.start +
          (
            fieldMatch.index ??
            0
          ),

        scopeName:
          scope.name,

        scopeParameters:
          scope.parameters,
      });
    }


    const uniqueMethods =
      [
        ...new Set(
          methods,
        ),
      ];


    const hasAppend =
      uniqueMethods.includes(
        "APPEND",
      );

    const hasEdit =
      uniqueMethods.includes(
        "EDIT",
      );

    const hasPost =
      uniqueMethods.includes(
        "POST",
      );

    const hasDelete =
      uniqueMethods.includes(
        "DELETE",
      );


    let access:
      SoftOneDetectedDatasetUsage["access"] =
      "READ";


    if (
      hasDelete &&
      (
        hasAppend ||
        hasEdit ||
        hasPost
      )
    ) {
      access =
        "MIXED";
    }
    else if (
      hasDelete
    ) {
      access =
        "DELETE";
    }
    else if (
      hasAppend
    ) {
      access =
        "INSERT";
    }
    else if (
      hasEdit ||
      fieldWrites.length >
        0
    ) {
      access =
        "UPDATE";
    }


    const qualified =
      qualifySoftOneConstruct(
        "TABLE",
        table,
      );


    results.push({
      variable:
        datasetVariable,

      table,

      canonical:
        qualified.canonical,

      objectVariable,

      object,

      methods:
        uniqueMethods,

      fieldWrites,

      access,
    });
  }


  return results;
}



function classifyValueOrigin(
  write:
    SoftOneDetectedDatasetFieldWrite,
): SoftOneDetectedValueOrigin {
  const expression =
    write.expression.trim();


  if (
    write.resolvedValue !==
      undefined
  ) {
    return {
      kind:
        "CONSTANT",

      raw:
        expression,

      resolvedValue:
        write.resolvedValue,

      functionName:
        write.scopeName,
    };
  }


  if (
    write.scopeParameters?.includes(
      expression,
    )
  ) {
    return {
      kind:
        "FUNCTION_PARAMETER",

      raw:
        expression,

      symbol:
        expression,

      functionName:
        write.scopeName,

      parameterName:
        expression,
    };
  }


  const sys =
    expression.match(
      /^X\.SYS\.([A-Za-z_$][\w$]*)$/i,
    );


  if (
    sys?.[1]
  ) {
    const name =
      sys[1].toUpperCase();


    return {
      kind:
        "SYSTEM_PARAMETER",

      raw:
        expression,

      symbol:
        `X.SYS.${name}`,

      canonical:
        `X.SYS:${name}`,

      functionName:
        write.scopeName,
    };
  }


  const fieldRef =
    expression.match(
      /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/,
    );


  if (
    fieldRef?.[1] &&
    fieldRef?.[2]
  ) {
    return {
      kind:
        "FIELD_REFERENCE",

      raw:
        expression,

      symbol:
        `${fieldRef[1]}.${fieldRef[2]}`,

      functionName:
        write.scopeName,
    };
  }


  if (
    /^[A-Za-z_$][\w$]*$/.test(
      expression,
    )
  ) {
    return {
      kind:
        "VARIABLE",

      raw:
        expression,

      symbol:
        expression,

      functionName:
        write.scopeName,
    };
  }


  if (
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(/.test(
      expression,
    )
  ) {
    return {
      kind:
        "FUNCTION_CALL",

      raw:
        expression,

      functionName:
        write.scopeName,
    };
  }


  if (
    expression
  ) {
    return {
      kind:
        "EXPRESSION",

      raw:
        expression,

      functionName:
        write.scopeName,
    };
  }


  return {
    kind:
      "UNKNOWN",

    raw:
      expression,

    functionName:
      write.scopeName,
  };
}


function buildFieldUsages(
  datasetUsages:
    SoftOneDetectedDatasetUsage[],
): SoftOneDetectedFieldUsage[] {
  const result:
    SoftOneDetectedFieldUsage[] = [];


  for (
    const dataset
    of datasetUsages
  ) {
    for (
      const write
      of dataset.fieldWrites
    ) {
      const qualified =
        qualifySoftOneConstruct(
          "FIELD",
          `${dataset.table}.${write.field}`,
        );


      const semantic =
        findSoftOneFieldSemantic(
          qualified.canonical,
          dataset.object,
        );


      result.push({
        table:
          dataset.table,

        field:
          write.field,

        canonical:
          qualified.canonical,

        datasetVariable:
          dataset.variable,

        object:
          dataset.object,

        access:
          "WRITE",

        expression:
          write.expression,

        resolvedValue:
          write.resolvedValue,

        meaning:
          semantic?.meaning,

        semanticStatus:
          semantic?.status,

        semanticRole:
          semantic?.semanticRole,

        references:
          semantic?.references,

        semanticEvidence:
          semantic?.evidence,

        valueOrigin:
          classifyValueOrigin(
            write,
          ),
      });
    }
  }


  return result;
}


function detectModuleBindings(
  source: string,
): SoftOneDetectedModuleBinding[] {
  return [
    ...source.matchAll(
      /\bAddCode\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/gi,
    ),
  ]
    .map(
      match => ({
        object:
          (
            match[1] ??
            ""
          ).toUpperCase(),

        module:
          match[2] ??
          "",
      }),
    )
    .filter(
      value =>
        Boolean(
          value.object &&
          value.module,
        ),
    );
}


function detectInternalCalls(
  source: string,
): SoftOneDetectedInternalCall[] {
  const result:
    SoftOneDetectedInternalCall[] = [];


  for (
    const match
    of source.matchAll(
      /X\.EXEC\s*\(\s*["']CODE:([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)["']/gi,
    )
  ) {
    const rawLibrary =
      match[1] ??
      "";

    const fn =
      match[2] ??
      "";


    if (
      !rawLibrary ||
      !fn
    ) {
      continue;
    }


    const normalized =
      rawLibrary.toLowerCase();


    const library:
      SoftOneDetectedInternalCall["library"] =
      normalized ===
        "moduleintf"
        ? "ModuleIntf"
        : normalized ===
            "sysrequest"
          ? "SysRequest"
          : normalized ===
              "pilib"
            ? "PiLib"
            : "OTHER";


    result.push({
      library,

      function:
        fn,

      raw:
        `CODE:${rawLibrary}.${fn}`,
    });
  }


  return result;
}


function detectSetParams(
  source: string,
): Array<{
  target: string;
  parameter: string;
  valueExpression: string;
}> {
  return [
    ...source.matchAll(
      /\b(X|[A-Za-z_$][\w$]*)\.SETPARAM\s*\(\s*["']([^"']+)["']\s*,\s*([^)]+)\)/gi,
    ),
  ]
    .map(
      match => ({
        target:
          match[1] ?? "",

        parameter:
          match[2] ?? "",

        valueExpression:
          (
            match[3] ??
            ""
          ).trim(),
      }),
    )
    .filter(
      item =>
        Boolean(
          item.target &&
          item.parameter,
        ),
    );
}


export function decodeSoftOneScript(
  source: string,
): SoftOneDecodedScript {
  const hostSurface =
    detectHostSurface(
      source,
    );


  const resolvedVariables =
    extractVariableAssignments(
      source,
    );


  const operations:
    SoftOneDetectedOperation[] = [];

  const executionChain:
    SoftOneExecutionSurface[] = [
      hostSurface,
    ];


  const executionEdges:
    SoftOneExecutionEdge[] = [];


  const addExecutionEdge = (
    edge:
      SoftOneExecutionEdge,
  ): void => {
    if (
      executionEdges.some(
        existing =>
          existing.from ===
            edge.from &&
          existing.to ===
            edge.to &&
          existing.via ===
            edge.via &&
          existing.detail ===
            edge.detail,
      )
    ) {
      return;
    }


    executionEdges.push(
      edge,
    );
  };


  const constructs:
    SoftOneDetectedConstruct[] = [];

  const sql:
    SoftOneDetectedSql[] = [];

  const webServices:
    SoftOneDetectedWebService[] = [];

  const warnings:
    string[] = [];


  const objectUsages =
    detectObjectUsages(
      source,
    );


  const datasetUsages =
    detectDatasetUsages(
      source,
    );


  const fieldUsages =
    buildFieldUsages(
      datasetUsages,
    );


  const moduleBindings =
    detectModuleBindings(
      source,
    );


  const internalCalls =
    detectInternalCalls(
      source,
    );


  const setParams =
    detectSetParams(
      source,
    );


  /*
   * X.SYS context.
   */
  const systemParameters =
    unique(
      [
        ...source.matchAll(
          /(?::)?X\.SYS\.([A-Z0-9_]+)/gi,
        ),
      ]
        .map(
          match =>
            (
              match[1] ??
              ""
            ).toUpperCase(),
        )
        .filter(
          Boolean,
        ),
    );


  for (
    const parameter
    of systemParameters
  ) {
    const qualified =
      qualifySoftOneConstruct(
        "X.SYS",
        parameter,
      );


    const resolved =
      resolveSoftOneConstructCompatibility(
        qualified.canonical,
      );


    addConstruct(
      constructs,
      {
        type:
          "SYSTEM_PARAMETER",

        value:
          `X.SYS.${parameter}`,

        canonical:
          qualified.canonical,

        meaning:
          resolved.description,

        compatibility:
          compatibilityForCanonical(
            qualified.canonical,
          ),

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  /*
   * Direct SQL through Advanced JavaScript/Form Script.
   */
  const getSqlStatements = [
    ...extractQuotedSql(
      source,
      "GETSQLDATASET",
    ),

    ...extractCallFirstArgument(
      source,
      /X\.GETSQLDATASET\s*\(/gi,
    )
      .map(
        expression =>
          resolveExpression(
            expression,
            resolvedVariables,
          ),
      )
      .filter(
        (
          value,
        ): value is ResolvedJsValue =>
          Boolean(
            value,
          ),
      )
      .map(
        value =>
          value.value,
      )
      .filter(
        value =>
          /\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(
            value,
          ),
      ),
  ];


  if (
    /X\.GETSQLDATASET\s*\(/i.test(
      source,
    )
  ) {
    operations.push(
      "DIRECT_DATABASE_QUERY",
    );

    executionChain.push(
      "DATABASE_SQL",
    );


    addExecutionEdge({
      from:
        hostSurface,

      to:
        "DATABASE_SQL",

      via:
        "X.GETSQLDATASET",
    });


    addConstruct(
      constructs,
      {
        type:
          "FUNCTION",

        value:
          "X.GETSQLDATASET",

        meaning:
          "Executes SQL directly from SoftOne script runtime and returns a Dataset.",

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  for (
    const statement
    of getSqlStatements
  ) {
    sql.push({
      source:
        "GETSQLDATASET",

      statement,

      tables:
        extractSqlTables(
          statement,
        ),

      operation:
        sqlOperation(
          statement,
        ),

      parameterized:
        /:\d+|:X\.SYS\./i.test(
          statement,
        ),
    });
  }


  const xSqlStatements = [
    ...extractQuotedSql(
      source,
      "SQL",
    ),

    ...extractCallFirstArgument(
      source,
      /X\.SQL\s*\(/gi,
    )
      .map(
        expression =>
          resolveExpression(
            expression,
            resolvedVariables,
          ),
      )
      .filter(
        (
          value,
        ): value is ResolvedJsValue =>
          Boolean(
            value,
          ),
      )
      .map(
        value =>
          value.value,
      )
      .filter(
        value =>
          /\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(
            value,
          ),
      ),
  ];


  if (
    /X\.SQL\s*\(/i.test(
      source,
    )
  ) {
    operations.push(
      "DIRECT_DATABASE_QUERY",
    );

    executionChain.push(
      "DATABASE_SQL",
    );


    addExecutionEdge({
      from:
        hostSurface,

      to:
        "DATABASE_SQL",

      via:
        "X.SQL",
    });


    addConstruct(
      constructs,
      {
        type:
          "FUNCTION",

        value:
          "X.SQL",

        meaning:
          "Executes direct SQL from SoftOne script runtime and returns a single-row result.",

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  for (
    const statement
    of xSqlStatements
  ) {
    sql.push({
      source:
        "X.SQL",

      statement,

      tables:
        extractSqlTables(
          statement,
        ),

      operation:
        sqlOperation(
          statement,
        ),

      parameterized:
        /:\d+|:X\.SYS\./i.test(
          statement,
        ),
    });
  }


  /*
   * Web Services.
   */
  if (
    /X\.WEBREQUEST\s*\(/i.test(
      source,
    )
  ) {
    operations.push(
      "BUILTIN_WEB_SERVICE_CALL",
    );

    executionChain.push(
      "SOFTONE_WEB_SERVICE_RUNTIME",
    );


    addExecutionEdge({
      from:
        hostSurface,

      to:
        "SOFTONE_WEB_SERVICE_RUNTIME",

      via:
        "X.WEBREQUEST",
    });


    addConstruct(
      constructs,
      {
        type:
          "FUNCTION",

        value:
          "X.WEBREQUEST",

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  if (
    /X\.WSCALL\s*\(/i.test(
      source,
    )
  ) {
    operations.push(
      "CUSTOM_WEB_SERVICE_CALL",
    );

    executionChain.push(
      "SOFTONE_WEB_SERVICE_RUNTIME",
      "CUSTOM_WEB_SERVICE",
    );


    addExecutionEdge({
      from:
        hostSurface,

      to:
        "SOFTONE_WEB_SERVICE_RUNTIME",

      via:
        "X.WSCALL",
    });


    addExecutionEdge({
      from:
        "SOFTONE_WEB_SERVICE_RUNTIME",

      to:
        "CUSTOM_WEB_SERVICE",

      via:
        "custom /s1services/JS endpoint",
    });


    addConstruct(
      constructs,
      {
        type:
          "FUNCTION",

        value:
          "X.WSCALL",

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  const serviceAssignments =
    [
      ...source.matchAll(
        /\b(?:ws|req|request|obj)\.SERVICE\s*=\s*["']([^"']+)["']/gi,
      ),
    ];


  for (
    const match
    of serviceAssignments
  ) {
    const service =
      match[1];


    if (
      !service
    ) {
      continue;
    }


    const sqlNameMatch =
      source.match(
        /\b(?:ws|req|request|obj)\.SQLNAME\s*=\s*["']([^"']+)["']/i,
      );


    const objectMatch =
      source.match(
        /\b(?:ws|req|request|obj)\.OBJECT\s*=\s*["']([^"']+)["']/i,
      );


    webServices.push({
      mechanism:
        /X\.WEBREQUEST/i.test(
          source,
        )
          ? "X.WEBREQUEST"
          : "DIRECT_REFERENCE",

      service,

      sqlName:
        sqlNameMatch?.[1],

      object:
        objectMatch?.[1],
    });


    const qualifiedService =
      qualifySoftOneConstruct(
        "WEB_SERVICE",
        service,
      );


    addConstruct(
      constructs,
      {
        type:
          "WEB_SERVICE",

        value:
          service,

        canonical:
          qualifiedService.canonical,

        evidence:
          "DETERMINISTIC",
      },
    );


    if (
      service.toLowerCase() ===
      "sqldata"
    ) {
      executionChain.push(
        "SQL_SCRIPT",
        "DATABASE_SQL",
      );


      const sqlName =
        sqlNameMatch?.[1];


      addExecutionEdge({
        from:
          "SOFTONE_WEB_SERVICE_RUNTIME",

        to:
          "SQL_SCRIPT",

        via:
          "SqlData",

        detail:
          sqlName
            ? `SqlName=${sqlName}`
            : undefined,
      });


      addExecutionEdge({
        from:
          "SQL_SCRIPT",

        to:
          "DATABASE_SQL",

        via:
          "configured SQL statement",
      });


      if (
        sqlName
      ) {
        const qualifiedSqlScript =
          qualifySoftOneConstruct(
            "SQL_SCRIPT",
            sqlName,
          );


        addConstruct(
          constructs,
          {
            type:
              "SQL_SCRIPT",

            value:
              sqlName,

            canonical:
              qualifiedSqlScript.canonical,

            evidence:
              "DETERMINISTIC",
          },
        );
      }
    }
  }


  const customUris =
    [
      ...source.matchAll(
        /["'](\/s1services\/JS\/[^"']+)["']/gi,
      ),
    ];


  for (
    const match
    of customUris
  ) {
    const uri =
      match[1];


    if (
      !uri
    ) {
      continue;
    }


    webServices.push({
      mechanism:
        "X.WSCALL",

      customUri:
        uri,
    });


    const qualifiedCustomWs =
      qualifySoftOneConstruct(
        "CUSTOM_WEB_SERVICE",
        uri,
      );


    addConstruct(
      constructs,
      {
        type:
          "CUSTOM_WEB_SERVICE",

        value:
          uri,

        canonical:
          qualifiedCustomWs.canonical,

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  /*
   * Generic external HTTP calls.
   */
  if (
    /X\.HTTPCALL\s*\(/i.test(
      source,
    )
  ) {
    operations.push(
      "HTTP_API_CALL",
    );


    addConstruct(
      constructs,
      {
        type:
          "FUNCTION",

        value:
          "X.HTTPCALL",

        meaning:
          "Makes an HTTP request to a web service/API/site.",

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  /*
   * Deterministic SoftOne Object Layer analysis.
   */
  for (
    const usage
    of objectUsages
  ) {
    operations.push(
      "OBJECT_CREATE",
    );


    if (
      usage.access ===
        "READ"
    ) {
      operations.push(
        "OBJECT_READ",
      );
    }


    if (
      usage.access ===
        "INSERT"
    ) {
      operations.push(
        "OBJECT_INSERT",
        "OBJECT_WRITE",
      );
    }


    if (
      usage.access ===
        "UPDATE"
    ) {
      operations.push(
        "OBJECT_UPDATE",
        "OBJECT_WRITE",
      );
    }


    if (
      usage.access ===
        "DELETE"
    ) {
      operations.push(
        "OBJECT_DELETE",
        "OBJECT_WRITE",
      );
    }


    executionChain.push(
      "OBJECT_RUNTIME",
    );


    addExecutionEdge({
      from:
        hostSurface,

      to:
        "OBJECT_RUNTIME",

      via:
        `X.CreateObj:${usage.object}`,
    });


    const qualifiedObject =
      qualifySoftOneConstruct(
        "OBJECT",
        usage.object,
      );


    addConstruct(
      constructs,
      {
        type:
          "OBJECT",

        value:
          usage.object,

        canonical:
          qualifiedObject.canonical,

        evidence:
          "DETERMINISTIC",
      },
    );


    for (
      const table
      of usage.tables
    ) {
      const qualifiedTable =
        qualifySoftOneConstruct(
          "TABLE",
          table,
        );


      addConstruct(
        constructs,
        {
          type:
            "TABLE",

          value:
            table,

          canonical:
            qualifiedTable.canonical,

          evidence:
            "DETERMINISTIC",
        },
      );
    }
  }


  for (
    const dataset
    of datasetUsages
  ) {
    if (
      dataset.access ===
        "READ"
    ) {
      operations.push(
        "DATASET_READ",
      );
    }
    else {
      operations.push(
        "DATASET_WRITE",
      );
    }
  }


  for (
    const binding
    of moduleBindings
  ) {
    operations.push(
      "MODULE_BINDING",
    );


    const qualifiedObject =
      qualifySoftOneConstruct(
        "OBJECT",
        binding.object,
      );


    addConstruct(
      constructs,
      {
        type:
          "OBJECT",

        value:
          binding.object,

        canonical:
          qualifiedObject.canonical,

        meaning:
          `Advanced JavaScript module binding: ${binding.module}`,

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  for (
    const call
    of internalCalls
  ) {
    operations.push(
      "INTERNAL_LIBRARY_CALL",
    );


    addConstruct(
      constructs,
      {
        type:
          "FUNCTION",

        value:
          call.raw,

        meaning:
          `SoftOne internal library call ${call.library}.${call.function}`,

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  if (
    setParams.length >
    0
  ) {
    operations.push(
      "OBJECT_PARAMETER_SET",
    );
  }


  /*
   * SoftOne Object Layer.
   */
  const objectMatches =
    [
      ...source.matchAll(
        /X\.CreateObj\s*\(\s*["']([^"']+)["']/gi,
      ),
    ]
      .map(
        match =>
          match[1],
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      )
      .map(
        value =>
          value.toUpperCase(),
      );


  const addCodeObjects =
    [
      ...source.matchAll(
        /\bAddCode\s*\(\s*["']([^"']+)["']/gi,
      ),
    ]
      .map(
        match =>
          match[1],
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      )
      .map(
        value =>
          value.toUpperCase(),
      );


  const objects =
    unique([
      ...objectMatches,
      ...addCodeObjects,
    ]);


  for (
    const object
    of objects
  ) {
    addConstruct(
      constructs,
      {
        type:
          "OBJECT",

        value:
          object,

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  if (
    objectMatches.length >
    0
  ) {
    operations.push(
      "OBJECT_READ",
    );

    executionChain.push(
      "OBJECT_RUNTIME",
    );


    addExecutionEdge({
      from:
        hostSurface,

      to:
        "OBJECT_RUNTIME",

      via:
        "X.CreateObj",
    });
  }


  if (
    /\.(DBPost|DBInsert|DBDelete|Post|Delete)\b/i.test(
      source,
    )
  ) {
    operations.push(
      "OBJECT_WRITE",
    );

    executionChain.push(
      "OBJECT_RUNTIME",
    );
  }


  for (
    const method
    of KNOWN_OBJECT_METHODS
  ) {
    if (
      new RegExp(
        `\\b${method}\\b`,
        "i",
      ).test(
        source,
      )
    ) {
      addConstruct(
        constructs,
        {
          type:
            "FUNCTION",

          value:
            method,

          evidence:
            "DETERMINISTIC",
        },
      );
    }
  }


  /*
   * X.STRINGS.
   */
  if (
    /X\.STRINGS\s*\(/i.test(
      source,
    )
  ) {
    operations.push(
      "STRING_LIST_LOOKUP",
    );


    addConstruct(
      constructs,
      {
        type:
          "FUNCTION",

        value:
          "X.STRINGS",

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  /*
   * X.EXEC / XCMD / ACMD.
   */
  if (
    /X\.EXEC\s*\(|\bXCMD:|\bACMD:/i.test(
      source,
    )
  ) {
    operations.push(
      "COMMAND_EXECUTION",
    );


    const execArguments =
      extractCallFirstArgument(
        source,
        /X\.EXEC\s*\(/gi,
      );


    for (
      const expression
      of execArguments
    ) {
      const resolved =
        resolveExpression(
          expression,
          resolvedVariables,
        );


      if (
        resolved &&
        /^(XCMD|ACMD):/i.test(
          resolved.value,
        )
      ) {
        addConstruct(
          constructs,
          {
            type:
              "COMMAND",

            value:
              resolved.value,

            evidence:
              "DETERMINISTIC",
          },
        );
      }
    }


  }


  /*
   * Semantic registries.
   */
  const semanticValues = [
    ...detectSemanticValues(
      source,
      "SODTYPE",
    ),

    ...detectSemanticValues(
      source,
      "SOSOURCE",
    ),

    ...detectSqlParameterSemantics(
      source,
      resolvedVariables,
    ),
  ]
    .filter(
      (
        value,
        index,
        all,
      ) =>
        all.findIndex(
          candidate =>
            candidate.registry ===
              value.registry &&
            candidate.code ===
              value.code,
        ) ===
        index,
    );


  for (
    const semantic
    of semanticValues
  ) {
    const qualified =
      qualifySoftOneConstruct(
        semantic.registry,
        semantic.code,
      );


    addConstruct(
      constructs,
      {
        type:
          semantic.registry,

        value:
          `${semantic.registry}=${semantic.code}`,

        canonical:
          qualified.canonical,

        meaning:
          semantic.meaning,

        compatibility:
          compatibilityForCanonical(
            qualified.canonical,
          ),

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  /*
   * Tables inferred only from actual SQL statements.
   */
  const tables =
    unique(
      sql.flatMap(
        item =>
          item.tables,
      ),
    );


  for (
    const usage
    of objectUsages
  ) {
    for (
      const table
      of usage.tables
    ) {
      if (
        !tables.includes(
          table,
        )
      ) {
        tables.push(
          table,
        );
      }
    }
  }



  for (
    const dataset
    of datasetUsages
  ) {
    if (
      !tables.includes(
        dataset.table,
      )
    ) {
      tables.push(
        dataset.table,
      );
    }
  }


  for (
    const field
    of fieldUsages
  ) {
    addConstruct(
      constructs,
      {
        type:
          "FIELD",

        value:
          `${field.table}.${field.field}`,

        canonical:
          field.canonical,

        meaning:
          field.meaning,

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  for (
    const table
    of tables
  ) {
    const qualified =
      qualifySoftOneConstruct(
        "TABLE",
        table,
      );


    addConstruct(
      constructs,
      {
        type:
          "TABLE",

        value:
          table,

        canonical:
          qualified.canonical,

        evidence:
          "DETERMINISTIC",
      },
    );
  }


  /*
   * Safety / interpretation warnings.
   */
  if (
    sql.some(
      query =>
        [
          "INSERT",
          "UPDATE",
          "DELETE",
        ].includes(
          query.operation,
        ),
    )
  ) {
    warnings.push(
      "Direct SQL write detected. Do not assume SoftOne object/business rules are executed.",
    );
  }


  if (
    hostSurface ===
      "ADVANCED_JAVASCRIPT" &&
    operations.includes(
      "DIRECT_DATABASE_QUERY",
    )
  ) {
    warnings.push(
      "Advanced JavaScript performs direct database access; distinguish this from SoftOne Object Layer operations.",
    );
  }


  if (
    operations.includes(
      "OBJECT_WRITE",
    )
  ) {
    warnings.push(
      "SoftOne Object Layer write detected; application business logic may execute.",
    );
  }


  return {
    hostSurface,

    operations:
      unique(
        operations,
      ),

    executionChain:
      unique(
        executionChain,
      ),

    executionEdges,

    constructs,

    sql,

    webServices,

    objects,

    objectUsages,

    datasetUsages,

    fieldUsages,

    moduleBindings,

    internalCalls,

    tables,

    systemParameters,

    semanticValues,

    warnings,
  };
}
