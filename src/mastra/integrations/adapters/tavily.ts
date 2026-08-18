import type {
  IntegrationEnvironment,
} from "../types";

import {
  resolveTenantIntegrationConnection,
} from "../connection-provider";


export type TavilySearchDepth =
  | "basic"
  | "advanced"
  | "fast"
  | "ultra-fast";


export type TavilyTopic =
  | "general"
  | "news"
  | "finance";


export type TavilySearchResult = {
  title: string;

  url: string;

  content: string;

  score:
    number | null;

  rawContent?:
    string | null;
};


export type TavilySearchResponse = {
  query: string;

  answer?:
    string | null;

  results:
    TavilySearchResult[];

  responseTime?:
    number | null;

  requestId?:
    string | null;

  usageCredits?:
    number | null;

  pricePerCredit?:
    number | null;

  currency?:
    string | null;
};


export type TavilySearchInput = {
  tenantId: string;

  environment?:
    IntegrationEnvironment;

  connectionId?:
    string;

  query: string;

  searchDepth?:
    TavilySearchDepth;

  topic?:
    TavilyTopic;

  country?:
    string;

  maxResults?:
    number;

  includeAnswer?:
    boolean;

  includeRawContent?:
    boolean;

  timeoutMs?:
    number;
};


type TavilyConnectionConfig = {
  baseUrl: string;

  defaultSearchDepth:
    TavilySearchDepth;

  defaultTopic:
    TavilyTopic;

  defaultCountry?:
    string;

  pricePerCredit?:
    number;

  currency:
    string;
};


type TavilyConnectionSecrets = {
  apiKey: string;
};


function asObject(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as
      Record<string, unknown>;
  }

  return {};
}


function asString(
  value: unknown,
): string | undefined {
  return typeof value === "string"
    ? value
    : undefined;
}


function asFiniteNumber(
  value: unknown,
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}


function normalizeBaseUrl(
  value: string,
): string {
  return value.replace(
    /\/+$/,
    "",
  );
}


function resolveConfig(
  config:
    Record<string, unknown>,
): TavilyConnectionConfig {
  const baseUrl =
    asString(
      config.baseUrl,
    ) ??
    "https://api.tavily.com";

  const defaultSearchDepthRaw =
    asString(
      config.defaultSearchDepth,
    );

  const defaultSearchDepth:
    TavilySearchDepth =
      (
        defaultSearchDepthRaw ===
          "advanced" ||
        defaultSearchDepthRaw ===
          "fast" ||
        defaultSearchDepthRaw ===
          "ultra-fast"
      )
        ? defaultSearchDepthRaw
        : "basic";

  const defaultTopicRaw =
    asString(
      config.defaultTopic,
    );

  const defaultTopic:
    TavilyTopic =
      (
        defaultTopicRaw ===
          "news" ||
        defaultTopicRaw ===
          "finance"
      )
        ? defaultTopicRaw
        : "general";

  return {
    baseUrl:
      normalizeBaseUrl(
        baseUrl,
      ),

    defaultSearchDepth,

    defaultTopic,

    defaultCountry:
      asString(
        config.defaultCountry,
      ),

    pricePerCredit:
      asFiniteNumber(
        config.pricePerCredit,
      ) ??
      undefined,

    currency:
      asString(
        config.currency,
      ) ??
      "USD",
  };
}


function resolveSecrets(
  secrets:
    Record<string, unknown>,
): TavilyConnectionSecrets {
  const apiKey =
    asString(
      secrets.apiKey,
    );

  if (!apiKey?.trim()) {
    throw new Error(
      "Tavily integration connection is missing apiKey",
    );
  }

  return {
    apiKey:
      apiKey.trim(),
  };
}


function normalizeSearchResult(
  value: unknown,
): TavilySearchResult | null {
  const item =
    asObject(
      value,
    );

  const title =
    asString(
      item.title,
    );

  const url =
    asString(
      item.url,
    );

  const content =
    asString(
      item.content,
    );

  if (
    !title ||
    !url ||
    content ===
      undefined
  ) {
    return null;
  }

  return {
    title,

    url,

    content,

    score:
      asFiniteNumber(
        item.score,
      ),

    rawContent:
      asString(
        item.raw_content,
      ) ??
      null,
  };
}


export async function tavilySearch(
  input:
    TavilySearchInput,
): Promise<TavilySearchResponse> {
  if (!input.tenantId?.trim()) {
    throw new Error(
      "Tavily search tenantId is required",
    );
  }

  if (!input.query?.trim()) {
    throw new Error(
      "Tavily search query is required",
    );
  }

  const environment =
    input.environment ??
    "PRODUCTION";

  const connection =
    await resolveTenantIntegrationConnection({
      tenantId:
        input.tenantId,

      providerCode:
        "research.tavily",

      environment,

      connectionId:
        input.connectionId,
    });

  const config =
    resolveConfig(
      connection.config,
    );

  const secrets =
    resolveSecrets(
      connection.secrets,
    );

  const searchDepth =
    input.searchDepth ??
    config.defaultSearchDepth;

  const topic =
    input.topic ??
    config.defaultTopic;

  const country =
    input.country ??
    config.defaultCountry;

  const maxResults =
    Math.min(
      Math.max(
        input.maxResults ??
          10,
        1,
      ),
      20,
    );

  const payload: Record<
    string,
    unknown
  > = {
    query:
      input.query.trim(),

    search_depth:
      searchDepth,

    topic,

    max_results:
      maxResults,

    include_answer:
      input.includeAnswer ??
      false,

    include_raw_content:
      input.includeRawContent ??
      false,

    include_usage:
      true,
  };

  if (
    country?.trim()
  ) {
    payload.country =
      country.trim();
  }

  const timeoutMs =
    Math.min(
      Math.max(
        input.timeoutMs ??
          20000,
        1000,
      ),
      60000,
    );

  const response =
    await fetch(
      `${config.baseUrl}/search`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${secrets.apiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload,
          ),

        signal:
          AbortSignal.timeout(
            timeoutMs,
          ),
      },
    );

  if (!response.ok) {
    const responseBody =
      await response
        .text()
        .catch(
          () => "",
        );

    throw new Error(
      [
        "Tavily search failed",
        `status=${response.status}`,
        `statusText=${response.statusText}`,
        responseBody
          ? `body=${responseBody.slice(0, 1000)}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const body =
    asObject(
      await response.json(),
    );

  const rawResults =
    Array.isArray(
      body.results,
    )
      ? body.results
      : [];

  const results =
    rawResults
      .map(
        normalizeSearchResult,
      )
      .filter(
        (
          item,
        ): item is TavilySearchResult =>
          item !== null,
      );

  return {
    query:
      asString(
        body.query,
      ) ??
      input.query.trim(),

    answer:
      asString(
        body.answer,
      ) ??
      null,

    results,

    responseTime:
      asFiniteNumber(
        body.response_time,
      ),

    requestId:
      asString(
        body.request_id,
      ) ??
      null,

    usageCredits:
      asFiniteNumber(
        asObject(
          body.usage,
        ).credits,
      ),

    pricePerCredit:
      config.pricePerCredit ??
      null,

    currency:
      config.currency,
  };
}
