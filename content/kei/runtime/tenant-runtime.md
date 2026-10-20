---
title: Tenant-side connector runtime
type: read-and-use
product: kei
---
# Tenant-side connector runtime

Use the deployed-runtime instructions here for a service, bot, or SDK (Agentware) integration; for a local workstation/headless workflow, follow [CLI authentication and runtime setup](/kei/get-started/connect-this-machine). The connector runtime is the local policy decision point for governed tool and data access. It runs in your environment alongside your Kei-enabled harness integration. Agentware SDK middleware sends it the authenticated invoking identity and requested tool, action, resource, and applicable context. The runtime checks those attributes against the active workspace policy before any connector operation. This follows the attribute-based access control (ABAC) model described in [NIST SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final): authorization evaluates attributes of the subject, resource, requested operation, and, where relevant, the environment.

Provider credentials, request payloads, and results stay in your tenant environment. An allowed decision proceeds to the governed connector operation; a denied or invalid request stops before the provider call. Only the decision and redacted audit metadata return to the control plane.

The model is resolved from the active model profile assigned to the runtime's default agent. The `kei-proxy` model-profile flow delivers the profile to the runtime, including its endpoint, default model, and provider key. Harnesses do not store provider keys.

## How a connector call is governed

The diagram shows the request and decision boundary. The numbered steps below it provide the same flow for screen readers.

<div class="runtime-flow" role="group" aria-label="Governed connector request flow">
  <div class="runtime-flow-node"><strong>Agent harness</strong><span>Requests a tool operation</span></div>
  <span class="runtime-flow-arrow" aria-hidden="true">→</span>
  <div class="runtime-flow-node"><strong>agentware SDK middleware</strong><span>Applies harness guardrails and sends the governed request</span></div>
  <span class="runtime-flow-arrow" aria-hidden="true">→</span>
  <div class="runtime-flow-node runtime-flow-runtime"><strong>Tenant-side connector runtime</strong><span>Evaluates workspace ABAC policy locally</span>
    <div class="runtime-flow-attributes"><span>Subject</span><span>Resource</span><span>Operation</span><span>Context</span></div>
  </div>
</div>
<div class="runtime-flow-outcomes" aria-hidden="true">
  <div class="runtime-flow-allow"><strong>Permit</strong><span>Run the governed connector operation in your environment</span></div>
  <div class="runtime-flow-deny"><strong>Deny</strong><span>Stop before the provider call</span></div>
</div>

1. The harness invokes a tool through agentware middleware.
2. The middleware sends the caller identity and requested tool, action, and resource to the tenant-side connector runtime.
3. The runtime checks subject, resource, operation, and relevant context against workspace policy.
4. If permitted, the runtime performs the connector operation locally. If denied, stale, or out of scope, it fails closed. Redacted decision metadata is available for audit.

## Governed vs non-governed tool calls

Not every tool call a harness makes is governed. The rule is simple: **anything that touches tenant data, external systems, or credentials is governed**; everything else is local.

- **Governed** — the call goes through `kei-proxy authorize` (or the Agentware SDK `KeiProxyEvaluator`, which wraps it — see [Build on the Agentware SDK](https://github.com/HaikeiLabs/agentware/tree/main/docs/getting-started)). Kei policy decides allow or deny, the decision is audited, and enrollment or approval can apply before the tool runs.
- **Non-governed** — the call runs locally in the harness and never reaches Kei. No policy check, no audit event.

When unsure whether a tool is governed, treat it as governed and route it through `kei-proxy authorize`. A tool is not governed just because the adapter exposes it, and a local call is not safe just because it never reaches Kei.

## Install for a Discord bot in Docker

Keep the connector runtime in the Discord bot's container and host. Governed tool calls invoke the runtime locally as a subprocess; they do not use a network listener, so do not expose a port or place the runtime in a separate sidecar container.

The `kei` release installer (v0.1.4 and later) installs the CLI and its pinned connector-runtime executable together. Add the tools to the bot image during the image build:

```sh
curl -fsSL "https://haikeilabs.com/install.sh" \
  | bash -s -- -d /usr/local/bin
kei-proxy help
```

An organization administrator creates a runtime installation in the web app or with the supported administrator CLI. Put the runtime credential in the container platform's secret store and inject it as `KEI_RUNTIME_TOKEN`; configure the fixed control-plane URL `https://app.haikeilabs.com`. The runtime reports its version from the binary build, so do not set `KEI_RUNTIME_VERSION`. Agent, organization, workspace, and installation identity are supplied through the authenticated runtime identity handshake. The installation ID is a non-secret identifier, not the credential.

Before the bot accepts work, run `kei-proxy runtime bootstrap`. Keep `kei-proxy runtime heartbeat --interval 1m` running under the container's process supervisor alongside the bot. The bot's agentware middleware invokes the runtime for governed tool calls. Keep provider credentials in the container's protected secret store; never bake secrets into the image or pass them as arguments.

For administrator installation and credential commands, see [CLI authentication and runtime setup](/kei/get-started/connect-this-machine). If bootstrap fails inside the container, see [Troubleshoot the runtime container](/kei/runtime/troubleshooting).

For Open WebUI, the published `openwebui-kei` image already runs the connector runtime in its own container: see [Open WebUI with Kei](/kei/connect-your-harness/openwebui).

## Install with curl for a local coding harness

Install the CLI bundle, which includes the connector runtime executable, on the same workstation as Claude Code, Codex, OpenCode, or another supported local harness:

```sh
curl -fsSL "https://haikeilabs.com/install.sh" \
  | bash -s -- -d "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
kei --version
kei-proxy help
```

An administrator creates the runtime installation and stores its runtime credential in a secret manager. Configure the workstation with `kei setup`, then verify and send its first heartbeat with `kei runtime bootstrap`. Keep the runtime token out of prompts, source control, shell history, command arguments, and logs.

Use [Agent setup](/kei/connect-your-harness/harness-setup) to choose the harness and install public Kei skills in that harness. Skills provide reusable instructions; they are a separate step from installing the connector runtime. agentware middleware connects governed tool calls to the local runtime.

## Recovery from Failed Credential Creation

An installation showing **pending · unverified** with RUNTIME CREDENTIAL **Not configured** means the credential was never created (the reveal was lost — it is shown only at creation — or the creation step failed). Recover by creating a credential for the existing installation — do not recreate under the same name (that returns `409`). Either:

- Open the installation card's **Create credential** action.
- Or from the CLI: `kei bot credential --installation INSTALLATION_ID --workspace <name|id>`.

To recreate with a different name, delete the old installation first with `kei bot delete --installation INSTALLATION_ID --yes`.

## Heartbeats and offline status

`kei-proxy runtime bootstrap` verifies the installation and sends its first heartbeat. `kei-proxy runtime heartbeat --interval 1m` keeps liveness current while the bot or harness is running. The Runtime installations card shows connectivity as connected, unknown, never seen, or suspended, based on the audit-log aggregator's derived state. Heartbeat status is operational metadata, not a policy decision. Use the card's **Logs** action to inspect lifecycle, connectivity, decision, and event records.

## Verify policy enforcement

Before enabling a workflow, check one operation that the workspace policy allows and one that it denies. A missing or stale policy, unbound connector, unsupported operation, or invalid installation scope must fail closed. Review the decision and redacted audit metadata in the web app.

Keep provider credentials, payloads, results, customer documents, embeddings, and indexes in your environment. Send only installation status and redacted decision metadata to the control plane.

## Disabling `kei-proxy` denies every governed tool call

`KEI_PROXY_DISABLED=true` is a valid setting, but it turns permits off: a disabled, missing, or misconfigured `kei-proxy` is a **deny on every governed call** (fail-closed). It never permits a tool call. Tests that need an allow inject a fake evaluator instead of relying on a disabled proxy (see [Build on the Agentware SDK](https://github.com/HaikeiLabs/agentware/tree/main/docs/getting-started) for the evaluator and its test fixtures). A production harness should not run with `kei-proxy` disabled — every governed tool would be denied.