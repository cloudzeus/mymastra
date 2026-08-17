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
} from "node:fs/promises";

import {
  appDb,
} from "../db/postgres";

import {
  getProject,
} from "./project-manager";

import type {
  CreateProjectWorkspaceInput,
  ProjectWorkspace,
  ProjectWorkspaceStatus,
  UpdateProjectWorkspaceInput,
} from "./types";


const WORKSPACE_ROOT =
  "/opt/mastra-workspaces";


const execFileAsync =
  promisify(
    execFile,
  );


type ProjectWorkspaceRow = {
  id: string;

  project_id: string;

  workspace_path: string;

  repository_url:
    string | null;

  base_branch:
    string | null;

  status:
    ProjectWorkspaceStatus;

  created_at: string;

  updated_at: string;
};


function mapWorkspace(
  row:
    ProjectWorkspaceRow,
): ProjectWorkspace {
  return {
    id:
      row.id,

    projectId:
      row.project_id,

    workspacePath:
      row.workspace_path,

    repositoryUrl:
      row.repository_url ??
      undefined,

    baseBranch:
      row.base_branch ??
      undefined,

    status:
      row.status,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export function buildProjectWorkspacePath(
  projectId: string,
): string {
  if (
    !projectId?.trim()
  ) {
    throw new Error(
      "projectId is required",
    );
  }


  const normalizedProjectId =
    projectId.trim();


  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      normalizedProjectId,
    )
  ) {
    throw new Error(
      "projectId must be a UUID",
    );
  }


  const workspacePath =
    path.resolve(
      WORKSPACE_ROOT,
      normalizedProjectId,
    );


  const expectedPrefix =
    `${WORKSPACE_ROOT}${path.sep}`;


  if (
    !workspacePath.startsWith(
      expectedPrefix,
    )
  ) {
    throw new Error(
      "Resolved workspace path escaped workspace root",
    );
  }


  return workspacePath;
}


export async function createProjectWorkspace(
  input:
    CreateProjectWorkspaceInput,
): Promise<ProjectWorkspace> {
  const project =
    await getProject(
      input.projectId,
    );


  const workspacePath =
    buildProjectWorkspacePath(
      project.id,
    );


  const result =
    await appDb.query<
      ProjectWorkspaceRow
    >(
      `
      INSERT INTO app.project_workspaces (
        project_id,
        workspace_path,
        repository_url,
        base_branch,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'PROVISIONING'
      )
      RETURNING
        id::text,
        project_id::text,
        workspace_path,
        repository_url,
        base_branch,
        status,
        created_at::text,
        updated_at::text
      `,
      [
        project.id,
        workspacePath,
        input.repositoryUrl?.trim() ||
          null,
        input.baseBranch?.trim() ||
          null,
      ],
    );


  return mapWorkspace(
    result.rows[0],
  );
}


export async function getProjectWorkspace(
  projectId: string,
): Promise<ProjectWorkspace> {
  if (
    !projectId?.trim()
  ) {
    throw new Error(
      "projectId is required",
    );
  }


  const result =
    await appDb.query<
      ProjectWorkspaceRow
    >(
      `
      SELECT
        id::text,
        project_id::text,
        workspace_path,
        repository_url,
        base_branch,
        status,
        created_at::text,
        updated_at::text
      FROM app.project_workspaces
      WHERE project_id = $1
      LIMIT 1
      `,
      [
        projectId,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Project workspace not found: ${projectId}`,
    );
  }


  return mapWorkspace(
    row,
  );
}


export async function updateProjectWorkspace(
  projectId: string,
  input:
    UpdateProjectWorkspaceInput,
): Promise<ProjectWorkspace> {
  if (
    !projectId?.trim()
  ) {
    throw new Error(
      "projectId is required",
    );
  }


  const result =
    await appDb.query<
      ProjectWorkspaceRow
    >(
      `
      UPDATE app.project_workspaces
      SET
        repository_url =
          CASE
            WHEN $2::boolean
              THEN $3
            ELSE repository_url
          END,

        base_branch =
          CASE
            WHEN $4::boolean
              THEN $5
            ELSE base_branch
          END,

        status =
          COALESCE(
            $6,
            status
          ),

        updated_at =
          now()

      WHERE project_id = $1

      RETURNING
        id::text,
        project_id::text,
        workspace_path,
        repository_url,
        base_branch,
        status,
        created_at::text,
        updated_at::text
      `,
      [
        projectId,

        input.repositoryUrl !==
          undefined,

        input.repositoryUrl ===
          null
          ? null
          : input.repositoryUrl
              ?.trim() ||
            null,

        input.baseBranch !==
          undefined,

        input.baseBranch ===
          null
          ? null
          : input.baseBranch
              ?.trim() ||
            null,

        input.status ??
          null,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Project workspace not found: ${projectId}`,
    );
  }


  return mapWorkspace(
    row,
  );
}


async function assertTrustedWorkspaceRoot():
  Promise<void> {
  let rootStat;


  try {
    rootStat =
      await lstat(
        WORKSPACE_ROOT,
      );
  } catch (
    error
  ) {
    throw new Error(
      `Workspace root is unavailable: ${WORKSPACE_ROOT}`,
      {
        cause:
          error,
      },
    );
  }


  if (
    rootStat.isSymbolicLink()
  ) {
    throw new Error(
      `Workspace root must not be a symbolic link: ${WORKSPACE_ROOT}`,
    );
  }


  if (
    !rootStat.isDirectory()
  ) {
    throw new Error(
      `Workspace root is not a directory: ${WORKSPACE_ROOT}`,
    );
  }
}


async function ensureWorkspaceDirectory(
  workspacePath: string,
): Promise<void> {
  try {
    await mkdir(
      workspacePath,
      {
        mode:
          0o750,
      },
    );
  } catch (
    error
  ) {
    const code =
      (
        error as
          NodeJS.ErrnoException
      ).code;


    if (
      code !==
      "EEXIST"
    ) {
      throw error;
    }
  }


  const workspaceStat =
    await lstat(
      workspacePath,
    );


  if (
    workspaceStat.isSymbolicLink()
  ) {
    throw new Error(
      `Workspace path must not be a symbolic link: ${workspacePath}`,
    );
  }


  if (
    !workspaceStat.isDirectory()
  ) {
    throw new Error(
      `Workspace path is not a directory: ${workspacePath}`,
    );
  }


  /*
   * Do not depend on process umask.
   * Canonical workspace permissions are always 0750.
   */
  await chmod(
    workspacePath,
    0o750,
  );
}


export async function provisionProjectWorkspace(
  projectId: string,
): Promise<ProjectWorkspace> {
  const workspace =
    await getProjectWorkspace(
      projectId,
    );


  const expectedPath =
    buildProjectWorkspacePath(
      projectId,
    );


  /*
   * Database contents are not trusted as filesystem authority.
   * A modified workspace_path must never redirect filesystem
   * operations outside the canonical project workspace.
   */
  if (
    workspace.workspacePath !==
    expectedPath
  ) {
    await updateProjectWorkspace(
      projectId,
      {
        status:
          "BLOCKED",
      },
    );


    throw new Error(
      `Project workspace path invariant violation: expected ${expectedPath}, got ${workspace.workspacePath}`,
    );
  }


  try {
    await assertTrustedWorkspaceRoot();

    await ensureWorkspaceDirectory(
      expectedPath,
    );


    return await updateProjectWorkspace(
      projectId,
      {
        status:
          "READY",
      },
    );
  } catch (
    error
  ) {
    await updateProjectWorkspace(
      projectId,
      {
        status:
          "BLOCKED",
      },
    );


    throw error;
  }
}


function validateRepositoryUrl(
  repositoryUrl: string,
): string {
  const normalized =
    repositoryUrl.trim();


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
    return normalized;
  }


  if (
    normalized.startsWith(
      "git@github.com:",
    )
  ) {
    return normalized;
  }


  throw new Error(
    "repositoryUrl must use https:// or git@github.com:",
  );
}


function validateGitBranchName(
  branch: string,
): string {
  const normalized =
    branch.trim();


  if (!normalized) {
    throw new Error(
      "Git branch must not be blank",
    );
  }


  if (
    normalized.startsWith("-")
  ) {
    throw new Error(
      "Git branch must not start with '-'",
    );
  }


  if (
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "Git branch contains unsupported characters",
    );
  }


  if (
    normalized.includes("..") ||
    normalized.includes("//") ||
    normalized.endsWith("/") ||
    normalized.endsWith(".") ||
    normalized.includes("@{")
  ) {
    throw new Error(
      "Git branch is invalid",
    );
  }


  return normalized;
}


async function assertWorkspaceDirectoryEmpty(
  workspacePath: string,
): Promise<void> {
  const entries =
    await readdir(
      workspacePath,
    );


  if (
    entries.length !==
    0
  ) {
    throw new Error(
      `Workspace directory is not empty: ${workspacePath}`,
    );
  }
}


export async function initializeProjectGitWorkspace(
  projectId: string,
): Promise<ProjectWorkspace> {
  const workspace =
    await getProjectWorkspace(
      projectId,
    );


  const expectedPath =
    buildProjectWorkspacePath(
      projectId,
    );


  if (
    workspace.workspacePath !==
    expectedPath
  ) {
    await updateProjectWorkspace(
      projectId,
      {
        status:
          "BLOCKED",
      },
    );


    throw new Error(
      `Project workspace path invariant violation: expected ${expectedPath}, got ${workspace.workspacePath}`,
    );
  }


  try {
    await assertTrustedWorkspaceRoot();

    await ensureWorkspaceDirectory(
      expectedPath,
    );


    await assertWorkspaceDirectoryEmpty(
      expectedPath,
    );


    if (
      workspace.repositoryUrl
    ) {
      const repositoryUrl =
        validateRepositoryUrl(
          workspace.repositoryUrl,
        );


      await execFileAsync(
        "git",
        [
          "clone",
          repositoryUrl,
          expectedPath,
        ],
        {
          cwd:
            WORKSPACE_ROOT,
        },
      );


      if (
        workspace.baseBranch
      ) {
        const branch =
          validateGitBranchName(
            workspace.baseBranch,
          );


        await execFileAsync(
          "git",
          [
            "checkout",
            branch,
          ],
          {
            cwd:
              expectedPath,
          },
        );
      }
    }
    else {
      await execFileAsync(
        "git",
        [
          "init",
        ],
        {
          cwd:
            expectedPath,
        },
      );


      if (
        workspace.baseBranch
      ) {
        const branch =
          validateGitBranchName(
            workspace.baseBranch,
          );


        await execFileAsync(
          "git",
          [
            "checkout",
            "-b",
            branch,
          ],
          {
            cwd:
              expectedPath,
          },
        );
      }
    }


    return await updateProjectWorkspace(
      projectId,
      {
        status:
          "READY",
      },
    );
  } catch (
    error
  ) {
    await updateProjectWorkspace(
      projectId,
      {
        status:
          "BLOCKED",
      },
    );


    throw error;
  }
}
