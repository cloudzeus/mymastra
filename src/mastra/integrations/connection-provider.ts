import {
  appDb,
} from "../db/postgres";

import {
  decryptSecret,
} from "../security/encryption";

import type {
  IntegrationConnection,
  IntegrationEnvironment,
} from "./types";


type IntegrationConnectionRow = {
  id: string;

  tenant_id: string;

  provider_id: string;

  provider_code: string;

  name: string;

  environment:
    IntegrationEnvironment;

  config:
    unknown;

  secrets_encrypted:
    string | null;

  is_active: boolean;

  provider_is_active:
    boolean;

  last_verified_at:
    string | null;
};


function asObject(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  ) {
    return value as
      Record<string, unknown>;
  }

  return {};
}


function decryptSecrets(
  encrypted:
    string | null,
): Record<string, unknown> {
  if (!encrypted) {
    return {};
  }


  const plaintext =
    decryptSecret(
      encrypted,
    );


  let parsed:
    unknown;


  try {
    parsed =
      JSON.parse(
        plaintext,
      );
  } catch {
    throw new Error(
      "Integration connection secrets contain invalid encrypted JSON",
    );
  }


  return asObject(
    parsed,
  );
}


export async function getTenantIntegrationConnection(
  connectionId: string,
): Promise<IntegrationConnection> {
  if (!connectionId?.trim()) {
    throw new Error(
      "Integration connectionId is required",
    );
  }


  const result =
    await appDb.query<
      IntegrationConnectionRow
    >(
      `
      SELECT
        ic.id::text,
        ic.tenant_id::text,
        ic.provider_id::text,
        p.code AS provider_code,
        ic.name,
        ic.environment,
        ic.config,
        ic.secrets_encrypted,
        ic.is_active,
        p.is_active AS provider_is_active,
        ic.last_verified_at::text
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


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Integration connection not found: ${connectionId}`,
    );
  }


  if (!row.is_active) {
    throw new Error(
      `Integration connection is inactive: ${connectionId}`,
    );
  }


  if (!row.provider_is_active) {
    throw new Error(
      `Integration provider is inactive: ${row.provider_code}`,
    );
  }


  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    providerId:
      row.provider_id,

    providerCode:
      row.provider_code,

    name:
      row.name,

    environment:
      row.environment,

    config:
      asObject(
        row.config,
      ),

    secrets:
      decryptSecrets(
        row.secrets_encrypted,
      ),

    isActive:
      row.is_active,

    lastVerifiedAt:
      row.last_verified_at ??
      undefined,
  };
}
