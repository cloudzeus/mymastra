export type SoftOneClaimScope =
  | "GLOBAL"
  | "TENANT"
  | "RECIPE"
  | "UNKNOWN";

export type SoftOneDecomposedClaimType =
  | "TECHNICAL_PATTERN"
  | "FUNCTION_USAGE"
  | "OBJECT_USAGE"
  | "TENANT_LITERAL"
  | "RECIPE_CONDITION"
  | "SYSTEM_CONTEXT"
  | "CUSTOM_FIELD"
  | "UNKNOWN";

export interface SoftOneDecomposedClaim {
  id: string;

  type:
    SoftOneDecomposedClaimType;

  scope:
    SoftOneClaimScope;

  concept:
    string;

  statement:
    string;

  evidenceStatus:
    "DERIVED" | "HYPOTHESIS";

  sourceFragment:
    string;

  key?: string;

  value?:
    | string
    | number;

  promotableToGlobal:
    boolean;

  requiresReview:
    boolean;

  reasons:
    string[];

  tags:
    string[];
}

export interface SoftOneClaimDecompositionResult {
  inputType:
    "SQL"
    | "SOFTONE_JS"
    | "TEXT"
    | "MIXED";

  claims:
    SoftOneDecomposedClaim[];

  tenantLiterals:
    SoftOneDecomposedClaim[];

  technicalPatterns:
    SoftOneDecomposedClaim[];

  unknown:
    SoftOneDecomposedClaim[];

  safety: {
    containsTenantSpecificValues:
      boolean;

    containsCustomFields:
      boolean;

    containsUnknownSemantics:
      boolean;

    safeForAutomaticGlobalPromotion:
      false;
  };
}

const TENANT_NUMERIC_KEYS =
  new Set([
    "COMPANY",
    "WHOUSE",
    "SERIES",
    "FPRMS",
    "TFPRMS",
    "PAYMENT",
    "RESTCATEG",
    "RESTMODE",
    "SOSOURCE",
    "TRDCATEGORY",
    "MTRCATEGORY",
    "MTRGROUP",
    "MTRMARK",
    "MTRMANFCTR",
  ]);

const SYSTEM_CONTEXT_PATTERNS = [
  /:X\.SYS\.COMPANY\b/gi,
  /:X\.SYS\.[A-Z0-9_]+\b/gi,

  /*
   * Observed SoftOne/runtime parameter namespaces,
   * e.g. :CCCQFILTERS.COMPANY.
   *
   * This records token usage only. It does not
   * establish official semantics of the namespace.
   */
  /(?<![A-Z0-9_]):[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\b/gi,
];

const FUNCTION_PATTERNS = [
  /\bX\.GETSQLDATASET\s*\(/gi,
  /\bX\.RUNSQL\s*\(/gi,
  /\bX\.CREATEOBJ\s*\(/gi,
  /\bX\.CREATEOBJFORM\s*\(/gi,
  /\bX\.HTTPCALL\s*\(/gi,
  /\bX\.EXCEPTION\s*\(/gi,
  /\bX\.WARNING\s*\(/gi,
  /\bX\.EXEC\s*\(/gi,
  /\bX\.FormatText\s*\(/gi,

  /\b[A-Za-z_$][A-Za-z0-9_$]*\.DBLocate\s*\(/gi,
  /\b[A-Za-z_$][A-Za-z0-9_$]*\.FindTable\s*\(/gi,
  /\b[A-Za-z_$][A-Za-z0-9_$]*\.SHOWOBJFORM\b/gi,
  /\b[A-Za-z_$][A-Za-z0-9_$]*\.FREE\b/gi,
  /\b[A-Za-z_$][A-Za-z0-9_$]*\.DBPost\b/gi,
  /\b[A-Za-z_$][A-Za-z0-9_$]*\.Edit\b/gi,
  /\b[A-Za-z_$][A-Za-z0-9_$]*\.Next\b/gi,

  /\bdbo\.fnSOGetLinePend\s*\(/gi,
];

const OBJECT_USAGE_PATTERNS = [
  /\bX\.CREATEOBJ\s*\(\s*['"]([A-Z0-9_]+)['"]\s*\)/gi,
];

const CUSTOM_FIELD_PATTERN =
  /\b(?:CCC|ccc)[A-Za-z0-9_]+\b/g;

function normalizeWhitespace(
  value: string,
): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function stripSourceComments(
  input: string,
): string {
  let output = "";
  let i = 0;

  let quote:
    "'" | '"' | "`" | null =
    null;

  let lineComment =
    false;

  let blockComment =
    false;

  while (i < input.length) {
    const char =
      input[i];

    const next =
      input[i + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        output += "\n";
      } else {
        output += " ";
      }

      i++;
      continue;
    }

    if (blockComment) {
      if (
        char === "*" &&
        next === "/"
      ) {
        blockComment = false;
        output += "  ";
        i += 2;
        continue;
      }

      output +=
        char === "\n"
          ? "\n"
          : " ";

      i++;
      continue;
    }

    if (quote) {
      output += char;

      if (
        char === "\\" &&
        i + 1 < input.length
      ) {
        output +=
          input[i + 1];

        i += 2;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      i++;
      continue;
    }

    if (
      char === "'" ||
      char === '"' ||
      char === "`"
    ) {
      quote = char;
      output += char;
      i++;
      continue;
    }

    if (
      char === "/" &&
      next === "/"
    ) {
      lineComment = true;
      output += "  ";
      i += 2;
      continue;
    }

    if (
      char === "/" &&
      next === "*"
    ) {
      blockComment = true;
      output += "  ";
      i += 2;
      continue;
    }

    output += char;
    i++;
  }

  return output;
}

function detectInputType(
  input: string,
):
  SoftOneClaimDecompositionResult["inputType"] {
  const hasSql =
    /\bSELECT\b|\bFROM\b|\bWHERE\b|\bJOIN\b|\bUPDATE\b|\bINSERT\b/i
      .test(input);

  const hasJs =
    /\bX\.[A-Za-z0-9_]+\s*\(|\bDBLocate\s*\(|\bDBPost\b|\bCREATEOBJ\b/i
      .test(input);

  if (
    hasSql &&
    hasJs
  ) {
    return "MIXED";
  }

  if (hasSql) {
    return "SQL";
  }

  if (hasJs) {
    return "SOFTONE_JS";
  }

  return "TEXT";
}

function makeId(
  prefix: string,
  index: number,
): string {
  return `${prefix}_${String(index + 1).padStart(3, "0")}`;
}

function extractTenantNumericLiterals(
  input: string,
): SoftOneDecomposedClaim[] {
  const claims:
    SoftOneDecomposedClaim[] = [];

  let counter = 0;

  const addClaim = (
    key: string,
    fragment: string,
    values: string[],
  ) => {
    const normalizedKey =
      key.toUpperCase();

    if (
      !TENANT_NUMERIC_KEYS.has(
        normalizedKey,
      )
    ) {
      return;
    }

    if (
      values.length === 0
    ) {
      return;
    }

    claims.push({
      id:
        makeId(
          "TENANT_LITERAL",
          counter++,
        ),

      type:
        "TENANT_LITERAL",

      scope:
        "TENANT",

      concept:
        normalizedKey,

      statement:
        `${normalizedKey} uses tenant-specific numeric value(s): ${values.join(", ")}.`,

      evidenceStatus:
        "DERIVED",

      sourceFragment:
        normalizeWhitespace(
          fragment,
        ),

      key:
        normalizedKey,

      value:
        values.length === 1
          ? Number(values[0])
          : values.join(","),

      promotableToGlobal:
        false,

      requiresReview:
        false,

      reasons: [
        `${normalizedKey} is treated as tenant/configuration-sensitive.`,
        "Numeric identifier meaning must not be generalized across SoftOne installations.",
      ],

      tags: [
        "tenant-literal",
        normalizedKey.toLowerCase(),
      ],
    });
  };

  /*
   * Scalar numeric comparisons:
   *
   * COMPANY = 1004
   * SERIES <> 790
   * FPRMS != 7090
   *
   * RHS MUST begin with a real numeric literal.
   * Therefore:
   *
   * COMPANY = :CCCQFILTERS.COMPANY
   *
   * cannot accidentally match.
   */
  const scalarRegex =
    /\b(?:[A-Z0-9_]+\.)?([A-Z][A-Z0-9_]*)\s*(=|<>|!=)\s*(\d+)\b/gi;

  for (
    const match of
      input.matchAll(
        scalarRegex,
      )
  ) {
    addClaim(
      match[1],
      match[0],
      [match[3]],
    );
  }

  /*
   * Numeric IN lists:
   *
   * FPRMS IN (7061,7062,7069)
   */
  const inRegex =
    /\b(?:[A-Z0-9_]+\.)?([A-Z][A-Z0-9_]*)\s+IN\s*\(\s*(\d+(?:\s*,\s*\d+)*)\s*\)/gi;

  for (
    const match of
      input.matchAll(
        inRegex,
      )
  ) {
    const values =
      match[2]
        .split(",")
        .map(value =>
          value.trim(),
        )
        .filter(Boolean);

    addClaim(
      match[1],
      match[0],
      values,
    );
  }

  return claims;
}

function extractSystemContext(
  input: string,
): SoftOneDecomposedClaim[] {
  const claims:
    SoftOneDecomposedClaim[] = [];

  let counter = 0;

  for (
    const pattern of
      SYSTEM_CONTEXT_PATTERNS
  ) {
    for (
      const match of
        input.matchAll(pattern)
    ) {
      const fragment =
        match[0];

      claims.push({
        id:
          makeId(
            "SYSTEM_CONTEXT",
            counter++,
          ),

        type:
          "SYSTEM_CONTEXT",

        scope:
          "GLOBAL",

        concept:
          fragment,

        statement:
          `Observed SoftOne system-context token usage: ${fragment}.`,

        evidenceStatus:
          "DERIVED",

        sourceFragment:
          fragment,

        promotableToGlobal:
          false,

        requiresReview:
          false,

        reasons: [
          "The token usage is observed in source code.",
          "Observed usage does not by itself establish complete official semantics.",
        ],

        tags: [
          "system-context",
          fragment.toLowerCase(),
        ],
      });
    }
  }

  return claims;
}

function extractFunctionUsage(
  input: string,
): SoftOneDecomposedClaim[] {
  const claims:
    SoftOneDecomposedClaim[] = [];

  let counter = 0;

  for (
    const pattern of
      FUNCTION_PATTERNS
  ) {
    for (
      const match of
        input.matchAll(pattern)
    ) {
      const raw =
        match[0];

      const observedName =
        raw
          .replace(
            /\s*\($/,
            "",
          )
          .replace(
            /\(\s*\)$/,
            "",
          )
          .trim();

      const functionName =
        observedName.startsWith("X.") ||
        observedName.startsWith("dbo.")
          ? observedName
          : observedName.includes(".")
            ? observedName
                .split(".")
                .pop()!
            : observedName;

      claims.push({
        id:
          makeId(
            "FUNCTION_USAGE",
            counter++,
          ),

        type:
          "FUNCTION_USAGE",

        scope:
          "GLOBAL",

        concept:
          functionName,

        statement:
          `Observed working-source usage of ${functionName}.`,

        evidenceStatus:
          "DERIVED",

        sourceFragment:
          raw,

        promotableToGlobal:
          false,

        requiresReview:
          false,

        reasons: [
          "Function invocation is directly observable in the source.",
          "Invocation proves observed usage only, not full documented semantics.",
        ],

        tags: [
          "function",
          functionName
            .toLowerCase(),
        ],
      });
    }
  }

  return claims;
}

function extractObjectUsage(
  input: string,
): SoftOneDecomposedClaim[] {
  const claims:
    SoftOneDecomposedClaim[] = [];

  let counter = 0;

  for (
    const pattern of
      OBJECT_USAGE_PATTERNS
  ) {
    for (
      const match of
        input.matchAll(pattern)
    ) {
      const object =
        match[1]
          .toUpperCase();

      claims.push({
        id:
          makeId(
            "OBJECT_USAGE",
            counter++,
          ),

        type:
          "OBJECT_USAGE",

        scope:
          "GLOBAL",

        concept:
          object,

        statement:
          `Observed X.CREATEOBJ usage with object argument ${object}.`,

        evidenceStatus:
          "DERIVED",

        sourceFragment:
          match[0],

        key:
          "OBJECT",

        value:
          object,

        promotableToGlobal:
          false,

        requiresReview:
          false,

        reasons: [
          `${object} is directly present as the CREATEOBJ argument.`,
          "This proves observed compatibility in this implementation only.",
        ],

        tags: [
          "createobj",
          "object-usage",
          object.toLowerCase(),
        ],
      });
    }
  }

  return claims;
}

function extractCustomFields(
  input: string,
): SoftOneDecomposedClaim[] {
  const matches =
    [
      ...input.matchAll(
        CUSTOM_FIELD_PATTERN,
      ),
    ].filter(match => {
      const start =
        match.index ?? 0;

      const end =
        start +
        match[0].length;

      const before =
        input[start - 1] ?? "";

      const after =
        input[end] ?? "";

      /*
       * :CCCQFILTERS.COMPANY is a runtime/filter
       * namespace observation, not evidence that
       * CCCQFILTERS is a tenant custom field.
       */
      if (
        before === ":" ||
        after === "."
      ) {
        return false;
      }

      return true;
    });

  const unique =
    [
      ...new Set(
        matches.map(
          match =>
            match[0],
        ),
      ),
    ];

  return unique.map(
    (
      field,
      index,
    ) => ({
      id:
        makeId(
          "CUSTOM_FIELD",
          index,
        ),

      type:
        "CUSTOM_FIELD",

      scope:
        "TENANT",

      concept:
        field,

      statement:
        `Custom SoftOne identifier observed: ${field}.`,

      evidenceStatus:
        "DERIVED",

      sourceFragment:
        field,

      key:
        field,

      promotableToGlobal:
        false,

      requiresReview:
        false,

      reasons: [
        "CCC-prefixed identifiers are treated as customization/tenant-specific by default.",
        "Their semantics must not be generalized without explicit evidence.",
      ],

      tags: [
        "custom-field",
        "tenant",
      ],
    }),
  );
}

function extractRecipeConditions(
  input: string,
): SoftOneDecomposedClaim[] {
  const claims:
    SoftOneDecomposedClaim[] = [];

  /*
   * Dates and business filters are recipe-specific
   * even when they are not numeric IDs.
   */
  const patterns = [
    /\bTRNDATE\s+BETWEEN\s+[^\n;]+/gi,
    /\bTRNDATE\s*(?:>=|>|<=|<|=)\s*[^\s;]+/gi,

    /\bFISCPRD\s*(?:=|<>|!=|>=|<=|>|<)\s*\d+\b/gi,
    /\bPERIOD\s*(?:=|<>|!=|>=|<=|>|<)\s*\d+\b/gi,

    /\bISACTIVE\s*=\s*[01]\b/gi,
    /\bISCANCEL\s*=\s*[01]\b/gi,
    /\bPENDING\s*=\s*[01]\b/gi,
    /\bFULLYTRANSF\s+IN\s*\([^)]+\)/gi,
  ];

  let counter = 0;

  for (
    const pattern of patterns
  ) {
    for (
      const match of
        input.matchAll(pattern)
    ) {
      claims.push({
        id:
          makeId(
            "RECIPE_CONDITION",
            counter++,
          ),

        type:
          "RECIPE_CONDITION",

        scope:
          "RECIPE",

        concept:
          "business filter",

        statement:
          `Observed recipe condition: ${normalizeWhitespace(match[0])}`,

        evidenceStatus:
          "DERIVED",

        sourceFragment:
          normalizeWhitespace(
            match[0],
          ),

        promotableToGlobal:
          false,

        requiresReview:
          false,

        reasons: [
          "The condition is part of a working query/script recipe.",
          "Its business meaning must not be generalized automatically.",
        ],

        tags: [
          "recipe",
          "condition",
        ],
      });
    }
  }

  return claims;
}

function dedupeClaims(
  claims:
    SoftOneDecomposedClaim[],
):
  SoftOneDecomposedClaim[] {
  const seen =
    new Set<string>();

  return claims.filter(
    claim => {
      const key =
        [
          claim.type,
          claim.scope,
          claim.concept,
          claim.sourceFragment,
        ]
          .join("|")
          .toLowerCase();

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}

export function decomposeSoftOneTechnicalSource(
  input: string,
): SoftOneClaimDecompositionResult {
  const originalSource =
    input.trim();

  const source =
    stripSourceComments(
      originalSource,
    );

  if (!source) {
    throw new Error(
      "Technical source input is required.",
    );
  }

  const claims =
    dedupeClaims([
      ...extractTenantNumericLiterals(
        source,
      ),

      ...extractSystemContext(
        source,
      ),

      ...extractFunctionUsage(
        source,
      ),

      ...extractObjectUsage(
        source,
      ),

      ...extractCustomFields(
        source,
      ),

      ...extractRecipeConditions(
        source,
      ),
    ]);

  const tenantLiterals =
    claims.filter(
      claim =>
        claim.type ===
          "TENANT_LITERAL" ||
        claim.type ===
          "CUSTOM_FIELD",
    );

  const technicalPatterns =
    claims.filter(
      claim =>
        claim.type ===
          "FUNCTION_USAGE" ||
        claim.type ===
          "OBJECT_USAGE" ||
        claim.type ===
          "SYSTEM_CONTEXT",
    );

  const unknown =
    claims.filter(
      claim =>
        claim.type ===
          "UNKNOWN" ||
        claim.scope ===
          "UNKNOWN",
    );

  return {
    inputType:
      detectInputType(
        source,
      ),

    claims,

    tenantLiterals,

    technicalPatterns,

    unknown,

    safety: {
      containsTenantSpecificValues:
        tenantLiterals.length >
        0,

      containsCustomFields:
        claims.some(
          claim =>
            claim.type ===
            "CUSTOM_FIELD",
        ),

      containsUnknownSemantics:
        unknown.length >
        0,

      /*
       * Deliberately always false.
       *
       * Decomposition may create candidates,
       * but automatic promotion to global
       * semantic truth is never allowed here.
       */
      safeForAutomaticGlobalPromotion:
        false,
    },
  };
}
