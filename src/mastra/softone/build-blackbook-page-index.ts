import fs from "node:fs";
import path from "node:path";

type Chapter = {
  chapter: number;
  title: string;
  startPage: number;
  endPage: number;
};

type IndexedPage = {
  page: number;
  chapter: number;
  chapterTitle: string;
  textFile: string;
  textLength: number;
  firstNonEmptyLines: string[];
};

const ROOT =
  path.resolve(
    "data/sources/blackbook/all-pages",
  );

const OUTPUT =
  path.resolve(
    "data/softone-blackbook-page-index.json",
  );

const chapters: Chapter[] = [
  {
    chapter: 1,
    title: "Screen Forms/UI",
    startPage: 14,
    endPage: 84,
  },
  {
    chapter: 2,
    title: "Browsers",
    startPage: 85,
    endPage: 98,
  },
  {
    chapter: 3,
    title: "Printout Forms",
    startPage: 99,
    endPage: 132,
  },
  {
    chapter: 4,
    title: "Alerts EDA",
    startPage: 133,
    endPage: 145,
  },
  {
    chapter: 5,
    title: "User-Defined Fields",
    startPage: 146,
    endPage: 169,
  },
  {
    chapter: 6,
    title: "Database Designer",
    startPage: 170,
    endPage: 232,
  },
  {
    chapter: 7,
    title: "Extra Tools",
    startPage: 233,
    endPage: 244,
  },
  {
    chapter: 8,
    title: "Scheduler & Messages",
    startPage: 245,
    endPage: 264,
  },
  {
    chapter: 9,
    title: "Form Scripts",
    startPage: 265,
    endPage: 366,
  },
  {
    chapter: 10,
    title: "Data Flows",
    startPage: 367,
    endPage: 390,
  },
  {
    chapter: 11,
    title: "SBSL",
    startPage: 391,
    endPage: 459,
  },
  {
    chapter: 12,
    title: "Web Services",
    startPage: 460,
    endPage: 501,
  },
  {
    chapter: 13,
    title: "BAM",
    startPage: 502,
    endPage: 540,
  },
  {
    chapter: 14,
    title: "Appendix System Parameters & Commands",
    startPage: 541,
    endPage: 573,
  },
];

function chapterForPage(
  page: number,
): Chapter | undefined {
  return chapters.find(
    chapter =>
      page >= chapter.startPage &&
      page <= chapter.endPage,
  );
}

const pages: IndexedPage[] = [];

for (
  let page = 1;
  page <= 573;
  page += 1
) {
  const file =
    path.join(
      ROOT,
      `page-${String(page).padStart(3, "0")}.txt`,
    );

  if (
    !fs.existsSync(file)
  ) {
    throw new Error(
      `Missing page text file: ${file}`,
    );
  }

  const text =
    fs.readFileSync(
      file,
      "utf8",
    );

  const chapter =
    chapterForPage(page);

  pages.push({
    page,

    chapter:
      chapter?.chapter ?? 0,

    chapterTitle:
      chapter?.title ??
      "Front Matter",

    textFile:
      path.relative(
        process.cwd(),
        file,
      ),

    textLength:
      text.length,

    firstNonEmptyLines:
      text
        .split(/\r?\n/)
        .map(line =>
          line.trim(),
        )
        .filter(Boolean)
        .slice(0, 8),
  });
}

const output = {
  formatVersion: 1,

  sourceId:
    "OFFICIAL_SOFTONE_BLACKBOOK_3_5",

  softOneVersion:
    "3.5",

  totalPages:
    pages.length,

  chapterCount:
    chapters.length,

  chapters,

  pages,
};

fs.writeFileSync(
  OUTPUT,
  JSON.stringify(
    output,
    null,
    2,
  ) + "\n",
);

console.log(
  JSON.stringify(
    {
      output:
        path.relative(
          process.cwd(),
          OUTPUT,
        ),

      totalPages:
        pages.length,

      chapterCount:
        chapters.length,

      frontMatterPages:
        pages.filter(
          p =>
            p.chapter === 0,
        ).length,

      chapterPages:
        Object.fromEntries(
          chapters.map(
            chapter => [
              chapter.chapter,
              pages.filter(
                page =>
                  page.chapter ===
                  chapter.chapter,
              ).length,
            ],
          ),
        ),
    },
    null,
    2,
  ),
);
