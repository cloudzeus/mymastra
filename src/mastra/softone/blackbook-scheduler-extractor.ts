import fs from "node:fs";

import type {
  SoftOneBlackBookCandidate,
  SoftOneBlackBookExtractionKind,
} from "./blackbook-types";

import {
  SOFTONE_BLACKBOOK_EXTRACTION_POLICIES,
} from "./blackbook-section-map";

import {
  SOFTONE_BLACKBOOK_SOURCE_ID,
} from "./blackbook-types";


const CHAPTER_FILE =
  "data/sources/blackbook/pages/chapter-08-scheduler.txt";

const FIRST_PAGE = 245;


interface PageText {
  page: number;
  text: string;
}


function normalizeText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function splitPages(raw: string): PageText[] {
  return raw
    .split("\f")
    .map((text, index) => ({
      page: FIRST_PAGE + index,
      text: normalizeText(text),
    }))
    .filter((entry) => entry.text.length > 0);
}


function requireText(
  pages: PageText[],
  page: number,
  needle: string,
): string {
  const entry = pages.find(
    (candidate) => candidate.page === page,
  );

  if (!entry) {
    throw new Error(
      `BlackBook page ${page} was not extracted`,
    );
  }

  if (
    !entry.text
      .toLowerCase()
      .includes(needle.toLowerCase())
  ) {
    throw new Error(
      `Expected text not found on BlackBook page ${page}: ${needle}`,
    );
  }

  return entry.text;
}


function makeCandidate(args: {
  id: string;

  page: number;

  section: string;

  extractionKind:
    SoftOneBlackBookExtractionKind;

  claim: string;

  symbol?: string;

  signature?: string;

  tags?: string[];

  limitations?: string[];

  verificationNotes?: string[];
}): SoftOneBlackBookCandidate {
  const policy =
    SOFTONE_BLACKBOOK_EXTRACTION_POLICIES[
      args.extractionKind
    ];

  return {
    id: args.id,

    sourceId:
      SOFTONE_BLACKBOOK_SOURCE_ID,

    chapter: 8,

    chapterTitle:
      "Scheduler & Messages",

    section:
      args.section,

    page:
      args.page,

    extractionKind:
      args.extractionKind,

    claim:
      args.claim,

    evidenceKind:
      policy.evidenceKind,

    productAreas: [
      "CUSTOMIZATION",
      "SCRIPTING",
    ],

    promotionPolicy:
      policy.promotionPolicy,

    recommendedStatus:
      policy.recommendedStatus,

    symbol:
      args.symbol,

    signature:
      args.signature,

    limitations:
      args.limitations,

    verificationNotes: [
      `Documented in SoftOne BlackBook v3.5, page ${args.page}.`,
      ...(args.verificationNotes ?? []),
    ],

    tags: [
      "blackbook",
      "scheduler",
      "chapter-8",
      ...(args.tags ?? []),
    ],
  };
}


export function extractBlackBookSchedulerCandidates(
  raw: string,
): SoftOneBlackBookCandidate[] {
  const pages =
    splitPages(raw);

  /*
   * Every claim below has a deterministic source guard.
   * If a future PDF/version no longer contains the expected
   * wording, extraction fails instead of silently creating
   * unsupported evidence.
   */

  requireText(
    pages,
    252,
    "Jobs running from Remote Server or SoftOne Scheduler can also run through Windows Scheduler",
  );

  requireText(
    pages,
    252,
    "Create a text file which includes the SoftOne job",
  );

  requireText(
    pages,
    252,
    "XECUTOR.LOG",
  );

  requireText(
    pages,
    252,
    "Enable Scheduler/Messages",
  );

  requireText(
    pages,
    253,
    "XCOFILENAME",
  );

  requireText(
    pages,
    253,
    "/execute",
  );

  requireText(
    pages,
    254,
    "must necessarily be located within the application folder",
  );

  requireText(
    pages,
    254,
    "[LOGIN]",
  );

  requireText(
    pages,
    258,
    "SoftOne Scheduler is a tool for scheduling SoftOne jobs",
  );

  requireText(
    pages,
    258,
    "Enable Scheduler / Messages",
  );

  requireText(
    pages,
    259,
    "Executed by",
  );

  requireText(
    pages,
    259,
    "Select Job",
  );

  requireText(
    pages,
    261,
    "Scheduler Commands",
  );

  const candidates:
    SoftOneBlackBookCandidate[] = [

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_CAN_RUN_SOFTONE_JOBS",

      page: 252,

      section:
        "B.1 Windows Scheduler - Overview",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "SoftOne jobs that run from Remote Server or SoftOne Scheduler can also be executed through Windows Scheduler using the documented Windows Scheduler mechanism.",

      tags: [
        "windows-scheduler",
        "execution",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_EXECUTION_MECHANISM",

      page: 252,

      section:
        "B.1 Windows Scheduler - Overview",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "The documented Windows Scheduler mechanism consists of a text file containing the SoftOne job, AutoLogin configuration in the XCO connection file, and a Windows Scheduler task that starts the SoftOne application using that job.",

      tags: [
        "windows-scheduler",
        "xco",
        "autologin",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_XECUTOR_LOG",

      page: 252,

      section:
        "B.1 Windows Scheduler - Overview",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "Windows Scheduler executions and execution errors are logged in XECUTOR.LOG under the SoftOne program profile log directory.",

      symbol:
        "XECUTOR.LOG",

      tags: [
        "windows-scheduler",
        "logging",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_MESSAGES_SETTING_DISABLED",

      page: 252,

      section:
        "B.1 Windows Scheduler - Overview",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "For the documented Windows Scheduler execution mechanism, the SoftOne System Settings option 'Enable Scheduler/Messages' must not be activated.",

      tags: [
        "windows-scheduler",
        "scheduler-messages",
        "configuration",
      ],

      limitations: [
        "This claim applies to the Windows Scheduler mechanism documented in BlackBook v3.5.",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_JOB_FILE",

      page: 253,

      section:
        "B.2 Job File",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "A SoftOne job executed through Windows Scheduler is stored in a text job file containing SoftOne job commands and an XCOFILENAME parameter identifying the XCO connection file.",

      tags: [
        "windows-scheduler",
        "job-file",
        "xco",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_EXECUTE_SWITCH",

      page: 253,

      section:
        "B.2 Job File",

      extractionKind:
        "COMMAND_SIGNATURE",

      claim:
        "SoftOne documents the /execute switch for launching Xplorer.exe with a scheduler job text file.",

      symbol:
        "/execute",

      signature:
        "xplorer.exe /execute:<job-file>",

      tags: [
        "windows-scheduler",
        "xplorer",
        "command-line",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_JOBNAME_COMMAND",

      page: 253,

      section:
        "B.2 Job File",

      extractionKind:
        "COMMAND_SIGNATURE",

      claim:
        "JOBNAME is a documented SoftOne scheduler job-file command representing the name of the job.",

      symbol:
        "JOBNAME",

      tags: [
        "scheduler-command",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_TYPE_BATCH_COMMAND",

      page: 253,

      section:
        "B.2 Job File",

      extractionKind:
        "COMMAND_SIGNATURE",

      claim:
        "TYPE=BATCH is documented as a SoftOne Windows Scheduler job-file job type.",

      symbol:
        "TYPE",

      signature:
        "TYPE=BATCH",

      tags: [
        "scheduler-command",
        "batch",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_OBJECT_COMMAND",

      page: 253,

      section:
        "B.2 Job File",

      extractionKind:
        "COMMAND_SIGNATURE",

      claim:
        "OBJECT is a documented SoftOne Windows Scheduler job-file command identifying the object or script to execute.",

      symbol:
        "OBJECT",

      tags: [
        "scheduler-command",
        "object",
        "script",
      ],

      limitations: [
        "The BlackBook wording 'object or script to execute' does not by itself establish that every SoftOne script mechanism or Form JavaScript function is valid as OBJECT.",
        "This evidence does not establish CLIENTIMPORT as a Scheduler OBJECT value.",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_WINDOWS_SCHEDULER_XCOFILENAME_COMMAND",

      page: 253,

      section:
        "B.2 Job File",

      extractionKind:
        "COMMAND_SIGNATURE",

      claim:
        "XCOFILENAME is a documented SoftOne Windows Scheduler job-file command identifying the XCO connection file.",

      symbol:
        "XCOFILENAME",

      tags: [
        "scheduler-command",
        "xco",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_XCO_SCHEDULER_LOCATION",

      page: 254,

      section:
        "B.3 XCO Connection File",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "For the documented Windows Scheduler setup, the XCO connection file must be located inside the SoftOne application folder.",

      tags: [
        "xco",
        "windows-scheduler",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_XCO_LOGIN_SECTION_FOR_SCHEDULER",

      page: 254,

      section:
        "B.3 XCO Connection File",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "The XCO connection file uses a [LOGIN] section so a Windows Scheduler task can automatically log in to a specific database with a specific user, company and branch before executing the selected job.",

      symbol:
        "[LOGIN]",

      tags: [
        "xco",
        "autologin",
        "windows-scheduler",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_SOFTONE_SCHEDULER_PURPOSE",

      page: 258,

      section:
        "C. SoftOne Scheduler",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "SoftOne Scheduler schedules SoftOne jobs such as browsers and reports to run at a specified time and day for a specified user and optionally repeat at a configured interval.",

      tags: [
        "softone-scheduler",
        "scheduled-jobs",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_SOFTONE_SCHEDULER_MESSAGES_SETTING_ENABLED",

      page: 258,

      section:
        "C. SoftOne Scheduler",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "SoftOne Scheduler messages are activated through the System Settings option 'Enable Scheduler / Messages'.",

      tags: [
        "softone-scheduler",
        "scheduler-messages",
        "configuration",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_SOFTONE_SCHEDULER_EXECUTED_BY",

      page: 259,

      section:
        "C.1 CreateTask",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "A SoftOne Scheduler task has an 'Executed by' setting that determines the user that will run the task.",

      tags: [
        "softone-scheduler",
        "task",
        "user",
      ],
    }),

    makeCandidate({
      id:
        "BLACKBOOK_3_5_SOFTONE_SCHEDULER_SELECT_JOB",

      page: 259,

      section:
        "C.1 CreateTask",

      extractionKind:
        "DOCUMENTED_BEHAVIOR",

      claim:
        "When creating a SoftOne Scheduler task, 'Select Job' selects from the available jobs of the application.",

      tags: [
        "softone-scheduler",
        "task",
        "job",
      ],
    }),
  ];


  /*
   * Scheduler command table on page 261.
   *
   * Each command is explicitly guarded against the extracted
   * source page before a candidate is emitted.
   */
  const schedulerCommands = [
    {
      symbol: "TYPE",
      claim:
        "TYPE is a documented SoftOne Scheduler command defining the job type.",
      signature:
        "TYPE=REPORT|BATCH|DIALOG|DESIGN|ANSWER|REPORTLIST|BATCHLIST|PRINTERLIST|COMPANYLIST|BRANCHLIST|BAM",
    },

    {
      symbol: "OBJECT",
      claim:
        "OBJECT is a documented SoftOne Scheduler command for object selection.",
    },

    {
      symbol: "JOBNAME",
      claim:
        "JOBNAME is a documented SoftOne Scheduler command defining the name of a Browser or designed Report.",
    },

    {
      symbol: "PHOTO",
      claim:
        "PHOTO is a documented SoftOne Scheduler command defining the template name.",
    },

    {
      symbol: "AUTOEXECUTE",
      claim:
        "AUTOEXECUTE is a documented SoftOne Scheduler command controlling automatic execution.",
      signature:
        "AUTOEXECUTE=0|1",
    },

    {
      symbol: "OUTPUT",
      claim:
        "OUTPUT is a documented SoftOne Scheduler command controlling the destination or format of job results.",
    },

    {
      symbol: "FILENAME",
      claim:
        "FILENAME is a documented SoftOne Scheduler command defining the file name used for saved results.",
    },

    {
      symbol: "SENDTO",
      claim:
        "SENDTO is a documented SoftOne Scheduler command for sending results to email or a cell phone.",
      signature:
        "SENDTO=MAIL|GSM",
    },

    {
      symbol: "MAILADDR",
      claim:
        "MAILADDR is a documented SoftOne Scheduler command defining the email address.",
    },

    {
      symbol: "GSMNUM",
      claim:
        "GSMNUM is a documented SoftOne Scheduler command defining the cell phone number.",
    },
  ] as const;


  const schedulerPage =
    requireText(
      pages,
      261,
      "Scheduler Commands",
    );


  for (const command of schedulerCommands) {
    if (
      !schedulerPage
        .toLowerCase()
        .includes(
          command.symbol.toLowerCase(),
        )
    ) {
      throw new Error(
        `Scheduler command ${command.symbol} not found on BlackBook page 261`,
      );
    }

    candidates.push(
      makeCandidate({
        id:
          `BLACKBOOK_3_5_SOFTONE_SCHEDULER_COMMAND_${command.symbol}`,

        page: 261,

        section:
          "C.2 Scheduler Commands",

        extractionKind:
          "COMMAND_SIGNATURE",

        claim:
          command.claim,

        symbol:
          command.symbol,

        signature:
          "signature" in command
            ? command.signature
            : undefined,

        tags: [
          "softone-scheduler",
          "scheduler-command",
        ],

        limitations:
          command.symbol === "OBJECT"
            ? [
                "The Scheduler command table describes OBJECT as object selection and gives CUSTOMER as an example.",
                "It does not establish CLIENTIMPORT, FORMIMPORT or arbitrary Form JavaScript as valid OBJECT values.",
              ]
            : undefined,
      }),
    );
  }


  return candidates;
}


export function extractBlackBookSchedulerFromFile(
  filename = CHAPTER_FILE,
): SoftOneBlackBookCandidate[] {
  const raw =
    fs.readFileSync(
      filename,
      "utf8",
    );

  return extractBlackBookSchedulerCandidates(
    raw,
  );
}
