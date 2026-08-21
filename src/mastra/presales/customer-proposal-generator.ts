import {
  RequestContext,
} from "@mastra/core/request-context";

import {
  analystAgent,
} from "../agents/analyst";

import type {
  InitialSolutionApproach,
} from "./types";


export type CustomerProposalDraft = {
  title: string;

  executiveSummary: string;

  currentSituation: string;

  customerNeed: string;

  proposedSolution: string;

  scope: string[];

  deliverables: string[];

  integrations: string[];

  implementationPhases: Array<{
    title: string;
    description: string;
  }>;

  timeline: string;

  assumptions: string[];

  dependencies: string[];

  exclusions: string[];

  risks: string[];

  optionalAddons: string[];

  acceptanceCriteria: string[];

  pricing: {
    status:
      | "VERIFIED"
      | "UNRESOLVED"
      | "NOT_APPLICABLE";

    lines: Array<{
      description: string;
      amount?: number;
      currency?: string;
    }>;

    notes: string;
  };

  nextSteps: string[];
};


export type GenerateCustomerProposalInput = {
  tenantId: string;

  customerId: string;

  opportunityId: string;

  customerRequest: string;

  analysis:
    InitialSolutionApproach;

  feedback?: string;

  additionalInformation?: string;

  commercialInformation?: string;
};


function extractJson(
  value: unknown,
): Record<string, unknown> {
  const record =
    value as {
      object?: unknown;
      text?: unknown;
    };

  if (
    record.object &&
    typeof record.object ===
      "object" &&
    !Array.isArray(
      record.object,
    )
  ) {
    return record.object as
      Record<string, unknown>;
  }

  if (
    typeof record.text !==
      "string"
  ) {
    throw new Error(
      "Proposal generator returned no content",
    );
  }

  const text =
    record.text.trim();

  if (!text) {
    throw new Error(
      "Proposal generator returned empty content",
    );
  }

  try {
    return JSON.parse(
      text,
    ) as Record<
      string,
      unknown
    >;
  }
  catch {
    // Continue.
  }

  const fenced =
    text.match(
      /```(?:json)?\s*([\s\S]*?)```/i,
    );

  if (
    fenced?.[1]
  ) {
    return JSON.parse(
      fenced[1].trim(),
    ) as Record<
      string,
      unknown
    >;
  }

  const start =
    text.indexOf("{");

  const end =
    text.lastIndexOf("}");

  if (
    start >= 0 &&
    end > start
  ) {
    return JSON.parse(
      text.slice(
        start,
        end + 1,
      ),
    ) as Record<
      string,
      unknown
    >;
  }

  throw new Error(
    "Proposal generator did not return valid JSON",
  );
}


export async function generateCustomerProposal(
  input:
    GenerateCustomerProposalInput,
): Promise<CustomerProposalDraft> {
  const requestContext =
    new RequestContext();

  requestContext.set(
    "tenantId",
    input.tenantId,
  );

  requestContext.set(
    "customerId",
    input.customerId,
  );

  requestContext.set(
    "opportunityId",
    input.opportunityId,
  );

  const prompt = [
    "Είσαι ο Proposal Solutions Consultant μιας ελληνικής εταιρείας software και IT.",
    "",
    "Δημιούργησε την εμπορική/τεχνική πρόταση που μπορεί να παρουσιαστεί στον πελάτη.",
    "",
    "ΚΑΝΟΝΕΣ:",
    "- Όλο το customer-facing κείμενο πρέπει να είναι στα Ελληνικά.",
    "- Technical identifiers, filenames, API names, SoftOne names και product names παραμένουν στην αρχική τους μορφή.",
    "- Μην κάνεις νέο repository research.",
    "- Χρησιμοποίησε την εγκεκριμένη/τρέχουσα ανάλυση ως τεχνική βάση.",
    "- Μην εφευρίσκεις λειτουργίες ή API της ΑΑΔΕ.",
    "- Αν δεν υπάρχει επιβεβαιωμένο pricing, pricing.status=UNRESOLVED.",
    "- Αν δοθούν commercialInformation, χρησιμοποίησέ τα.",
    "- Αν δοθεί feedback, άλλαξε την πρόταση σύμφωνα με αυτό.",
    "- Η πρόταση πρέπει να είναι κατανοητή από πελάτη και όχι dump τεχνικής ανάλυσης.",
    "",
    "CUSTOMER REQUEST:",
    input.customerRequest,
    "",
    "CURRENT ANALYSIS:",
    JSON.stringify(
      input.analysis,
      null,
      2,
    ),
    "",
    "HUMAN FEEDBACK:",
    input.feedback?.trim() ||
      "Δεν υπάρχει.",
    "",
    "ADDITIONAL INFORMATION:",
    input.additionalInformation?.trim() ||
      "Δεν υπάρχει.",
    "",
    "COMMERCIAL INFORMATION:",
    input.commercialInformation?.trim() ||
      "Δεν έχει δοθεί.",
    "",
    "Return ONLY one JSON object with exactly this shape:",
    JSON.stringify(
      {
        title:
          "string",

        executiveSummary:
          "string",

        currentSituation:
          "string",

        customerNeed:
          "string",

        proposedSolution:
          "string",

        scope: [
          "string",
        ],

        deliverables: [
          "string",
        ],

        integrations: [
          "string",
        ],

        implementationPhases: [
          {
            title:
              "string",

            description:
              "string",
          },
        ],

        timeline:
          "string",

        assumptions: [
          "string",
        ],

        dependencies: [
          "string",
        ],

        exclusions: [
          "string",
        ],

        risks: [
          "string",
        ],

        optionalAddons: [
          "string",
        ],

        acceptanceCriteria: [
          "string",
        ],

        pricing: {
          status:
            "UNRESOLVED",

          lines: [],

          notes:
            "string",
        },

        nextSteps: [
          "string",
        ],
      },
      null,
      2,
    ),
  ].join(
    "\n",
  );

  let lastError:
    unknown;

  for (
    let attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {
    try {
      const response =
        await analystAgent.generate(
          [
            {
              role:
                "user" as const,

              content:
                prompt,
            },
          ],
          {
            requestContext,

            toolChoice:
              "none",

            maxSteps:
              1,

            abortSignal:
              AbortSignal.timeout(
                90_000,
              ),

            providerOptions: {
              openrouter: {
                plugins: [
                  {
                    id:
                      "auto-router",

                    cost_quality_tradeoff:
                      Number(
                        process.env
                          .MASTRA_OPENROUTER_COST_QUALITY_TRADEOFF ??
                          "8",
                      ),
                  },
                ],
              },
            },
          },
        );

      return extractJson(
        response,
      ) as unknown as
        CustomerProposalDraft;
    }
    catch (error) {
      lastError =
        error;
    }
  }

  throw lastError ??
    new Error(
      "Proposal generation failed",
    );
}
