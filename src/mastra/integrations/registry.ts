import {
  appDb,
} from "../db/postgres";

import type {
  IntegrationCategory,
  IntegrationProvider,
} from "./types";


type IntegrationProviderRow = {
  id: string;

  code: string;

  category:
    IntegrationCategory;

  name: string;

  description:
    string | null;

  adapter_version:
    string | null;

  api_version:
    string | null;

  capabilities:
    unknown;

  config_schema:
    unknown;

  secret_schema:
    unknown;

  is_active: boolean;
};


function asStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is string =>
      typeof item ===
      "string",
  );
}


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


function mapProvider(
  row:
    IntegrationProviderRow,
): IntegrationProvider {
  return {
    id:
      row.id,

    code:
      row.code,

    category:
      row.category,

    name:
      row.name,

    description:
      row.description ??
      undefined,

    adapterVersion:
      row.adapter_version ??
      undefined,

    apiVersion:
      row.api_version ??
      undefined,

    capabilities:
      asStringArray(
        row.capabilities,
      ),

    configSchema:
      asObject(
        row.config_schema,
      ),

    secretSchema:
      asObject(
        row.secret_schema,
      ),

    isActive:
      row.is_active,
  };
}


export async function getIntegrationProvider(
  code: string,
): Promise<IntegrationProvider> {
  if (!code?.trim()) {
    throw new Error(
      "Integration provider code is required",
    );
  }


  const result =
    await appDb.query<
      IntegrationProviderRow
    >(
      `
      SELECT
        id::text,
        code,
        category,
        name,
        description,
        adapter_version,
        api_version,
        capabilities,
        config_schema,
        secret_schema,
        is_active
      FROM app.integration_providers
      WHERE code = $1
      LIMIT 1
      `,
      [
        code,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Integration provider not found: ${code}`,
    );
  }


  if (!row.is_active) {
    throw new Error(
      `Integration provider is inactive: ${code}`,
    );
  }


  return mapProvider(
    row,
  );
}


export async function findIntegrationProvidersByCategory(
  category:
    IntegrationCategory,
): Promise<IntegrationProvider[]> {
  const result =
    await appDb.query<
      IntegrationProviderRow
    >(
      `
      SELECT
        id::text,
        code,
        category,
        name,
        description,
        adapter_version,
        api_version,
        capabilities,
        config_schema,
        secret_schema,
        is_active
      FROM app.integration_providers
      WHERE category = $1
        AND is_active = true
      ORDER BY code
      `,
      [
        category,
      ],
    );


  return result.rows.map(
    mapProvider,
  );
}


export async function findIntegrationProvidersByCapability(
  capability: string,
): Promise<IntegrationProvider[]> {
  if (!capability?.trim()) {
    throw new Error(
      "Integration capability is required",
    );
  }


  const result =
    await appDb.query<
      IntegrationProviderRow
    >(
      `
      SELECT
        id::text,
        code,
        category,
        name,
        description,
        adapter_version,
        api_version,
        capabilities,
        config_schema,
        secret_schema,
        is_active
      FROM app.integration_providers
      WHERE is_active = true
        AND capabilities @> $1::jsonb
      ORDER BY code
      `,
      [
        JSON.stringify([
          capability,
        ]),
      ],
    );


  return result.rows.map(
    mapProvider,
  );
}
