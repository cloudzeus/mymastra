import {
  Agent,
} from "@mastra/core/agent";

import type {
  SoftOneProjectSemanticGraph,
} from "./script-project-semantic-graph";

import {
  createSoftOneSemanticLlmContext,
} from "./semantic-llm-context";

import type {
  SoftOneLlmSemanticExplanation,
} from "./semantic-llm-explanation-types";


const MODEL =
  `openrouter/${
    process.env
      .MASTRA_OPENROUTER_MODEL_ID ??
    "auto"
  }`;


const softOneSemanticExplainer =
  new Agent({
    id:
      "softone-semantic-explainer",

    name:
      "SoftOne Semantic Explainer",

    instructions: `
You are a SoftOne ERP source-code semantic explanation component.

You receive ONLY structured deterministic analysis and curated SoftOne knowledge.

Your job is to explain the analyzed implementation in natural Greek.

STRICT EPISTEMIC RULES:

1. DETECTED CODE BEHAVIOR
Facts about functions, calls, fields, objects, SQL, guards, reachability and value flow come from deterministic analysis.
Never contradict them.

2. VERIFIED
VERIFIED SoftOne semantics are authoritative for the stated context only.

3. DERIVED
DERIVED semantics are supported knowledge but must not be presented as formally verified.

4. UNRESOLVED
If a construct is unresolved, do not invent its exact business meaning.

5. CONTEXTUAL INFERENCE
You may infer likely intent from surrounding behavior.
Every such statement MUST be explicitly classified CONTEXTUAL_INFERENCE.
It must never become VERIFIED or DERIVED.

6. ACTIVE vs POTENTIAL
Never describe POTENTIAL/unreachable behavior as if it definitely executes.
Clearly distinguish active runtime behavior from code that exists but is not reachable from the detected entry points.

7. CONDITIONS
Preserve guards and exclusions.
Do not claim that an operation always executes when it is conditional.

8. LANGUAGE
Business explanation must be Greek.
Keep technical identifiers exactly as supplied:
SoftOne object names, tables, fields, functions, SQL identifiers and canonical identifiers.

9. OUTPUT
Return valid JSON only.
No markdown.
No prose outside the JSON.

Return exactly this shape:

{
  "summary": "...",
  "activeBehavior": [
    {
      "text": "...",
      "basis": "DETERMINISTIC|VERIFIED|DERIVED|CONTEXTUAL_INFERENCE",
      "references": []
    }
  ],
  "potentialBehavior": [],
  "businessInterpretation": [],
  "unresolved": [
    {
      "construct": "...",
      "explanation": "..."
    }
  ],
  "risks": [],
  "inferredContext": [
    {
      "statement": "...",
      "confidence": "LOW|MEDIUM|HIGH",
      "evidence": [],
      "requiresVerification": true
    }
  ]
}
`,
    model:
      MODEL,
  });


function extractJson(
  text: string,
): string {
  const trimmed =
    text.trim();

  if (
    trimmed.startsWith(
      "{",
    ) &&
    trimmed.endsWith(
      "}",
    )
  ) {
    return trimmed;
  }


  const fenced =
    trimmed.match(
      /```(?:json)?\s*([\s\S]*?)```/i,
    );

  if (
    fenced?.[1]
  ) {
    return fenced[1]
      .trim();
  }


  const first =
    trimmed.indexOf(
      "{",
    );

  const last =
    trimmed.lastIndexOf(
      "}",
    );


  if (
    first >= 0 &&
    last > first
  ) {
    return trimmed.slice(
      first,
      last + 1,
    );
  }


  throw new Error(
    "SoftOne semantic explainer returned no JSON object",
  );
}


const VALID_BASES =
  new Set([
    "VERIFIED",
    "DERIVED",
    "DETERMINISTIC",
    "CONTEXTUAL_INFERENCE",
  ]);


function containsCorruptedScript(
  value: string,
): boolean {
  /*
   * Greek + Latin identifiers are fine.
   *
   * Reject accidental contamination from scripts that should never
   * appear in a Greek SoftOne technical explanation.
   */
  return /[\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/u.test(
    value,
  );
}


function validateStatement(
  value: unknown,
  location: string,
): void {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${location}: expected statement object`,
    );
  }


  const item =
    value as Record<string, unknown>;


  if (
    typeof item.text !== "string" ||
    item.text.trim().length === 0
  ) {
    throw new Error(
      `${location}: missing text`,
    );
  }


  if (
    containsCorruptedScript(
      item.text,
    )
  ) {
    throw new Error(
      `${location}: corrupted/mixed-script text`,
    );
  }


  if (
    typeof item.basis !== "string" ||
    !VALID_BASES.has(
      item.basis,
    )
  ) {
    throw new Error(
      `${location}: invalid basis`,
    );
  }


  if (
    item.references !== undefined &&
    (
      !Array.isArray(
        item.references,
      ) ||
      item.references.some(
        ref =>
          typeof ref !==
            "string",
      )
    )
  ) {
    throw new Error(
      `${location}: references must be string[]`,
    );
  }
}



function normalizeBasis(
  value: unknown,
): "VERIFIED" | "DERIVED" | "DETERMINISTIC" | "CONTEXTUAL_INFERENCE" {
  const normalized =
    String(
      value ?? "",
    )
      .trim()
      .toUpperCase();


  if (
    normalized ===
      "VERIFIED"
  ) {
    return "VERIFIED";
  }


  if (
    normalized ===
      "DERIVED"
  ) {
    return "DERIVED";
  }


  if (
    [
      "DETERMINISTIC",
      "DETECTED",
      "FACT",
      "CODE",
      "STATIC_ANALYSIS",
    ].includes(
      normalized,
    )
  ) {
    return "DETERMINISTIC";
  }


  /*
   * Unknown / interpretive labels are deliberately downgraded.
   * Never upgrade them to VERIFIED or DERIVED.
   */
  return "CONTEXTUAL_INFERENCE";
}


function normalizeStatementArray(
  value: unknown,
): unknown[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }


  return value.map(
    item => {
      if (
        typeof item ===
          "string"
      ) {
        return {
          text:
            item,

          basis:
            "CONTEXTUAL_INFERENCE",

          references:
            [],
        };
      }


      if (
        !item ||
        typeof item !==
          "object" ||
        Array.isArray(
          item,
        )
      ) {
        return item;
      }


      const record =
        item as Record<
          string,
          unknown
        >;


      return {
        ...record,

        basis:
          normalizeBasis(
            record.basis,
          ),

        references:
          Array.isArray(
            record.references,
          )
            ? record.references.filter(
                ref =>
                  typeof ref ===
                    "string",
              )
            : [],
      };
    },
  );
}


function normalizeExplanation(
  value: unknown,
): unknown {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return value;
  }


  const candidate =
    value as Record<
      string,
      unknown
    >;


  return {
    ...candidate,

    activeBehavior:
      normalizeStatementArray(
        candidate.activeBehavior,
      ),

    potentialBehavior:
      normalizeStatementArray(
        candidate.potentialBehavior,
      ),

    businessInterpretation:
      normalizeStatementArray(
        candidate.businessInterpretation,
      ),

    risks:
      normalizeStatementArray(
        candidate.risks,
      ),
  };
}


function validateExplanation(
  value:
    unknown,
): asserts value is
  SoftOneLlmSemanticExplanation {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Invalid SoftOne semantic explanation",
    );
  }


  const candidate =
    value as Record<
      string,
      unknown
    >;


  if (
    typeof candidate.summary !==
      "string" ||
    candidate.summary.trim().length ===
      0
  ) {
    throw new Error(
      "Missing explanation summary",
    );
  }


  if (
    containsCorruptedScript(
      candidate.summary,
    )
  ) {
    throw new Error(
      "Summary contains corrupted/mixed-script text",
    );
  }


  for (
    const key
    of [
      "activeBehavior",
      "potentialBehavior",
      "businessInterpretation",
      "risks",
    ] as const
  ) {
    const items =
      candidate[key];


    if (
      !Array.isArray(
        items,
      )
    ) {
      throw new Error(
        `${key} must be an array`,
      );
    }


    items.forEach(
      (
        item,
        index,
      ) =>
        validateStatement(
          item,
          `${key}[${index}]`,
        ),
    );
  }


  if (
    !Array.isArray(
      candidate.unresolved,
    )
  ) {
    throw new Error(
      "unresolved must be an array",
    );
  }


  candidate.unresolved.forEach(
    (
      value,
      index,
    ) => {
      if (
        !value ||
        typeof value !==
          "object" ||
        Array.isArray(value)
      ) {
        throw new Error(
          `unresolved[${index}] invalid`,
        );
      }


      const item =
        value as Record<
          string,
          unknown
        >;


      if (
        typeof item.construct !==
          "string" ||
        typeof item.explanation !==
          "string"
      ) {
        throw new Error(
          `unresolved[${index}] incomplete`,
        );
      }


      if (
        containsCorruptedScript(
          item.construct,
        ) ||
        containsCorruptedScript(
          item.explanation,
        )
      ) {
        throw new Error(
          `unresolved[${index}] corrupted text`,
        );
      }
    },
  );


  if (
    !Array.isArray(
      candidate.inferredContext,
    )
  ) {
    throw new Error(
      "inferredContext must be an array",
    );
  }


  candidate.inferredContext.forEach(
    (
      value,
      index,
    ) => {
      if (
        !value ||
        typeof value !==
          "object" ||
        Array.isArray(value)
      ) {
        throw new Error(
          `inferredContext[${index}] invalid`,
        );
      }


      const item =
        value as Record<
          string,
          unknown
        >;


      if (
        typeof item.statement !==
          "string" ||
        containsCorruptedScript(
          item.statement,
        ) ||
        ![
          "LOW",
          "MEDIUM",
          "HIGH",
        ].includes(
          String(
            item.confidence,
          ),
        ) ||
        !Array.isArray(
          item.evidence,
        )
      ) {
        throw new Error(
          `inferredContext[${index}] incomplete/corrupted`,
        );
      }
    },
  );
}


export async function explainSoftOneSemanticGraph(
  graph:
    SoftOneProjectSemanticGraph,
): Promise<
  SoftOneLlmSemanticExplanation
> {
  const context =
    createSoftOneSemanticLlmContext(
      graph,
    );


  const basePrompt =
    [
      "Explain this SoftOne implementation analysis.",
      "",
      "CRITICAL OUTPUT REQUIREMENTS:",
      "- Write fluent natural Greek.",
      "- Keep supplied technical identifiers unchanged.",
      "- Do not invent file names, objects, tables, fields, products or systems.",
      "- Do not introduce identifiers that are absent from the supplied context.",
      "- Do not use Korean, Arabic, Chinese, Japanese or other unrelated scripts.",
      "- activeBehavior, potentialBehavior, businessInterpretation and risks MUST contain objects with exactly: text, basis, references.",
      "- basis MUST be exactly one of: VERIFIED, DERIVED, DETERMINISTIC, CONTEXTUAL_INFERENCE.",
      "- Never invent alternative basis labels such as FACT, RISK, ASSUMPTION or INFERENCE.",
      "- UNRESOLVED constructs remain unresolved.",
      "- Contextual guesses must be CONTEXTUAL_INFERENCE and require verification.",
      "- Return JSON only.",
      "",
      JSON.stringify(
        context,
        null,
        2,
      ),
    ].join(
      "\n",
    );


  let previousError:
    unknown;


  for (
    let attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {
    const prompt =
      attempt === 1
        ? basePrompt
        : [
            basePrompt,
            "",
            "THE PREVIOUS RESPONSE FAILED VALIDATION.",
            "Regenerate the complete JSON from scratch.",
            `Validation error: ${
              previousError instanceof Error
                ? previousError.message
                : String(
                    previousError,
                  )
            }`,
            "Do not repeat the invalid output.",
          ].join(
            "\n",
          );


    try {
      const response =
        await softOneSemanticExplainer.generate(
          [
            {
              role:
                "user",

              content:
                prompt,
            },
          ],
        );


      const parsed =
        normalizeExplanation(
          JSON.parse(
            extractJson(
              response.text,
            ),
          ),
        );


      validateExplanation(
        parsed,
      );


      parsed.inferredContext =
        parsed.inferredContext.map(
          item => ({
            ...item,

            requiresVerification:
              true,
          }),
        );


      return parsed;
    }
    catch (
      error
    ) {
      previousError =
        error;
    }
  }


  throw new Error(
    `SoftOne semantic explanation failed validation after retry: ${
      previousError instanceof Error
        ? previousError.message
        : String(
            previousError,
          )
    }`,
  );
}
