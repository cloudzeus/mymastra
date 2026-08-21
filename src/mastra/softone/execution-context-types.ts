export type SoftOneExecutionSurface =
  | "EXTERNAL_WEB_SERVICE_CLIENT"
  | "SOFTONE_WEB_SERVICE_RUNTIME"
  | "CUSTOM_WEB_SERVICE"
  | "ADVANCED_JAVASCRIPT"
  | "FORM_SCRIPT"
  | "SQL_SCRIPT"
  | "DATABASE_SQL"
  | "BROWSER_REPORT_SQL"
  | "SBSL"
  | "EDA"
  | "OBJECT_RUNTIME"
  | "CONFIGURATION";


export type SoftOneExecutionSupport =
  | "SUPPORTED"
  | "INDIRECT"
  | "NOT_APPLICABLE"
  | "UNVERIFIED";


export interface SoftOneExecutionCompatibility {
  surface:
    SoftOneExecutionSurface;

  support:
    SoftOneExecutionSupport;

  usage?: string;

  evidence?: string[];

  notes?: string[];
}


export interface SoftOneRuntimeSemantic {
  key: string;

  category:
    | "SYSTEM_PARAMETER"
    | "DOMAIN_VALUE"
    | "MODULE_VALUE"
    | "FUNCTION"
    | "WEB_SERVICE"
    | "SQL_FUNCTION"
    | "OBJECT_PARAMETER"
    | "COMMAND"
    | "CONFIGURATION";

  compatibility:
    SoftOneExecutionCompatibility[];
}
