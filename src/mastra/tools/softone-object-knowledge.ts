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

type JsonRecord =
  Record<string, any>;

type ContractStore = {
  generatedAt?: string;
  formatVersion?: number;
  policy?: JsonRecord;
  contracts: Record<
    string,
    JsonRecord
  >;
};

type AuditStore = {
  generatedAt?: string;
  formatVersion?: number;
  policy?: JsonRecord;
  objects: Record<
    string,
    JsonRecord
  >;
};

let contractCache:
  ContractStore | null = null;

let auditCache:
  AuditStore | null = null;

function normalize(
  value:
    | string
    | null
    | undefined,
): string {
  return (
    value ?? ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .toUpperCase();
}

function loadContracts():
  ContractStore {
  if (contractCache) {
    return contractCache;
  }

  const path =
    process.env
      .SOFTONE_CONTRACTS_PATH ??
    "data/softone-object-contracts.json";

  if (!existsSync(path)) {
    throw new Error(
      `SoftOne contract store not found: ${path}`,
    );
  }

  const parsed =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as ContractStore;

  if (
    !parsed.contracts ||
    typeof parsed.contracts !==
      "object"
  ) {
    throw new Error(
      "Invalid SoftOne contract store",
    );
  }

  contractCache = parsed;

  return parsed;
}

function loadAudit():
  AuditStore {
  if (auditCache) {
    return auditCache;
  }

  const path =
    process.env
      .SOFTONE_AUDIT_PATH ??
    "data/softone-object-audit.json";

  if (!existsSync(path)) {
    throw new Error(
      `SoftOne audit store not found: ${path}`,
    );
  }

  const parsed =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as AuditStore;

  if (
    !parsed.objects ||
    typeof parsed.objects !==
      "object"
  ) {
    throw new Error(
      "Invalid SoftOne audit store",
    );
  }

  auditCache = parsed;

  return parsed;
}

function resolveObject(
  query: string,
  contracts:
    Record<
      string,
      JsonRecord
    >,
): string | null {
  const canonical =
    normalizeSoftOneObjectName(
      query,
    );

  if (
    canonical &&
    contracts[canonical]
  ) {
    return canonical;
  }

  const normalizedQuery =
    normalize(query);

  /*
   * Exact object name.
   */
  for (
    const object of
    Object.keys(contracts)
  ) {
    if (
      normalize(object) ===
      normalizedQuery
    ) {
      return object;
    }
  }

  /*
   * Exact caption only.
   *
   * No fuzzy guessing here.
   * Natural-language discovery belongs
   * to softoneObjectDiscovery.
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
      ) ===
        normalizedQuery
    ) {
      return object;
    }
  }

  return null;
}

export const softoneObjectKnowledge =
  createTool({
    id:
      "softone-object-knowledge",

    description: `
Returns the unified SoftOne knowledge record for a Business Object.

This is the preferred default knowledge source for Analyst,
Developer and QA agents.

It merges:
- generated object contract
- audit classification
- priority
- readiness
- key evidence
- table identity
- relation summary
- provenance
- safety warnings

Important rules:
- P1/P2/P3/P4 priority is not write authority.
- HEURISTIC_CANDIDATE is never an executable key by itself.
- getDataContract=UNVERIFIED remains unverified.
- LIVE_VERIFIED means actual runtime getData evidence exists.
- REGISTRY_VERIFIED means explicit canonical registry evidence exists.
- This tool performs no live SoftOne call and no write.
`,

    inputSchema:
      z.object({
        object:
          z.string()
            .min(1),

        detail:
          z.enum([
            "summary",
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
      const contractsStore =
        loadContracts();

      const auditStore =
        loadAudit();

      const resolvedObject =
        resolveObject(
          object,
          contractsStore.contracts,
        );

      if (!resolvedObject) {
        return {
          found: false,

          query:
            object,

          instruction:
            "Object not found in generated SoftOne knowledge. Use softoneObjectDiscovery rather than guessing.",
        };
      }

      const contract =
        contractsStore.contracts[
          resolvedObject
        ];

      const audit =
        auditStore.objects[
          resolvedObject
        ] ?? null;

      if (!audit) {
        return {
          found: false,

          query:
            object,

          resolvedObject,

          error:
            "Contract exists but audit record is missing.",
        };
      }

      const keyContract =
        contract.keyContract ??
        {};

      const getDataVerified =
        keyContract
          .getDataContract ===
        "VERIFIED";

      const canonicalKey =
        keyContract
          .canonicalKey ??
        null;

      const keyAuthority =
        keyContract
          .authority ??
        "UNRESOLVED";

      const heuristicKeyOnly =
        keyAuthority ===
        "HEURISTIC_CANDIDATE";

      const executableReadKeyReady =
        getDataVerified &&
        canonicalKey !== null;

      if (
        detail === "summary"
      ) {
        return {
          found: true,

          object:
            resolvedObject,

          caption:
            contract.caption ??
            null,

          classification:
            audit.classification,

          priority:
            audit.priority,

          readiness:
            audit.readiness,

          physicalTable:
            contract.identity
              ?.effectivePhysicalTable ??
            null,

          canonicalKey,

          keyAuthority,

          getDataVerified,

          warnings:
            contract.warnings ??
            [],
        };
      }

      const compact = {
        found: true,

        object:
          resolvedObject,

        caption:
          contract.caption ??
          null,

        objectType:
          contract.objectType ??
          null,

        audit: {
          classification:
            audit.classification,

          classificationAuthority:
            audit
              .classificationAuthority,

          priority:
            audit.priority,

          readiness:
            audit.readiness,

          reasons:
            audit
              .classificationReasons ??
            [],
        },

        identity:
          contract.identity ??
          null,

        keyContract: {
          canonicalKey,

          authority:
            keyAuthority,

          heuristicConfidence:
            keyContract
              .heuristicConfidence ??
            "NONE",

          getDataContract:
            keyContract
              .getDataContract ??
            "UNVERIFIED",

          verificationMethod:
            keyContract
              .verificationMethod ??
            null,

          topCandidates:
            Array.isArray(
              keyContract.candidates,
            )
              ? keyContract
                  .candidates
                  .slice(
                    0,
                    3,
                  )
              : [],
        },

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
            "getData",

          browserMethodsCanonical:
            false,

          heuristicKeyOnly,

          heuristicKeyExecutable:
            false,

          executableReadKeyReady,

          writeAuthority:
            false,

          writePerformed:
            false,
        },
      };

      if (
        detail === "compact"
      ) {
        return compact;
      }

      return {
        ...compact,

        generatedFrom: {
          contractsGeneratedAt:
            contractsStore
              .generatedAt ??
            null,

          auditGeneratedAt:
            auditStore
              .generatedAt ??
            null,
        },

        contract,

        audit,
      };
    },
  });
