import {
  appDb,
} from "../db/postgres";

import {
  encryptSecret,
} from "../security/encryption";

import {
  getIntegrationProvider,
} from "./registry";

import {
  getProviderConnectionSchema,
  validateProviderConnectionInput,
} from "./provider-schemas";

import type {
  IntegrationCategory,
  IntegrationEnvironment,
} from "./types";


export type IntegrationConnectionSummary = {
  id: string;

  tenantId: string;

  providerId: string;
  providerCode: string;

  category:
    IntegrationCategory;

  name: string;

  environment:
    IntegrationEnvironment;

  config:
    Record<string, unknown>;

  hasSecrets: boolean;

  isActive: boolean;

  isDefault: boolean;

  lastVerifiedAt?: string;

  createdAt: string;
  updatedAt: string;
};


export type CreateTenantIntegrationConnectionInput = {
  tenantId: string;

  providerCode: string;

  name: string;

  environment?:
    IntegrationEnvironment;

  config?:
    Record<string, unknown>;

  secrets?:
    Record<string, unknown>;

  isDefault?: boolean;
};


export type UpdateTenantIntegrationConnectionInput = {
  name?: string;

  environment?:
    IntegrationEnvironment;

  config?:
    Record<string, unknown>;

  /*
   * Undefined:
   *   keep currently stored encrypted secrets.
   *
   * {}:
   *   intentionally replace with an empty encrypted object.
   */
  secrets?:
    Record<string, unknown>;

  isActive?: boolean;

  isDefault?: boolean;
};


type ConnectionSummaryRow = {
  id: string;

  tenant_id: string;

  provider_id: string;
  provider_code: string;

  category:
    IntegrationCategory;

  name: string;

  environment:
    IntegrationEnvironment;

  config: unknown;

  has_secrets: boolean;

  is_active: boolean;

  is_default: boolean;

  last_verified_at:
    string | null;

  created_at: string;
  updated_at: string;
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


function mapSummary(
  row:
    ConnectionSummaryRow,
): IntegrationConnectionSummary {
  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    providerId:
      row.provider_id,

    providerCode:
      row.provider_code,

    category:
      row.category,

    name:
      row.name,

    environment:
      row.environment,

    config:
      asObject(
        row.config,
      ),

    hasSecrets:
      row.has_secrets,

    isActive:
      row.is_active,

    isDefault:
      row.is_default,

    lastVerifiedAt:
      row.last_verified_at ??
      undefined,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


function encryptSecrets(
  secrets:
    Record<string, unknown>,
): string {
  return encryptSecret(
    JSON.stringify(
      secrets,
    ),
  );
}


async function assertTenantExists(
  tenantId: string,
): Promise<void> {
  if (!tenantId?.trim()) {
    throw new Error(
      "tenantId is required",
    );
  }


  const result =
    await appDb.query(
      `
      SELECT 1
      FROM app.tenants
      WHERE id = $1
        AND is_active = true
      LIMIT 1
      `,
      [
        tenantId,
      ],
    );


  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      `Active tenant not found: ${tenantId}`,
    );
  }
}


export async function createTenantIntegrationConnection(
  input:
    CreateTenantIntegrationConnectionInput,
): Promise<IntegrationConnectionSummary> {
  await assertTenantExists(
    input.tenantId,
  );


  if (!input.name?.trim()) {
    throw new Error(
      "Integration connection name is required",
    );
  }


  /*
   * This also verifies that the provider exists
   * and is currently active.
   */
  const provider =
    await getIntegrationProvider(
      input.providerCode,
    );


  const environment =
    input.environment ??
    "PRODUCTION";


  const rawConfig =
    input.config ??
    {};


  const rawSecrets =
    input.secrets ??
    {};


  const validated =
    validateProviderConnectionInput(
      provider.code,
      rawConfig,
      rawSecrets,
    );


  const config =
    validated.config;


  const secretsEncrypted =
    encryptSecrets(
      validated.secrets,
    );


  const result =
    await appDb.query<
      ConnectionSummaryRow
    >(
      `
      INSERT INTO app.integration_connections (
        tenant_id,
        provider_id,
        name,
        environment,
        config,
        secrets_encrypted,
        is_default
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6,
        $7
      )
      RETURNING
        id::text,
        tenant_id::text,
        provider_id::text,
        $8::text AS provider_code,
        $9::text AS category,
        name,
        environment,
        config,
        (secrets_encrypted IS NOT NULL) AS has_secrets,
        is_active,
        is_default,
        last_verified_at::text,
        created_at::text,
        updated_at::text
      `,
      [
        input.tenantId,
        provider.id,
        input.name.trim(),
        environment,
        JSON.stringify(
          config,
        ),
        secretsEncrypted,
        input.isDefault ?? false,
        provider.code,
        provider.category,
      ],
    );


  return mapSummary(
    result.rows[0],
  );
}


export async function updateTenantIntegrationConnection(
  connectionId: string,
  input:
    UpdateTenantIntegrationConnectionInput,
): Promise<IntegrationConnectionSummary> {
  if (!connectionId?.trim()) {
    throw new Error(
      "Integration connectionId is required",
    );
  }


  const existing =
    await appDb.query<{
      id: string;
      provider_code: string;
      config: unknown;
      secrets_encrypted: string | null;
    }>(
      `
      SELECT
        ic.id::text,
        p.code AS provider_code,
        ic.config,
        ic.secrets_encrypted
      FROM app.integration_connections ic
      INNER JOIN app.integration_providers p
        ON p.id = ic.provider_id
      WHERE ic.id = $1
      LIMIT 1
      `,
      [
        connectionId,
      ],
    );


  if (
    existing.rowCount !== 1
  ) {
    throw new Error(
      `Integration connection not found: ${connectionId}`,
    );
  }


  const existingRow =
    existing.rows[0];


  const schema =
    getProviderConnectionSchema(
      existingRow.provider_code,
    );


  if (!schema) {
    throw new Error(
      `Provider connection schema not registered: ${existingRow.provider_code}`,
    );
  }


  const nextConfig =
    input.config !== undefined
      ? input.config
      : asObject(
          existingRow.config,
        );


  let nextSecrets:
    Record<string, unknown>;


  if (
    input.secrets !== undefined
  ) {
    nextSecrets =
      input.secrets;
  }
  else if (
    existingRow.secrets_encrypted
  ) {
    /*
     * Preserve existing encrypted secrets without exposing
     * them through public manager return values.
     *
     * Validation of unchanged secrets is deferred here because
     * they were already validated at creation/update time.
     */
    nextSecrets =
      {};
  }
  else {
    nextSecrets =
      {};
  }


  const validatedConfig =
    schema.configSchema.parse(
      nextConfig,
    );


  let secretsEncrypted:
    string | undefined;


  if (
    input.secrets !== undefined
  ) {
    const validatedSecrets =
      schema.secretSchema.parse(
        nextSecrets,
      );

    secretsEncrypted =
      encryptSecrets(
        validatedSecrets,
      );
  }


  const result =
    await appDb.query<
      ConnectionSummaryRow
    >(
      `
      UPDATE app.integration_connections ic
      SET
        name =
          COALESCE(
            $2,
            ic.name
          ),

        environment =
          COALESCE(
            $3,
            ic.environment
          ),

        config =
          COALESCE(
            $4::jsonb,
            ic.config
          ),

        secrets_encrypted =
          CASE
            WHEN $5::boolean
              THEN $6
            ELSE ic.secrets_encrypted
          END,

        is_active =
          COALESCE(
            $7,
            ic.is_active
          ),

        is_default =
          COALESCE(
            $8,
            ic.is_default
          ),

        updated_at =
          now()

      FROM app.integration_providers p

      WHERE
        ic.id = $1
        AND p.id = ic.provider_id

      RETURNING
        ic.id::text,
        ic.tenant_id::text,
        ic.provider_id::text,
        p.code AS provider_code,
        p.category,
        ic.name,
        ic.environment,
        ic.config,
        (
          ic.secrets_encrypted
          IS NOT NULL
        ) AS has_secrets,
        ic.is_active,
        ic.is_default,
        ic.last_verified_at::text,
        ic.created_at::text,
        ic.updated_at::text
      `,
      [
        connectionId,

        input.name !== undefined
          ? input.name.trim()
          : null,

        input.environment ??
          null,

        input.config !== undefined
          ? JSON.stringify(
              validatedConfig,
            )
          : null,

        input.secrets !== undefined,

        secretsEncrypted ??
          null,

        input.isActive ??
          null,

        input.isDefault ??
          null,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Integration connection could not be updated: ${connectionId}`,
    );
  }


  return mapSummary(
    row,
  );
}


export async function listTenantIntegrationConnections(
  tenantId: string,
): Promise<IntegrationConnectionSummary[]> {
  if (!tenantId?.trim()) {
    throw new Error(
      "tenantId is required",
    );
  }


  const result =
    await appDb.query<
      ConnectionSummaryRow
    >(
      `
      SELECT
        ic.id::text,
        ic.tenant_id::text,
        ic.provider_id::text,
        p.code AS provider_code,
        p.category,
        ic.name,
        ic.environment,
        ic.config,
        (
          ic.secrets_encrypted
          IS NOT NULL
        ) AS has_secrets,
        ic.is_active,
        ic.is_default,
        ic.last_verified_at::text,
        ic.created_at::text,
        ic.updated_at::text
      FROM app.integration_connections ic
      INNER JOIN app.integration_providers p
        ON p.id = ic.provider_id
      WHERE ic.tenant_id = $1
      ORDER BY
        p.category,
        p.code,
        ic.environment,
        ic.name
      `,
      [
        tenantId,
      ],
    );


  return result.rows.map(
    mapSummary,
  );
}
