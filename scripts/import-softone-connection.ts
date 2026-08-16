import { readFile } from "node:fs/promises";

import { appDb } from "../src/mastra/db/postgres";
import { encryptSecret } from "../src/mastra/security/encryption";

type Input = {
  tenantCode: string;
  tenantName: string;
  connectionName: string;

  url: string;
  username: string;
  password: string;
  appId: string;

  company: string;
  branch: string;
  module?: string;
  refid: string;
};

function required(
  value: string | undefined,
  name: string,
): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

async function main() {
  const file = process.argv[2];

  if (!file) {
    throw new Error(
      "Usage: import-softone-connection.ts <config.json>",
    );
  }

  const input = JSON.parse(
    await readFile(file, "utf8"),
  ) as Input;

  const client = await appDb.connect();

  try {
    await client.query("BEGIN");

    const tenantResult =
      await client.query<{ id: string }>(
        `
        INSERT INTO app.tenants (
          code,
          name
        )
        VALUES ($1, $2)

        ON CONFLICT (code)
        DO UPDATE SET
          name = EXCLUDED.name,
          is_active = TRUE,
          updated_at = NOW()

        RETURNING id
        `,
        [
          required(
            input.tenantCode,
            "tenantCode",
          ),
          required(
            input.tenantName,
            "tenantName",
          ),
        ],
      );

    const tenantId =
      tenantResult.rows[0].id;

    const connectionResult =
      await client.query(
        `
        INSERT INTO app.softone_connections (
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
        )
        VALUES (
          $1,
          $2,
          'PRODUCTION',
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          TRUE
        )

        ON CONFLICT (
          tenant_id,
          name
        )
        DO UPDATE SET
          url =
            EXCLUDED.url,

          username_encrypted =
            EXCLUDED.username_encrypted,

          password_encrypted =
            EXCLUDED.password_encrypted,

          app_id_encrypted =
            EXCLUDED.app_id_encrypted,

          company =
            EXCLUDED.company,

          branch =
            EXCLUDED.branch,

          module =
            EXCLUDED.module,

          refid_encrypted =
            EXCLUDED.refid_encrypted,

          is_active = TRUE,

          updated_at = NOW()

        RETURNING
          id,
          tenant_id,
          name,
          environment,
          company,
          branch,
          module,
          is_active
        `,
        [
          tenantId,

          required(
            input.connectionName,
            "connectionName",
          ),

          required(
            input.url,
            "url",
          ),

          encryptSecret(
            required(
              input.username,
              "username",
            ),
          ),

          encryptSecret(
            required(
              input.password,
              "password",
            ),
          ),

          encryptSecret(
            required(
              input.appId,
              "appId",
            ),
          ),

          required(
            input.company,
            "company",
          ),

          required(
            input.branch,
            "branch",
          ),

          input.module?.trim() || "0",

          encryptSecret(
            required(
              input.refid,
              "refid",
            ),
          ),
        ],
      );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          tenant: {
            id: tenantId,
            code: input.tenantCode,
            name: input.tenantName,
          },

          connection:
            connectionResult.rows[0],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await appDb.end();
  });
