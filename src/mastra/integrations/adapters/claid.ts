import type {
  IntegrationConnection,
} from "../types";


export type ClaidRemoveBackgroundInput = {
  imageUrl: string;

  outputFormat?:
    | "png"
    | "jpeg"
    | "webp";
};


export type ClaidRemoveBackgroundResult = {
  outputUrl?: string;

  objectUri?: string;

  format?: string;

  width?: number;

  height?: number;

  raw:
    Record<string, unknown>;
};


type ClaidApiResponse = {
  data?: {
    output?: {
      tmp_url?: string;
      object_uri?: string;
      format?: string;
      width?: number;
      height?: number;
    };
  };

  output?: {
    tmp_url?: string;
    object_uri?: string;
    format?: string;
    width?: number;
    height?: number;
  };
};


function requireString(
  value: unknown,
  name: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `Claid connection ${name} is required`,
    );
  }

  return value.trim();
}


function requireHttpUrl(
  value: string,
  name: string,
): string {
  const normalized =
    value.trim();


  if (!normalized) {
    throw new Error(
      `${name} is required`,
    );
  }


  let url:
    URL;


  try {
    url =
      new URL(
        normalized,
      );
  } catch {
    throw new Error(
      `${name} must be a valid URL`,
    );
  }


  if (
    url.protocol !==
      "http:" &&
    url.protocol !==
      "https:"
  ) {
    throw new Error(
      `${name} must use http or https`,
    );
  }


  return url.toString();
}


export class ClaidAdapter {
  constructor(
    private readonly connection:
      IntegrationConnection,
  ) {
    if (
      connection.providerCode !==
      "image.claid"
    ) {
      throw new Error(
        `ClaidAdapter requires image.claid connection, got: ${connection.providerCode}`,
      );
    }
  }


  async removeBackground(
    input:
      ClaidRemoveBackgroundInput,
  ): Promise<ClaidRemoveBackgroundResult> {
    const imageUrl =
      requireHttpUrl(
        input.imageUrl,
        "Claid imageUrl",
      );


    const apiKey =
      requireString(
        this.connection.secrets
          .apiKey,
        "secret apiKey",
      );


    const baseUrl =
      requireString(
        this.connection.config
          .baseUrl,
        "config.baseUrl",
      )
        .replace(
          /\/+$/,
          "",
        );


    const response =
      await fetch(
        `${baseUrl}/image/edit`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              input:
                imageUrl,

              operations: {
                background: {
                  remove:
                    true,
                },
              },

              output: {
                format: {
                  type:
                    input.outputFormat ??
                    "png",
                },
              },
            }),
        },
      );


    if (!response.ok) {
      const body =
        await response
          .text()
          .catch(
            () =>
              "",
          );


      throw new Error(
        `Claid API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }


    const data =
      await response.json() as
        ClaidApiResponse;


    const output =
      data.data?.output ??
      data.output;


    if (!output) {
      throw new Error(
        "Claid API returned no output",
      );
    }


    return {
      outputUrl:
        output.tmp_url,

      objectUri:
        output.object_uri,

      format:
        output.format,

      width:
        output.width,

      height:
        output.height,

      raw:
        data as unknown as
          Record<string, unknown>,
    };
  }
}
