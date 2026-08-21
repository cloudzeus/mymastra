import type {
  SoftOneDecodedScript,
} from "./advanced-javascript-decoder";

import {
  findSoftOneAppendixByCode,
} from "./blackbook-appendix-registry";

import {
  findSoftOneBlackBookSystemEntry,
} from "./blackbook-system-registry";


export interface SoftOneSemanticExplanation {
  summary: string;

  runtime: string[];

  dataAccess: Array<{
    mode: string;
    operation?: string;
    tables?: string[];
    explanation: string;
  }>;

  semantics: Array<{
    construct: string;
    meaning: string;
  }>;

  integrations: Array<{
    type: string;
    target: string;
    explanation: string;
  }>;

  commands: Array<{
    command: string;
    explanation: string;
  }>;

  cautions: string[];
}


function explainSystemParameter(
  parameter: string,
): string | undefined {
  return findSoftOneBlackBookSystemEntry(
    "X.SYS",
    parameter,
  )[0]?.description;
}


function explainRegistry(
  registry:
    "SODTYPE" | "SOSOURCE",
  code: string,
): string | undefined {
  return findSoftOneAppendixByCode(
    registry,
    code,
  )[0]?.label;
}


function humanSurface(
  value: string,
): string {
  switch (
    value
  ) {
    case "ADVANCED_JAVASCRIPT":
      return "Advanced JavaScript μέσα στο SoftOne";

    case "FORM_SCRIPT":
      return "Form Script μέσα στο SoftOne";

    case "DATABASE_SQL":
      return "άμεση εκτέλεση SQL στη βάση";

    case "SOFTONE_WEB_SERVICE_RUNTIME":
      return "SoftOne Web Services runtime";

    case "SQL_SCRIPT":
      return "S1 SQL Script";

    case "CUSTOM_WEB_SERVICE":
      return "custom Web Service μέσω Advanced JavaScript";

    case "OBJECT_RUNTIME":
      return "SoftOne Object Layer";

    case "SBSL":
      return "SoftOne SBSL";

    default:
      return value;
  }
}


export function explainSoftOneDecodedScript(
  decoded:
    SoftOneDecodedScript,
): SoftOneSemanticExplanation {
  const semantics:
    SoftOneSemanticExplanation[
      "semantics"
    ] = [];


  for (
    const parameter
    of decoded.systemParameters
  ) {
    const description =
      explainSystemParameter(
        parameter,
      );


    if (
      description
    ) {
      semantics.push({
        construct:
          `X.SYS.${parameter}`,

        meaning:
          description,
      });
    }
  }


  for (
    const value
    of decoded.semanticValues
  ) {
    const meaning =
      value.meaning ??
      explainRegistry(
        value.registry,
        value.code,
      );


    if (
      meaning
    ) {
      semantics.push({
        construct:
          `${value.registry}=${value.code}`,

        meaning,
      });
    }
  }


  const dataAccess =
    decoded.sql.map(
      query => {
        const tables =
          query.tables;


        const explanation =
          query.operation ===
            "SELECT"
            ? `Διαβάζει δεδομένα απευθείας με SQL${tables.length ? ` από ${tables.join(", ")}` : ""}.`
            : `${query.operation} μέσω άμεσου SQL${tables.length ? ` σε ${tables.join(", ")}` : ""}.`;


        return {
          mode:
            query.source,

          operation:
            query.operation,

          tables,

          explanation,
        };
      },
    );


  const integrations:
    SoftOneSemanticExplanation[
      "integrations"
    ] = [];


  for (
    const service
    of decoded.webServices
  ) {
    if (
      service.service
    ) {
      integrations.push({
        type:
          "SOFTONE_WEB_SERVICE",

        target:
          service.service,

        explanation:
          service.service.toLowerCase() ===
            "sqldata"
            ? service.sqlName
              ? `Καλεί SqlData και εκτελεί το S1 SQL Script '${service.sqlName}'.`
              : "Καλεί το SoftOne SqlData service."
            : `Καλεί built-in SoftOne Web Service '${service.service}'.`,
      });
    }


    if (
      service.customUri
    ) {
      integrations.push({
        type:
          "CUSTOM_WEB_SERVICE",

        target:
          service.customUri,

        explanation:
          "Καλεί custom Web Service που υλοποιείται μέσω Advanced JavaScript.",
      });
    }
  }


  const commands =
    decoded.constructs
      .filter(
        construct =>
          construct.type ===
            "COMMAND",
      )
      .map(
        construct => ({
          command:
            construct.value,

          explanation:
            construct.value
              .toUpperCase()
              .startsWith(
                "XCMD:CUSTOMER",
              )
              ? "Εκτελεί command πάνω στο CUSTOMER object."
              : "Εκτελεί SoftOne command.",
        }),
      );


  const semanticParts:
    string[] = [];


  const customerSemantic =
    decoded.semanticValues.find(
      value =>
        value.registry ===
          "SODTYPE" &&
        value.code ===
          "13",
    );


  if (
    customerSemantic &&
    decoded.tables.includes(
      "TRDR",
    )
  ) {
    semanticParts.push(
      "διαβάζει Customer trader records από τον φυσικό πίνακα TRDR",
    );
  }


  if (
    decoded.systemParameters.includes(
      "COMPANY",
    )
  ) {
    semanticParts.push(
      "στο context της εταιρείας με την οποία έχει γίνει login",
    );
  }


  let summary =
    `Το script εκτελείται ως ${humanSurface(decoded.hostSurface)}.`;


  if (
    semanticParts.length >
    0
  ) {
    summary +=
      ` Συγκεκριμένα ${semanticParts.join(" ")}.`;
  }


  if (
    decoded.webServices.some(
      value =>
        value.service?.toLowerCase() ===
          "sqldata",
    )
  ) {
    summary +=
      " Παράλληλα χρησιμοποιεί SoftOne Web Services μέσω SqlData.";
  }


  if (
    decoded.webServices.some(
      value =>
        Boolean(
          value.customUri,
        ),
    )
  ) {
    summary +=
      " Επίσης καλεί custom Advanced JavaScript Web Service.";
  }


  const cautions =
    [
      ...decoded.warnings,
    ];


  if (
    decoded.sql.some(
      query =>
        query.operation !==
        "SELECT",
    )
  ) {
    cautions.push(
      "Υπάρχει direct SQL μεταβολή δεδομένων. Δεν πρέπει να θεωρηθεί ισοδύναμη με write μέσω SoftOne Object Layer.",
    );
  }


  return {
    summary,

    runtime:
      decoded.executionChain.map(
        humanSurface,
      ),

    dataAccess,

    semantics,

    integrations,

    commands,

    cautions:
      [
        ...new Set(
          cautions,
        ),
      ],
  };
}
