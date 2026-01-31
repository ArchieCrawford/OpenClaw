# App Variables (Quick Reference)

Use this page to track and set environment variables that customize OpenClaw. Keep the values in your local `.env` file (not committed). This file just documents what to set.

## How to use
1) Copy `.env.example` to `.env` in the repo root (same folder as this file):
   ```bash
   cp .env.example .env
   ```
2) Edit `.env` with your real values. Do **not** commit secrets.
3) Restart the gateway after changes.

## Core variables
| Name | What it controls | Notes |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Only if you use Twilio/WhatsApp. |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Keep secret. |
| `TWILIO_WHATSAPP_FROM` | WhatsApp-enabled From number | Format: `whatsapp:+1234567890`. |
| `GOOGLE_CHAT_PROJECT_ID` | Google Chat project number (audience) | Required for Google Chat when using `audienceType=project-number`. |
| `GOOGLE_CHAT_AUDIENCE` | Webhook URL audience (optional) | Use when `audienceType=app-url`. |
| `GOOGLE_CHAT_AUDIENCE_TYPE` | `project-number` or `app-url` | Default `project-number`. |
| `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON` | Inline Google Chat service account JSON | Use this **or** the path variable below. |
| `GOOGLE_CHAT_SERVICE_ACCOUNT_PATH` | Path to service account JSON file | Example: `~/.openclaw/googlechat.json`. |
| `GOOGLE_CHAT_SPACE_ALLOWLIST` | Comma-separated space IDs | Example: `spaces/AAAA,spaces/BBBB`; mention-only behavior recommended. |

## Adding your own variables
- Add new entries to `.env` with `KEY=value` lines.
- Reference them in config via `${KEY}` if the config supports env substitution.
- Never commit secrets; keep them in `.env` or your host environment.

## Tips
- After editing `.env`, restart the gateway: `pnpm openclaw gateway --port 18789 --verbose`.
- Keep `.env` out of version control (already in `.gitignore`).
- For channel-specific options, see `docs/channels/*.md`.
