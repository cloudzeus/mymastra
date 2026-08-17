export type IntegrationCategory =
  | "COMPANY_DATA"
  | "GEODATA"
  | "TRANSLATION"
  | "PAYMENT"
  | "COURIER"
  | "NOTIFICATION"
  | "STORAGE"
  | "EMAIL"
  | "IMAGE_PROCESSING"
  | "AI_PROVIDER"
  | "OTHER";


export type IntegrationEnvironment =
  | "PRODUCTION"
  | "TEST"
  | "DEVELOPMENT";


export type IntegrationProvider = {
  id: string;

  code: string;

  category:
    IntegrationCategory;

  name: string;

  description?: string;

  adapterVersion?: string;

  apiVersion?: string;

  capabilities: string[];

  configSchema:
    Record<string, unknown>;

  secretSchema:
    Record<string, unknown>;

  isActive: boolean;
};


export type IntegrationConnection = {
  id: string;

  tenantId: string;

  providerId: string;

  providerCode: string;

  name: string;

  environment:
    IntegrationEnvironment;

  config:
    Record<string, unknown>;

  secrets:
    Record<string, unknown>;

  isActive: boolean;

  lastVerifiedAt?: string;
};
