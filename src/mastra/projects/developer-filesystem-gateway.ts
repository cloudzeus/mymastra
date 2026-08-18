import path from "node:path";

import {
  constants,
} from "node:fs";

import {
  lstat,
  mkdir,
  open,
} from "node:fs/promises";

import {
  resolveDeveloperWorkOrder,
} from "./developer-work-order-resolver";

import type {
  DeveloperWorkOrder,
} from "./developer-work-order-types";

import type {
  ProjectDefinitionPackage,
} from "./project-definition-types";


export type DeveloperFileWriteInput = {
  workOrder:
    DeveloperWorkOrder;

  projectDefinition:
    ProjectDefinitionPackage;

  relativePath: string;

  content: string;
};


export type DeveloperFileWriteResult = {
  projectId: string;

  relativePath: string;

  absolutePath: string;

  operation:
    | "CREATED"
    | "MODIFIED";

  bytesWritten: number;
};


export type DeveloperFileReadInput = {
  workOrder:
    DeveloperWorkOrder;

  projectDefinition:
    ProjectDefinitionPackage;

  relativePath: string;
};


export type DeveloperFileReadResult = {
  projectId: string;

  relativePath: string;

  absolutePath: string;

  content: string;

  bytesRead: number;
};


function normalizeDeveloperRelativePath(
  relativePath: string,
): string {
  const normalized =
    relativePath
      .trim()
      .replaceAll(
        "\\",
        "/",
      );


  if (!normalized) {
    throw new Error(
      "Developer file path must not be blank",
    );
  }


  if (
    path.isAbsolute(
      normalized,
    )
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: absolute path is prohibited: ${normalized}`,
    );
  }


  const segments =
    normalized.split(
      "/",
    );


  if (
    segments.some(
      (
        segment,
      ) =>
        segment ===
          "" ||
        segment ===
          "." ||
        segment ===
          "..",
    )
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: invalid path segments: ${normalized}`,
    );
  }


  if (
    segments.some(
      (
        segment,
      ) =>
        segment ===
        ".git",
    )
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: .git access is prohibited: ${normalized}`,
    );
  }


  return normalized;
}


function pathIsInsideScope(
  targetAbsolutePath: string,
  scopeAbsolutePath: string,
): boolean {
  const relative =
    path.relative(
      scopeAbsolutePath,
      targetAbsolutePath,
    );


  return (
    relative ===
      "" ||
    (
      relative !==
        ".." &&
      !relative.startsWith(
        `..${path.sep}`,
      ) &&
      !path.isAbsolute(
        relative,
      )
    )
  );
}


async function pathExists(
  targetPath: string,
): Promise<boolean> {
  try {
    await lstat(
      targetPath,
    );

    return true;
  } catch (
    error
  ) {
    if (
      (
        error as
          NodeJS.ErrnoException
      ).code ===
      "ENOENT"
    ) {
      return false;
    }


    throw error;
  }
}


async function assertNoSymlinkPath(
  workspacePath: string,
  targetAbsolutePath: string,
): Promise<void> {
  const relative =
    path.relative(
      workspacePath,
      targetAbsolutePath,
    );


  if (
    relative ===
      "" ||
    relative ===
      ".." ||
    relative.startsWith(
      `..${path.sep}`,
    ) ||
    path.isAbsolute(
      relative,
    )
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: target escapes workspace: ${targetAbsolutePath}`,
    );
  }


  const segments =
    relative.split(
      path.sep,
    );


  let current =
    workspacePath;


  for (
    const segment
    of segments
  ) {
    current =
      path.join(
        current,
        segment,
      );


    try {
      const stat =
        await lstat(
          current,
        );


      if (
        stat.isSymbolicLink()
      ) {
        throw new Error(
          `Developer filesystem BLOCKED: symbolic link encountered: ${current}`,
        );
      }
    } catch (
      error
    ) {
      if (
        (
          error as
            NodeJS.ErrnoException
        ).code ===
        "ENOENT"
      ) {
        return;
      }


      throw error;
    }
  }
}


async function ensureSafeParentDirectories(
  workspacePath: string,
  targetAbsolutePath: string,
): Promise<void> {
  const parentPath =
    path.dirname(
      targetAbsolutePath,
    );


  const relativeParent =
    path.relative(
      workspacePath,
      parentPath,
    );


  if (
    relativeParent ===
      "" ||
    relativeParent ===
      "."
  ) {
    return;
  }


  if (
    relativeParent ===
      ".." ||
    relativeParent.startsWith(
      `..${path.sep}`,
    ) ||
    path.isAbsolute(
      relativeParent,
    )
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: parent escapes workspace: ${parentPath}`,
    );
  }


  const segments =
    relativeParent.split(
      path.sep,
    );


  let current =
    workspacePath;


  for (
    const segment
    of segments
  ) {
    current =
      path.join(
        current,
        segment,
      );


    try {
      const stat =
        await lstat(
          current,
        );


      if (
        stat.isSymbolicLink()
      ) {
        throw new Error(
          `Developer filesystem BLOCKED: symbolic link parent encountered: ${current}`,
        );
      }


      if (
        !stat.isDirectory()
      ) {
        throw new Error(
          `Developer filesystem BLOCKED: parent path is not a directory: ${current}`,
        );
      }
    } catch (
      error
    ) {
      if (
        (
          error as
            NodeJS.ErrnoException
        ).code !==
        "ENOENT"
      ) {
        throw error;
      }


      await mkdir(
        current,
        {
          mode:
            0o750,
        },
      );


      const createdStat =
        await lstat(
          current,
        );


      if (
        createdStat.isSymbolicLink() ||
        !createdStat.isDirectory()
      ) {
        throw new Error(
          `Developer filesystem BLOCKED: unsafe directory created: ${current}`,
        );
      }
    }
  }
}


async function resolveAuthorizedDeveloperTarget(
  workOrder:
    DeveloperWorkOrder,

  projectDefinition:
    ProjectDefinitionPackage,

  requestedRelativePath: string,
) {
  const resolved =
    await resolveDeveloperWorkOrder(
      workOrder,
      projectDefinition,
    );


  const relativePath =
    normalizeDeveloperRelativePath(
      requestedRelativePath,
    );


  const absolutePath =
    path.resolve(
      resolved.workspace.workspacePath,
      relativePath,
    );


  const relativeFromWorkspace =
    path.relative(
      resolved.workspace.workspacePath,
      absolutePath,
    );


  if (
    relativeFromWorkspace ===
      "" ||
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
      `Developer filesystem BLOCKED: target escapes or targets workspace root: ${relativePath}`,
    );
  }


  const insideAllowedScope =
    resolved.allowedScope.some(
      (
        scope,
      ) =>
        pathIsInsideScope(
          absolutePath,
          scope.absolutePath,
        ),
    );


  if (
    !insideAllowedScope
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: target is outside allowed scope: ${relativePath}`,
    );
  }


  await assertNoSymlinkPath(
    resolved.workspace.workspacePath,
    absolutePath,
  );


  return {
    resolved,
    relativePath,
    absolutePath,
  };
}


export async function writeDeveloperFile(
  input:
    DeveloperFileWriteInput,
): Promise<DeveloperFileWriteResult> {
  const {
    resolved,
    relativePath,
    absolutePath,
  } =
    await resolveAuthorizedDeveloperTarget(
      input.workOrder,
      input.projectDefinition,
      input.relativePath,
    );


  const exists =
    await pathExists(
      absolutePath,
    );


  if (
    exists &&
    !input.workOrder.allowedScope.allowModify
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: modification is not allowed: ${relativePath}`,
    );
  }


  if (
    !exists &&
    !input.workOrder.allowedScope.allowCreate
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: creation is not allowed: ${relativePath}`,
    );
  }


  if (
    exists
  ) {
    const existingStat =
      await lstat(
        absolutePath,
      );


    if (
      existingStat.isSymbolicLink()
    ) {
      throw new Error(
        `Developer filesystem BLOCKED: target file is a symbolic link: ${relativePath}`,
      );
    }


    if (
      !existingStat.isFile()
    ) {
      throw new Error(
        `Developer filesystem BLOCKED: target is not a regular file: ${relativePath}`,
      );
    }
  }


  await ensureSafeParentDirectories(
    resolved.workspace.workspacePath,
    absolutePath,
  );


  /*
   * Re-check immediately before opening the target.
   */
  await assertNoSymlinkPath(
    resolved.workspace.workspacePath,
    absolutePath,
  );


  const data =
    Buffer.from(
      input.content,
      "utf8",
    );


  const flags =
    exists
      ? (
          constants.O_WRONLY |
          constants.O_TRUNC |
          constants.O_NOFOLLOW
        )
      : (
          constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW
        );


  const handle =
    await open(
      absolutePath,
      flags,
      0o640,
    );


  try {
    await handle.writeFile(
      data,
    );
  } finally {
    await handle.close();
  }


  return {
    projectId:
      input.workOrder.projectId,

    relativePath,

    absolutePath,

    operation:
      exists
        ? "MODIFIED"
        : "CREATED",

    bytesWritten:
      data.byteLength,
  };
}



const MAX_DEVELOPER_READ_BYTES =
  1_048_576;


export async function readDeveloperFile(
  input:
    DeveloperFileReadInput,
): Promise<DeveloperFileReadResult> {
  const {
    resolved,
    relativePath,
    absolutePath,
  } =
    await resolveAuthorizedDeveloperTarget(
      input.workOrder,
      input.projectDefinition,
      input.relativePath,
    );


  const exists =
    await pathExists(
      absolutePath,
    );


  if (
    !exists
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: target file does not exist: ${relativePath}`,
    );
  }


  const existingStat =
    await lstat(
      absolutePath,
    );


  if (
    existingStat.isSymbolicLink()
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: target file is a symbolic link: ${relativePath}`,
    );
  }


  if (
    !existingStat.isFile()
  ) {
    throw new Error(
      `Developer filesystem BLOCKED: target is not a regular file: ${relativePath}`,
    );
  }


  /*
   * Re-check the full path immediately before opening the target.
   */
  await assertNoSymlinkPath(
    resolved.workspace.workspacePath,
    absolutePath,
  );


  const flags =
    constants.O_RDONLY |
    constants.O_NOFOLLOW;


  const handle =
    await open(
      absolutePath,
      flags,
    );


  try {
    /*
     * Check the already-open file descriptor rather than relying
     * only on the earlier path-based stat.
     */
    const openedStat =
      await handle.stat();


    if (
      !openedStat.isFile()
    ) {
      throw new Error(
        `Developer filesystem BLOCKED: opened target is not a regular file: ${relativePath}`,
      );
    }


    if (
      openedStat.size >
      MAX_DEVELOPER_READ_BYTES
    ) {
      throw new Error(
        `Developer filesystem BLOCKED: file exceeds ${MAX_DEVELOPER_READ_BYTES} byte read limit: ${relativePath}`,
      );
    }


    const data =
      await handle.readFile();


    if (
      data.byteLength >
      MAX_DEVELOPER_READ_BYTES
    ) {
      throw new Error(
        `Developer filesystem BLOCKED: file exceeds ${MAX_DEVELOPER_READ_BYTES} byte read limit: ${relativePath}`,
      );
    }


    let content: string;


    try {
      content =
        new TextDecoder(
          "utf-8",
          {
            fatal:
              true,
          },
        ).decode(
          data,
        );
    } catch {
      throw new Error(
        `Developer filesystem BLOCKED: file is not valid UTF-8 text: ${relativePath}`,
      );
    }


    return {
      projectId:
        input.workOrder.projectId,

      relativePath,

      absolutePath,

      content,

      bytesRead:
        data.byteLength,
    };
  } finally {
    await handle.close();
  }
}
