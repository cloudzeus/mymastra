import {
  createHash,
} from "node:crypto";

import {
  mkdirSync,
  writeFileSync,
} from "node:fs";

import {
  dirname,
  resolve,
} from "node:path";


export const SOFTONE_OFFICIAL_WS_SOURCE_ID =
  "OFFICIAL_SOFTONE_WS_DOCS";

export const SOFTONE_OFFICIAL_WS_URL =
  "https://www.softone.gr/ws/";


/*
 * Only actual documented Web Service methods.
 *
 * "Image" in the page navigation is an image asset
 * (/ws/images/new.jpg), not a Web Service method.
 */
export const SOFTONE_OFFICIAL_WS_EXPECTED_METHODS =
  [
    "login",
    "authenticate",
    "changePassword",

    "getObjects",
    "getObjectTables",
    "getTableFields",
    "getDialog",
    "getFormDesign",

    "getBrowserInfo",
    "getBrowserData",

    "getReportInfo",
    "getReportData",

    "getData",
    "setData",
    "calculate",
    "delData",

    "getSelectorData",
    "selectorFields",
    "SqlData",

    "eInvoice",
  ] as const;


export interface SoftOneOfficialWsSection {
  key: string;

  title: string;

  kind:
    | "METHOD"
    | "REFERENCE"
    | "ERROR_CODES";

  text: string;

  html: string;

  sourceUrl: string;
}


export interface SoftOneOfficialWsSnapshot {
  formatVersion: 2;

  source: {
    sourceId: string;

    title: string;

    url: string;

    authority:
      "OFFICIAL_DOCUMENTATION";
  };

  retrievedAt: string;

  sha256: string;

  expectedMethods: string[];

  discoveredMethods: string[];

  missingExpectedMethods: string[];

  hasErrorCodes: boolean;

  sections:
    SoftOneOfficialWsSection[];

  rawHtml: string;
}


function decodeHtml(
  value: string,
): string {
  return value
    .replace(
      /&nbsp;/gi,
      " ",
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#39;/gi,
      "'",
    );
}


function htmlToText(
  html: string,
): string {
  return decodeHtml(
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
        /<br\s*\/?>/gi,
        "\n",
      )
      .replace(
        /<\/(?:p|div|pre|li|tr|h1|h2|h3|h4)>/gi,
        "\n",
      )
      .replace(
        /<\/(?:td|th)>/gi,
        " | ",
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


function headingText(
  value: string,
): string {
  return htmlToText(
    value,
  )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


interface HeadingPosition {
  start: number;

  end: number;

  level:
    "h2"
    | "h3";

  title: string;
}


function findTopLevelHeadings(
  html: string,
): HeadingPosition[] {
  /*
   * Only H2/H3 delimit logical documentation
   * sections.
   *
   * H4 Request / Response headings remain INSIDE
   * their parent method section.
   */
  const regex =
    /<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/gi;


  const result:
    HeadingPosition[] = [];


  let match:
    RegExpExecArray | null;


  while (
    (
      match =
        regex.exec(
          html,
        )
    ) !== null
  ) {
    const title =
      headingText(
        match[2],
      );


    if (!title) {
      continue;
    }


    result.push({
      start:
        match.index,

      end:
        regex.lastIndex,

      level:
        match[1]
          .toLowerCase() as
          | "h2"
          | "h3",

      title,
    });
  }


  return result;
}


function findErrorCodesTable(
  html: string,
): {
  start: number;
  end: number;
  html: string;
} | null {
  /*
   * Error codes are documented as a table and are
   * not exposed as a normal method heading.
   *
   * Identify the table by multiple known documented
   * error codes rather than by page position.
   */
  const tableRegex =
    /<table\b[^>]*>[\s\S]*?<\/table>/gi;


  let match:
    RegExpExecArray | null;


  while (
    (
      match =
        tableRegex.exec(
          html,
        )
    ) !== null
  ) {
    const tableHtml =
      match[0];


    const text =
      htmlToText(
        tableHtml,
      );


    if (
      text.includes(
        "-103",
      ) &&
      text.includes(
        "-101",
      ) &&
      text.includes(
        "-100",
      ) &&
      /session has expired/i.test(
        text,
      )
    ) {
      return {
        start:
          match.index,

        end:
          tableRegex.lastIndex,

        html:
          tableHtml,
      };
    }
  }


  return null;
}


function normalizeMethodTitle(
  title: string,
): string {
  /*
   * Example:
   * getReportData (GET) -> getReportData
   */
  return title
    .replace(
      /\s+\([^)]*\)\s*$/,
      "",
    )
    .trim();
}


function extractSections(
  html: string,
): SoftOneOfficialWsSection[] {
  const headings =
    findTopLevelHeadings(
      html,
    );


  const errorCodes =
    findErrorCodesTable(
      html,
    );


  const sections:
    SoftOneOfficialWsSection[] = [];


  for (
    let index = 0;
    index < headings.length;
    index += 1
  ) {
    const current =
      headings[index];

    const next =
      headings[index + 1];


    let end =
      next?.start ??
      html.length;


    /*
     * The error-code table appears after the final
     * Web Service documentation. Do not accidentally
     * absorb it into eInvoice.
     */
    if (
      errorCodes &&
      errorCodes.start >
        current.end &&
      errorCodes.start <
        end
    ) {
      end =
        errorCodes.start;
    }


    const bodyHtml =
      html.slice(
        current.end,
        end,
      );


    const text =
      htmlToText(
        bodyHtml,
      );


    if (!text) {
      continue;
    }


    const normalizedTitle =
      normalizeMethodTitle(
        current.title,
      );


    const isExpectedMethod =
      SOFTONE_OFFICIAL_WS_EXPECTED_METHODS.some(
        method =>
          method.toLowerCase() ===
          normalizedTitle.toLowerCase(),
      );


    sections.push({
      key:
        normalizedTitle,

      title:
        normalizedTitle,

      kind:
        isExpectedMethod
          ? "METHOD"
          : "REFERENCE",

      text,

      html:
        bodyHtml,

      sourceUrl:
        SOFTONE_OFFICIAL_WS_URL,
    });
  }


  if (errorCodes) {
    sections.push({
      key:
        "Error codes",

      title:
        "Error codes",

      kind:
        "ERROR_CODES",

      text:
        htmlToText(
          errorCodes.html,
        ),

      html:
        errorCodes.html,

      sourceUrl:
        `${SOFTONE_OFFICIAL_WS_URL}#errors`,
    });
  }


  return sections;
}


export async function fetchSoftOneOfficialWsReference():
  Promise<SoftOneOfficialWsSnapshot> {
  const response =
    await fetch(
      SOFTONE_OFFICIAL_WS_URL,
      {
        headers: {
          "User-Agent":
            "mymastra-softone-knowledge/1.0",

          Accept:
            "text/html,application/xhtml+xml",
        },
      },
    );


  if (!response.ok) {
    throw new Error(
      [
        "Official SoftOne Web Services fetch failed:",
        String(
          response.status,
        ),
        response.statusText,
      ].join(
        " ",
      ),
    );
  }


  const html =
    await response.text();


  /*
   * Minimum fingerprint of the expected source.
   */
  if (
    !html.includes(
      "getObjects",
    ) ||
    !html.includes(
      "SqlData",
    ) ||
    !html.includes(
      "selectorFields",
    ) ||
    !html.includes(
      "authenticate",
    )
  ) {
    throw new Error(
      "Fetched content does not match the expected SoftOne Web Services reference.",
    );
  }


  const sections =
    extractSections(
      html,
    );


  const methodSections =
    sections.filter(
      section =>
        section.kind ===
        "METHOD",
    );


  const discoveredMethods =
    methodSections.map(
      section =>
        section.title,
    );


  const discoveredLower =
    new Set(
      discoveredMethods.map(
        method =>
          method.toLowerCase(),
      ),
    );


  const missingExpectedMethods =
    SOFTONE_OFFICIAL_WS_EXPECTED_METHODS.filter(
      method =>
        !discoveredLower.has(
          method.toLowerCase(),
        ),
    );


  const hasErrorCodes =
    sections.some(
      section =>
        section.kind ===
        "ERROR_CODES",
    );


  const sha256 =
    createHash(
      "sha256",
    )
      .update(
        html,
        "utf8",
      )
      .digest(
        "hex",
      );


  return {
    formatVersion:
      2,

    source: {
      sourceId:
        SOFTONE_OFFICIAL_WS_SOURCE_ID,

      title:
        "Soft1 Web Services Reference",

      url:
        SOFTONE_OFFICIAL_WS_URL,

      authority:
        "OFFICIAL_DOCUMENTATION",
    },

    retrievedAt:
      new Date()
        .toISOString(),

    sha256,

    expectedMethods:
      [
        ...SOFTONE_OFFICIAL_WS_EXPECTED_METHODS,
      ],

    discoveredMethods,

    missingExpectedMethods:
      [
        ...missingExpectedMethods,
      ],

    hasErrorCodes,

    sections,

    rawHtml:
      html,
  };
}


export function writeSoftOneOfficialWsSnapshot(
  snapshot:
    SoftOneOfficialWsSnapshot,
): string {
  const path =
    resolve(
      process.cwd(),
      "data",
      "softone-official",
      "web-services-reference.json",
    );


  mkdirSync(
    dirname(
      path,
    ),
    {
      recursive:
        true,
    },
  );


  writeFileSync(
    path,
    JSON.stringify(
      snapshot,
      null,
      2,
    ) + "\n",
    "utf8",
  );


  return path;
}
