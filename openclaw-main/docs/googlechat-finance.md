---
summary: "FinanceGroup agent for Google Chat (mention-only, safe defaults)"
read_when:
  - Deploying Google Chat FinanceGroup
  - Locking down group agents
---
# Google Chat FinanceGroup Quick Start

This guide wires a mention-only **FinanceGroup** agent into a Google Chat space with safe defaults: no exec, no file writes, no browser automation, thread-aware replies, and a built-in "not financial advice" reminder.

## Prerequisites
- Follow the base Google Chat setup first: [docs/channels/googlechat.md](channels/googlechat.md) (service account, Chat app, webhook URL).
- Expose only the `/googlechat` path publicly.

## Environment
Set these in `.env` (or the host environment):

- `GOOGLE_CHAT_PROJECT_ID` — Chat project number (use for `audienceType=project-number`).
- `GOOGLE_CHAT_AUDIENCE` — Webhook URL if you prefer `audienceType=app-url`.
- `GOOGLE_CHAT_AUDIENCE_TYPE` — `project-number` (default) or `app-url`.
- `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON` — Inline service account JSON (or `GOOGLE_CHAT_SERVICE_ACCOUNT_PATH` for a file path).
- `GOOGLE_CHAT_SPACE_ALLOWLIST` — Comma-separated space ids (e.g., `spaces/AAAA,spaces/BBBB`).

## Config: channel, agent, binding
Save a patch file (e.g., `finance-googlechat.json5`) and apply with `openclaw config patch finance-googlechat.json5`.

```json5
{
  channels: {
    googlechat: {
      enabled: true,
      audienceType: "project-number",           // or "app-url" if GOOGLE_CHAT_AUDIENCE is your webhook URL
      audience: "${GOOGLE_CHAT_PROJECT_ID}",     // project number or webhook URL
      serviceAccountFile: "${GOOGLE_CHAT_SERVICE_ACCOUNT_PATH}",
      groupPolicy: "allowlist",
      requireMention: true,                      // mention-only in spaces
      groups: {
        "spaces/FINANCE_SPACE_ID": {
          allow: true,
          requireMention: true,
          systemPrompt: "You are FinanceGroup. Reply only when mentioned. Be concise, thread-aware, and focus on summaries, checklists, and next steps. Never give financial advice; always note responses are not financial advice. Do not quote long histories unless asked."
        }
      }
    }
  },
  agents: {
    list: [
      {
        id: "finance-group",
        name: "FinanceGroup",
        identity: { name: "FinanceGroup" },
        groupChat: { historyLimit: 20 },          // keeps thread context tight
        sandbox: { mode: "off", workspaceAccess: "none" },
        tools: {
          profile: "messaging",                 // messaging + session helpers only
          deny: [
            "group:runtime",                    // exec/process
            "group:fs",                         // read/write/edit/apply_patch
            "group:ui",                         // browser/canvas
            "group:web",                        // web_search/web_fetch
            "group:nodes",                      // remote nodes/camera
            "group:automation",                 // cron/gateway
            "group:memory"                      // memory search if you want no history scraping
          ]
        }
      }
    ]
  },
  bindings: [
    {
      agentId: "finance-group",
      match: {
        channel: "googlechat",
        accountId: "default",
        peer: { kind: "group", id: "spaces/FINANCE_SPACE_ID" }
      }
    }
  ]
}
```

Notes:
- Add one `groups["spaces/..."]` entry per allowed space. With `GOOGLE_CHAT_SPACE_ALLOWLIST`, entries are auto-created and default to `requireMention=true`.
- Repeat the `bindings` entry for each space you want FinanceGroup to serve.
- If not mentioned in a space, the channel drops the message (no ambient replies).

## Run locally
```bash
pnpm install
pnpm openclaw gateway --port 18789 --verbose
```

## Add the bot to a Google Chat space
1) In Google Chat, click **+** → **Find apps** (or search for your Chat app name).  
2) Add it to the target space and send a short message mentioning the bot (e.g., `@FinanceGroup hello`).
3) Confirm you see delivery in `openclaw channels status --probe` and the gateway logs.

## Troubleshooting
- **Auth/permissions**: `openclaw channels status --probe` should show `configured` and `probe ok`; if not, re-download the service account JSON and confirm `GOOGLE_CHAT_*` env values match your project.
- **Webhook delivery**: in Google Cloud Logs, filter Chat webhook errors; 405/401 usually mean audience mismatch—set `audienceType` + `audience` to your webhook URL or project number.
- **Space allowlist mismatch**: ensure the space id is in `channels.googlechat.groups` (or `GOOGLE_CHAT_SPACE_ALLOWLIST`) and your binding `peer.id` matches the exact `spaces/…` id.
