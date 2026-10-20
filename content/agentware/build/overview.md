---
title: Build on Agentware
type: read-and-use
product: agentware
---

Use the Agentware SDK to add Kei governance to a custom agent harness. Agentware provides the middleware, audit, guardrails, and Kei policy integration; Kei is the metadata-only control plane that holds registration, policy, and audit metadata. Provider payloads, customer content, and credentials never enter Kei.

For a first look at what agentware does, see [Govern an agent with agentware](/content/agentware/getting-started/overview.html).

## Six harness types

Kei has six user-facing harness types. The **SDK (Agentware)** type covers harnesses built on the Agentware SDK:

| Harness type | Integration path |
|---|---|
| **SDK (Agentware)** | `KeiProxyEvaluator` → `kei-proxy authorize`, fail closed. Covers pydantic-ai, Gemini SDK, AWS AgentCore, and bespoke loops. API kind `custom`. |
| **Claude Code** | Native permission files + hook. |
| **Codex** | Native permission files + hook. |
| **OpenCode** | Native permission files + hook. |
| **Pi** | Own package + local-socket adapter. |
| **Open WebUI** | Own Python library (`openwebui-kei`), not the SDK path. |

## Six-step path

Bring up an Agentware SDK harness in this order:

1. **Install the Kei CLI and sign in** — `curl -fsSL https://haikeilabs.com/install.sh | sh`, then `kei login`. You need an organization owner or admin to approve the device authorization flow.
2. **Create a runtime installation** — `kei bot init` creates pending installation metadata and provisions a runtime credential. The credential is shown once; deliver it directly into your approved secret manager.
3. **Register the harness** — `kei harness add --kind custom --installation INSTALLATION_ID` registers the SDK harness. The CLI resolves the assigned agent for that installation.
4. **Register tools** — Use `ToolSpec` with a `harness_executor` route over the runtime socket (`POST /v1/tools:register`), or maintain a `tools.json` manifest and sync it with `kei harness sync --harness custom --manifest tools.json`. The manifest is tool metadata, not a permission grant.
5. **Start the runtime daemon** — `kei-proxy serve` runs the policy enforcement point on a local Unix socket. The SDK discovers it through `KEI_RUNTIME_SOCKET_PATH`.
6. **Run the harness** — Each governed tool call goes through `kei-proxy authorize`. An explicit allow lets the tool run; a deny returns `reason_code` and `hint`; a socket or protocol failure fails closed.

## Compatible versions

| agentware SDK | kei-proxy (minimum) | kei-cli (minimum) |
|---|---|---|
| 0.11.0 | v0.3.0 | 0.2.0 |

## Language guides

- [Go setup](/content/agentware/build/go.html)
- [Python setup](/content/agentware/build/python.html)
- [TypeScript setup](/content/agentware/build/typescript.html)

## Next steps

- [Runtime setup](/content/agentware/build/runtime-setup.html) — connect a harness to a local `kei-proxy` daemon.
- [Policy and audit](/content/agentware/build/policy-and-audit.html) — create policies and view audit entries.
- [Deny reason codes](/content/agentware/reference/deny-hints.html) — reference for every `reason_code` and its `hint`.

For the complete API reference, see the [Agentware SDK repository](https://github.com/haikeilabs/agentware).
