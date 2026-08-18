import {
  createHash,
} from "node:crypto";

import {
  isIP,
} from "node:net";

import {
  lookup,
} from "node:dns/promises";

import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  consumeFetchBudget,
  RESEARCH_EXECUTION_LIMITS,
} from "../research/execution-budget";


const INTERNAL_AI_RUN_ID_KEY =
  "__dgsmart.aiAccounting.runId";


const MAX_RESPONSE_BYTES =
  2 * 1024 * 1024;


function createSourceId(
  url: string,
): string {
  const digest =
    createHash(
      "sha256",
    )
      .update(
        url,
        "utf8",
      )
      .digest(
        "hex",
      )
      .slice(
        0,
        20,
      );

  return `web:${digest}`;
}


function isBlockedIpv4(
  address: string,
): boolean {
  if (isIP(address) !== 4) {
    return false;
  }

  const [
    a,
    b,
  ] =
    address
      .split(".")
      .map(
        Number,
      );

  // unspecified
  if (a === 0) {
    return true;
  }

  // RFC1918
  if (a === 10) {
    return true;
  }

  if (
    a === 172 &&
    b >= 16 &&
    b <= 31
  ) {
    return true;
  }

  if (
    a === 192 &&
    b === 168
  ) {
    return true;
  }

  // loopback
  if (a === 127) {
    return true;
  }

  // link-local
  if (
    a === 169 &&
    b === 254
  ) {
    return true;
  }

  // carrier-grade NAT
  if (
    a === 100 &&
    b >= 64 &&
    b <= 127
  ) {
    return true;
  }

  // multicast/reserved
  if (a >= 224) {
    return true;
  }

  return false;
}


function isBlockedIpv6(
  address: string,
): boolean {
  if (isIP(address) !== 6) {
    return false;
  }

  const normalized =
    address
      .toLowerCase();

  if (
    normalized === "::" ||
    normalized === "::1"
  ) {
    return true;
  }

  // IPv4-mapped IPv6
  if (
    normalized.startsWith(
      "::ffff:",
    )
  ) {
    const ipv4 =
      normalized.slice(
        "::ffff:".length,
      );

    return (
      isIP(ipv4) === 4 &&
      isBlockedIpv4(
        ipv4,
      )
    );
  }

  // Unique local addresses fc00::/7
  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }

  // Link-local fe80::/10
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  // Multicast ff00::/8
  if (
    normalized.startsWith("ff")
  ) {
    return true;
  }

  return false;
}


function isBlockedIp(
  address: string,
): boolean {
  return (
    isBlockedIpv4(
      address,
    ) ||
    isBlockedIpv6(
      address,
    )
  );
}


function parseAndValidateUrl(
  rawUrl: string,
): URL {
  let url: URL;

  try {
    url =
      new URL(
        rawUrl,
      );
  } catch {
    throw new Error(
      "Invalid URL",
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Only http and https URLs are allowed",
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      "Credential-bearing URLs are not allowed",
    );
  }

  const hostname =
    url.hostname
      .toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(
      ".localhost",
    )
  ) {
    throw new Error(
      "Localhost URLs are not allowed",
    );
  }

  if (
    isIP(hostname) &&
    isBlockedIp(
      hostname,
    )
  ) {
    throw new Error(
      "Private, local or reserved IP URLs are not allowed",
    );
  }

  return url;
}


async function assertPublicUrl(
  rawUrl: string,
): Promise<URL> {
  const url =
    parseAndValidateUrl(
      rawUrl,
    );

  const hostname =
    url.hostname;

  /*
   * Literal public IPs need no DNS lookup.
   */
  if (isIP(hostname)) {
    return url;
  }

  const addresses =
    await lookup(
      hostname,
      {
        all:
          true,

        verbatim:
          true,
      },
    );

  if (addresses.length === 0) {
    throw new Error(
      "URL hostname did not resolve",
    );
  }

  for (
    const entry
    of addresses
  ) {
    if (
      isBlockedIp(
        entry.address,
      )
    ) {
      throw new Error(
        `URL hostname resolves to a private, local or reserved address`,
      );
    }
  }

  return url;
}


const MAX_REDIRECTS =
  5;


async function fetchPublicUrl(
  initialUrl: URL,
  timeoutMs: number,
): Promise<Response> {
  let currentUrl =
    initialUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    /*
     * Revalidate every redirect target before requesting it.
     */
    currentUrl =
      await assertPublicUrl(
        currentUrl.toString(),
      );

    const response =
      await fetch(
        currentUrl,
        {
          method:
            "GET",

          redirect:
            "manual",

          headers: {
            "User-Agent":
              "MastraResearchAgent/1.0",

            Accept:
              "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
          },

          signal:
            AbortSignal.timeout(
              timeoutMs,
            ),
        },
      );

    if (
      response.status < 300 ||
      response.status >= 400
    ) {
      return response;
    }

    const location =
      response.headers.get(
        "location",
      );

    if (!location) {
      return response;
    }

    if (
      redirectCount >=
      MAX_REDIRECTS
    ) {
      throw new Error(
        `URL fetch exceeded ${MAX_REDIRECTS} redirects`,
      );
    }

    currentUrl =
      new URL(
        location,
        currentUrl,
      );
  }

  throw new Error(
    "URL redirect handling failed",
  );
}


function decodeHtmlEntities(
  text: string,
): string {
  return text
    .replace(
      /&nbsp;/gi,
      " ",
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    );
}


function htmlToText(
  html: string,
): string {
  return decodeHtmlEntities(
    html
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " ",
      )
      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " ",
      )
      .replace(
        /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
        " ",
      )
      .replace(
        /<!--[\s\S]*?-->/g,
        " ",
      )
      .replace(
        /<br\s*\/?>/gi,
        "\n",
      )
      .replace(
        /<\/p>/gi,
        "\n",
      )
      .replace(
        /<\/div>/gi,
        "\n",
      )
      .replace(
        /<\/li>/gi,
        "\n",
      )
      .replace(
        /<[^>]+>/g,
        " ",
      ),
  )
    .replace(
      /\r/g,
      "",
    )
    .replace(
      /[ \t]+/g,
      " ",
    )
    .replace(
      /\n[ \t]+/g,
      "\n",
    )
    .replace(
      /\n{3,}/g,
      "\n\n",
    )
    .trim();
}


function extractTitle(
  html: string,
): string | null {
  const match =
    html.match(
      /<title\b[^>]*>([\s\S]*?)<\/title>/i,
    );

  if (!match) {
    return null;
  }

  return decodeHtmlEntities(
    match[1],
  )
    .replace(
      /\s+/g,
      " ",
    )
    .trim() ||
    null;
}


export const researchFetchUrl =
  createTool({
    id:
      "research-fetch-url",

    description: `
Fetches one public HTTP/HTTPS URL for read-only research.

Use this after web search when the linked page itself needs to be
inspected.

Security restrictions:

- public HTTP/HTTPS only;
- localhost is blocked;
- private/local/reserved IPv4 and IPv6 destinations are blocked;
- DNS hostnames resolving to blocked addresses are rejected;
- every redirect target is validated before it is fetched;
- URLs containing credentials are blocked;
- response size is limited;
- no cookies or authentication credentials are supplied;
- this tool performs no writes.

Evidence rules:

- content returned by this tool may support VERIFIED findings;
- preserve the returned sourceId and final URL;
- do not claim content that was not present in the fetched page.
`.trim(),

    inputSchema:
      z
        .object({
          url:
            z
              .string()
              .url(),

          timeoutMs:
            z
              .number()
              .int()
              .min(1000)
              .max(60000)
              .optional()
              .default(
                20000,
              ),

          maxCharacters:
            z
              .number()
              .int()
              .min(1000)
              .max(
                RESEARCH_EXECUTION_LIMITS
                  .fetchMaxCharacters,
              )
              .optional()
              .default(
                RESEARCH_EXECUTION_LIMITS
                  .fetchMaxCharacters,
              ),
        })
        .strict(),

    execute:
      async (
        {
          url:
            rawUrl,
          timeoutMs,
          maxCharacters,
        },
        context,
      ) => {
        const internalRunIdValue =
          context.requestContext?.get(
            INTERNAL_AI_RUN_ID_KEY,
          );

        const internalRunId =
          typeof internalRunIdValue ===
            "string" &&
          internalRunIdValue.trim()
            ? internalRunIdValue.trim()
            : undefined;

        if (!internalRunId) {
          throw new Error(
            "researchFetchUrl requires internal AI runId in runtime requestContext",
          );
        }

        consumeFetchBudget(
          internalRunId,
        );

        const url =
          await assertPublicUrl(
            rawUrl,
          );

        const response =
          await fetchPublicUrl(
            url,
            timeoutMs,
          );

        if (!response.ok) {
          throw new Error(
            `URL fetch failed status=${response.status} statusText=${response.statusText}`,
          );
        }

        const contentType =
          response.headers
            .get(
              "content-type",
            )
            ?.toLowerCase() ??
          "";

        const allowed =
          contentType.includes(
            "text/html",
          ) ||
          contentType.includes(
            "application/xhtml+xml",
          ) ||
          contentType.includes(
            "text/plain",
          );

        if (!allowed) {
          throw new Error(
            `Unsupported content-type: ${contentType || "unknown"}`,
          );
        }

        const reader =
          response.body
            ?.getReader();

        if (!reader) {
          throw new Error(
            "Response body is unavailable",
          );
        }

        const chunks:
          Uint8Array[] = [];

        let totalBytes =
          0;

        while (true) {
          const {
            done,
            value,
          } =
            await reader.read();

          if (done) {
            break;
          }

          if (!value) {
            continue;
          }

          totalBytes +=
            value.byteLength;

          if (
            totalBytes >
            MAX_RESPONSE_BYTES
          ) {
            await reader.cancel();

            throw new Error(
              `Response exceeds ${MAX_RESPONSE_BYTES} byte limit`,
            );
          }

          chunks.push(
            value,
          );
        }

        const merged =
          new Uint8Array(
            totalBytes,
          );

        let offset =
          0;

        for (
          const chunk
          of chunks
        ) {
          merged.set(
            chunk,
            offset,
          );

          offset +=
            chunk.byteLength;
        }

        const body =
          new TextDecoder(
            "utf-8",
            {
              fatal:
                false,
            },
          )
            .decode(
              merged,
            );

        const finalUrl =
          response.url ||
          url.toString();

        const isHtml =
          contentType.includes(
            "html",
          );

        const title =
          isHtml
            ? extractTitle(
                body,
              )
            : null;

        const text =
          (
            isHtml
              ? htmlToText(
                  body,
                )
              : body.trim()
          )
            .slice(
              0,
              maxCharacters,
            );

        return {
          sourceId:
            createSourceId(
              finalUrl,
            ),

          requestedUrl:
            url.toString(),

          finalUrl,

          title,

          contentType,

          text,

          truncated:
            (
              isHtml
                ? htmlToText(
                    body,
                  ).length
                : body.trim().length
            ) >
            maxCharacters,

          bytes:
            totalBytes,
        };
      },
  });
