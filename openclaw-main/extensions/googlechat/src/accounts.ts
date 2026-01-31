import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";

import type { GoogleChatAccountConfig, GoogleChatConfig } from "./types.config.js";

export type GoogleChatCredentialSource = "file" | "inline" | "env" | "none";

export type ResolvedGoogleChatAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  config: GoogleChatAccountConfig;
  credentialSource: GoogleChatCredentialSource;
  credentials?: Record<string, unknown>;
  credentialsFile?: string;
};

const ENV_SERVICE_ACCOUNT = "GOOGLE_CHAT_SERVICE_ACCOUNT";
const ENV_SERVICE_ACCOUNT_FILE = "GOOGLE_CHAT_SERVICE_ACCOUNT_FILE";
const ENV_SERVICE_ACCOUNT_JSON = "GOOGLE_CHAT_SERVICE_ACCOUNT_JSON";
const ENV_SERVICE_ACCOUNT_PATH = "GOOGLE_CHAT_SERVICE_ACCOUNT_PATH";
const ENV_SPACE_ALLOWLIST = "GOOGLE_CHAT_SPACE_ALLOWLIST";
const ENV_AUDIENCE = "GOOGLE_CHAT_AUDIENCE";
const ENV_AUDIENCE_TYPE = "GOOGLE_CHAT_AUDIENCE_TYPE";
const ENV_PROJECT_ID = "GOOGLE_CHAT_PROJECT_ID";

function listConfiguredAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = (cfg.channels?.["googlechat"] as GoogleChatConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listGoogleChatAccountIds(cfg: OpenClawConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultGoogleChatAccountId(cfg: OpenClawConfig): string {
  const channel = cfg.channels?.["googlechat"] as GoogleChatConfig | undefined;
  if (channel?.defaultAccount?.trim()) return channel.defaultAccount.trim();
  const ids = listGoogleChatAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): GoogleChatAccountConfig | undefined {
  const accounts = (cfg.channels?.["googlechat"] as GoogleChatConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as GoogleChatAccountConfig | undefined;
}

function mergeGoogleChatAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): GoogleChatAccountConfig {
  const raw = (cfg.channels?.["googlechat"] ?? {}) as GoogleChatConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  const merged = { ...base, ...account } as GoogleChatAccountConfig;
  return applyEnvDefaultsToAccount(accountId, merged);
}

function parseServiceAccount(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveCredentialsFromConfig(params: {
  accountId: string;
  account: GoogleChatAccountConfig;
}): {
  credentials?: Record<string, unknown>;
  credentialsFile?: string;
  source: GoogleChatCredentialSource;
} {
  const { account, accountId } = params;
  const inline = parseServiceAccount(account.serviceAccount);
  if (inline) {
    return { credentials: inline, source: "inline" };
  }

  const file = account.serviceAccountFile?.trim();
  if (file) {
    return { credentialsFile: file, source: "file" };
  }

  if (accountId === DEFAULT_ACCOUNT_ID) {
    const inlineEnvVars = [ENV_SERVICE_ACCOUNT, ENV_SERVICE_ACCOUNT_JSON];
    for (const key of inlineEnvVars) {
      const envInline = parseServiceAccount(process.env[key]);
      if (envInline) {
        return { credentials: envInline, source: "env" };
      }
    }

    const fileEnvVars = [ENV_SERVICE_ACCOUNT_FILE, ENV_SERVICE_ACCOUNT_PATH];
    for (const key of fileEnvVars) {
      const envFile = process.env[key]?.trim();
      if (envFile) {
        return { credentialsFile: envFile, source: "env" };
      }
    }
  }

  return { source: "none" };
}

function normalizeSpaceIdFromEnv(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withoutPrefix = trimmed.replace(/^(googlechat|google-chat|gchat):/i, "");
  if (withoutPrefix.toLowerCase().startsWith("spaces/")) return withoutPrefix;
  if (withoutPrefix.toLowerCase().startsWith("space/")) {
    return `spaces/${withoutPrefix.slice("space/".length)}`;
  }
  return `spaces/${withoutPrefix}`;
}

function applyEnvDefaultsToAccount(
  accountId: string,
  account: GoogleChatAccountConfig,
): GoogleChatAccountConfig {
  if (accountId !== DEFAULT_ACCOUNT_ID) return account;

  let next = account;

  const envAudienceRaw = process.env[ENV_AUDIENCE]?.trim();
  const envProjectId = process.env[ENV_PROJECT_ID]?.trim();
  const envAudienceTypeLower = process.env[ENV_AUDIENCE_TYPE]?.trim()?.toLowerCase();
  const envAudience = next.audience ?? envAudienceRaw ?? envProjectId;

  const envAudienceType: GoogleChatAccountConfig["audienceType"] = (() => {
    if (next.audienceType) return next.audienceType;
    if (envAudienceTypeLower === "app-url" || envAudienceTypeLower === "app") return "app-url";
    if (envAudienceTypeLower === "project-number" || envAudienceTypeLower === "project") {
      return "project-number";
    }
    if (envProjectId) return "project-number";
    if (envAudienceRaw) return "app-url";
    return undefined;
  })();

  if (!next.audience && envAudience) {
    next = { ...next, audience: envAudience };
  }

  if (!next.audienceType && envAudienceType) {
    next = { ...next, audienceType: envAudienceType };
  }

  const spaceAllowlistEnv = process.env[ENV_SPACE_ALLOWLIST];
  if (spaceAllowlistEnv) {
    const ids = spaceAllowlistEnv
      .split(",")
      .map((entry) => normalizeSpaceIdFromEnv(entry))
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      const groups = { ...(next.groups ?? {}) };
      for (const id of ids) {
        const existing = groups[id] ?? {};
        groups[id] = {
          ...existing,
          allow: existing.allow ?? true,
          enabled: existing.enabled ?? true,
          requireMention: existing.requireMention ?? true,
        };
      }
      next = {
        ...next,
        groupPolicy: next.groupPolicy ?? "allowlist",
        groups,
      };
    }
  }

  return next;
}

export function resolveGoogleChatAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedGoogleChatAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled =
    (params.cfg.channels?.["googlechat"] as GoogleChatConfig | undefined)?.enabled !== false;
  const merged = mergeGoogleChatAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const credentials = resolveCredentialsFromConfig({ accountId, account: merged });

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    config: merged,
    credentialSource: credentials.source,
    credentials: credentials.credentials,
    credentialsFile: credentials.credentialsFile,
  };
}

export function listEnabledGoogleChatAccounts(cfg: OpenClawConfig): ResolvedGoogleChatAccount[] {
  return listGoogleChatAccountIds(cfg)
    .map((accountId) => resolveGoogleChatAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
