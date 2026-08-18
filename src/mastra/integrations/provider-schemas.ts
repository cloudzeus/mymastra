import {
  z,
} from "zod";


export type ProviderConnectionSchema = {
  configSchema:
    z.ZodType<
      Record<string, unknown>
    >;

  secretSchema:
    z.ZodType<
      Record<string, unknown>
    >;
};


/*
 * ============================================================
 * Tavily Search
 *
 * Verified official API:
 * - base URL: https://api.tavily.com
 * - POST /search performs web search
 * - Authorization uses Bearer API key
 * - /extract may later be used for page extraction
 *
 * API key is tenant-secret material.
 * ============================================================
 */

const tavilyConfigSchema =
  z
    .object({
      baseUrl:
        z
          .string()
          .url()
          .default(
            "https://api.tavily.com",
          ),

      defaultSearchDepth:
        z
          .enum([
            "basic",
            "advanced",
            "fast",
            "ultra-fast",
          ])
          .default(
            "basic",
          ),

      defaultTopic:
        z
          .enum([
            "general",
            "news",
            "finance",
          ])
          .default(
            "general",
          ),

      defaultCountry:
        z
          .string()
          .min(2)
          .optional(),

      pricePerCredit:
        z
          .number()
          .nonnegative()
          .optional(),

      currency:
        z
          .string()
          .regex(/^[A-Z]{3}$/)
          .optional()
          .default(
            "USD",
          ),
    })
    .strict();


const tavilySecretSchema =
  z
    .object({
      apiKey:
        z
          .string()
          .min(1),
    })
    .strict();


/*
 * ============================================================
 * MapTiler
 *
 * Verified:
 * - public Maps/Search/Geocoding APIs use an API key
 * - geocoding supports forward + reverse lookup
 *
 * API key is treated as a tenant secret even when a protected
 * browser key may later be intentionally exposed client-side.
 * ============================================================
 */

const mapTilerConfigSchema =
  z
    .object({
      defaultLanguage:
        z
          .string()
          .min(2)
          .optional(),

      defaultCountry:
        z
          .string()
          .length(2)
          .optional(),
    })
    .strict();


const mapTilerSecretSchema =
  z
    .object({
      apiKey:
        z
          .string()
          .min(1),
    })
    .strict();


/*
 * ============================================================
 * Bunny Storage
 *
 * Verified:
 * - storageZoneName is part of every Storage API object path
 * - endpoint is region-dependent
 * - AccessKey uses the Storage Zone password
 *
 * CDN hostname is optional application configuration and is not
 * authentication material.
 * ============================================================
 */

const bunnyConfigSchema =
  z
    .object({
      storageZoneName:
        z
          .string()
          .min(1),

      storageEndpoint:
        z
          .string()
          .url(),

      cdnHostname:
        z
          .string()
          .min(1)
          .optional(),
    })
    .strict();


const bunnySecretSchema =
  z
    .object({
      accessKey:
        z
          .string()
          .min(1),
    })
    .strict();


/*
 * ============================================================
 * Mailgun
 *
 * Verified:
 * - send endpoint is scoped by domain_name
 * - Mailgun supports US and EU API endpoints
 * - API authentication credentials remain secret
 * ============================================================
 */

const mailgunConfigSchema =
  z
    .object({
      domain:
        z
          .string()
          .min(1),

      region:
        z
          .enum([
            "US",
            "EU",
          ])
          .default(
            "US",
          ),

      defaultFrom:
        z
          .string()
          .min(1)
          .optional(),
    })
    .strict();


const mailgunSecretSchema =
  z
    .object({
      apiKey:
        z
          .string()
          .min(1),
    })
    .strict();


/*
 * ============================================================
 * Claid
 *
 * Verified:
 * - API uses Bearer API key
 * - image editing operations require image_editing permission
 * - API base URL is https://api.claid.ai/v1/
 *
 * We do not store operation-specific image settings here; those
 * belong to runtime request contracts.
 * ============================================================
 */

const claidConfigSchema =
  z
    .object({
      baseUrl:
        z
          .string()
          .url()
          .default(
            "https://api.claid.ai/v1/",
          ),
    })
    .strict();


const claidSecretSchema =
  z
    .object({
      apiKey:
        z
          .string()
          .min(1),
    })
    .strict();



/*
 * ============================================================
 * DeepSeek
 *
 * Verified official API:
 * - OpenAI-compatible base URL: https://api.deepseek.com
 * - current model IDs:
 *     deepseek-v4-flash
 *     deepseek-v4-pro
 * - API authentication uses Bearer API key
 *
 * Model selection is tenant connection configuration.
 * Translation policy will normally use deepseek-v4-flash unless
 * the tenant explicitly configures another supported model.
 * ============================================================
 */

const deepSeekConfigSchema =
  z
    .object({
      baseUrl:
        z
          .string()
          .url()
          .default(
            "https://api.deepseek.com",
          ),

      defaultModel:
        z
          .enum([
            "deepseek-v4-flash",
            "deepseek-v4-pro",
          ])
          .default(
            "deepseek-v4-flash",
          ),
    })
    .strict();


const deepSeekSecretSchema =
  z
    .object({
      apiKey:
        z
          .string()
          .min(1),
    })
    .strict();


export const providerConnectionSchemas:
  Record<
    string,
    ProviderConnectionSchema
  > =
{
  "research.tavily": {
    configSchema:
      tavilyConfigSchema,

    secretSchema:
      tavilySecretSchema,
  },

  "ai.deepseek": {
    configSchema:
      deepSeekConfigSchema,

    secretSchema:
      deepSeekSecretSchema,
  },

  "geodata.maptiler": {
    configSchema:
      mapTilerConfigSchema,

    secretSchema:
      mapTilerSecretSchema,
  },

  "storage.bunny": {
    configSchema:
      bunnyConfigSchema,

    secretSchema:
      bunnySecretSchema,
  },

  "email.mailgun": {
    configSchema:
      mailgunConfigSchema,

    secretSchema:
      mailgunSecretSchema,
  },

  "image.claid": {
    configSchema:
      claidConfigSchema,

    secretSchema:
      claidSecretSchema,
  },
};


export function getProviderConnectionSchema(
  providerCode: string,
): ProviderConnectionSchema | undefined {
  return providerConnectionSchemas[
    providerCode
  ];
}


export function validateProviderConnectionInput(
  providerCode: string,
  config:
    Record<string, unknown>,
  secrets:
    Record<string, unknown>,
): {
  config:
    Record<string, unknown>;

  secrets:
    Record<string, unknown>;
} {
  const schema =
    getProviderConnectionSchema(
      providerCode,
    );


  if (!schema) {
    throw new Error(
      `Provider connection schema not registered: ${providerCode}`,
    );
  }


  return {
    config:
      schema.configSchema.parse(
        config,
      ),

    secrets:
      schema.secretSchema.parse(
        secrets,
      ),
  };
}
