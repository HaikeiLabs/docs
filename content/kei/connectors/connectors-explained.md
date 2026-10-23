---
title: Connectors, explained
type: reference
product: kei
nav_group: Reference
nav_order: 45
---

# Connectors, explained

A connector is a bridge between Kei and an external service — GitHub, Linear, Google Drive, a homegrown CRM API, or a remote MCP server. Connectors let agents read and write data through governed tool calls. Kei authorizes each call; the harness (Claude Code, Codex, the agentware SDK) performs the actual request.

## How connectors work

1. An admin creates a connector in the workspace and configures its credentials.
2. The connector registers its capabilities — the operations an agent can call.
3. An admin creates a policy that allows a group to use those capabilities.
4. When an agent makes a call, Kei checks whether a matching policy exists and returns allow or deny.
5. On allow, the harness performs the request using the connector's stored credential.

Credentials stay in your environment — your secret manager, an OAuth token issued to your user, or a service account key. Kei never stores secret material in plain text and never performs data operations itself.

## Connector kinds

### Native connectors

Built-in providers for popular services. Kei ships connector templates for:

- GitHub
- Google Drive & Docs
- Gmail
- Linear
- Grafana
- Discord
- Notion
- Tito
- FreshBooks

Each native connector registers typed capabilities such as `pull_request.read`, `issue.write`, or `file.search`. The capability set depends on the connector version; see the connector documentation for the full list.

### http\_api (generic REST API)

The `http_api` kind is for any homegrown, private, or non-standard HTTP API. It wraps a REST endpoint with governed access: you configure a base URL, allowed HTTP methods, path patterns, and query parameters, and the harness calls the API through Kei's authorized proxy.

Use `http_api` when:

- Your organization has an internal CRM, billing, or inventory API.
- A vendor offers a REST API but no Kei connector template exists yet.
- You need to expose a read-only or write-only endpoint to agents.

Configuration options include:

| Field | What it controls |
| ----- | ---------------- |
| `--base-url` | The HTTPS base URL of the API |
| `--methods` | Allowed HTTP methods (`GET`, `HEAD`, `POST`, `PATCH`) |
| `--paths` | Allowed path patterns relative to the base URL (a trailing `*` matches a prefix) |
| `--query` | Allowlisted query parameter names |
| `--auth-header` | Header the runtime places the API key in (default `Authorization`) |
| `--auth-scheme` | Scheme before the key (default `Bearer` for Authorization) |
| `--credential-ref` | Reference to the API key in your secret manager |

Credentials are injected as an HTTP header on each request. The header name and value are redacted from audit logs.

### MCP connectors

Remote MCP servers are added from **catalog templates** — preconfigured entries for public MCP servers — or as a **custom MCP server** with a raw URL. Each MCP connector registers its tools from the server's tool manifest. Policies target MCP tools with `mcp:<slug>.<tool>` (for a specific tool) or `mcp:<slug>` (for the whole server).

- **Catalog templates** provide a display name, logo, default URL, and OAuth configuration. Choose a template from the gallery when creating the connector.
- **Custom MCP servers** let you enter any public HTTPS MCP URL, set a transport (Streamable HTTP or SSE), and optionally configure an OAuth expected issuer.

The connector slug is derived from the display name and cannot be changed after creation. Policies use it to target the connector.

## Connector identity and labels

Every connector has:

- **A name** (the display name shown in the UI)
- **A slug** (a short identifier used in policies as `connector:<slug>`)
- **Labels** (admin-set tags such as `crm`, `pii`, `prod`)

Labels are set on the connector for organization and discovery. Today, labels are display-only in the UI. Policy targets use the connector slug: `connector:<slug>`.

> **Planned: `connector:label:<label>` targeting.** A future change will let policies target connectors by label — for example, `connector:label:pii` to match every connector carrying the `pii` label, without naming each slug individually. This page documents today's slug-based targeting.

## Credentials

Kei supports several credential models:

| Model | How credentials are stored | Example connectors |
| ----- | ------------------------- | ------------------ |
| **Per-user OAuth** | Each user connects their own account. Kei stores an encrypted OAuth token. | Google Drive, GitHub, Linear |
| **Shared OAuth** | One organization account is connected. All users share the credential. | Google Drive (shared drive), GitHub (bot account) |
| **Opaque reference** | A reference to a secret in your secret manager (AWS Secrets Manager, Azure Key Vault, or a file). The runtime resolves it at call time. | http\_api, skills\_repo |
| **Service account** | A service account key is stored in your secret manager and referenced by the connector. | Gmail (GSuite delegation), Google Drive (domain delegation) |

- Kei never stores plain-text secrets. Opaque references are stored; the actual secret value lives in your secret manager.
- Per-user OAuth tokens are encrypted at rest.
- The CLI never prints a credential value.

## Who writes

Kei authorizes; harnesses perform. When an agent requests a connector operation:

1. The harness sends the request to `kei-proxy authorize`.
2. Kei checks the workspace policy bundle and returns allow or deny.
3. On allow, the harness performs the operation using the connector's credential.
4. The audit hook reports a redacted summary — no payloads, no secret values.

Kei never initiates a connection to an external service, never stores data from a connector operation, and never modifies data on a connector's service. All data flows directly between the harness and the external service.

## Learn more

- [Grant a connector](/kei/connectors/grant-a-connector) — create a connector and grant access to a group
- [Connectors (setup guide)](/kei/connectors/connectors) — add, connect, and grant access in the console
- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
- [Tools and capabilities](/kei/reference/tools-and-capabilities) — capability target semantics
