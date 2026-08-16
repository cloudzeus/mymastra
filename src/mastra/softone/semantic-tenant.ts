import { Pool } from "pg";

export type SemanticTenantContext = {
  connectionId: string;
  tenantId: string;
  tenantCode: string;
};

const semanticPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

export async function getSemanticTenantContext(
  connectionId: string,
): Promise<SemanticTenantContext> {
  if (!connectionId?.trim()) {
    throw new Error("connectionId is required");
  }

  const result = await semanticPool.query(
    `
      SELECT
        sc.id::text AS connection_id,
        t.id::text AS tenant_id,
        t.code AS tenant_code
      FROM app.softone_connections sc
      INNER JOIN app.tenants t
        ON t.id = sc.tenant_id
      WHERE sc.id = $1
      LIMIT 1
    `,
    [connectionId],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      `SoftOne connection not found or tenant unresolved: ${connectionId}`,
    );
  }

  const row = result.rows[0];

  if (!row.tenant_code) {
    throw new Error(
      `Tenant code is missing for SoftOne connection: ${connectionId}`,
    );
  }

  return {
    connectionId: row.connection_id,
    tenantId: row.tenant_id,
    tenantCode: row.tenant_code,
  };
}
