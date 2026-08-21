export type SoftOneQualifiedConstructKind =
  | "X.SYS"
  | "SODTYPE"
  | "SOSOURCE"
  | "ORIGIN"
  | "CSTTYPE"
  | "ACMD"
  | "XCO"
  | "PARAMS.CFG"
  | "OBJECT_PARAMETER"
  | "COMMAND_SWITCH"
  | "RUNTIME_FUNCTION"
  | "WEB_SERVICE"
  | "SQL_SCRIPT"
  | "CUSTOM_WEB_SERVICE"
  | "OBJECT"
  | "TABLE"
  | "FIELD";


export interface SoftOneQualifiedConstruct {
  kind:
    SoftOneQualifiedConstructKind;

  scope?: string;

  key: string;

  canonical: string;
}


function norm(
  value: string,
): string {
  return value
    .trim();
}


export function qualifySoftOneConstruct(
  kind:
    SoftOneQualifiedConstructKind,
  key: string,
  scope?: string,
): SoftOneQualifiedConstruct {
  const cleanKey =
    norm(
      key,
    );

  const cleanScope =
    scope
      ? norm(
          scope,
        )
      : undefined;


  let canonical:
    string;


  switch (
    kind
  ) {
    case "X.SYS":
      canonical =
        `X.SYS:${cleanKey.toUpperCase()}`;
      break;

    case "SODTYPE":
    case "SOSOURCE":
    case "ORIGIN":
    case "CSTTYPE":
      canonical =
        `${kind}:${cleanKey}`;
      break;

    case "ACMD":
      canonical =
        `ACMD:${cleanKey}`;
      break;

    case "XCO":
      canonical =
        `XCO.${cleanScope ?? "UNKNOWN"}:${cleanKey.toUpperCase()}`;
      break;

    case "PARAMS.CFG":
      canonical =
        `PARAMS.CFG.${cleanScope ?? "UNKNOWN"}:${cleanKey.toUpperCase()}`;
      break;

    case "OBJECT_PARAMETER":
      canonical =
        `OBJECT_PARAMETER.${cleanScope ?? "UNKNOWN"}:${cleanKey.toUpperCase()}`;
      break;

    case "COMMAND_SWITCH":
      canonical =
        `COMMAND_SWITCH:${cleanKey}`;
      break;

    case "RUNTIME_FUNCTION":
      canonical =
        `RUNTIME_FUNCTION:${cleanKey}`;
      break;

    case "WEB_SERVICE":
      canonical =
        `WEB_SERVICE:${cleanKey}`;
      break;

    case "SQL_SCRIPT":
      canonical =
        `SQL_SCRIPT:${cleanKey}`;
      break;

    case "CUSTOM_WEB_SERVICE":
      canonical =
        `CUSTOM_WEB_SERVICE:${cleanKey}`;
      break;

    case "OBJECT":
      canonical =
        `OBJECT:${cleanKey.toUpperCase()}`;
      break;

    case "TABLE":
      canonical =
        `TABLE:${cleanKey.toUpperCase()}`;
      break;

    case "FIELD":
      canonical =
        `FIELD:${cleanKey.toUpperCase()}`;
      break;

    default: {
      const neverKind:
        never =
        kind;

      throw new Error(
        `Unsupported construct kind: ${neverKind}`,
      );
    }
  }


  return {
    kind,

    scope:
      cleanScope,

    key:
      cleanKey,

    canonical,
  };
}
