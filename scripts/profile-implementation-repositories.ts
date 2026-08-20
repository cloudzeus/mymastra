import {
  execFile,
} from "node:child_process";

import {
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";

import {
  promisify,
} from "node:util";

import {
  join,
} from "node:path";

import {
  appDb,
} from "../src/mastra/db/postgres";


const execFileAsync =
  promisify(execFile);


const WORKSPACE_ROOT =
  process.env
    .IMPLEMENTATION_CATALOG_WORKSPACE_ROOT
    ?.trim() ||
  "/opt/mastra-implementation-repositories";


type RepositoryRow = {
  id: string;

  owner: string;

  repository_name: string;

  repository_url: string;

  default_branch:
    string | null;
};


type DependencyAudit = {
  available: boolean;

  critical: number;

  high: number;

  moderate: number;

  low: number;

  total: number;

  status:
    | "PASS"
    | "WARNING"
    | "BLOCKED"
    | "UNKNOWN";

  score: number;

  error?: string;
};


type RepositoryProfile = {
  stack: string[];

  packageVersions:
    Record<string, string>;

  dependencyAudit:
    DependencyAudit;

  signals: string[];

  importantFiles: string[];

  integrations: string[];

  databases: string[];

  frameworks: string[];

  hasApiRoutes: boolean;

  hasPrisma: boolean;

  hasDocker: boolean;

  hasTests: boolean;

  hasCron: boolean;

  hasWebhooks: boolean;

  worthDeepScan: boolean;

  summary: string;
};


async function git(
  cwd: string,
  args: string[],
): Promise<string> {
  const result =
    await execFileAsync(
      "git",
      args,
      {
        cwd,
        maxBuffer:
          20 * 1024 * 1024,
      },
    );

  return result.stdout.trim();
}


async function gitFrom(
  args: string[],
): Promise<string> {
  const result =
    await execFileAsync(
      "git",
      args,
      {
        maxBuffer:
          20 * 1024 * 1024,
      },
    );

  return result.stdout.trim();
}


function uniq(
  values: string[],
): string[] {
  return [
    ...new Set(
      values.filter(Boolean),
    ),
  ];
}


function includesAny(
  value: string,
  needles: string[],
): boolean {
  const lower =
    value.toLowerCase();

  return needles.some(
    needle =>
      lower.includes(
        needle.toLowerCase(),
      ),
  );
}


async function readGitFile(
  cwd: string,
  path: string,
): Promise<string | undefined> {
  try {
    return await git(
      cwd,
      [
        "show",
        `HEAD:${path}`,
      ],
    );
  }
  catch {
    return undefined;
  }
}


function detectPackageSignals(
  packageJsonText:
    string | undefined,
) {
  const stack:
    string[] = [];

  const frameworks:
    string[] = [];

  const databases:
    string[] = [];

  const integrations:
    string[] = [];

  const packageVersions:
    Record<string, string> = {};

  if (!packageJsonText) {
    return {
      stack,
      frameworks,
      databases,
      integrations,
      packageVersions,
    };
  }

  let parsed:
    Record<string, any>;

  try {
    parsed =
      JSON.parse(
        packageJsonText,
      );
  }
  catch {
    return {
      stack,
      frameworks,
      databases,
      integrations,
      packageVersions,
    };
  }

  const dependencies = {
    ...(parsed.dependencies ?? {}),
    ...(parsed.devDependencies ?? {}),
  };

  const names =
    Object.keys(
      dependencies,
    );

  for (
    const packageName
    of [
      "next",
      "react",
      "react-dom",
      "typescript",
      "prisma",
      "@prisma/client",
      "next-auth",
      "@auth/core",
      "tailwindcss",
      "zod",
    ]
  ) {
    const version =
      dependencies[
        packageName
      ];

    if (
      typeof version ===
        "string"
    ) {
      packageVersions[
        packageName
      ] =
        version;
    }
  }

  const has =
    (name: string) =>
      names.includes(name);


  if (has("next")) {
    stack.push(
      `Next.js ${dependencies.next}`,
    );

    frameworks.push(
      "Next.js",
    );
  }

  if (has("react")) {
    stack.push(
      `React ${dependencies.react}`,
    );
  }

  if (
    has("typescript") ||
    names.some(
      item =>
        item.startsWith(
          "@types/",
        ),
    )
  ) {
    stack.push(
      "TypeScript",
    );
  }

  if (
    has("@prisma/client") ||
    has("prisma")
  ) {
    stack.push(
      "Prisma",
    );
  }

  if (has("tailwindcss")) {
    stack.push(
      "Tailwind CSS",
    );
  }

  if (
    has("next-auth") ||
    has("@auth/core")
  ) {
    integrations.push(
      "Auth.js / NextAuth",
    );
  }

  if (
    has("mysql2") ||
    has("mysql")
  ) {
    databases.push(
      "MySQL",
    );
  }

  if (
    has("pg") ||
    has("postgres")
  ) {
    databases.push(
      "PostgreSQL",
    );
  }

  if (
    has("mongoose") ||
    has("mongodb")
  ) {
    databases.push(
      "MongoDB",
    );
  }

  if (
    has("redis") ||
    has("ioredis")
  ) {
    databases.push(
      "Redis",
    );
  }

  if (has("node-cron")) {
    integrations.push(
      "node-cron",
    );
  }

  if (
    has("stripe")
  ) {
    integrations.push(
      "Stripe",
    );
  }

  if (
    has("@aws-sdk/client-s3") ||
    has("aws-sdk")
  ) {
    integrations.push(
      "S3-compatible storage",
    );
  }

  return {
    stack,
    frameworks,
    databases,
    integrations,
    packageVersions,
  };
}


async function auditNpmDependencies(
  repositoryDirectory: string,
  packageJson:
    string | undefined,
  packageLock:
    string | undefined,
): Promise<DependencyAudit> {
  if (
    !packageJson ||
    !packageLock
  ) {
    return {
      available: false,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      total: 0,
      status: "UNKNOWN",
      score: 0,
    };
  }

  const auditDirectory =
    join(
      repositoryDirectory,
      ".catalog-audit",
    );

  await rm(
    auditDirectory,
    {
      recursive: true,
      force: true,
    },
  );

  await mkdir(
    auditDirectory,
    {
      recursive: true,
    },
  );

  try {
    await writeFile(
      join(
        auditDirectory,
        "package.json",
      ),
      packageJson,
    );

    await writeFile(
      join(
        auditDirectory,
        "package-lock.json",
      ),
      packageLock,
    );

    let output =
      "";

    try {
      const result =
        await execFileAsync(
          "npm",
          [
            "audit",
            "--package-lock-only",
            "--ignore-scripts",
            "--json",
          ],
          {
            cwd:
              auditDirectory,

            maxBuffer:
              30 * 1024 * 1024,

            env: {
              ...process.env,
              npm_config_audit:
                "true",
              npm_config_fund:
                "false",
            },
          },
        );

      output =
        result.stdout;
    }
    catch (error: any) {
      /*
       * npm audit returns non-zero when
       * vulnerabilities are detected.
       * That is expected.
       */
      output =
        typeof error?.stdout ===
          "string"
          ? error.stdout
          : "";
    }

    if (!output.trim()) {
      return {
        available: false,
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        total: 0,
        status: "UNKNOWN",
        score: 0,
        error:
          "npm audit returned no JSON output",
      };
    }

    const parsed =
      JSON.parse(
        output,
      );

    const vulnerabilities =
      parsed?.metadata
        ?.vulnerabilities ??
      {};

    const critical =
      Number(
        vulnerabilities
          .critical ?? 0,
      );

    const high =
      Number(
        vulnerabilities
          .high ?? 0,
      );

    const moderate =
      Number(
        vulnerabilities
          .moderate ?? 0,
      );

    const low =
      Number(
        vulnerabilities
          .low ?? 0,
      );

    const total =
      Number(
        vulnerabilities
          .total ??
          (
            critical +
            high +
            moderate +
            low
          ),
      );

    if (
      critical > 0
    ) {
      return {
        available: true,
        critical,
        high,
        moderate,
        low,
        total,
        status:
          "BLOCKED",
        score: 0,
      };
    }

    if (
      high > 0
    ) {
      return {
        available: true,
        critical,
        high,
        moderate,
        low,
        total,
        status:
          "WARNING",
        score: 2,
      };
    }

    if (
      moderate > 0
    ) {
      return {
        available: true,
        critical,
        high,
        moderate,
        low,
        total,
        status:
          "WARNING",
        score: 4,
      };
    }

    return {
      available: true,
      critical,
      high,
      moderate,
      low,
      total,
      status:
        "PASS",
      score: 5,
    };
  }
  catch (error) {
    return {
      available: false,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      total: 0,
      status: "UNKNOWN",
      score: 0,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
  finally {
    await rm(
      auditDirectory,
      {
        recursive: true,
        force: true,
      },
    );
  }
}


function profileTree(
  tree: string[],
  packageSignals:
    ReturnType<
      typeof detectPackageSignals
    >,
): RepositoryProfile {
  const normalized =
    tree.map(
      item =>
        item.toLowerCase(),
    );

  const signals:
    string[] = [];

  const integrations = [
    ...packageSignals.integrations,
  ];

  const databases = [
    ...packageSignals.databases,
  ];

  const importantFiles =
    tree.filter(
      file =>
        includesAny(
          file,
          [
            "package.json",
            "prisma/schema.prisma",
            "dockerfile",
            "docker-compose",
            "readme",
            "/api/",
            "/lib/",
            "/services/",
            "/integrations/",
            "webhook",
            "cron",
            "worker",
          ],
        ),
    )
    .slice(
      0,
      150,
    );


  const hasPrisma =
    normalized.includes(
      "prisma/schema.prisma",
    );

  const hasDocker =
    normalized.some(
      item =>
        item.endsWith(
          "dockerfile",
        ) ||
        item.includes(
          "docker-compose",
        ),
    );

  const hasApiRoutes =
    normalized.some(
      item =>
        item.includes(
          "/api/",
        ) &&
        (
          item.endsWith(
            "route.ts",
          ) ||
          item.endsWith(
            "route.js",
          )
        ),
    );

  const hasTests =
    normalized.some(
      item =>
        item.includes(
          ".test.",
        ) ||
        item.includes(
          ".spec.",
        ) ||
        item.includes(
          "__tests__",
        ),
    );

  const hasCron =
    normalized.some(
      item =>
        item.includes(
          "cron",
        ) ||
        item.includes(
          "scheduler",
        ),
    );

  const hasWebhooks =
    normalized.some(
      item =>
        item.includes(
          "webhook",
        ),
    );


  const integrationPatterns:
    Array<
      [string, string[]]
    > = [
      [
        "SoftOne",
        [
          "softone",
          "soft1",
        ],
      ],

      [
        "AADE",
        [
          "aade",
          "mydata",
        ],
      ],

      [
        "Milesight",
        [
          "milesight",
          "lpr",
          "peoplecount",
        ],
      ],

      [
        "BunnyCDN",
        [
          "bunny",
        ],
      ],

      [
        "Microsoft",
        [
          "microsoft",
          "graph",
          "azure",
        ],
      ],

      [
        "Google",
        [
          "google",
        ],
      ],

      [
        "WooCommerce",
        [
          "woocommerce",
          "woo",
        ],
      ],

      [
        "Strapi",
        [
          "strapi",
        ],
      ],
    ];


  const treeText =
    normalized.join(
      "\n",
    );

  for (
    const [
      name,
      patterns,
    ]
    of integrationPatterns
  ) {
    if (
      patterns.some(
        pattern =>
          treeText.includes(
            pattern,
          ),
      )
    ) {
      integrations.push(
        name,
      );
    }
  }


  if (hasApiRoutes) {
    signals.push(
      "API_ROUTES",
    );
  }

  if (hasPrisma) {
    signals.push(
      "PRISMA_SCHEMA",
    );
  }

  if (hasWebhooks) {
    signals.push(
      "WEBHOOKS",
    );
  }

  if (hasCron) {
    signals.push(
      "BACKGROUND_JOBS",
    );
  }

  if (hasDocker) {
    signals.push(
      "CONTAINERIZED",
    );
  }

  if (hasTests) {
    signals.push(
      "AUTOMATED_TESTS",
    );
  }


  let valueScore =
    0;

  if (hasApiRoutes) {
    valueScore += 2;
  }

  if (hasPrisma) {
    valueScore += 2;
  }

  if (hasWebhooks) {
    valueScore += 2;
  }

  if (hasCron) {
    valueScore += 1;
  }

  if (
    integrations.length > 0
  ) {
    valueScore += 3;
  }

  if (
    importantFiles.length >
      20
  ) {
    valueScore += 1;
  }


  const worthDeepScan =
    valueScore >= 3;


  return {
    stack:
      uniq(
        packageSignals.stack,
      ),

    packageVersions:
      packageSignals.packageVersions,

    dependencyAudit: {
      available: false,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      total: 0,
      status: "UNKNOWN",
      score: 0,
    },

    frameworks:
      uniq(
        packageSignals.frameworks,
      ),

    databases:
      uniq(
        databases,
      ),

    integrations:
      uniq(
        integrations,
      ),

    signals:
      uniq(
        signals,
      ),

    importantFiles,

    hasApiRoutes,

    hasPrisma,

    hasDocker,

    hasTests,

    hasCron,

    hasWebhooks,

    worthDeepScan,

    summary: [
      `stack=${uniq(packageSignals.stack).join(", ") || "unknown"}`,

      `integrations=${uniq(integrations).join(", ") || "none"}`,

      `signals=${uniq(signals).join(", ") || "none"}`,

      `deepScan=${worthDeepScan ? "YES" : "NO"}`,
    ].join(
      " | ",
    ),
  };
}


async function profileRepository(
  repository:
    RepositoryRow,
): Promise<{
  commit: string;

  profile:
    RepositoryProfile;
}> {
  const directory =
    join(
      WORKSPACE_ROOT,
      repository.id,
    );

  await rm(
    directory,
    {
      recursive: true,
      force: true,
    },
  );

  await mkdir(
    directory,
    {
      recursive: true,
    },
  );


  await gitFrom(
    [
      "clone",
      "--depth=1",
      "--filter=blob:none",
      "--no-checkout",
      repository.repository_url,
      directory,
    ],
  );


  const commit =
    await git(
      directory,
      [
        "rev-parse",
        "HEAD",
      ],
    );


  const treeText =
    await git(
      directory,
      [
        "ls-tree",
        "-r",
        "--name-only",
        "HEAD",
      ],
    );


  const tree =
    treeText
      .split("\n")
      .map(
        item =>
          item.trim(),
      )
      .filter(Boolean);


  const packageJson =
    await readGitFile(
      directory,
      "package.json",
    );


  const packageLock =
    await readGitFile(
      directory,
      "package-lock.json",
    );


  const packageSignals =
    detectPackageSignals(
      packageJson,
    );


  const dependencyAudit =
    await auditNpmDependencies(
      directory,
      packageJson,
      packageLock,
    );


  const profile =
    profileTree(
      tree,
      packageSignals,
    );


  profile.dependencyAudit =
    dependencyAudit;


  return {
    commit,
    profile,
  };
}


async function main() {
  await mkdir(
    WORKSPACE_ROOT,
    {
      recursive: true,
    },
  );


  const repositories =
    await appDb.query<
      RepositoryRow
    >(
      `
        SELECT
          id::text,
          owner,
          repository_name,
          repository_url,
          default_branch
        FROM app.implementation_repositories
        WHERE status IN (
          'PENDING',
          'FAILED'
        )
        ORDER BY repository_name
      `,
    );


  console.log(
    "\n--- FAST IMPLEMENTATION REPOSITORY PROFILER ---",
  );

  console.log(
    "repositories:",
    repositories.rowCount,
  );


  let ready =
    0;

  let deepScan =
    0;

  let failed =
    0;


  for (
    const repository
    of repositories.rows
  ) {
    console.log(
      `\n--- ${repository.owner}/${repository.repository_name} ---`,
    );


    await appDb.query(
      `
        UPDATE app.implementation_repositories
        SET
          status = 'SCANNING',
          updated_at = now()
        WHERE id = $1
      `,
      [
        repository.id,
      ],
    );


    try {
      const {
        commit,
        profile,
      } =
        await profileRepository(
          repository,
        );


      await appDb.query(
        `
          UPDATE app.implementation_repositories
          SET
            scanned_commit = $2,
            detected_stack = $3::jsonb,
            summary = $4,
            status = 'READY',
            last_scanned_at = now(),
            updated_at = now()
          WHERE id = $1
        `,
        [
          repository.id,

          commit,

          JSON.stringify(
            profile.stack,
          ),

          JSON.stringify(
            profile,
          ),
        ],
      );


      ready += 1;

      if (
        profile.worthDeepScan
      ) {
        deepScan += 1;
      }


      console.log(
        "commit:",
        commit,
      );

      console.log(
        "stack:",
        profile.stack,
      );

      console.log(
        "integrations:",
        profile.integrations,
      );

      console.log(
        "signals:",
        profile.signals,
      );

      console.log(
        "versions:",
        profile.packageVersions,
      );

      console.log(
        "security:",
        profile.dependencyAudit,
      );

      console.log(
        "deepScan:",
        profile.worthDeepScan,
      );
    }
    catch (error) {
      failed += 1;

      await appDb.query(
        `
          UPDATE app.implementation_repositories
          SET
            status = 'FAILED',
            summary = $2,
            updated_at = now()
          WHERE id = $1
        `,
        [
          repository.id,

          String(
            error,
          ).slice(
            0,
            4000,
          ),
        ],
      );

      console.error(
        "FAILED:",
        error,
      );
    }
  }


  console.log(
    "\n--- RESULT ---",
  );

  console.log(
    "READY:",
    ready,
  );

  console.log(
    "DEEP_SCAN_CANDIDATES:",
    deepScan,
  );

  console.log(
    "FAILED:",
    failed,
  );

  console.log(
    "\nFAST IMPLEMENTATION REPOSITORY PROFILER: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nFAST IMPLEMENTATION REPOSITORY PROFILER: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await appDb.end();
    },
  );
