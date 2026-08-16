import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  getSoftOneObjectRegistryEntry,
} from "../src/mastra/softone/registry";

type KeyAuthority =
  | "LIVE_VERIFIED"
  | "REGISTRY_VERIFIED"
  | "HEURISTIC_CANDIDATE"
  | "UNRESOLVED";

type Contract = {
  object: string;
  caption?: string | null;
  objectType?: string | null;

  identity?: {
    schemaMasterTable?: string | null;
    schemaPhysicalTable?: string | null;
    registryPhysicalTable?: string | null;
    effectivePhysicalTable?: string | null;
  };

  keyContract?: {
    canonicalKey?: string | null;
    authority?: KeyAuthority;
    heuristicConfidence?:
      | "HIGH"
      | "MEDIUM"
      | "LOW"
      | "NONE";
    getDataContract?:
      | "VERIFIED"
      | "UNVERIFIED";
    verificationMethod?: string | null;
  };

  tables?: Array<{
    name?: string | null;
    dbname?: string | null;
    caption?: string | null;
    filltype?: string | null;
    fieldCount?: number;
  }>;

  relations?: {
    inboundCount?: number;
    outboundCount?: number;
    inboundTypes?: string[];
    outboundTypes?: string[];
  };

  provenance?: Record<
    string,
    unknown
  >;

  warnings?: string[];
};

type ContractStore = {
  generatedAt?: string;
  formatVersion?: number;
  policy?: Record<
    string,
    unknown
  >;
  contracts: Record<
    string,
    Contract
  >;
};

type ObjectClass =
  | "DOCUMENT_OBJECT"
  | "CORE_BUSINESS_OBJECT"
  | "REFERENCE_MASTER"
  | "CONFIGURATION_OBJECT"
  | "AUXILIARY_INTERNAL"
  | "UNCLASSIFIED";

type ClassificationAuthority =
  | "EXPLICIT"
  | "HEURISTIC"
  | "STRUCTURAL";

type Readiness =
  | "LIVE_VERIFIED"
  | "STATIC_STRONG"
  | "STATIC_MEDIUM"
  | "UNRESOLVED_KEY"
  | "NO_PHYSICAL_TABLE"
  | "INTERNAL_ONLY";

type Priority =
  | "P1"
  | "P2"
  | "P3"
  | "P4";

function normalize(
  value:
    | string
    | null
    | undefined,
): string {
  return (
    value ?? ""
  )
    .trim()
    .toUpperCase();
}

function isSqlTable(
  table:
    | Contract["tables"][number]
    | undefined,
): boolean {
  return (
    normalize(
      table?.filltype,
    ) === "SQL" &&
    normalize(
      table?.dbname,
    ) !== ""
  );
}

function classify(
  contract: Contract,
): {
  classification: ObjectClass;
  authority:
    ClassificationAuthority;
  reasons: string[];
} {
  const reasons: string[] =
    [];

  const registry =
    getSoftOneObjectRegistryEntry(
      contract.object,
    );

  /*
   * Explicit registry mapping to FINDOC:
   * known document-type Business Object.
   */
  if (
    registry &&
    normalize(
      registry.physicalMasterTable,
    ) === "FINDOC"
  ) {
    return {
      classification:
        "DOCUMENT_OBJECT",
      authority:
        "EXPLICIT",
      reasons: [
        "CANONICAL_REGISTRY_FINDOC_MAPPING",
      ],
    };
  }

  /*
   * Any other explicit canonical registry
   * entry is considered a core business
   * object for audit/prioritization.
   *
   * This does NOT imply write readiness.
   */
  if (registry) {
    return {
      classification:
        "CORE_BUSINESS_OBJECT",
      authority:
        "EXPLICIT",
      reasons: [
        "CANONICAL_REGISTRY_ENTRY",
      ],
    };
  }

  const tables =
    contract.tables ?? [];

  const master =
    tables[0];

  const physicalTable =
    normalize(
      contract.identity
        ?.effectivePhysicalTable,
    );

  const sqlTables =
    tables.filter(
      table =>
        isSqlTable(table),
    );

  const virtualTables =
    tables.filter(
      table =>
        !isSqlTable(table),
    );

  /*
   * No physical persistence visible
   * from the generated contract.
   */
  if (
    !physicalTable ||
    sqlTables.length === 0
  ) {
    reasons.push(
      "NO_EFFECTIVE_PHYSICAL_MASTER",
    );

    if (
      tables.length > 0 &&
      virtualTables.length ===
        tables.length
    ) {
      reasons.push(
        "ALL_TABLES_BUFFER_OR_FUNCTION",
      );
    }

    return {
      classification:
        "AUXILIARY_INTERNAL",
      authority:
        "STRUCTURAL",
      reasons,
    };
  }

  const objectType =
    normalize(
      contract.objectType,
    );

  const inboundCount =
    contract.relations
      ?.inboundCount ?? 0;

  const keyAuthority =
    contract.keyContract
      ?.authority ??
    "UNRESOLVED";

  const keyConfidence =
    contract.keyContract
      ?.heuristicConfidence ??
    "NONE";

  const hasStrongStaticKey =
    keyAuthority ===
      "LIVE_VERIFIED" ||
    keyAuthority ===
      "REGISTRY_VERIFIED" ||
    (
      keyAuthority ===
        "HEURISTIC_CANDIDATE" &&
      keyConfidence ===
        "HIGH"
    );

  /*
   * EditMaster + SQL persistence +
   * meaningful inbound references +
   * strong key evidence is a good
   * structural signature of a reference
   * master.
   *
   * Still HEURISTIC, not canonical truth.
   */
  if (
    objectType ===
      "EDITMASTER" &&
    isSqlTable(master) &&
    inboundCount >= 3 &&
    hasStrongStaticKey
  ) {
    return {
      classification:
        "REFERENCE_MASTER",
      authority:
        "HEURISTIC",
      reasons: [
        "EDITMASTER",
        "SQL_MASTER",
        "INBOUND_RELATION_USAGE",
        "STRONG_KEY_EVIDENCE",
      ],
    };
  }

  /*
   * Remaining persisted EditMaster
   * objects are conservatively treated
   * as configuration/master candidates.
   */
  if (
    objectType ===
      "EDITMASTER" &&
    isSqlTable(master)
  ) {
    return {
      classification:
        "CONFIGURATION_OBJECT",
      authority:
        "HEURISTIC",
      reasons: [
        "EDITMASTER",
        "SQL_MASTER",
        "NOT_PROMOTED_TO_REFERENCE_MASTER",
      ],
    };
  }

  return {
    classification:
      "UNCLASSIFIED",
    authority:
      "STRUCTURAL",
    reasons: [
      "PERSISTED_OBJECT_WITHOUT_CLASSIFICATION_RULE",
    ],
  };
}

function readiness(
  contract: Contract,
  classification:
    ObjectClass,
): Readiness {
  if (
    classification ===
      "AUXILIARY_INTERNAL"
  ) {
    return "INTERNAL_ONLY";
  }

  const physicalTable =
    normalize(
      contract.identity
        ?.effectivePhysicalTable,
    );

  if (!physicalTable) {
    return "NO_PHYSICAL_TABLE";
  }

  const key =
    contract.keyContract;

  if (
    key?.getDataContract ===
      "VERIFIED"
  ) {
    return "LIVE_VERIFIED";
  }

  if (
    key?.authority ===
      "REGISTRY_VERIFIED"
  ) {
    return "STATIC_STRONG";
  }

  if (
    key?.authority ===
      "HEURISTIC_CANDIDATE" &&
    key.heuristicConfidence ===
      "HIGH"
  ) {
    return "STATIC_STRONG";
  }

  if (
    key?.authority ===
      "HEURISTIC_CANDIDATE" &&
    key.heuristicConfidence ===
      "MEDIUM"
  ) {
    return "STATIC_MEDIUM";
  }

  return "UNRESOLVED_KEY";
}

function priority(
  classification: ObjectClass,
  state: Readiness,
  authority: ClassificationAuthority,
): Priority {
  /*
   * P1 must be strict.
   *
   * Explicit canonical business/document objects
   * are trusted as the primary working set.
   */
  if (
    authority === "EXPLICIT" &&
    (
      classification === "DOCUMENT_OBJECT" ||
      classification === "CORE_BUSINESS_OBJECT"
    )
  ) {
    return "P1";
  }

  /*
   * A reference master reaches P1 only
   * after live getData verification.
   *
   * Static/heuristic evidence remains useful,
   * but does not make the object core by itself.
   */
  if (
    classification === "REFERENCE_MASTER" &&
    state === "LIVE_VERIFIED"
  ) {
    return "P1";
  }

  /*
   * Strong reference/configuration objects
   * form the normal extended working set.
   */
  if (
    classification === "REFERENCE_MASTER" ||
    classification === "CONFIGURATION_OBJECT"
  ) {
    return "P2";
  }

  if (
    classification === "UNCLASSIFIED"
  ) {
    return "P3";
  }

  return "P4";
}

function main() {
  const contractsPath =
    process.env
      .SOFTONE_CONTRACTS_PATH ??
    "data/softone-object-contracts.json";

  if (
    !existsSync(
      contractsPath,
    )
  ) {
    throw new Error(
      `Contract store not found: ${contractsPath}`,
    );
  }

  const store =
    JSON.parse(
      readFileSync(
        contractsPath,
        "utf8",
      ),
    ) as ContractStore;

  const audit:
    Record<
      string,
      Record<string, unknown>
    > = {};

  for (
    const [
      object,
      contract,
    ] of Object.entries(
      store.contracts,
    )
  ) {
    const classified =
      classify(contract);

    const state =
      readiness(
        contract,
        classified.classification,
      );

    const objectPriority =
      priority(
        classified.classification,
        state,
        classified.authority,
      );

    audit[object] = {
      object,

      caption:
        contract.caption ??
        null,

      classification:
        classified.classification,

      classificationAuthority:
        classified.authority,

      classificationReasons:
        classified.reasons,

      priority:
        objectPriority,

      readiness:
        state,

      key: {
        canonicalKey:
          contract.keyContract
            ?.canonicalKey ??
          null,

        authority:
          contract.keyContract
            ?.authority ??
          "UNRESOLVED",

        confidence:
          contract.keyContract
            ?.heuristicConfidence ??
          "NONE",

        getDataContract:
          contract.keyContract
            ?.getDataContract ??
          "UNVERIFIED",
      },

      physicalTable:
        contract.identity
          ?.effectivePhysicalTable ??
        null,

      masterTable:
        contract.identity
          ?.schemaMasterTable ??
        null,

      objectType:
        contract.objectType ??
        null,

      tableCount:
        contract.tables
          ?.length ?? 0,

      inboundRelations:
        contract.relations
          ?.inboundCount ?? 0,

      outboundRelations:
        contract.relations
          ?.outboundCount ?? 0,

      warnings:
        contract.warnings ??
        [],
    };
  }

  const values =
    Object.values(audit);

  const countBy = (
    field: string,
  ) => {
    const result:
      Record<
        string,
        number
      > = {};

    for (
      const item of values
    ) {
      const value =
        String(
          item[field] ??
          "UNKNOWN",
        );

      result[value] =
        (
          result[value] ??
          0
        ) + 1;
    }

    return result;
  };

  const output = {
    generatedAt:
      new Date()
        .toISOString(),

    sourceContractsGeneratedAt:
      store.generatedAt ??
      null,

    formatVersion: 1,

    policy: {
      purpose:
        "Prioritize SoftOne Business Object knowledge without modifying canonical key evidence.",

      classificationsAreWriteAuthority:
        false,

      heuristicClassificationIsCanonicalTruth:
        false,

      unresolvedIsAcceptable:
        true,

      browserMethodsCanonical:
        false,

      canonicalReadMethod:
        "getData",
    },

    statistics: {
      totalObjects:
        values.length,

      byClassification:
        countBy(
          "classification",
        ),

      byReadiness:
        countBy(
          "readiness",
        ),

      byPriority:
        countBy(
          "priority",
        ),
    },

    objects:
      audit,
  };

  writeFileSync(
    "data/softone-object-audit.json",
    JSON.stringify(
      output,
      null,
      2,
    ),
  );

  console.log(
    `Audited ${values.length} SoftOne objects.`,
  );

  console.log(
    "Output: data/softone-object-audit.json",
  );

  console.log(
    JSON.stringify(
      output.statistics,
      null,
      2,
    ),
  );
}

main();
