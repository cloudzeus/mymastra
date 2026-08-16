import {
  appDb,
} from "../db/postgres";

import {
  decryptSecret,
} from "../security/encryption";

export type SoftOneConnection = {
  id: string;
  tenantId: string;

  name: string;

  environment:
    | "PRODUCTION"
    | "TEST"
    | "DEVELOPMENT";

  url: string;

  username: string;
  password: string;
  appId: string;

  company: string;
  branch: string;
  module: string;

  refid: string;
};

type SoftOneConnectionRow = {
  id: string;
  tenant_id: string;

  name: string;

  environment:
    | "PRODUCTION"
    | "TEST"
    | "DEVELOPMENT";

  url: string;

  username_encrypted: string;
  password_encrypted: string;
  app_id_encrypted: string;

  company: string;
  branch: string;
  module: string;

  refid_encrypted: string;

  is_active: boolean;
};

export async function getSoftOneConnection(
  connectionId: string,
): Promise<SoftOneConnection> {
  const result =
    await appDb.query<SoftOneConnectionRow>(
      `
      SELECT
        id,
        tenant_id,
        name,
        environment,
        url,
        username_encrypted,
        password_encrypted,
        app_id_encrypted,
        company,
        branch,
        module,
        refid_encrypted,
        is_active
      FROM app.softone_connections
      WHERE id = $1
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
      "SoftOne connection not found",
    );
  }

  if (!row.is_active) {
    throw new Error(
      "SoftOne connection is inactive",
    );
  }

  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    name:
      row.name,

    environment:
      row.environment,

    url:
      row.url,

    username:
      decryptSecret(
        row.username_encrypted,
      ),

    password:
      decryptSecret(
        row.password_encrypted,
      ),

    appId:
      decryptSecret(
        row.app_id_encrypted,
      ),

    company:
      row.company,

    branch:
      row.branch,

    module:
      row.module,

    refid:
      decryptSecret(
        row.refid_encrypted,
      ),
  };
}
