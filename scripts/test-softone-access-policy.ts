import {
  deriveSoftOneAccessPolicy,
  SOFTONE_CAPABILITY,
} from "../src/mastra/projects/softone-access-policy";

import type {
  ProjectDefinitionPackage,
} from "../src/mastra/projects/project-definition-types";


function createDefinition(
  providerCode: string,
  capabilities: string[],
): ProjectDefinitionPackage {
  const now =
    new Date()
      .toISOString();

  return {
    id:
      "project-definition-softone-policy-test",

    version:
      1,

    projectId:
      "project-softone-policy-test",

    tenantId:
      "tenant-softone-policy-test",

    tenantCode:
      "TEST",

    status:
      "READY",

    requirements:
      [],

    knowledgeReferences:
      [],

    structuredSqlPlans:
      [],

    integrationRequirements: [
      {
        id:
          "integration-softone-test",

        providerCode,

        /*
         * Environment is irrelevant to policy derivation.
         * Keep the existing ProjectDefinition contract value.
         */
        environment:
          "PRODUCTION" as never,

        purpose:
          "SoftOne policy contract test",

        requiredCapabilities:
          capabilities,

        requiredForDevelopment:
          true,

        bindingRequired:
          true,
      },
    ],

    unresolved:
      [],

    blockers:
      [],

    provenance:
      [],

    createdAt:
      now,

    updatedAt:
      now,
  };
}


/*
 * ---------------------------------------------------------
 * 1. No explicit capabilities -> FAIL CLOSED
 * ---------------------------------------------------------
 */

const none =
  deriveSoftOneAccessPolicy(
    createDefinition(
      "SOFTONE",
      [],
    ),
  );

if (
  none.transport !==
    "WEB_SERVICES_ONLY"
) {
  throw new Error(
    "SoftOne transport must always be WEB_SERVICES_ONLY",
  );
}

if (
  none.directDatabaseAccess !==
    "UNAVAILABLE"
) {
  throw new Error(
    "SoftOne direct database access must always be UNAVAILABLE",
  );
}

if (
  none.dataExplorerExecution !==
    "ADMIN_MANUAL_ONLY"
) {
  throw new Error(
    "SoftOne Data Explorer execution must be ADMIN_MANUAL_ONLY",
  );
}

if (
  none.webServicesReadAllowed ||
  none.webServicesUpsertAllowed ||
  none.sqlScriptGenerationAllowed ||
  none.advancedJavaScriptGenerationAllowed
) {
  throw new Error(
    "Undeclared SoftOne capabilities must fail closed",
  );
}


/*
 * ---------------------------------------------------------
 * 2. Explicit canonical capabilities -> GRANTED
 * ---------------------------------------------------------
 */

const all =
  deriveSoftOneAccessPolicy(
    createDefinition(
      "SOFTONE",
      [
        SOFTONE_CAPABILITY
          .WEB_SERVICES_READ,

        SOFTONE_CAPABILITY
          .WEB_SERVICES_UPSERT,

        SOFTONE_CAPABILITY
          .SQL_SCRIPT_GENERATION,

        SOFTONE_CAPABILITY
          .ADVANCED_JAVASCRIPT_GENERATION,
      ],
    ),
  );

if (
  !all.webServicesReadAllowed
) {
  throw new Error(
    "WEB_SERVICES_READ was not granted",
  );
}

if (
  !all.webServicesUpsertAllowed
) {
  throw new Error(
    "WEB_SERVICES_UPSERT was not granted",
  );
}

if (
  !all.sqlScriptGenerationAllowed
) {
  throw new Error(
    "SQL_SCRIPT_GENERATION was not granted",
  );
}

if (
  !all.advancedJavaScriptGenerationAllowed
) {
  throw new Error(
    "ADVANCED_JAVASCRIPT_GENERATION was not granted",
  );
}


/*
 * ---------------------------------------------------------
 * 3. Installation/invocation lifecycle remains fixed
 * ---------------------------------------------------------
 */

if (
  all.sqlScriptInstallation !==
    "ADMIN_MANUAL_ONLY" ||
  all.sqlScriptInvocation !==
    "WEB_SERVICES_ONLY"
) {
  throw new Error(
    "SoftOne SQL Script lifecycle invariant failed",
  );
}

if (
  all.advancedJavaScriptInstallation !==
    "ADMIN_MANUAL_ONLY" ||
  all.advancedJavaScriptInvocation !==
    "WEB_SERVICES_ONLY"
) {
  throw new Error(
    "SoftOne Advanced JavaScript lifecycle invariant failed",
  );
}


/*
 * ---------------------------------------------------------
 * 4. Loose aliases MUST NOT grant authority
 * ---------------------------------------------------------
 */

const aliases =
  deriveSoftOneAccessPolicy(
    createDefinition(
      "SOFTONE",
      [
        "READ",
        "WRITE",
        "UPSERT",
        "SQL",
        "SCRIPT",
        "JS",
        "JAVASCRIPT",
      ],
    ),
  );

if (
  aliases.webServicesReadAllowed ||
  aliases.webServicesUpsertAllowed ||
  aliases.sqlScriptGenerationAllowed ||
  aliases.advancedJavaScriptGenerationAllowed
) {
  throw new Error(
    "Loose SoftOne aliases incorrectly granted authority",
  );
}


/*
 * ---------------------------------------------------------
 * 5. Another provider cannot grant SoftOne authority
 * ---------------------------------------------------------
 */

const otherProvider =
  deriveSoftOneAccessPolicy(
    createDefinition(
      "OTHER_PROVIDER",
      [
        SOFTONE_CAPABILITY
          .WEB_SERVICES_READ,

        SOFTONE_CAPABILITY
          .WEB_SERVICES_UPSERT,
      ],
    ),
  );

if (
  otherProvider.webServicesReadAllowed ||
  otherProvider.webServicesUpsertAllowed
) {
  throw new Error(
    "Non-SoftOne integration incorrectly granted SoftOne authority",
  );
}


/*
 * ---------------------------------------------------------
 * 6. SOFT1 alias is an explicit provider alias
 * ---------------------------------------------------------
 */

const soft1 =
  deriveSoftOneAccessPolicy(
    createDefinition(
      "SOFT1",
      [
        SOFTONE_CAPABILITY
          .WEB_SERVICES_READ,
      ],
    ),
  );

if (
  !soft1.webServicesReadAllowed
) {
  throw new Error(
    "SOFT1 provider alias was not recognized",
  );
}


console.log(
  JSON.stringify(
    {
      transport:
        all.transport,

      directDatabaseAccess:
        all.directDatabaseAccess,

      dataExplorerExecution:
        all.dataExplorerExecution,

      capabilities: {
        webServicesReadAllowed:
          all.webServicesReadAllowed,

        webServicesUpsertAllowed:
          all.webServicesUpsertAllowed,

        sqlScriptGenerationAllowed:
          all.sqlScriptGenerationAllowed,

        advancedJavaScriptGenerationAllowed:
          all.advancedJavaScriptGenerationAllowed,
      },

      sqlScriptLifecycle: {
        installation:
          all.sqlScriptInstallation,

        invocation:
          all.sqlScriptInvocation,
      },

      advancedJavaScriptLifecycle: {
        installation:
          all.advancedJavaScriptInstallation,

        invocation:
          all.advancedJavaScriptInvocation,
      },

      failClosedWithoutCapabilities:
        !none.webServicesReadAllowed &&
        !none.webServicesUpsertAllowed &&
        !none.sqlScriptGenerationAllowed &&
        !none.advancedJavaScriptGenerationAllowed,

      looseAliasesRejected:
        !aliases.webServicesReadAllowed &&
        !aliases.webServicesUpsertAllowed &&
        !aliases.sqlScriptGenerationAllowed &&
        !aliases.advancedJavaScriptGenerationAllowed,

      otherProviderRejected:
        !otherProvider.webServicesReadAllowed &&
        !otherProvider.webServicesUpsertAllowed,

      soft1AliasAccepted:
        soft1.webServicesReadAllowed,
    },
    null,
    2,
  ),
);

console.log(
  "SOFTONE ACCESS POLICY CONTRACT: PASS",
);
