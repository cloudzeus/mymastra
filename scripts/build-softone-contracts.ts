import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  gunzipSync,
} from "node:zlib";

import {
  getSoftOneObjectRegistryEntry,
} from "../src/mastra/softone/registry";

type SchemaField = {
  name?: string;
  caption?: string;
  type?: string;
  editor?: string;
  defaultvalue?: string;
  required?: boolean;
  readOnly?: boolean;
  calculated?: boolean;
};

type SchemaTable = {
  name?: string;
  dbname?: string;
  caption?: string;
  filltype?: string;
  fields?: SchemaField[];
};

type SchemaObject = {
  type?: string;
  caption?: string;
  tables?: SchemaTable[];
};

type SchemaRoot =
  Record<string, SchemaObject>;

type Relation = {
  sourceObject: string;
  sourceTable: string;
  sourceField: string;
  caption: string;
  targetObject: string;
  relationType: string;
};

type KeyCandidate = {
  field: string;
  score: number;
  reasons: string[];
  type: string | null;
  required: boolean;
  readOnly: boolean;
  calculated: boolean;
};

function normalize(
  value: string | undefined,
): string {
  return (value ?? "")
    .trim()
    .toUpperCase();
}

function loadSchema(): SchemaRoot {
  const path =
    process.env.SOFTONE_SCHEMA_PATH ??
    "data/softone-full-schema.json.gz";

  if (!existsSync(path)) {
    throw new Error(
      `Schema cache not found: ${path}`,
    );
  }

  return JSON.parse(
    gunzipSync(
      readFileSync(path),
    ).toString("utf8"),
  ) as SchemaRoot;
}

function loadRelations(): Relation[] {
  const path =
    process.env.SOFTONE_RELATIONS_PATH ??
    "data/softone-full-relations.json";

  if (!existsSync(path)) {
    throw new Error(
      `Relations cache not found: ${path}`,
    );
  }

  const raw =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as unknown;

  if (!Array.isArray(raw)) {
    throw new Error(
      "Relations cache must be an array",
    );
  }

  return raw
    .map(value => {
      if (
        !Array.isArray(value) ||
        value.length < 6
      ) {
        return null;
      }

      const [
        sourceObject,
        sourceTable,
        sourceField,
        caption,
        targetObject,
        relationType,
      ] = value;

      if (
        typeof sourceObject !== "string" ||
        typeof sourceTable !== "string" ||
        typeof sourceField !== "string" ||
        typeof caption !== "string" ||
        typeof targetObject !== "string" ||
        typeof relationType !== "string"
      ) {
        return null;
      }

      return {
        sourceObject,
        sourceTable,
        sourceField,
        caption,
        targetObject,
        relationType,
      };
    })
    .filter(
      (
        value,
      ): value is Relation =>
        value !== null,
    );
}

function scoreKeyCandidates(
  objectName: string,
  masterTable: SchemaTable | null,
  registryPrimaryKey: string | null,
  inboundRelations: Relation[],
): KeyCandidate[] {
  if (!masterTable) {
    return [];
  }

  const objectUpper =
    normalize(objectName);

  const tableUpper =
    normalize(masterTable.name);

  const dbUpper =
    normalize(masterTable.dbname);

  return (masterTable.fields ?? [])
    .filter(
      field =>
        typeof field.name === "string",
    )
    .map(field => {
      const fieldName =
        field.name!;

      const fieldUpper =
        normalize(fieldName);

      let score = 0;

      const reasons: string[] = [];

      if (
        registryPrimaryKey &&
        fieldUpper ===
          normalize(
            registryPrimaryKey,
          )
      ) {
        score += 1000;
        reasons.push(
          "REGISTRY_PRIMARY_KEY",
        );
      }

      if (
        dbUpper &&
        fieldUpper === dbUpper
      ) {
        score += 180;
        reasons.push(
          "FIELD_EQUALS_PHYSICAL_TABLE",
        );
      }

      if (
        tableUpper &&
        fieldUpper === tableUpper
      ) {
        score += 150;
        reasons.push(
          "FIELD_EQUALS_MASTER_TABLE",
        );
      }

      if (
        fieldUpper === objectUpper
      ) {
        score += 120;
        reasons.push(
          "FIELD_EQUALS_OBJECT",
        );
      }

      if (
        normalize(field.type) ===
        "AUTOINC"
      ) {
        score += 250;
        reasons.push(
          "AUTOINC",
        );
      }

      /*
       * Relation evidence:
       *
       * If inbound relations to this object repeatedly use a source field
       * with the same name as this master-table field, that is useful
       * identity evidence.
       *
       * Example:
       *   SALDOC.SERIES -> SERIES
       *   PURDOC.SERIES -> SERIES
       *
       * This remains heuristic evidence. It does NOT verify the getData KEY.
       */
      const relationNameHits =
        inboundRelations.filter(
          relation =>
            normalize(
              relation.sourceField,
            ) === fieldUpper,
        ).length;

      /*
       * Relation-name matches are corroborating evidence only.
       *
       * They may strengthen a field that already has independent
       * identity evidence, but they must never create a key candidate
       * by themselves.
       */
      if (
        relationNameHits > 0 &&
        score > 0
      ) {
        let relationScore = 30;

        if (relationNameHits >= 2) {
          relationScore = 50;
        }

        if (relationNameHits >= 5) {
          relationScore = 80;
        }

        if (relationNameHits >= 20) {
          relationScore = 100;
        }

        score += relationScore;

        reasons.push(
          `RELATION_REFERENCE_NAME_MATCH:${relationNameHits}`,
        );
      }

      /*
       * required=true is not identity evidence by itself.
       * It may strengthen an already-established identity candidate,
       * but must never turn an arbitrary required field into a key candidate.
       */
      if (
        field.required === true &&
        score > 0
      ) {
        score += 20;
        reasons.push(
          "SCHEMA_REQUIRED",
        );
      }

      if (
        field.calculated === true
      ) {
        score -= 100;
        reasons.push(
          "CALCULATED_PENALTY",
        );
      }

      return {
        field:
          fieldName,

        score,

        reasons,

        type:
          field.type ?? null,

        required:
          field.required === true,

        readOnly:
          field.readOnly === true,

        calculated:
          field.calculated === true,
      };
    })
    .filter(
      candidate =>
        candidate.score > 0,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.field.localeCompare(
          b.field,
        ),
    );
}

function heuristicConfidence(
  candidates: KeyCandidate[],
): "HIGH" | "MEDIUM" | "LOW" | "NONE" {
  if (!candidates.length) {
    return "NONE";
  }

  const top =
    candidates[0];

  const second =
    candidates[1];

  if (
    top.score >= 250 &&
    (
      !second ||
      top.score -
        second.score >= 80
    )
  ) {
    return "HIGH";
  }

  if (top.score >= 150) {
    return "MEDIUM";
  }

  return "LOW";
}

function main() {
  const schema =
    loadSchema();

  const relations =
    loadRelations();

  const contracts:
    Record<
      string,
      Record<string, unknown>
    > = {};

  for (
    const [
      objectName,
      objectSchema,
    ] of Object.entries(schema)
  ) {
    const tables =
      objectSchema.tables ?? [];

    const masterTable =
      tables[0] ?? null;

    const registry =
      getSoftOneObjectRegistryEntry(
        objectName,
      );

    const registryPrimaryKey =
      registry?.primaryKey ??
      null;

    const inboundRelations =
      relations.filter(
        relation =>
          normalize(
            relation.targetObject,
          ) ===
          normalize(objectName),
      );

    const candidates =
      scoreKeyCandidates(
        objectName,
        masterTable,
        registryPrimaryKey,
        inboundRelations,
      );

    const confidence =
      heuristicConfidence(
        candidates,
      );

    const bestCandidate =
      candidates[0] ?? null;

    const outboundRelations =
      relations.filter(
        relation =>
          normalize(
            relation.sourceObject,
          ) ===
          normalize(objectName),
      );

    let canonicalKey:
      string | null = null;

    let keyAuthority:
      | "REGISTRY_VERIFIED"
      | "HEURISTIC_CANDIDATE"
      | "UNRESOLVED";

    if (registryPrimaryKey) {
      canonicalKey =
        registryPrimaryKey;

      keyAuthority =
        "REGISTRY_VERIFIED";
    } else if (
      bestCandidate &&
      confidence !== "NONE"
    ) {
      canonicalKey =
        bestCandidate.field;

      keyAuthority =
        "HEURISTIC_CANDIDATE";
    } else {
      keyAuthority =
        "UNRESOLVED";
    }

    const warnings: string[] = [];

    if (!masterTable) {
      warnings.push(
        "NO_MASTER_TABLE",
      );
    }

    if (
      masterTable &&
      !masterTable.dbname
    ) {
      warnings.push(
        "MASTER_TABLE_HAS_NO_DBNAME",
      );
    }

    if (
      keyAuthority ===
      "HEURISTIC_CANDIDATE"
    ) {
      warnings.push(
        "KEY_NOT_REGISTRY_VERIFIED",
      );
    }

    if (
      keyAuthority ===
      "UNRESOLVED"
    ) {
      warnings.push(
        "KEY_UNRESOLVED",
      );
    }

    if (
      registry?.physicalMasterTable &&
      masterTable?.dbname &&
      normalize(
        registry.physicalMasterTable,
      ) !==
        normalize(
          masterTable.dbname,
        )
    ) {
      warnings.push(
        "PHYSICAL_TABLE_MAPPING_MISMATCH",
      );
    }

    contracts[objectName] = {
      object:
        objectName,

      caption:
        objectSchema.caption ??
        null,

      objectType:
        objectSchema.type ??
        null,

      identity: {
        schemaMasterTable:
          masterTable?.name ??
          null,

        schemaPhysicalTable:
          masterTable?.dbname ??
          null,

        registryPhysicalTable:
          registry
            ?.physicalMasterTable ??
          null,

        effectivePhysicalTable:
          registry
            ?.physicalMasterTable ??
          masterTable?.dbname ??
          null,
      },

      keyContract: {
        canonicalKey,

        authority:
          keyAuthority,

        heuristicConfidence:
          confidence,

        getDataContract:
          "UNVERIFIED",

        verificationMethod:
          null,

        candidates:
          candidates.slice(
            0,
            10,
          ),
      },

      tables: tables.map(
        table => ({
          name:
            table.name ??
            null,

          dbname:
            table.dbname ??
            null,

          caption:
            table.caption ??
            null,

          filltype:
            table.filltype ??
            null,

          fieldCount:
            table.fields?.length ??
            0,
        }),
      ),

      relations: {
        inboundCount:
          inboundRelations.length,

        outboundCount:
          outboundRelations.length,

        inboundTypes:
          Array.from(
            new Set(
              inboundRelations.map(
                relation =>
                  relation.relationType,
              ),
            ),
          ),

        outboundTypes:
          Array.from(
            new Set(
              outboundRelations.map(
                relation =>
                  relation.relationType,
              ),
            ),
          ),
      },

      provenance: {
        schema:
          "SCHEMA_CACHE",

        relations:
          "RELATIONS_CACHE",

        registry:
          registry
            ? "CANONICAL_REGISTRY"
            : null,

        live:
          null,
      },

      warnings,
    };
  }

  /*
   * Preserve the two contracts we have actually proven live.
   *
   * These are explicit evidence overrides, not heuristics.
   */
  const liveVerified: Record<
    string,
    {
      key: string;
      method: string;
    }
  > = {
    CUSTOMER: {
      key: "TRDR",
      method:
        "LIVE_GETDATA",
    },

    VAT: {
      key: "VAT",
      method:
        "LIVE_GETDATA",
    },
  };

  for (
    const [
      objectName,
      evidence,
    ] of Object.entries(
      liveVerified,
    )
  ) {
    const contract =
      contracts[
        objectName
      ] as any;

    if (!contract) {
      continue;
    }

    contract.keyContract
      .canonicalKey =
      evidence.key;

    contract.keyContract
      .authority =
      "LIVE_VERIFIED";

    contract.keyContract
      .getDataContract =
      "VERIFIED";

    contract.keyContract
      .verificationMethod =
      evidence.method;

    contract.provenance.live =
      "LIVE_TENANT_VERIFICATION";

    contract.warnings =
      contract.warnings.filter(
        (warning: string) =>
          warning !==
            "KEY_NOT_REGISTRY_VERIFIED" &&
          warning !==
            "KEY_UNRESOLVED",
      );
  }

  const output = {
    generatedAt:
      new Date().toISOString(),

    formatVersion: 1,

    policy: {
      canonicalReadMethod:
        "getData",

      browserMethodsCanonical:
        false,

      heuristicKeyIsExecutable:
        false,

      liveVerificationRequiredForGetDataContract:
        true,
    },

    statistics: {
      objectCount:
        Object.keys(
          contracts,
        ).length,
    },

    contracts,
  };

  const outputPath =
    "data/softone-object-contracts.json";

  writeFileSync(
    outputPath,
    JSON.stringify(
      output,
      null,
      2,
    ),
  );

  console.log(
    `Generated ${Object.keys(contracts).length} SoftOne object contracts.`,
  );

  console.log(
    `Output: ${outputPath}`,
  );
}

main();
