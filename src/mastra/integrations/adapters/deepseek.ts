import type {
  IntegrationConnection,
} from "../types";


export type DeepSeekMessage = {
  role:
    | "system"
    | "user"
    | "assistant";

  content: string;
};


export type DeepSeekChatInput = {
  messages:
    DeepSeekMessage[];

  model?: string;

  temperature?: number;

  maxTokens?: number;
};


export type DeepSeekChatResult = {
  text: string;

  model: string;

  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};


type DeepSeekApiResponse = {
  model?: string;

  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;

  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
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
      `DeepSeek connection ${name} is required`,
    );
  }

  return value.trim();
}


export class DeepSeekAdapter {
  constructor(
    private readonly connection:
      IntegrationConnection,
  ) {
    if (
      connection.providerCode !==
      "ai.deepseek"
    ) {
      throw new Error(
        `DeepSeekAdapter requires ai.deepseek connection, got: ${connection.providerCode}`,
      );
    }
  }


  async chat(
    input:
      DeepSeekChatInput,
  ): Promise<DeepSeekChatResult> {
    if (
      input.messages.length === 0
    ) {
      throw new Error(
        "DeepSeek chat requires at least one message",
      );
    }


    const baseUrl =
      requireString(
        this.connection.config.baseUrl,
        "config.baseUrl",
      )
        .replace(
          /\/+$/,
          "",
        );


    const defaultModel =
      requireString(
        this.connection.config.defaultModel,
        "config.defaultModel",
      );


    const apiKey =
      requireString(
        this.connection.secrets.apiKey,
        "secret apiKey",
      );


    const response =
      await fetch(
        `${baseUrl}/chat/completions`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`,
          },

          body:
            JSON.stringify({
              model:
                input.model ??
                defaultModel,

              messages:
                input.messages,

              ...(input.temperature !== undefined
                ? {
                    temperature:
                      input.temperature,
                  }
                : {}),

              ...(input.maxTokens !== undefined
                ? {
                    max_tokens:
                      input.maxTokens,
                  }
                : {}),
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
        `DeepSeek API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }


    const data =
      await response.json() as
        DeepSeekApiResponse;


    const text =
      data.choices?.[0]
        ?.message?.content;


    if (
      typeof text !==
        "string"
    ) {
      throw new Error(
        "DeepSeek API returned no assistant content",
      );
    }


    return {
      text,

      model:
        data.model ??
        (
          input.model ??
          defaultModel
        ),

      usage:
        data.usage
          ? {
              promptTokens:
                data.usage
                  .prompt_tokens,

              completionTokens:
                data.usage
                  .completion_tokens,

              totalTokens:
                data.usage
                  .total_tokens,
            }
          : undefined,
    };
  }
}
