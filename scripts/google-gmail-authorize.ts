import {
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  authenticate,
} from "@google-cloud/local-auth";


const CREDENTIALS_PATH =
  resolve(
    process.cwd(),
    "secrets/google-oauth-client.json",
  );

const TOKEN_PATH =
  resolve(
    process.cwd(),
    "secrets/google-gmail-token.json",
  );

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
];


async function main() {
  const credentials =
    JSON.parse(
      readFileSync(
        CREDENTIALS_PATH,
        "utf8",
      ),
    );

  const client =
    await authenticate({
      scopes:
        SCOPES,

      keyfilePath:
        CREDENTIALS_PATH,
    });

  if (!client.credentials) {
    throw new Error(
      "Google OAuth credentials were not returned.",
    );
  }

  writeFileSync(
    TOKEN_PATH,
    JSON.stringify(
      {
        type:
          "authorized_user",

        client_id:
          credentials.installed
            ?.client_id,

        client_secret:
          credentials.installed
            ?.client_secret,

        refresh_token:
          client.credentials
            .refresh_token,

        scope:
          SCOPES,
      },
      null,
      2,
    ) + "\n",
    {
      mode: 0o600,
    },
  );

  console.log(
    "Google Gmail readonly authorization saved:",
    TOKEN_PATH,
  );

  console.log(
    "Refresh token present:",
    Boolean(
      client.credentials
        .refresh_token,
    ),
  );
}


main().catch(
  error => {
    console.error(error);
    process.exit(1);
  },
);
