import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  normalizeSoftOneObjectName,
} from "../softone/registry";

type ContractFile = {
  generatedAt?: string;
  formatVersion?: number;

  policy?: {
    canonicalReadMethod?: string;
    browserMethodsCanonical?: boolean;
    heuristicKeyIsExecutable?: boolean;
    liveVerificationRequiredForGetDataContract?: boolean;
  };

  contracts?: Record<
    string,
    Record<string, any>
  >;
};

let cache:
  ContractFile | null = null;

function normalize(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .toUpperCase();
}

function loadContracts():
  ContractFile {
  if (cache) {
    return cache;
  }

  const path =
    process.env
      .SOFTONE_CONTRACTS_PATH ??
    "data/softone-object-contracts.json";

  if (!existsSync(path)) {
    throw new Error(
      `SoftOne object contracts not found: ${path}. Run scripts/build-softone-contracts.ts first.`,
    );
  }

  const parsed =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as ContractFile;

  if (
    !parsed.contracts ||
    typeof parsed.contracts !==
      "object"
  ) {
    throw new Error(
      "Invalid SoftOne object contracts file",
    );
  }

  cache = parsed;

  return cache;
}

function resolveObject(
  query: string,
  contracts:
    Record<
      string,
      Record<string, any>
    >,
): string | null {
  /*
   * First use canonical registry
   * normalization/aliases.
   */
  const canonical =
    normalizeSoftOneObjectName(
      query,
    );

  if (contracts[canonical]) {
    return canonical;
  }

  const q =
    normalize(query);

  /*
   * Exact object name.
   */
  for (
    const object of
    Object.keys(contracts)
  ) {
    if (
      normalize(object) === q
    ) {
      return object;
    }
  }

  /*
   * Exact caption.
   * Never fuzzy-resolve here.
   * Fuzzy discovery belongs to
   * softoneObjectDiscovery.
   */
  for (
    const [
      object,
      contract,
    ] of Object.entries(
      contracts,
    )
  ) {
    if (
      typeof contract.caption ===
        "string" &&
      normalize(
        contract.caption,
      ) === q
    ) {
      return object;
    }
  }

  return null;
}

export const softoneObjectContract =
  createTool({
    id:
      "softone-object-contract",

    description: `
Returns the generated canonical implementation contract for a SoftOne Business Object.

This is the preferred compact SoftOne knowledge source for Analyst,
Developer and QA agents.

It combines previously generated evidence from:
- schema cache
- relations cache
- canonical registry
- explicit live verification overrides

Important:
- HEURISTIC_CANDIDATE is not a verified getData key.
- getDataContract=UNVERIFIED must remain unverified.
- Never promote heuristic evidence to live verification.
- This tool performs no SoftOne API calls and no writes.
`,

    inputSchema:
      z.object({
        object:
          z.string().min(1),

        detail:
          z
            .enum([
              "compact",
              "full",
            ])
            .optional()
            .default(
              "compact",
            ),
      }),

    execute: async ({
      object,
      detail,
    }) => {
      const store =
        loadContracts();

      const contracts =
        store.contracts!;

      const resolvedObject =
        resolveObject(
          object,
          contracts,
        );

      if (!resolvedObject) {
        return {
          found: false,

          query:
            object,

          verified:
            false,

          instruction:
            "Object is not present in the generated contract store. Use softoneObjectDiscovery rather than guessing an object name.",
        };
      }

      const contract =
        contracts[
          resolvedObject
        ];

      if (
        detail === "full"
      ) {
        return {
          found: true,

          generatedAt:
            store.generatedAt ??
            null,

          formatVersion:
            store.formatVersion ??
            null,

          policy:
            store.policy ??
            null,

          contract,
        };
      }

      /*
       * Compact form is designed
       * for routine agent usage.
       */
      return {
        found: true,

        object:
          contract.object,

        caption:
          contract.caption ??
          null,

        objectType:
          contract.objectType ??
          null,

        identity:
          contract.identity ??
          null,

        keyContract:
          contract.keyContract
            ? {
                canonicalKey:
                  contract
                    .keyContract
                    .canonicalKey ??
                  null,

                authority:
                  contract
                    .keyContract
                    .authority ??
                  "UNRESOLVED",

                heuristicConfidence:
                  contract
                    .keyContract
                    .heuristicConfidence ??
                  "NONE",

                getDataContract:
                  contract
                    .keyContract
                    .getDataContract ??
                  "UNVERIFIED",

                verificationMethod:
                  contract
                    .keyContract
                    .verificationMethod ??
                  null,

                topCandidates:
                  Array.isArray(
                    contract
                      .keyContract
                      .candidates,
                  )
                    ? contract
                        .keyContract
                        .candidates
                        .slice(
                          0,
                          3,
                        )
                    : [],
              }
            : null,

        tableSummary: {
          count:
            Array.isArray(
              contract.tables,
            )
              ? contract
                  .tables
                  .length
              : 0,

          master:
            Array.isArray(
              contract.tables,
            )
              ? contract
                  .tables[0] ??
                null
              : null,
        },

        relations:
          contract.relations ??
          null,

        provenance:
          contract.provenance ??
          null,

        warnings:
          contract.warnings ??
          [],

        safety: {
          canonicalReadMethod:
            store.policy
              ?.canonicalReadMethod ??
            "getData",

          heuristicKeyExecutable:
            false,

          getDataVerified:
            contract
              .keyContract
              ?.getDataContract ===
            "VERIFIED",

          writePerformed:
            false,
        },
      };
    },
  });
