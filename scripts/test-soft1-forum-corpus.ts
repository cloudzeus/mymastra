import {
  buildSoft1ForumCorpus,
} from "../src/mastra/softone/google-groups-collector";

import {
  normalizeSoft1ForumCorpus,
} from "../src/mastra/softone/soft1-forum-normalizer";


const corpus =
  buildSoft1ForumCorpus([
    {
      gmailThreadId:
        "19adfa0bae5ceea2",

      groupThreadId:
        "example-thread",

      subject:
        "Database View & Object",

      threadUrl:
        "https://groups.google.com/g/soft1/c/example",

      gmailUrl:
        "https://mail.google.com/mail/u/0/#inbox/example",

      complete:
        true,

      messages: [
        {
          messageId:
            "m1",

          author:
            "Developer A",

          publishedAt:
            "2026-01-01T10:00:00Z",

          body:
            "WHERE Company = :CCCQFILTERS.COMPANY",
        },

        {
          messageId:
            "m2",

          author:
            "Developer B",

          publishedAt:
            "2026-01-01T11:00:00Z",

          body:
            "λειτούργησε κανονικά",
        },
      ],
    },
  ]);


const normalized =
  normalizeSoft1ForumCorpus(
    corpus,
  );


const thread =
  normalized.threads[0];


if (!thread) {
  throw new Error(
    "Normalized thread missing.",
  );
}


if (
  thread.sourceKey !==
  "gmail-thread:19adfa0bae5ceea2"
) {
  throw new Error(
    `Unexpected sourceKey: ${thread.sourceKey}`,
  );
}


if (
  thread.classification !==
  "CONFIRMED"
) {
  throw new Error(
    `Unexpected classification: ${thread.classification}`,
  );
}


if (
  !thread.rawTechnicalContent.includes(
    ":CCCQFILTERS.COMPANY",
  )
) {
  throw new Error(
    "Technical content was not preserved.",
  );
}


console.log(
  JSON.stringify(
    {
      sourceKey:
        thread.sourceKey,

      classification:
        thread.classification,

      messageCount:
        corpus.threads[0]
          ?.messages.length,

      completeness:
        corpus.threads[0]
          ?.completeness,
    },
    null,
    2,
  ),
);


console.log(
  "SOFT1 FORUM CORPUS CONTRACT: PASS",
);
