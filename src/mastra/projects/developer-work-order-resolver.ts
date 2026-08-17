import path from "node:path";

import {
  lstat,
  realpath,
} from "node:fs/promises";

import {
  buildProjectWorkspacePath,
  getProjectWorkspace,
} from "./workspace-manager";

import {
  validateDeveloperWorkOrder,
} from "./developer-work-order-validator";

import type {
  DeveloperWorkOrder,
} from "./developer-work-order-types";

import type {
  ProjectDefinitionPackage,
} from "./project-definition-types";


export type ResolvedDeveloperScope = {
  relativePath: string;

  absolutePath: string;
};


export type ResolvedDeveloperWorkOrder = {
  workOrder:
    DeveloperWorkOrder;

  projectDefinition:
    ProjectDefinitionPackage;

  workspace: {
    projectId: string;

    workspacePath: string;

    realWorkspacePath: string;

    repositoryUrl?: string;

    baseBranch?: string;

    status:
      "READY";
  };

  allowedScope:
    ResolvedDeveloperScope[];
};


async function assertReadyCanonicalWorkspace(
  projectId: string,
): Promise<{
  projectId: string;

  workspacePath: string;

  realWorkspacePath: string;

  repositoryUrl?: string;

  baseBranch?: string;

  status:
    "READY";
}> {
  const workspace =
    await getProjectWorkspace(
      projectId,
    );


  if (
    workspace.status !==
    "READY"
  ) {
    throw new Error(
      `Developer execution BLOCKED: project workspace status is ${workspace.status}`,
    );
  }


  const expectedPath =
    buildProjectWorkspacePath(
      projectId,
    );


  if (
    workspace.workspacePath !==
    expectedPath
  ) {
    throw new Error(
      `Developer execution BLOCKED: workspace path invariant violation for project=${projectId}`,
    );
  }


  const workspaceStat =
    await lstat(
      expectedPath,
    );


  if (
    workspaceStat.isSymbolicLink()
  ) {
    throw new Error(
      `Developer execution BLOCKED: workspace must not be a symbolic link: ${expectedPath}`,
    );
  }


  if (
    !workspaceStat.isDirectory()
  ) {
    throw new Error(
      `Developer execution BLOCKED: workspace is not a directory: ${expectedPath}`,
    );
  }


  const resolvedWorkspacePath =
    await realpath(
      expectedPath,
    );


  if (
    resolvedWorkspacePath !==
    expectedPath
  ) {
    throw new Error(
      `Developer execution BLOCKED: workspace realpath mismatch: expected=${expectedPath} actual=${resolvedWorkspacePath}`,
    );
  }


  return {
    projectId:
      workspace.projectId,

    workspacePath:
      expectedPath,

    realWorkspacePath:
      resolvedWorkspacePath,

    repositoryUrl:
      workspace.repositoryUrl,

    baseBranch:
      workspace.baseBranch,

    status:
      "READY",
  };
}


function resolveAllowedScopePath(
  workspacePath: string,
  relativePath: string,
): ResolvedDeveloperScope {
  const normalizedRelative =
    relativePath
      .trim()
      .replaceAll(
        "\\",
        "/",
      );


  const absolutePath =
    path.resolve(
      workspacePath,
      normalizedRelative,
    );


  const relativeFromWorkspace =
    path.relative(
      workspacePath,
      absolutePath,
    );


  if (
    relativeFromWorkspace ===
      "" ||
    relativeFromWorkspace ===
      "." ||
    relativeFromWorkspace ===
      ".." ||
    relativeFromWorkspace.startsWith(
      `..${path.sep}`,
    ) ||
    path.isAbsolute(
      relativeFromWorkspace,
    )
  ) {
    throw new Error(
      `Developer execution BLOCKED: resolved scope escapes or targets workspace root: ${relativePath}`,
    );
  }


  return {
    relativePath:
      normalizedRelative,

    absolutePath,
  };
}


export async function resolveDeveloperWorkOrder(
  workOrder:
    DeveloperWorkOrder,
  projectDefinition:
    ProjectDefinitionPackage,
): Promise<ResolvedDeveloperWorkOrder> {
  const validation =
    validateDeveloperWorkOrder(
      workOrder,
      projectDefinition,
    );


  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "Developer work order validation failed",
        ...validation.errors,
      ].join(
        ": ",
      ),
    );
  }


  const workspace =
    await assertReadyCanonicalWorkspace(
      workOrder.projectId,
    );


  const allowedScope =
    workOrder.allowedScope.paths.map(
      (
        scopePath,
      ) =>
        resolveAllowedScopePath(
          workspace.workspacePath,
          scopePath,
        ),
    );


  return {
    workOrder,
    projectDefinition,
    workspace,
    allowedScope,
  };
}
