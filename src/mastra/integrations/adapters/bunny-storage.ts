import type {
  IntegrationConnection,
} from "../types";


export type BunnyUploadInput = {
  path: string;

  data:
    string
    | Uint8Array
    | ArrayBuffer;

  contentType?:
    string;
};


export type BunnyUploadResult = {
  path: string;

  storageUrl: string;

  cdnUrl?: string;

  status:
    number;
};


export type BunnyDownloadResult = {
  path: string;

  data:
    ArrayBuffer;

  contentType?: string;
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
      `Bunny connection ${name} is required`,
    );
  }

  return value.trim();
}


function normalizeObjectPath(
  path: string,
): string {
  const normalized =
    path
      .trim()
      .replace(
        /^\/+/,
        "",
      )
      .replace(
        /\/+/g,
        "/",
      );


  if (!normalized) {
    throw new Error(
      "Bunny object path is required",
    );
  }


  if (
    normalized.includes(
      "..",
    )
  ) {
    throw new Error(
      "Bunny object path must not contain '..'",
    );
  }


  return normalized;
}


function encodeObjectPath(
  path: string,
): string {
  return normalizeObjectPath(
    path,
  )
    .split("/")
    .map(
      segment =>
        encodeURIComponent(
          segment,
        ),
    )
    .join("/");
}


export class BunnyStorageAdapter {
  constructor(
    private readonly connection:
      IntegrationConnection,
  ) {
    if (
      connection.providerCode !==
      "storage.bunny"
    ) {
      throw new Error(
        `BunnyStorageAdapter requires storage.bunny connection, got: ${connection.providerCode}`,
      );
    }
  }


  private buildStorageUrl(
    path: string,
  ): string {
    const endpoint =
      requireString(
        this.connection.config
          .storageEndpoint,
        "config.storageEndpoint",
      )
        .replace(
          /\/+$/,
          "",
        );


    const storageZoneName =
      requireString(
        this.connection.config
          .storageZoneName,
        "config.storageZoneName",
      );


    return (
      `${endpoint}/` +
      `${encodeURIComponent(storageZoneName)}/` +
      encodeObjectPath(
        path,
      )
    );
  }


  private buildCdnUrl(
    path: string,
  ): string | undefined {
    const cdnHostname =
      this.connection.config
        .cdnHostname;


    if (
      typeof cdnHostname !==
        "string" ||
      !cdnHostname.trim()
    ) {
      return undefined;
    }


    const normalizedHost =
      cdnHostname
        .trim()
        .replace(
          /^https?:\/\//,
          "",
        )
        .replace(
          /\/+$/,
          "",
        );


    return (
      `https://${normalizedHost}/` +
      encodeObjectPath(
        path,
      )
    );
  }


  private getAccessKey():
    string {
    return requireString(
      this.connection.secrets
        .accessKey,
      "secret accessKey",
    );
  }


  async upload(
    input:
      BunnyUploadInput,
  ): Promise<BunnyUploadResult> {
    const path =
      normalizeObjectPath(
        input.path,
      );


    const storageUrl =
      this.buildStorageUrl(
        path,
      );


    const response =
      await fetch(
        storageUrl,
        {
          method:
            "PUT",

          headers: {
            AccessKey:
              this.getAccessKey(),

            "Content-Type":
              input.contentType ??
              "application/octet-stream",
          },

          body:
            input.data as
              BodyInit,
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
        `Bunny Storage API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }


    return {
      path,

      storageUrl,

      cdnUrl:
        this.buildCdnUrl(
          path,
        ),

      status:
        response.status,
    };
  }


  async download(
    pathInput: string,
  ): Promise<BunnyDownloadResult> {
    const path =
      normalizeObjectPath(
        pathInput,
      );


    const response =
      await fetch(
        this.buildStorageUrl(
          path,
        ),
        {
          method:
            "GET",

          headers: {
            AccessKey:
              this.getAccessKey(),
          },
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
        `Bunny Storage API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }


    return {
      path,

      data:
        await response
          .arrayBuffer(),

      contentType:
        response.headers.get(
          "Content-Type",
        ) ??
        undefined,
    };
  }


  async delete(
    pathInput: string,
  ): Promise<{
    path: string;
    status: number;
  }> {
    const path =
      normalizeObjectPath(
        pathInput,
      );


    const response =
      await fetch(
        this.buildStorageUrl(
          path,
        ),
        {
          method:
            "DELETE",

          headers: {
            AccessKey:
              this.getAccessKey(),
          },
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
        `Bunny Storage API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }


    return {
      path,

      status:
        response.status,
    };
  }
}
