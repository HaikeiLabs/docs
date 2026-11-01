---
description: Build a custom AI agent or harness with Agentware, coding-agent Skills, and local examples in TypeScript, Python, and Go.
title: Build on Agentware
type: read-and-use
product: agentware
nav_group: Make and maintain
nav_order: 2
---

Build a custom agent or harness with Agentware: call typed tools, add guardrails, and record tool decisions. Start with an offline echo example, then adapt the tool to a research, monitoring, or workflow application. Agentware is a library; Haikei Skills are instructions for your coding assistant; Kei is an optional integration for governed operations. Kei is a metadata-only control plane: provider payloads, customer content, and credentials never enter Kei.

## Start locally

Install the canonical [Haikei Skills](https://github.com/HaikeiLabs/skills) for Codex (requires Node.js 22.20+ and npx):

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill agentware-sdk -a codex -y
```

Replace `codex` with `claude-code`, `cursor`, `opencode`, or `pi` for the corresponding coding agent. Skills guide the assistant; they do not install SDKs, configure Kei, or grant permissions.

Choose the [TypeScript](/agentware/build/typescript), [Python](/agentware/build/python), or [Go](/agentware/build/go) guide to install the SDK and run an offline fake-proxy example. It prints an allowed echo and a denied operation; no Kei account or runtime is needed for the fake. The [Agentware README](https://github.com/HaikeiLabs/agentware#start-building) also has a local Python echo example.

## Add Kei when needed

For governed external operations, use the runtime setup below. The proxy is the enforcement point; it executes provider operations in your environment. The control plane holds registration, policy, and audit metadata, not secrets or provider data.

Agentware implements the **kei-connector-contracts** platform specification.
Contracts defines the tool definition schemas, call template validator, and
capability declarations; agentware imports those types, validates templates,
registers tools, and builds provider calls. For the full story of how
contracts, agentware, and the runtime fit together, see
[Contracts, Agentware, and how to build a custom connector](/kei/reference/contracts-vs-agentware).

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

## Six-step governed path

Bring up an Agentware SDK harness in this order:

1. **Install the Kei CLI and sign in** — `curl -fsSL https://haikeilabs.com/install.sh | sh`, then `kei login`. You need an organization owner or admin to approve the device authorization flow.
2. **Create a runtime installation** — `kei bot init` creates pending installation metadata and provisions a runtime credential. The credential is shown once; deliver it directly into your approved secret manager.
3. **Register the harness** — `kei harness add --kind custom --installation INSTALLATION_ID` registers the SDK harness. The CLI resolves the assigned agent for that installation.
4. **Register tools** — Use `ToolSpec` with a `harness_executor` route over the runtime socket (`POST /v1/tools:register`), or maintain a `tools.json` manifest and sync it with `kei harness sync --harness custom --manifest tools.json`. The manifest is tool metadata, not a permission grant. For Open WebUI, see [tool specs from a deployment-provided file](/content/kei/connect-your-harness/openwebui.html#3-tool-implementations-and-definitions).
5. **Start the runtime daemon** — `kei-proxy serve` runs the policy enforcement point on a local Unix socket. The SDK discovers it through `KEI_RUNTIME_SOCKET_PATH`.
6. **Run the harness** — Each governed tool call goes through `kei-proxy authorize`. An explicit allow lets the tool run; a deny returns `reason_code` and `hint`; a socket or protocol failure fails closed.

## Compatible versions

As of 2026-10-31, the latest verified npm, PyPI, and Go releases are 0.15.0. For Kei integration, the source compatibility table lists these minimum runtime versions; check the [current table](https://github.com/HaikeiLabs/agentware#compatibility) for other SDK versions:

| agentware SDK | kei-proxy (minimum) | kei-cli (minimum) |
|---|---|---|
| 0.15.0 | v0.6.5 | 0.3.6 |
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
