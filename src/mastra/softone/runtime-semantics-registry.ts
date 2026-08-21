import type {
  SoftOneRuntimeSemantic,
} from "./execution-context-types";


export const SOFTONE_RUNTIME_SEMANTICS:
  readonly SoftOneRuntimeSemantic[] = [
  {
    key:
      "X.SYS",

    category:
      "SYSTEM_PARAMETER",

    compatibility: [
      {
        surface:
          "ADVANCED_JAVASCRIPT",

        support:
          "SUPPORTED",

        usage:
          "X.SYS.<NAME> or :X.SYS.<NAME> depending on expression context",

        evidence: [
          "BLACKBOOK_3_5_XSYS",
          "BLACKBOOK_ADVANCED_JS_GETSQLDATASET",
        ],
      },

      {
        surface:
          "FORM_SCRIPT",

        support:
          "SUPPORTED",

        usage:
          "X.SYS.<NAME> / :X.SYS.<NAME>",
      },

      {
        surface:
          "SBSL",

        support:
          "SUPPORTED",

        usage:
          ":X.SYS.<NAME>",
      },

      {
        surface:
          "EDA",

        support:
          "SUPPORTED",

        usage:
          ":X.SYS.<NAME>",
      },

      {
        surface:
          "BROWSER_REPORT_SQL",

        support:
          "SUPPORTED",

        usage:
          ":X.SYS.<NAME>",
      },

      {
        surface:
          "DATABASE_SQL",

        support:
          "SUPPORTED",

        usage:
          "Used from SoftOne-hosted SQL expressions such as X.SQL and X.GETSQLDATASET.",
      },

      {
        surface:
          "EXTERNAL_WEB_SERVICE_CLIENT",

        support:
          "NOT_APPLICABLE",

        notes: [
          "External WS callers do not send :X.SYS.* as a Web Services request property.",
          "Equivalent session/company context is established through Web Services authentication/request parameters.",
        ],
      },

      {
        surface:
          "SQL_SCRIPT",

        support:
          "UNVERIFIED",

        notes: [
          "Do not assume all S1 SQL Script execution contexts resolve :X.SYS.* until explicitly verified.",
        ],
      },
    ],
  },


  {
    key:
      "X.GETSQLDATASET",

    category:
      "SQL_FUNCTION",

    compatibility: [
      {
        surface:
          "ADVANCED_JAVASCRIPT",

        support:
          "SUPPORTED",

        usage:
          "X.GETSQLDATASET(sql, ...params)",
      },

      {
        surface:
          "FORM_SCRIPT",

        support:
          "SUPPORTED",

        usage:
          "X.GETSQLDATASET(sql, ...params)",
      },

      {
        surface:
          "DATABASE_SQL",

        support:
          "INDIRECT",

        notes: [
          "The function executes database SQL from the SoftOne script runtime and returns a Dataset.",
        ],
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
  },


  {
    key:
      "X.SQL",

    category:
      "SQL_FUNCTION",

    compatibility: [
      {
        surface:
          "ADVANCED_JAVASCRIPT",

        support:
          "SUPPORTED",

        usage:
          "X.SQL(sql, ...params)",
      },

      {
        surface:
          "FORM_SCRIPT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "DATABASE_SQL",

        support:
          "INDIRECT",

        notes: [
          "Executes direct SQL and returns a single-row comma-separated result.",
        ],
      },

      {
        surface:
          "EXTERNAL_WEB_SERVICE_CLIENT",

        support:
          "NOT_APPLICABLE",
      },
    ],
  },


  {
    key:
      "X.WEBREQUEST",

    category:
      "WEB_SERVICE",

    compatibility: [
      {
        surface:
          "ADVANCED_JAVASCRIPT",

        support:
          "SUPPORTED",

        usage:
          "Calls built-in SoftOne Web Services from inside the SoftOne runtime.",
      },

      {
        surface:
          "FORM_SCRIPT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "EXTERNAL_WEB_SERVICE_CLIENT",

        support:
          "NOT_APPLICABLE",

        notes: [
          "External integrations call the Web Services endpoint directly; they do not invoke X.WEBREQUEST.",
        ],
      },
    ],
  },


  {
    key:
      "X.WSCALL",

    category:
      "WEB_SERVICE",

    compatibility: [
      {
        surface:
          "ADVANCED_JAVASCRIPT",

        support:
          "SUPPORTED",

        usage:
          "Calls built-in or custom SoftOne Web Services.",
      },

      {
        surface:
          "CUSTOM_WEB_SERVICE",

        support:
          "INDIRECT",

        notes: [
          "Custom Advanced JavaScript Web Services can be invoked through their /s1services/JS/... URI.",
        ],
      },

      {
        surface:
          "EXTERNAL_WEB_SERVICE_CLIENT",

        support:
          "INDIRECT",

        notes: [
          "External callers invoke the custom Web Service URI directly rather than calling X.WSCALL itself.",
        ],
      },
    ],
  },


  {
    key:
      "SqlData",

    category:
      "WEB_SERVICE",

    compatibility: [
      {
        surface:
          "EXTERNAL_WEB_SERVICE_CLIENT",

        support:
          "SUPPORTED",

        usage:
          "External clients invoke SqlData through the SoftOne Web Services endpoint.",
      },

      {
        surface:
          "SOFTONE_WEB_SERVICE_RUNTIME",

        support:
          "SUPPORTED",

        usage:
          "service=SqlData, SqlName=<configured S1 SQL Script>, plus documented parameters.",
      },

      {
        surface:
          "ADVANCED_JAVASCRIPT",

        support:
          "SUPPORTED",

        usage:
          "Can be called internally through X.WEBREQUEST.",
      },

      {
        surface:
          "SQL_SCRIPT",

        support:
          "INDIRECT",

        notes: [
          "SqlData executes a configured S1 SQL Script identified by SqlName.",
        ],
      },
    ],
  },


  {
    key:
      "SODTYPE",

    category:
      "DOMAIN_VALUE",

    compatibility: [
      {
        surface:
          "EXTERNAL_WEB_SERVICE_CLIENT",

        support:
          "SUPPORTED",

        notes: [
          "May appear as object/table data, filters or values; semantic meanings come from the canonical SODTYPE registry.",
        ],
      },

      {
        surface:
          "ADVANCED_JAVASCRIPT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "FORM_SCRIPT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "SQL_SCRIPT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "DATABASE_SQL",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "BROWSER_REPORT_SQL",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "SBSL",

        support:
          "SUPPORTED",
      },
    ],
  },


  {
    key:
      "SOSOURCE",

    category:
      "MODULE_VALUE",

    compatibility: [
      {
        surface:
          "EXTERNAL_WEB_SERVICE_CLIENT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "ADVANCED_JAVASCRIPT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "FORM_SCRIPT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "SQL_SCRIPT",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "DATABASE_SQL",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "BROWSER_REPORT_SQL",

        support:
          "SUPPORTED",
      },

      {
        surface:
          "SBSL",

        support:
          "SUPPORTED",
      },
    ],
  },
];


export function getSoftOneRuntimeSemantic(
  key: string,
): SoftOneRuntimeSemantic | undefined {
  const normalized =
    key
      .trim()
      .toUpperCase();


  return SOFTONE_RUNTIME_SEMANTICS.find(
    entry =>
      entry.key
        .toUpperCase() ===
      normalized,
  );
}
