import path from "node:path";

import {
  execFile,
} from "node:child_process";

import {
  promisify,
} from "node:util";

import {
  chmod,
  lstat,
  mkdir,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";

import {
  appDb,
} from "../db/postgres";

import {
  getPresalesSource,
} from "./presales-source-manager";

import type {
  PresalesRepositoryWorkspace,
  PresalesRepositoryWorkspaceStatus,
} from "./presales-repository-workspace-types";


const PRESALES_REPOSITORY_ROOT =
  "/opt/mastra-presales-repositories";


const execFileAsync =
  promisify(
    execFile,
  );


type WorkspaceRow = {
  presales_source_id: string;

  tenant_id: string;
  customer_id: string;
  opportunity_id: string;

  workspace_path: string;

  requested_ref:
    string | null;

  resolved_ref:
    string | null;

  resolved_commit:
    string | null;

  status:
    PresalesRepositoryWorkspaceStatus;

  created_at: string;
  updated_at: string;
};


function requireUuid(
  value: string,
  name: string,
): string {
  const normalized =
    value?.trim();

  if (
    !normalized ||
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      `${name} must be a UUID`,
    );
  }

  return normalized;
}


function mapWorkspace(
  row: WorkspaceRow,
): PresalesRepositoryWorkspace {
  return {
    presalesSourceId:
      row.presales_source_id,

    tenantId:
      row.tenant_id,

    customerId:
      row.customer_id,

    opportunityId:
      row.opportunity_id,

    workspacePath:
      row.workspace_path,

    requestedRef:
      row.requested_ref ??
      undefined,

    resolvedRef:
      row.resolved_ref ??
      undefined,

    resolvedCommit:
      row.resolved_commit ??
      undefined,

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export function buildPresalesRepositoryWorkspacePath(
  opportunityId: string,
  presalesSourceId: string,
): string {
  const normalizedOpportunityId =
    requireUuid(
      opportunityId,
      "opportunityId",
    );

  const normalizedSourceId =
    requireUuid(
      presalesSourceId,
      "presalesSourceId",
    );

  const workspacePath =
    path.resolve(
      PRESALES_REPOSITORY_ROOT,
      normalizedOpportunityId,
      normalizedSourceId,
    );

  const expectedPrefix =
    `${PRESALES_REPOSITORY_ROOT}${path.sep}`;

  if (
    !workspacePath.startsWith(
      expectedPrefix,
    )
  ) {
    throw new Error(
      "Resolved presales repository path escaped repository root",
    );
  }

  return workspacePath;
}


function validateRepositoryUrl(
  repositoryUrl: string,
): string {
  const normalized =
    repositoryUrl?.trim();

  if (!normalized) {
    throw new Error(
      "repositoryUrl must not be blank",
    );
  }

  if (
    normalized.startsWith(
      "https://",
    )
  ) {
    const parsed =
      new URL(
        normalized,
      );

    if (
      parsed.username ||
      parsed.password
    ) {
      throw new Error(
        "Repository URL must not contain embedded credentials",
      );
    }

    return normalized;
  }

  if (
    normalized.startsWith(
      "git@github.com:",
    ) ||
    normalized.startsWith(
      "git@gitlab.com:",
    ) ||
    normalized.startsWith(
      "git@bitbucket.org:",
    )
  ) {
    return normalized;
  }

  throw new Error(
    "Repository URL must use HTTPS or an approved Git SSH host",
  );
}


function validateRequestedRef(
  value: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      "requestedRef must not be blank",
    );
  }

  if (
    normalized.startsWith("-") ||
    normalized.includes("..") ||
    normalized.includes("//") ||
    normalized.includes("@{") ||
    normalized.includes("\\") ||
    /[\s~^:?*\[\]]/.test(
      normalized,
    ) ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "requestedRef contains unsupported characters",
    );
  }

  return normalized;
}


async function ensureTrustedRoot(): Promise<void> {
  await mkdir(
    PRESALES_REPOSITORY_ROOT,
    {
      recursive: true,
      mode: 0o750,
    },
  );

  const stat =
    await lstat(
      PRESALES_REPOSITORY_ROOT,
    );

  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory()
  ) {
    throw new Error(
      `Presales repository root is not trusted: ${PRESALES_REPOSITORY_ROOT}`,
    );
  }

  await chmod(
    PRESALES_REPOSITORY_ROOT,
    0o750,
  );
}


async function ensureDirectory(
  directoryPath: string,
): Promise<void> {
  await mkdir(
    directoryPath,
    {
      recursive: true,
      mode: 0o750,
    },
  );

  const stat =
    await lstat(
      directoryPath,
    );

  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory()
  ) {
    throw new Error(
      `Unsafe presales repository directory: ${directoryPath}`,
    );
  }

  await chmod(
    directoryPath,
    0o750,
  );
}


async function assertDirectoryEmpty(
  directoryPath: string,
): Promise<void> {
  const entries =
    await readdir(
      directoryPath,
    );

  if (
    entries.length !== 0
  ) {
    throw new Error(
      `Presales repository workspace is not empty: ${directoryPath}`,
    );
  }
}


async function updateWorkspace(
  tenantId: string,
  presalesSourceId: string,
  input: {
    status:
      PresalesRepositoryWorkspaceStatus;

    resolvedRef?:
      string | null;

    resolvedCommit?:
      string | null;
  },
): Promise<PresalesRepositoryWorkspace> {
  const result =
    await appDb.query<
      WorkspaceRow
    >(
      `
        UPDATE app.presales_repository_workspaces
        SET
          status = $3,

          resolved_ref =
            CASE
              WHEN $4::text IS NULL
                THEN resolved_ref
              ELSE $4
            END,

          resolved_commit =
            CASE
              WHEN $5::text IS NULL
                THEN resolved_commit
              ELSE $5
            END,

          updated_at = now()

        WHERE presales_source_id =
            $1::uuid
          AND tenant_id =
            $2::uuid

        RETURNING
          presales_source_id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          workspace_path,
          requested_ref,
          resolved_ref,
          resolved_commit,
          status,
          created_at::text,
          updated_at::text
      `,
      [
        presalesSourceId,
        tenantId,
        input.status,
        input.resolvedRef ??
          null,
        input.resolvedCommit ??
          null,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Presales repository workspace not found: ${presalesSourceId}`,
    );
  }

  return mapWorkspace(
    row,
  );
}


export async function createPresalesRepositoryWorkspace(
  tenantId: string,
  presalesSourceId: string,
): Promise<PresalesRepositoryWorkspace> {
  const source =
    await getPresalesSource(
      tenantId,
      presalesSourceId,
    );

  if (
    source.sourceType !==
      "REPOSITORY"
  ) {
    throw new Error(
      "Presales repository workspace requires a REPOSITORY source",
    );
  }

  if (
    source.status ===
      "REVOKED"
  ) {
    throw new Error(
      "Cannot create workspace for REVOKED repository source",
    );
  }

  if (
    !source.repositoryUrl
  ) {
    throw new Error(
      "Repository source has no repositoryUrl",
    );
  }

  const workspacePath =
    buildPresalesRepositoryWorkspacePath(
      source.opportunityId,
      source.id,
    );

  const result =
    await appDb.query<
      WorkspaceRow
    >(
      `
        INSERT INTO app.presales_repository_workspaces (
          presales_source_id,
          tenant_id,
          customer_id,
          opportunity_id,
          workspace_path,
          requested_ref,
          status
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5,
          $6,
          'PENDING'
        )
        RETURNING
          presales_source_id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          workspace_path,
          requested_ref,
          resolved_ref,
          resolved_commit,
          status,
          created_at::text,
          updated_at::text
      `,
      [
        source.id,
        source.tenantId,
        source.customerId,
        source.opportunityId,
        workspacePath,
        source.requestedRef ??
          null,
      ],
    );

  return mapWorkspace(
    result.rows[0],
  );
}


export async function getPresalesRepositoryWorkspace(
  tenantId: string,
  presalesSourceId: string,
): Promise<PresalesRepositoryWorkspace> {
  const result =
    await appDb.query<
      WorkspaceRow
    >(
      `
        SELECT
          presales_source_id::text,
          tenant_id::text,
          customer_id::text,
          opportunity_id::text,
          workspace_path,
          requested_ref,
          resolved_ref,
          resolved_commit,
          status,
          created_at::text,
          updated_at::text
        FROM app.presales_repository_workspaces
        WHERE presales_source_id =
            $1::uuid
          AND tenant_id =
            $2::uuid
        LIMIT 1
      `,
      [
        requireUuid(
          presalesSourceId,
          "presalesSourceId",
        ),

        requireUuid(
          tenantId,
          "tenantId",
        ),
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Presales repository workspace not found: ${presalesSourceId}`,
    );
  }

  return mapWorkspace(
    row,
  );
}


export async function provisionPresalesRepository(
  tenantId: string,
  presalesSourceId: string,
): Promise<PresalesRepositoryWorkspace> {
  const source =
    await getPresalesSource(
      tenantId,
      presalesSourceId,
    );

  if (
    source.sourceType !==
      "REPOSITORY"
  ) {
    throw new Error(
      "Repository provisioning requires a REPOSITORY presales source",
    );
  }

  if (
    source.status ===
      "REVOKED"
  ) {
    throw new Error(
      "Cannot provision a REVOKED repository source",
    );
  }

  const repositoryUrl =
    validateRepositoryUrl(
      source.repositoryUrl ?? "",
    );

  const workspace =
    await getPresalesRepositoryWorkspace(
      tenantId,
      presalesSourceId,
    );

  const expectedPath =
    buildPresalesRepositoryWorkspacePath(
      source.opportunityId,
      source.id,
    );

  if (
    workspace.workspacePath !==
      expectedPath
  ) {
    await updateWorkspace(
      tenantId,
      source.id,
      {
        status:
          "BLOCKED",
      },
    );

    throw new Error(
      `Presales repository workspace path invariant violation`,
    );
  }

  await updateWorkspace(
    tenantId,
    source.id,
    {
      status:
        "PROVISIONING",
    },
  );

  try {
    await ensureTrustedRoot();

    const opportunityDirectory =
      path.dirname(
        expectedPath,
      );

    await ensureDirectory(
      opportunityDirectory,
    );

    await ensureDirectory(
      expectedPath,
    );

    await assertDirectoryEmpty(
      expectedPath,
    );

    await execFileAsync(
      "git",
      [
        "clone",
        "--no-checkout",
        "--",
        repositoryUrl,
        expectedPath,
      ],
      {
        cwd:
          PRESALES_REPOSITORY_ROOT,

        timeout:
          120_000,

        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT:
            "0",
        },
      },
    );

    const requestedRef =
      source.requestedRef
        ? validateRequestedRef(
            source.requestedRef,
          )
        : null;

    let resolvedRef:
      string;

    if (requestedRef) {
      resolvedRef =
        requestedRef;
    }
    else {
      const {
        stdout,
      } =
        await execFileAsync(
          "git",
          [
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
          ],
          {
            cwd:
              expectedPath,

            timeout:
              30_000,
          },
        );

      resolvedRef =
        stdout.trim();
    }

    const commitExpression =
      `${resolvedRef}^{commit}`;

    const {
      stdout:
        commitStdout,
    } =
      await execFileAsync(
        "git",
        [
          "rev-parse",
          "--verify",
          commitExpression,
        ],
        {
          cwd:
            expectedPath,

          timeout:
            30_000,
        },
      );

    const resolvedCommit =
      commitStdout.trim();

    if (
      !/^[0-9a-fA-F]{40,64}$/.test(
        resolvedCommit,
      )
    ) {
      throw new Error(
        "Git resolved commit is invalid",
      );
    }

    await execFileAsync(
      "git",
      [
        "checkout",
        "--detach",
        resolvedCommit,
      ],
      {
        cwd:
          expectedPath,

        timeout:
          60_000,
      },
    );

    const {
      stdout:
        headStdout,
    } =
      await execFileAsync(
        "git",
        [
          "rev-parse",
          "HEAD",
        ],
        {
          cwd:
            expectedPath,

          timeout:
            30_000,
        },
      );

    if (
      headStdout.trim() !==
        resolvedCommit
    ) {
      throw new Error(
        "Detached checkout commit verification failed",
      );
    }

    const resolvedPath =
      await realpath(
        expectedPath,
      );

    if (
      resolvedPath !==
        expectedPath
    ) {
      throw new Error(
        "Presales repository realpath invariant violation",
      );
    }

    const gitPath =
      path.join(
        expectedPath,
        ".git",
      );

    const gitStat =
      await lstat(
        gitPath,
      );

    if (
      gitStat.isSymbolicLink()
    ) {
      throw new Error(
        "Repository .git path must not be a symbolic link",
      );
    }

    const ready =
      await updateWorkspace(
        tenantId,
        source.id,
        {
          status:
            "READY",

          resolvedRef,

          resolvedCommit,
        },
      );

    await appDb.query(
      `
        UPDATE app.presales_sources
        SET
          status = 'READY',
          updated_at = now()
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
          AND source_type = 'REPOSITORY'
      `,
      [
        source.id,
        tenantId,
      ],
    );

    return ready;
  }
  catch (error) {
    await updateWorkspace(
      tenantId,
      source.id,
      {
        status:
          "BLOCKED",
      },
    );

    await appDb.query(
      `
        UPDATE app.presales_sources
        SET
          status = 'FAILED',
          updated_at = now()
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
          AND source_type = 'REPOSITORY'
          AND status <> 'REVOKED'
      `,
      [
        source.id,
        tenantId,
      ],
    );

    /*
     * Cleanup is restricted to the exact canonical path
     * derived from opportunityId + sourceId.
     */
    if (
      expectedPath ===
      buildPresalesRepositoryWorkspacePath(
        source.opportunityId,
        source.id,
      )
    ) {
      await rm(
        expectedPath,
        {
          recursive: true,
          force: true,
        },
      ).catch(
        () => undefined,
      );
    }

    throw error;
  }
}
