import type {
  SoftOneAccessPolicy,
} from "./developer-work-order-types";

import type {
  ProjectDefinitionPackage,
  ProjectIntegrationRequirement,
} from "./project-definition-types";


export const SOFTONE_CAPABILITY = {
  WEB_SERVICES_READ:
    "WEB_SERVICES_READ",

  WEB_SERVICES_UPSERT:
    "WEB_SERVICES_UPSERT",

  SQL_SCRIPT_GENERATION:
    "SQL_SCRIPT_GENERATION",

  ADVANCED_JAVASCRIPT_GENERATION:
    "ADVANCED_JAVASCRIPT_GENERATION",
} as const;


export type SoftOneCapability =
  typeof SOFTONE_CAPABILITY[
    keyof typeof SOFTONE_CAPABILITY
  ];


function normalizeProviderCode(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      "",
    );
}


function isSoftOneRequirement(
  requirement:
    ProjectIntegrationRequirement,
): boolean {
  const provider =
    normalizeProviderCode(
      requirement.providerCode,
    );

  return (
    provider === "SOFTONE" ||
    provider === "SOFT1"
  );
}


function hasCapability(
  requirements:
    ProjectIntegrationRequirement[],

  capability:
    SoftOneCapability,
): boolean {
  return requirements.some(
    requirement =>
      requirement.requiredCapabilities.some(
        declared =>
          declared.trim() ===
          capability,
      ),
  );
}


export function deriveSoftOneAccessPolicy(
  definition:
    ProjectDefinitionPackage,
): SoftOneAccessPolicy {
  const softOneRequirements =
    definition.integrationRequirements.filter(
      isSoftOneRequirement,
    );

  return {
    transport:
      "WEB_SERVICES_ONLY",

    directDatabaseAccess:
      "UNAVAILABLE",

    dataExplorerExecution:
      "ADMIN_MANUAL_ONLY",

    webServicesReadAllowed:
      hasCapability(
        softOneRequirements,
        SOFTONE_CAPABILITY
          .WEB_SERVICES_READ,
      ),

    webServicesUpsertAllowed:
      hasCapability(
        softOneRequirements,
        SOFTONE_CAPABILITY
          .WEB_SERVICES_UPSERT,
      ),

    sqlScriptGenerationAllowed:
      hasCapability(
        softOneRequirements,
        SOFTONE_CAPABILITY
          .SQL_SCRIPT_GENERATION,
      ),

    sqlScriptInstallation:
      "ADMIN_MANUAL_ONLY",

    sqlScriptInvocation:
      "WEB_SERVICES_ONLY",

    advancedJavaScriptGenerationAllowed:
      hasCapability(
        softOneRequirements,
        SOFTONE_CAPABILITY
          .ADVANCED_JAVASCRIPT_GENERATION,
      ),

    advancedJavaScriptInstallation:
      "ADMIN_MANUAL_ONLY",

    advancedJavaScriptInvocation:
      "WEB_SERVICES_ONLY",
  };
}
