---
title: Set up a local Kei runtime for an Agentware SDK harness
type: read-and-use
product: agentware
---

This guide connects a custom Go, Python, or TypeScript harness to a local `kei-proxy` daemon. The daemon is the runtime and policy enforcement point; Kei stores installation and harness metadata. Provider payloads, customer content, and credentials stay out of the control plane.

Compatible versions: agentware 0.11.0, kei-proxy v0.3.0, kei-cli 0.2.0.

## Prerequisites

- A macOS or Linux host where your harness and `kei-proxy` can run as the same operating-system user.
- A Kei organization and workspace. An organization owner or admin must create the organization and workspace in the Kei console and configure the policies needed by the harness.
- An organization owner or admin who can approve `kei login` and provision a runtime installation credential.

## Install and sign in

Install the Kei CLI and its bundled `kei-proxy` runtime:

```sh
curl -fsSL https://haikeilabs.com/install.sh | sh
kei --version
kei-proxy --help
```

If you install to a user-writable directory, add that directory to `PATH` as described by the installer documentation. Sign in as an organization owner or admin; approve the device authorization in your browser when prompted:

```sh
kei login
```

The CLI stores its login credential in the operating system credential store. Do not copy it into a file, command argument, or harness environment.

## Create a runtime installation

Create pending installation metadata for this local SDK runtime:

```sh
kei bot init --platform cli --name "My Agentware SDK harness" --workspace "WORKSPACE_NAME"
```

Record the printed installation ID. Request its runtime credential and deliver it directly into your approved secret manager; do not print or paste the credential into a terminal transcript, repository, or harness source. The CLI supports piping credential output directly to a secret-manager import command:

```sh
kei bot credential --installation INSTALLATION_ID --workspace WORKSPACE_ID | secret-manager import
```

Then configure the local runtime:

```sh
kei setup
```

Follow the prompts to configure the Kei control-plane URL and runtime installation credential. `kei setup` stores local configuration in `~/.config/kei.yaml` with `0600` permissions. Keep the credential out of harness code and logs.

## Bootstrap the runtime

On a workstation, bootstrap from the `kei` configuration you just created. This verifies the runtime credential, sends the first heartbeat, and syncs the policy bundle:

```sh
kei runtime bootstrap
```

For a deployed runtime configured with environment variables instead of workstation config, run the runtime binary directly:

```sh
kei-proxy runtime bootstrap
```

## Start the daemon and check readiness

Choose a short, user-writable socket path and configure it in the environment of `kei-proxy` and the harness. macOS limits Unix socket paths to 104 bytes; keep the full path comfortably below that limit. The SDK reads `KEI_RUNTIME_SOCKET_PATH` from its process environment and otherwise uses `/run/kei-proxy/runtime.sock`.

For example, set the socket path in the shell that starts the daemon and harness:

```sh
export KEI_RUNTIME_SOCKET_PATH="$HOME/.kei/runtime.sock"
```

**Known limitation:** `kei-proxy serve` does not yet read `~/.config/kei.yaml`. Although `kei setup` saves workstation configuration there for `kei runtime bootstrap`, `KEI_RUNTIME_TOKEN` and `KEI_RUNTIME_CONTROL_PLANE_URL` must also be injected into the daemon's environment by your secret manager. Never put the token in the command line, shell history, this guide, or harness source.

Start the daemon with the secret manager supplying those environment variables:

```sh
kei-proxy serve
```

`kei-proxy serve` keeps the runtime heartbeat running itself. Check readiness through the Unix socket from another terminal:

```sh
curl --unix-socket "$KEI_RUNTIME_SOCKET_PATH" http://localhost/readyz
```

`/readyz` returns success when the runtime has the required control-plane URL and runtime credential configured. Then confirm the control plane has received the first heartbeat:

```sh
kei bot status --installation INSTALLATION_ID
```

Verify that `last_heartbeat_at` is present, then bind the installation:

```sh
kei bot bind --installation INSTALLATION_ID
```

If installation or binding reports that organization, workspace, agent, or policy setup is missing, ask an organization owner or admin to resolve it in the Kei console.

## Register the SDK harness and sync its tools

The user-facing harness name is **SDK (Agentware)**; its API kind is `custom`. Use the `installation_id` returned by `kei bot init`. The CLI resolves the assigned agent for that installation; if there is no default agent, assign one with:

```sh
kei bot agents add --installation INSTALLATION_ID --agent AGENT_ID --default
```

Register the harness:

```sh
kei harness add --kind custom --installation INSTALLATION_ID
```

### Register tools over the runtime socket

Agentware 0.11.0 can register tools directly with `kei-proxy` over its Unix socket. Use `ToolSpec` with an explicit `harness_executor` route; the tool name must match the name your harness authorizes. The socket API is available in `kei-proxy` v0.3.0 at `POST /v1/tools:register`.

See the language-specific setup pages for code examples:

- [Go: register tools](/content/agentware/build/go.html#register-tools-over-the-socket)
- [Python: register tools](/content/agentware/build/python.html#register-tools-over-the-socket)
- [TypeScript: register tools](/content/agentware/build/typescript.html#register-tools-over-the-socket)

As an alternative, maintain a `tools.json` manifest and sync it with the CLI:

```sh
kei harness sync --harness custom --manifest tools.json
```

The manifest is tool metadata, not a credential store or permission grant. The proxy and Kei policy determine whether a call is allowed. Keep credentials and customer payloads out of it.

## Create a group and policies

In the selected workspace in the Kei console, open **Groups** → **Create Group**, create a group for this run, then add the agent's user to that group. Open **Policies**, choose **New policy** (or **Create your first grant** when the workspace has no policies), and create two tool-call policies for the group:

1. Set **What** to **Tool call**, choose the group under **Who**, target the exact `echo` tool with **Allow** (permit effect), then create.
2. Create a second policy for the exact `delete_everything` tool with **Deny**.

If a tool is not in the picker, use its exact name without a `tool:` prefix. See the [Create policies](/content/kei/policies/create-policies.html) guide for the console workflow and policy fields.

## See your audit entries

In the Kei console, open **Audit Logs**. Find the records by the `echo` and `delete_everything` action names; each row shows its timestamp, user, agent, harness, action, result (`permit` or `deny`), and policy. See the [Audit logs](/content/kei/audit/logs.html) page for the recent activity view and recorded fields.

## Understand a denial

A policy denial is a normal authorization result. The response includes a deny decision and may include a `reason_code`, reason text, policy ID, or a hint. The SDK returns the denial to the caller; it does not authorize tool execution. Proceed to the tool handler only after an explicit allow. Connection and protocol errors are errors and fail closed.

For reason codes and next-step guidance, see the [Deny reason codes](/content/agentware/reference/deny-hints.html) reference. An organization owner or admin must create or adjust policies in the Kei console when a denial requires a policy change.

## Next steps

- [Policy and audit](/content/agentware/build/policy-and-audit.html) — create policies and view audit entries.
- [Deny reason codes](/content/agentware/reference/deny-hints.html) — reference for every `reason_code` and its `hint`.
