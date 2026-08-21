import type {
  SoftOneExecutionSurface,
  SoftOneExecutionSupport,
} from "./execution-context-types";

import {
  getSoftOneRuntimeSemantic,
} from "./runtime-semantics-registry";

import {
  SOFTONE_BLACKBOOK_APPENDIX_ENTRIES,
} from "./blackbook-appendix-registry";

import {
  SOFTONE_BLACKBOOK_SYSTEM_ENTRIES,
} from "./blackbook-system-registry";


export interface SoftOneConstructCompatibilityResult {
  construct: string;

  category:
    | "RUNTIME_SEMANTIC"
    | "APPENDIX_VALUE"
    | "SYSTEM_REGISTRY"
    | "UNKNOWN";

  description?: string;

  compatibility: Array<{
    surface:
      SoftOneExecutionSurface;

    support:
      SoftOneExecutionSupport;

    usage?: string;

    notes?: string[];
  }>;

  authoritative:
    boolean;
}


function normalized(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
}


function allDataSurfaces() {
  return [
    {
      surface:
        "ADVANCED_JAVASCRIPT" as const,

      support:
        "SUPPORTED" as const,

      usage:
        "May be referenced as a SoftOne data field/value from script or SQL executed by the script.",
    },

    {
      surface:
        "FORM_SCRIPT" as const,

      support:
        "SUPPORTED" as const,
    },

    {
      surface:
        "SQL_SCRIPT" as const,

      support:
        "SUPPORTED" as const,

      usage:
        "May be used as a database field/value inside the configured SQL statement.",
    },

    {
      surface:
        "DATABASE_SQL" as const,

      support:
        "SUPPORTED" as const,
    },

    {
      surface:
        "BROWSER_REPORT_SQL" as const,

      support:
        "SUPPORTED" as const,
    },

    {
      surface:
        "SBSL" as const,

      support:
        "SUPPORTED" as const,
    },

    {
      surface:
        "EXTERNAL_WEB_SERVICE_CLIENT" as const,

      support:
        "INDIRECT" as const,

      notes: [
        "This is data/object semantics, not a Web Service method.",
        "It may appear in payloads, filters, returned fields or SQL exposed through SqlData.",
      ],
    },

    {
      surface:
        "SOFTONE_WEB_SERVICE_RUNTIME" as const,

      support:
        "INDIRECT" as const,
    },
  ];
}


export function resolveSoftOneConstructCompatibility(
  construct: string,
): SoftOneConstructCompatibilityResult {
  const key =
    normalized(
      construct,
    );


  /*
   * Qualified construct addressing.
   */


  const qualifiedXsys =
    construct.match(
      /^X\.SYS:([A-Z0-9_]+)$/i,
    );


  if (
    qualifiedXsys
  ) {
    const name =
      qualifiedXsys[1].toUpperCase();


    const entry =
      SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
        candidate =>
          candidate.registry ===
            "X.SYS" &&
          normalized(
            candidate.key,
          ) ===
            name,
      );


    const runtime =
      getSoftOneRuntimeSemantic(
        "X.SYS",
      );


    if (
      entry
    ) {
      return {
        construct,

        category:
          "SYSTEM_REGISTRY",

        description:
          entry.description,

        compatibility:
          runtime?.compatibility ??
          [],

        authoritative:
          true,
      };
    }
  }


  const qualifiedAppendix =
    construct.match(
      /^(SODTYPE|SOSOURCE|ORIGIN|CSTTYPE):(.+)$/i,
    );


  if (
    qualifiedAppendix
  ) {
    const registry =
      qualifiedAppendix[1].toUpperCase();

    const code =
      qualifiedAppendix[2].trim();


    const entry =
      SOFTONE_BLACKBOOK_APPENDIX_ENTRIES.find(
        candidate =>
          candidate.registry ===
            registry &&
          normalized(
            candidate.code,
          ) ===
            normalized(
              code,
            ),
      );


    if (
      entry
    ) {
      return {
        construct,

        category:
          "APPENDIX_VALUE",

        description:
          entry.label,

        compatibility:
          allDataSurfaces(),

        authoritative:
          true,
      };
    }
  }


  const qualifiedXco =
    construct.match(
      /^XCO\.([^:]+):(.+)$/i,
    );


  if (
    qualifiedXco
  ) {
    const scope =
      qualifiedXco[1];

    const name =
      qualifiedXco[2];


    const entry =
      SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
        candidate =>
          candidate.registry ===
            "XCO" &&
          normalized(
            candidate.scope ??
            "",
          ) ===
            normalized(
              scope,
            ) &&
          normalized(
            candidate.key,
          ) ===
            normalized(
              name,
            ),
      );


    if (
      entry
    ) {
      return {
        construct,

        category:
          "SYSTEM_REGISTRY",

        description:
          entry.description,

        authoritative:
          true,

        compatibility: [
          {
            surface:
              "CONFIGURATION",

            support:
              "SUPPORTED",

            usage:
              entry.example,
          },
        ],
      };
    }
  }


  const qualifiedParams =
    construct.match(
      /^PARAMS\.CFG\.([^:]+):(.+)$/i,
    );


  if (
    qualifiedParams
  ) {
    const scope =
      qualifiedParams[1];

    const name =
      qualifiedParams[2];


    const entry =
      SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
        candidate =>
          candidate.registry ===
            "PARAMS.CFG" &&
          normalized(
            candidate.scope ??
            "",
          ) ===
            normalized(
              scope,
            ) &&
          normalized(
            candidate.key,
          ) ===
            normalized(
              name,
            ),
      );


    if (
      entry
    ) {
      return {
        construct,

        category:
          "SYSTEM_REGISTRY",

        description:
          entry.description,

        authoritative:
          true,

        compatibility: [
          {
            surface:
              "CONFIGURATION",

            support:
              "SUPPORTED",

            usage:
              entry.example,
          },
        ],
      };
    }
  }


  const qualifiedObjectParameter =
    construct.match(
      /^OBJECT_PARAMETER\.([^:]+):(.+)$/i,
    );


  if (
    qualifiedObjectParameter
  ) {
    const scope =
      qualifiedObjectParameter[1];

    const name =
      qualifiedObjectParameter[2];


    const entry =
      SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
        candidate =>
          candidate.registry ===
            "OBJECT_PARAMETER" &&
          normalized(
            candidate.scope ??
            "",
          ) ===
            normalized(
              scope,
            ) &&
          normalized(
            candidate.key,
          ) ===
            normalized(
              name,
            ),
      );


    if (
      entry
    ) {
      return {
        construct,

        category:
          "SYSTEM_REGISTRY",

        description:
          entry.description,

        authoritative:
          true,

        compatibility: [
          {
            surface:
              "OBJECT_RUNTIME",

            support:
              "SUPPORTED",

            usage:
              `${entry.scope}: ${entry.key}`,
          },

          {
            surface:
              "ADVANCED_JAVASCRIPT",

            support:
              "SUPPORTED",

            usage:
              "X.SETPARAM(...) or object.SETPARAM(...)",
          },

          {
            surface:
              "FORM_SCRIPT",

            support:
              "SUPPORTED",

            usage:
              "X.SETPARAM(...) or object.SETPARAM(...)",
          },
        ],
      };
    }
  }


  const qualifiedSwitch =
    construct.match(
      /^COMMAND_SWITCH:(.+)$/i,
    );


  if (
    qualifiedSwitch
  ) {
    const name =
      qualifiedSwitch[1];


    const entry =
      SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
        candidate =>
          candidate.registry ===
            "COMMAND_SWITCH" &&
          normalized(
            candidate.key,
          ) ===
            normalized(
              name,
            ),
      );


    if (
      entry
    ) {
      return {
        construct,

        category:
          "SYSTEM_REGISTRY",

        description:
          entry.description,

        authoritative:
          true,

        compatibility: [
          {
            surface:
              "CONFIGURATION",

            support:
              "SUPPORTED",

            usage:
              entry.example,
          },
        ],
      };
    }
  }


  /*
   * Explicit runtime semantics have highest priority.
   */
  const runtime =
    getSoftOneRuntimeSemantic(
      construct,
    );


  if (
    runtime
  ) {
    return {
      construct,

      category:
        "RUNTIME_SEMANTIC",

      compatibility:
        runtime.compatibility,

      authoritative:
        true,
    };
  }


  /*
   * Handle X.SYS.NAME as a member of X.SYS.
   */
  if (
    key.startsWith(
      "X.SYS.",
    )
  ) {
    const name =
      key.slice(
        "X.SYS.".length,
      );


    const exists =
      SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.some(
        entry =>
          entry.registry ===
            "X.SYS" &&
          normalized(
            entry.key,
          ) ===
            name,
      );


    if (
      exists
    ) {
      const base =
        getSoftOneRuntimeSemantic(
          "X.SYS",
        );


      return {
        construct,

        category:
          "SYSTEM_REGISTRY",

        description:
          SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
            entry =>
              entry.registry ===
                "X.SYS" &&
              normalized(
                entry.key,
              ) ===
                name,
          )?.description,

        compatibility:
          base?.compatibility ??
          [],

        authoritative:
          true,
      };
    }
  }


  /*
   * SODTYPE / SOSOURCE / ORIGIN / CSTTYPE canonical values.
   *
   * They are data semantics, not executable APIs.
   */
  const registryValue =
    key.match(
      /^(SODTYPE|SOSOURCE|ORIGIN|CSTTYPE)\s*=\s*(.+)$/,
    );


  if (
    registryValue
  ) {
    const registry =
      registryValue[1];

    const code =
      registryValue[2];


    const entry =
      SOFTONE_BLACKBOOK_APPENDIX_ENTRIES.find(
        candidate =>
          candidate.registry ===
            registry &&
          normalized(
            candidate.code,
          ) ===
            normalized(
              code,
            ),
      );


    if (
      entry
    ) {
      return {
        construct,

        category:
          "APPENDIX_VALUE",

        description:
          entry.label,

        compatibility:
          allDataSurfaces(),

        authoritative:
          true,
      };
    }
  }


  /*
   * ACMD internal commands.
   */
  if (
    key.startsWith(
      "ACMD:",
    )
  ) {
    const command =
      construct
        .slice(
          construct.indexOf(
            ":",
          ) + 1,
        )
        .trim();


    const entry =
      SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
        candidate =>
          candidate.registry ===
            "ACMD" &&
          normalized(
            candidate.key,
          ) ===
            normalized(
              command,
            ),
      );


    if (
      entry
    ) {
      return {
        construct,

        category:
          "SYSTEM_REGISTRY",

        description:
          entry.description,

        authoritative:
          true,

        compatibility: [
          {
            surface:
              "OBJECT_RUNTIME",

            support:
              "SUPPORTED",

            usage:
              `ACMD:${entry.key}`,
          },

          {
            surface:
              "ADVANCED_JAVASCRIPT",

            support:
              "INDIRECT",

            usage:
              `X.EXEC("ACMD:${entry.key}")`,
          },

          {
            surface:
              "FORM_SCRIPT",

            support:
              "INDIRECT",

            usage:
              `X.EXEC("ACMD:${entry.key}")`,
          },

          {
            surface:
              "EXTERNAL_WEB_SERVICE_CLIENT",

            support:
              "NOT_APPLICABLE",
          },

          {
            surface:
              "SQL_SCRIPT",

            support:
              "NOT_APPLICABLE",
          },
        ],
      };
    }
  }


  /*
   * XCO configuration.
   */
  const xco =
    SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
      entry =>
        entry.registry ===
          "XCO" &&
        normalized(
          entry.key,
        ) ===
          key,
    );


  if (
    xco
  ) {
    return {
      construct,

      category:
        "SYSTEM_REGISTRY",

      description:
        xco.description,

      authoritative:
        true,

      compatibility: [
        {
          surface:
            "CONFIGURATION",

          support:
            "SUPPORTED",

          usage:
            xco.example,
        },

        {
          surface:
            "ADVANCED_JAVASCRIPT",

          support:
            "NOT_APPLICABLE",
        },

        {
          surface:
            "SQL_SCRIPT",

          support:
            "NOT_APPLICABLE",
        },

        {
          surface:
            "EXTERNAL_WEB_SERVICE_CLIENT",

          support:
            "NOT_APPLICABLE",
        },
      ],
    };
  }


  /*
   * PARAMS.CFG configuration.
   */
  const params =
    SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
      entry =>
        entry.registry ===
          "PARAMS.CFG" &&
        normalized(
          entry.key,
        ) ===
          key,
    );


  if (
    params
  ) {
    return {
      construct,

      category:
        "SYSTEM_REGISTRY",

      description:
        params.description,

      authoritative:
        true,

      compatibility: [
        {
          surface:
            "CONFIGURATION",

          support:
            "SUPPORTED",

          usage:
            params.example,
        },

        {
          surface:
            "ADVANCED_JAVASCRIPT",

          support:
            "NOT_APPLICABLE",
        },

        {
          surface:
            "SQL_SCRIPT",

          support:
            "NOT_APPLICABLE",
        },

        {
          surface:
            "EXTERNAL_WEB_SERVICE_CLIENT",

          support:
            "NOT_APPLICABLE",
        },
      ],
    };
  }


  /*
   * Internal Object Parameters.
   */
  const objectParameter =
    SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
      entry =>
        entry.registry ===
          "OBJECT_PARAMETER" &&
        normalized(
          entry.key,
        ) ===
          key,
    );


  if (
    objectParameter
  ) {
    return {
      construct,

      category:
        "SYSTEM_REGISTRY",

      description:
        objectParameter.description,

      authoritative:
        true,

      compatibility: [
        {
          surface:
            "OBJECT_RUNTIME",

          support:
            "SUPPORTED",

          usage:
            `${objectParameter.scope}: ${objectParameter.key}`,
        },

        {
          surface:
            "ADVANCED_JAVASCRIPT",

          support:
            "SUPPORTED",

          usage:
            `X.SETPARAM(...) or object.SETPARAM(...)`,
        },

        {
          surface:
            "FORM_SCRIPT",

          support:
            "SUPPORTED",

          usage:
            `X.SETPARAM(...) or object.SETPARAM(...)`,
        },

        {
          surface:
            "EXTERNAL_WEB_SERVICE_CLIENT",

          support:
            "NOT_APPLICABLE",
        },

        {
          surface:
            "SQL_SCRIPT",

          support:
            "NOT_APPLICABLE",
        },
      ],
    };
  }


  /*
   * Command-line switches are configuration only.
   */
  const commandSwitch =
    SOFTONE_BLACKBOOK_SYSTEM_ENTRIES.find(
      entry =>
        entry.registry ===
          "COMMAND_SWITCH" &&
        normalized(
          entry.key,
        ) ===
          key,
    );


  if (
    commandSwitch
  ) {
    return {
      construct,

      category:
        "SYSTEM_REGISTRY",

      description:
        commandSwitch.description,

      authoritative:
        true,

      compatibility: [
        {
          surface:
            "CONFIGURATION",

          support:
            "SUPPORTED",

          usage:
            commandSwitch.example,
        },

        {
          surface:
            "ADVANCED_JAVASCRIPT",

          support:
            "NOT_APPLICABLE",
        },

        {
          surface:
            "SQL_SCRIPT",

          support:
            "NOT_APPLICABLE",
        },

        {
          surface:
            "EXTERNAL_WEB_SERVICE_CLIENT",

          support:
            "NOT_APPLICABLE",
        },
      ],
    };
  }


  return {
    construct,

    category:
      "UNKNOWN",

    compatibility:
      [],

    authoritative:
      false,
  };
}
