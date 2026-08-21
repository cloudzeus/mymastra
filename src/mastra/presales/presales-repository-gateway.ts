import path from "node:path";

import {
  execFile,
} from "node:child_process";

import {
  promisify,
} from "node:util";

import {
  lstat,
  readFile,
  readdir,
  realpath,
} from "node:fs/promises";

import {
  getPresalesSource,
} from "./presales-source-manager";

import {
  buildPresalesRepositoryWorkspacePath,
  getPresalesRepositoryWorkspace,
} from "./presales-repository-workspace-manager";


const execFileAsync =
  promisify(
    execFile,
  );


const MAX_FILE_BYTES =
  1024 * 1024;


const MAX_TREE_ENTRIES =
  4000;


const MAX_SEARCH_FILES =
  2000;


const MAX_SEARCH_RESULTS =
  200;


const IGNORED_DIRECTORIES =
  new Set([
    ".git",
    "node_modules",
    ".next",
    ".mastra",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".turbo",
  ]);


export type PresalesRepositoryAuthority = {
  tenantId: string;
  customerId: string;
  opportunityId: string;
};


export type ResolvedPresalesRepository = {
  tenantId: string;
  customerId: string;
  opportunityId: string;

  presalesSourceId: string;

  repositoryUrl: string;

  requestedRef?: string;

  resolvedRef: string;
  resolvedCommit: string;

  /*
   * Internal server-side authority only.
   * Never expose this path in tool output.
   */
  workspacePath: string;
};


export type RepositoryTreeEntry = {
  path: string;

  type:
    | "FILE"
    | "DIRECTORY";

  size?: number;
};


export type RepositoryReadResult = {
  relativePath: string;

  content: string;

  bytesRead: number;
};


export type RepositorySearchMatch = {
  path: string;

  line: number;

  preview: string;
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


function requireText(
  value: string,
  name: string,
): string {
  const normalized =
    value?.trim();

  if (!normalized) {
    throw new Error(
      `${name} is required`,
    );
  }

  return normalized;
}


function normalizeRelativePath(
  value: string,
): string {
  const normalized =
    requireText(
      value,
      "relativePath",
    ).replace(
      /\\/g,
      "/",
    );

  if (
    path.posix.isAbsolute(
      normalized,
    )
  ) {
    throw new Error(
      "Presales repository BLOCKED: absolute paths are prohibited",
    );
  }

  const segments =
    normalized.split(
      "/",
    );

  if (
    segments.some(
      segment =>
        !segment ||
        segment === "." ||
        segment === "..",
    )
  ) {
    throw new Error(
      "Presales repository BLOCKED: invalid path traversal",
    );
  }

  if (
    segments.some(
      segment =>
        segment === ".git",
    )
  ) {
    throw new Error(
      "Presales repository BLOCKED: .git access is prohibited",
    );
  }

  return segments.join(
    path.sep,
  );
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
    relative === "" ||
    relative === ".." ||
    relative.startsWith(
      `..${path.sep}`,
    ) ||
    path.isAbsolute(
      relative,
    )
  ) {
    throw new Error(
      "Presales repository BLOCKED: target escapes or targets repository root",
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
    if (
      segment === ".git"
    ) {
      throw new Error(
        "Presales repository BLOCKED: .git access is prohibited",
      );
    }

    current =
      path.join(
        current,
        segment,
      );

    const stat =
      await lstat(
        current,
      );

    if (
      stat.isSymbolicLink()
    ) {
      throw new Error(
        `Presales repository BLOCKED: symbolic link encountered: ${relative}`,
      );
    }
  }
}


function resolveTargetPath(
  workspacePath: string,
  requestedRelativePath: string,
): {
  relativePath: string;
  absolutePath: string;
} {
  const relativePath =
    normalizeRelativePath(
      requestedRelativePath,
    );

  const absolutePath =
    path.resolve(
      workspacePath,
      relativePath,
    );

  const relativeFromRoot =
    path.relative(
      workspacePath,
      absolutePath,
    );

  if (
    relativeFromRoot === "" ||
    relativeFromRoot === ".." ||
    relativeFromRoot.startsWith(
      `..${path.sep}`,
    ) ||
    path.isAbsolute(
      relativeFromRoot,
    )
  ) {
    throw new Error(
      "Presales repository BLOCKED: target escapes repository root",
    );
  }

  return {
    relativePath:
      relativePath
        .split(
          path.sep,
        )
        .join("/"),

    absolutePath,
  };
}


async function getVerifiedHeadCommit(
  workspacePath: string,
): Promise<string> {
  const {
    stdout,
  } =
    await execFileAsync(
      "git",
      [
        "rev-parse",
        "--verify",
        "HEAD",
      ],
      {
        cwd:
          workspacePath,

        timeout:
          30_000,

        env: {
          ...process.env,

          GIT_TERMINAL_PROMPT:
            "0",
        },
      },
    );

  const commit =
    stdout.trim();

  if (
    !/^[0-9a-fA-F]{40,64}$/.test(
      commit,
    )
  ) {
    throw new Error(
      "Presales repository BLOCKED: current Git HEAD is invalid",
    );
  }

  return commit;
}


export async function resolvePresalesRepositoryAuthority(
  authority:
    PresalesRepositoryAuthority,

  presalesSourceId:
    string,
): Promise<
  ResolvedPresalesRepository
> {
  const tenantId =
    requireUuid(
      authority.tenantId,
      "tenantId",
    );

  const customerId =
    requireUuid(
      authority.customerId,
      "customerId",
    );

  const opportunityId =
    requireUuid(
      authority.opportunityId,
      "opportunityId",
    );

  const sourceId =
    requireUuid(
      presalesSourceId,
      "presalesSourceId",
    );


  const source =
    await getPresalesSource(
      tenantId,
      sourceId,
    );


  if (
    source.customerId !==
      customerId
  ) {
    throw new Error(
      "Presales repository BLOCKED: customer ownership mismatch",
    );
  }


  if (
    source.opportunityId !==
      opportunityId
  ) {
    throw new Error(
      "Presales repository BLOCKED: opportunity ownership mismatch",
    );
  }


  if (
    source.sourceType !==
      "REPOSITORY"
  ) {
    throw new Error(
      "Presales repository BLOCKED: source is not a REPOSITORY",
    );
  }


  if (
    source.status !==
      "READY"
  ) {
    throw new Error(
      `Presales repository BLOCKED: source status=${source.status}`,
    );
  }


  if (
    source.accessMode !==
      "READ_ONLY"
  ) {
    throw new Error(
      "Presales repository BLOCKED: source is not READ_ONLY",
    );
  }


  if (
    !source.repositoryUrl
  ) {
    throw new Error(
      "Presales repository BLOCKED: authoritative repository URL is missing",
    );
  }


  const workspace =
    await getPresalesRepositoryWorkspace(
      tenantId,
      sourceId,
    );


  if (
    workspace.customerId !==
      customerId ||
    workspace.opportunityId !==
      opportunityId
  ) {
    throw new Error(
      "Presales repository BLOCKED: workspace ownership mismatch",
    );
  }


  if (
    workspace.status !==
      "READY"
  ) {
    throw new Error(
      `Presales repository BLOCKED: workspace status=${workspace.status}`,
    );
  }


  if (
    !workspace.resolvedRef ||
    !workspace.resolvedCommit
  ) {
    throw new Error(
      "Presales repository BLOCKED: workspace has no exact resolved ref/commit",
    );
  }


  const expectedPath =
    buildPresalesRepositoryWorkspacePath(
      opportunityId,
      sourceId,
    );


  if (
    workspace.workspacePath !==
      expectedPath
  ) {
    throw new Error(
      "Presales repository BLOCKED: canonical workspace path invariant violated",
    );
  }


  const rootStat =
    await lstat(
      expectedPath,
    );


  if (
    rootStat.isSymbolicLink() ||
    !rootStat.isDirectory()
  ) {
    throw new Error(
      "Presales repository BLOCKED: canonical workspace is not a trusted directory",
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
      "Presales repository BLOCKED: workspace realpath invariant violated",
    );
  }


  const actualCommit =
    await getVerifiedHeadCommit(
      expectedPath,
    );


  if (
    actualCommit !==
      workspace.resolvedCommit
  ) {
    throw new Error(
      `Presales repository BLOCKED: HEAD commit drift detected; expected=${workspace.resolvedCommit} actual=${actualCommit}`,
    );
  }


  return {
    tenantId,

    customerId,

    opportunityId,

    presalesSourceId:
      sourceId,

    repositoryUrl:
      source.repositoryUrl,

    requestedRef:
      source.requestedRef,

    resolvedRef:
      workspace.resolvedRef,

    resolvedCommit:
      workspace.resolvedCommit,

    workspacePath:
      expectedPath,
  };
}


export async function readPresalesRepositoryFile(
  resolved:
    ResolvedPresalesRepository,

  requestedRelativePath:
    string,
): Promise<
  RepositoryReadResult
> {
  const {
    relativePath,
    absolutePath,
  } =
    resolveTargetPath(
      resolved.workspacePath,
      requestedRelativePath,
    );


  await assertNoSymlinkPath(
    resolved.workspacePath,
    absolutePath,
  );


  const stat =
    await lstat(
      absolutePath,
    );


  if (
    stat.isSymbolicLink()
  ) {
    throw new Error(
      "Presales repository BLOCKED: symbolic-link files are prohibited",
    );
  }


  if (
    !stat.isFile()
  ) {
    throw new Error(
      `Presales repository BLOCKED: target is not a regular file: ${relativePath}`,
    );
  }


  if (
    stat.size >
      MAX_FILE_BYTES
  ) {
    throw new Error(
      `Presales repository BLOCKED: file exceeds ${MAX_FILE_BYTES} byte read limit`,
    );
  }


  const buffer =
    await readFile(
      absolutePath,
    );


  let content:
    string;


  try {
    content =
      new TextDecoder(
        "utf-8",
        {
          fatal: true,
        },
      ).decode(
        buffer,
      );
  }
  catch {
    throw new Error(
      `Presales repository BLOCKED: file is not valid UTF-8 text: ${relativePath}`,
    );
  }


  if (
    content.includes(
      "\u0000",
    )
  ) {
    throw new Error(
      `Presales repository BLOCKED: binary content detected: ${relativePath}`,
    );
  }


  return {
    relativePath,

    content,

    bytesRead:
      buffer.byteLength,
  };
}


export async function listPresalesRepositoryTree(
  resolved:
    ResolvedPresalesRepository,

  options?: {
    relativePath?: string;

    maxDepth?: number;

    maxEntries?: number;
  },
): Promise<
  RepositoryTreeEntry[]
> {
  const maxDepth =
    Math.max(
      0,
      Math.min(
        options?.maxDepth ??
          4,
        12,
      ),
    );


  const maxEntries =
    Math.max(
      1,
      Math.min(
        options?.maxEntries ??
          1000,
        MAX_TREE_ENTRIES,
      ),
    );


  let startPath =
    resolved.workspacePath;


  let startRelative =
    "";


  if (
    options?.relativePath
  ) {
    const target =
      resolveTargetPath(
        resolved.workspacePath,
        options.relativePath,
      );

    await assertNoSymlinkPath(
      resolved.workspacePath,
      target.absolutePath,
    );

    const stat =
      await lstat(
        target.absolutePath,
      );

    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink()
    ) {
      throw new Error(
        "Presales repository BLOCKED: tree root must be a regular directory",
      );
    }

    startPath =
      target.absolutePath;

    startRelative =
      target.relativePath;
  }


  const results:
    RepositoryTreeEntry[] =
      [];


  async function walk(
    currentAbsolute:
      string,

    currentRelative:
      string,

    depth:
      number,
  ): Promise<void> {
    if (
      results.length >=
        maxEntries
    ) {
      return;
    }


    const entries =
      await readdir(
        currentAbsolute,
        {
          withFileTypes: true,
        },
      );


    entries.sort(
      (
        a,
        b,
      ) =>
        a.name.localeCompare(
          b.name,
        ),
    );


    for (
      const entry
      of entries
    ) {
      if (
        results.length >=
          maxEntries
      ) {
        return;
      }


      if (
        entry.name === ".git" ||
        (
          entry.isDirectory() &&
          IGNORED_DIRECTORIES.has(
            entry.name,
          )
        )
      ) {
        continue;
      }


      const absolute =
        path.join(
          currentAbsolute,
          entry.name,
        );


      const relative =
        currentRelative
          ? `${currentRelative}/${entry.name}`
          : entry.name;


      const stat =
        await lstat(
          absolute,
        );


      if (
        stat.isSymbolicLink()
      ) {
        continue;
      }


      if (
        stat.isDirectory()
      ) {
        results.push({
          path:
            relative,

          type:
            "DIRECTORY",
        });


        if (
          depth <
            maxDepth
        ) {
          await walk(
            absolute,
            relative,
            depth + 1,
          );
        }

        continue;
      }


      if (
        stat.isFile()
      ) {
        results.push({
          path:
            relative,

          type:
            "FILE",

          size:
            stat.size,
        });
      }
    }
  }


  await walk(
    startPath,
    startRelative,
    0,
  );


  return results;
}


export async function searchPresalesRepository(
  resolved:
    ResolvedPresalesRepository,

  query:
    string,

  options?: {
    caseSensitive?: boolean;

    maxResults?: number;
  },
): Promise<
  RepositorySearchMatch[]
> {
  const normalizedQuery =
    requireText(
      query,
      "query",
    );


  if (
    normalizedQuery.length >
      500
  ) {
    throw new Error(
      "Repository search query is too long",
    );
  }


  const maxResults =
    Math.max(
      1,
      Math.min(
        options?.maxResults ??
          50,
        MAX_SEARCH_RESULTS,
      ),
    );


  const caseSensitive =
    options?.caseSensitive ??
      false;


  const needle =
    caseSensitive
      ? normalizedQuery
      : normalizedQuery
          .toLocaleLowerCase();


  const matches:
    RepositorySearchMatch[] =
      [];


  let scannedFiles =
    0;


  async function walk(
    directory:
      string,

    relativeDirectory:
      string,
  ): Promise<void> {
    if (
      matches.length >=
        maxResults ||
      scannedFiles >=
        MAX_SEARCH_FILES
    ) {
      return;
    }


    const entries =
      await readdir(
        directory,
        {
          withFileTypes:
            true,
        },
      );


    for (
      const entry
      of entries
    ) {
      if (
        matches.length >=
          maxResults ||
        scannedFiles >=
          MAX_SEARCH_FILES
      ) {
        return;
      }


      if (
        entry.name === ".git" ||
        (
          entry.isDirectory() &&
          IGNORED_DIRECTORIES.has(
            entry.name,
          )
        )
      ) {
        continue;
      }


      const absolute =
        path.join(
          directory,
          entry.name,
        );


      const relative =
        relativeDirectory
          ? `${relativeDirectory}/${entry.name}`
          : entry.name;


      const stat =
        await lstat(
          absolute,
        );


      if (
        stat.isSymbolicLink()
      ) {
        continue;
      }


      if (
        stat.isDirectory()
      ) {
        await walk(
          absolute,
          relative,
        );

        continue;
      }


      if (
        !stat.isFile() ||
        stat.size >
          MAX_FILE_BYTES
      ) {
        continue;
      }


      scannedFiles +=
        1;


      let buffer:
        Buffer;


      try {
        buffer =
          await readFile(
            absolute,
          );
      }
      catch {
        continue;
      }


      let content:
        string;


      try {
        content =
          new TextDecoder(
            "utf-8",
            {
              fatal: true,
            },
          ).decode(
            buffer,
          );
      }
      catch {
        continue;
      }


      if (
        content.includes(
          "\u0000",
        )
      ) {
        continue;
      }


      const lines =
        content.split(
          /\r?\n/,
        );


      for (
        let index = 0;
        index <
          lines.length;
        index += 1
      ) {
        const line =
          lines[index];


        const comparable =
          caseSensitive
            ? line
            : line
                .toLocaleLowerCase();


        if (
          !comparable.includes(
            needle,
          )
        ) {
          continue;
        }


        matches.push({
          path:
            relative,

          line:
            index + 1,

          preview:
            line
              .trim()
              .slice(
                0,
                500,
              ),
        });


        if (
          matches.length >=
            maxResults
        ) {
          return;
        }
      }
    }
  }


  await walk(
    resolved.workspacePath,
    "",
  );


  return matches;
}


export async function getPresalesRepositoryGitMetadata(
  resolved:
    ResolvedPresalesRepository,
): Promise<{
  resolvedRef: string;

  resolvedCommit: string;

  headCommit: string;

  detachedHead: boolean;
}> {
  const headCommit =
    await getVerifiedHeadCommit(
      resolved.workspacePath,
    );


  const {
    stdout:
      symbolicHead,
  } =
    await execFileAsync(
      "git",
      [
        "symbolic-ref",
        "-q",
        "HEAD",
      ],
      {
        cwd:
          resolved.workspacePath,

        timeout:
          30_000,

        env: {
          ...process.env,

          GIT_TERMINAL_PROMPT:
            "0",
        },
      },
    ).catch(
      () => ({
        stdout: "",
        stderr: "",
      }),
    );


  return {
    resolvedRef:
      resolved.resolvedRef,

    resolvedCommit:
      resolved.resolvedCommit,

    headCommit,

    detachedHead:
      !symbolicHead.trim(),
  };
}
