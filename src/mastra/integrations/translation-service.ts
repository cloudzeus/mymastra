import crypto from "node:crypto";

import {
  appDb,
} from "../db/postgres";

import type {
  DeepSeekAdapter,
} from "./adapters/deepseek";


export type TranslationProfile =
  | "GENERAL"
  | "ECOMMERCE"
  | "ERP"
  | "LOGISTICS"
  | "HOSPITALITY"
  | "LEGAL";


export type TranslateInput = {
  tenantId?: string;

  text: string;

  sourceLanguage: string;

  targetLanguage: string;

  profile?:
    TranslationProfile;

  glossaryVersion?:
    number;
};


export type TranslateResult = {
  translatedText: string;

  source:
    | "TENANT_CACHE"
    | "GLOBAL_CACHE"
    | "DEEPSEEK";

  providerCode:
    "ai.deepseek";

  model: string;

  cacheKey: string;
};


type TranslationCacheRow = {
  translated_text: string;
  provider_code: string;
  model: string;
};


function normalizeText(
  text: string,
): string {
  return text
    .normalize("NFC")
    .trim()
    .replace(
      /\s+/g,
      " ",
    );
}


function buildSourceHash(
  text: string,
): string {
  return crypto
    .createHash("sha256")
    .update(
      normalizeText(
        text,
      ),
    )
    .digest("hex");
}


function buildCacheKey(
  input: {
    tenantId?: string;
    sourceHash: string;
    sourceLanguage: string;
    targetLanguage: string;
    profile: TranslationProfile;
    glossaryVersion: number;
    providerCode: string;
    model: string;
  },
): string {
  return [
    input.tenantId ?? "GLOBAL",
    input.sourceHash,
    input.sourceLanguage,
    input.targetLanguage,
    input.profile,
    input.glossaryVersion,
    input.providerCode,
    input.model,
  ].join("|");
}


async function findCachedTranslation(
  options: {
    tenantId?: string;
    sourceHash: string;
    sourceLanguage: string;
    targetLanguage: string;
    profile: TranslationProfile;
    glossaryVersion: number;
    providerCode: string;
    model: string;
  },
): Promise<
  | {
      source:
        | "TENANT_CACHE"
        | "GLOBAL_CACHE";

      row:
        TranslationCacheRow;
    }
  | undefined
> {
  if (
    options.tenantId
  ) {
    const tenantResult =
      await appDb.query<
        TranslationCacheRow
      >(
        `
        SELECT
          translated_text,
          provider_code,
          model
        FROM app.translation_cache
        WHERE tenant_id = $1
          AND source_hash = $2
          AND source_language = $3
          AND target_language = $4
          AND profile = $5
          AND glossary_version = $6
          AND provider_code = $7
          AND model = $8
        LIMIT 1
        `,
        [
          options.tenantId,
          options.sourceHash,
          options.sourceLanguage,
          options.targetLanguage,
          options.profile,
          options.glossaryVersion,
          options.providerCode,
          options.model,
        ],
      );


    if (
      tenantResult.rowCount === 1
    ) {
      return {
        source:
          "TENANT_CACHE",

        row:
          tenantResult.rows[0],
      };
    }
  }


  const globalResult =
    await appDb.query<
      TranslationCacheRow
    >(
      `
      SELECT
        translated_text,
        provider_code,
        model
      FROM app.translation_cache
      WHERE tenant_id IS NULL
        AND source_hash = $1
        AND source_language = $2
        AND target_language = $3
        AND profile = $4
        AND glossary_version = $5
        AND provider_code = $6
        AND model = $7
      LIMIT 1
      `,
      [
        options.sourceHash,
        options.sourceLanguage,
        options.targetLanguage,
        options.profile,
        options.glossaryVersion,
        options.providerCode,
        options.model,
      ],
    );


  if (
    globalResult.rowCount ===
    1
  ) {
    return {
      source:
        "GLOBAL_CACHE",

      row:
        globalResult.rows[0],
    };
  }


  return undefined;
}


async function touchCacheHit(
  options: {
    tenantId?: string;
    sourceHash: string;
    sourceLanguage: string;
    targetLanguage: string;
    profile: TranslationProfile;
    glossaryVersion: number;
    providerCode: string;
    model: string;
  },
): Promise<void> {
  await appDb.query(
    `
    UPDATE app.translation_cache
    SET
      hit_count =
        hit_count + 1,

      last_used_at =
        now()

    WHERE
      (
        tenant_id = $1
        OR (
          tenant_id IS NULL
          AND $1::uuid IS NULL
        )
      )
      AND source_hash = $2
      AND source_language = $3
      AND target_language = $4
      AND profile = $5
      AND glossary_version = $6
      AND provider_code = $7
      AND model = $8
    `,
    [
      options.tenantId ??
        null,

      options.sourceHash,
      options.sourceLanguage,
      options.targetLanguage,
      options.profile,
      options.glossaryVersion,
      options.providerCode,
      options.model,
    ],
  );
}


async function storeTranslation(
  options: {
    tenantId?: string;
    sourceHash: string;
    sourceText: string;
    sourceLanguage: string;
    targetLanguage: string;
    profile: TranslationProfile;
    glossaryVersion: number;
    translatedText: string;
    providerCode: string;
    model: string;
  },
): Promise<void> {
  await appDb.query(
    `
    INSERT INTO app.translation_cache (
      tenant_id,
      source_hash,
      source_text,
      source_language,
      target_language,
      profile,
      glossary_version,
      translated_text,
      provider_code,
      model
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10
    )
    ON CONFLICT DO NOTHING
    `,
    [
      options.tenantId ??
        null,

      options.sourceHash,
      options.sourceText,
      options.sourceLanguage,
      options.targetLanguage,
      options.profile,
      options.glossaryVersion,
      options.translatedText,
      options.providerCode,
      options.model,
    ],
  );
}



type TranslationGlossaryEntry = {
  source_term: string;
  target_term: string;
  case_sensitive: boolean;
};


async function resolveEffectiveGlossary(
  options: {
    tenantId?: string;
    sourceLanguage: string;
    targetLanguage: string;
    profile: TranslationProfile;
    version: number;
  },
): Promise<TranslationGlossaryEntry[]> {
  const globalResult =
    await appDb.query<
      TranslationGlossaryEntry
    >(
      `
      SELECT
        source_term,
        target_term,
        case_sensitive
      FROM app.translation_glossary
      WHERE tenant_id IS NULL
        AND source_language = $1
        AND target_language = $2
        AND profile = $3
        AND version = $4
        AND is_active = true
      ORDER BY source_term
      `,
      [
        options.sourceLanguage,
        options.targetLanguage,
        options.profile,
        options.version,
      ],
    );


  const entries =
    new Map<
      string,
      TranslationGlossaryEntry
    >();


  for (
    const row of
      globalResult.rows
  ) {
    const key =
      row.case_sensitive
        ? `CS:${row.source_term}`
        : `CI:${row.source_term.toLocaleLowerCase()}`;

    entries.set(
      key,
      row,
    );
  }


  if (
    options.tenantId
  ) {
    const tenantResult =
      await appDb.query<
        TranslationGlossaryEntry
      >(
        `
        SELECT
          source_term,
          target_term,
          case_sensitive
        FROM app.translation_glossary
        WHERE tenant_id = $1
          AND source_language = $2
          AND target_language = $3
          AND profile = $4
          AND version = $5
          AND is_active = true
        ORDER BY source_term
        `,
        [
          options.tenantId,
          options.sourceLanguage,
          options.targetLanguage,
          options.profile,
          options.version,
        ],
      );


    for (
      const row of
        tenantResult.rows
    ) {
      const key =
        row.case_sensitive
          ? `CS:${row.source_term}`
          : `CI:${row.source_term.toLocaleLowerCase()}`;

      entries.set(
        key,
        row,
      );
    }
  }


  return [
    ...entries.values(),
  ];
}


function buildGlossaryPromptSection(
  entries:
    TranslationGlossaryEntry[],
): string {
  if (
    entries.length ===
    0
  ) {
    return "";
  }


  return [
    "Required terminology:",
    ...entries.map(
      entry =>
        `"${entry.source_term}" => "${entry.target_term}"`,
    ),
    "",
  ].join("\n");
}


function buildTranslationPrompt(
  input:
    TranslateInput,
  glossary:
    TranslationGlossaryEntry[],
): string {
  return [
    "Translate the following text accurately.",
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    `Profile: ${input.profile ?? "GENERAL"}`,
    "",
    buildGlossaryPromptSection(
      glossary,
    ),
    "Return only the translated text.",
    "",
    normalizeText(
      input.text,
    ),
  ]
    .filter(
      part =>
        part !== "",
    )
    .join("\n");
}


export async function translateWithCache(
  options: {
    input:
      TranslateInput;

    adapter:
      DeepSeekAdapter;

    model: string;
  },
): Promise<TranslateResult> {
  const {
    input,
    adapter,
    model,
  } =
    options;


  const normalizedText =
    normalizeText(
      input.text,
    );


  if (!normalizedText) {
    throw new Error(
      "Translation text is required",
    );
  }


  if (
    input.sourceLanguage ===
    input.targetLanguage
  ) {
    throw new Error(
      "Translation source and target languages must differ",
    );
  }


  const profile =
    input.profile ??
    "GENERAL";


  const glossaryVersion =
    input.glossaryVersion ??
    1;


  const sourceHash =
    buildSourceHash(
      normalizedText,
    );


  const providerCode =
    "ai.deepseek" as const;


  const cacheOptions = {
    tenantId:
      input.tenantId,

    sourceHash,

    sourceLanguage:
      input.sourceLanguage,

    targetLanguage:
      input.targetLanguage,

    profile,

    glossaryVersion,

    providerCode,

    model,
  };


  const cached =
    await findCachedTranslation(
      cacheOptions,
    );


  if (cached) {
    await touchCacheHit({
      ...cacheOptions,

      tenantId:
        cached.source ===
          "TENANT_CACHE"
          ? input.tenantId
          : undefined,
    });


    return {
      translatedText:
        cached.row
          .translated_text,

      source:
        cached.source,

      providerCode,

      model:
        cached.row.model,

      cacheKey:
        buildCacheKey({
          ...cacheOptions,

          tenantId:
            cached.source ===
              "TENANT_CACHE"
              ? input.tenantId
              : undefined,
        }),
    };
  }


  const glossary =
    await resolveEffectiveGlossary({
      tenantId:
        input.tenantId,

      sourceLanguage:
        input.sourceLanguage,

      targetLanguage:
        input.targetLanguage,

      profile,

      version:
        glossaryVersion,
    });


  const result =
    await adapter.chat({
      model,

      messages: [
        {
          role:
            "system",

          content:
            "You are a professional translation engine. Preserve meaning, terminology, formatting and product/ERP semantics. Return only the translation.",
        },
        {
          role:
            "user",

          content:
            buildTranslationPrompt(
              input,
              glossary,
            ),
        },
      ],

      temperature:
        0,
    });


  const translatedText =
    result.text.trim();


  if (!translatedText) {
    throw new Error(
      "DeepSeek returned an empty translation",
    );
  }


  await storeTranslation({
    tenantId:
      input.tenantId,

    sourceHash,

    sourceText:
      normalizedText,

    sourceLanguage:
      input.sourceLanguage,

    targetLanguage:
      input.targetLanguage,

    profile,

    glossaryVersion,

    translatedText,

    providerCode,

    model:
      result.model,
  });


  return {
    translatedText,

    source:
      "DEEPSEEK",

    providerCode,

    model:
      result.model,

    cacheKey:
      buildCacheKey({
        tenantId:
          input.tenantId,

        sourceHash,

        sourceLanguage:
          input.sourceLanguage,

        targetLanguage:
          input.targetLanguage,

        profile,

        glossaryVersion,

        providerCode,

        model:
          result.model,
      }),
  };
}
