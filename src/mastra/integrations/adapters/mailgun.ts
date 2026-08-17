import type {
  IntegrationConnection,
} from "../types";


export type MailgunSendEmailInput = {
  from?: string;

  to:
    string[];

  cc?:
    string[];

  bcc?:
    string[];

  subject: string;

  text?: string;

  html?: string;

  replyTo?: string;
};


export type MailgunSendEmailResult = {
  id?: string;

  message?: string;

  status: number;
};


type MailgunApiResponse = {
  id?: string;
  message?: string;
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
      `Mailgun connection ${name} is required`,
    );
  }

  return value.trim();
}


function validateAddresses(
  addresses: string[],
  name: string,
): string[] {
  const normalized =
    addresses
      .map(
        value =>
          value.trim(),
      )
      .filter(
        Boolean,
      );


  if (
    normalized.length ===
    0
  ) {
    throw new Error(
      `Mailgun ${name} requires at least one address`,
    );
  }


  return normalized;
}


export class MailgunAdapter {
  constructor(
    private readonly connection:
      IntegrationConnection,
  ) {
    if (
      connection.providerCode !==
      "email.mailgun"
    ) {
      throw new Error(
        `MailgunAdapter requires email.mailgun connection, got: ${connection.providerCode}`,
      );
    }
  }


  private getBaseUrl():
    string {
    const region =
      this.connection.config
        .region;


    if (
      region ===
      "EU"
    ) {
      return "https://api.eu.mailgun.net";
    }


    return "https://api.mailgun.net";
  }


  async sendEmail(
    input:
      MailgunSendEmailInput,
  ): Promise<MailgunSendEmailResult> {
    const domain =
      requireString(
        this.connection.config
          .domain,
        "config.domain",
      );


    const apiKey =
      requireString(
        this.connection.secrets
          .apiKey,
        "secret apiKey",
      );


    const defaultFrom =
      this.connection.config
        .defaultFrom;


    const from =
      input.from?.trim() ||
      (
        typeof defaultFrom ===
          "string"
          ? defaultFrom.trim()
          : ""
      );


    if (!from) {
      throw new Error(
        "Mailgun sender address is required",
      );
    }


    const to =
      validateAddresses(
        input.to,
        "to",
      );


    const subject =
      input.subject.trim();


    if (!subject) {
      throw new Error(
        "Mailgun subject is required",
      );
    }


    if (
      !input.text?.trim() &&
      !input.html?.trim()
    ) {
      throw new Error(
        "Mailgun email requires text or html content",
      );
    }


    const body =
      new FormData();


    body.set(
      "from",
      from,
    );


    for (
      const address of
        to
    ) {
      body.append(
        "to",
        address,
      );
    }


    for (
      const address of
        input.cc ??
        []
    ) {
      if (
        address.trim()
      ) {
        body.append(
          "cc",
          address.trim(),
        );
      }
    }


    for (
      const address of
        input.bcc ??
        []
    ) {
      if (
        address.trim()
      ) {
        body.append(
          "bcc",
          address.trim(),
        );
      }
    }


    body.set(
      "subject",
      subject,
    );


    if (
      input.text?.trim()
    ) {
      body.set(
        "text",
        input.text,
      );
    }


    if (
      input.html?.trim()
    ) {
      body.set(
        "html",
        input.html,
      );
    }


    if (
      input.replyTo?.trim()
    ) {
      body.set(
        "h:Reply-To",
        input.replyTo.trim(),
      );
    }


    const auth =
      Buffer
        .from(
          `api:${apiKey}`,
          "utf8",
        )
        .toString(
          "base64",
        );


    const response =
      await fetch(
        `${this.getBaseUrl()}/v3/${encodeURIComponent(domain)}/messages`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Basic ${auth}`,
          },

          body,
        },
      );


    if (!response.ok) {
      const responseBody =
        await response
          .text()
          .catch(
            () =>
              "",
          );


      throw new Error(
        `Mailgun API error ${response.status}: ${responseBody.slice(0, 500)}`,
      );
    }


    const data =
      await response
        .json()
        .catch(
          () =>
            ({}),
        ) as
          MailgunApiResponse;


    return {
      id:
        data.id,

      message:
        data.message,

      status:
        response.status,
    };
  }
}
