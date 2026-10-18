---
title: "Getting Started: Web Onboarding"
type: read-and-use
product: kei
---

# Getting Started: Web Onboarding

Use the Kei web app to set up the organization that owns your governed workflows. This walkthrough covers the initial browser journey: create a workspace, invite people, register connector metadata, define access policy, and review the resulting activity. You can do this before connecting an agent.

Your organization and workspace hold policy, connector configuration, and audit metadata. Bring or build your own Kei-enabled harness; it connects through agentware to the tenant-side connector runtime, which enforces policy and performs governed connector operations in your environment.

## Concepts

- **Harness** — software that lets an LLM act as an agent (for example Claude Code, OpenCode, Pi, Open WebUI, or an SDK (Agentware) integration). One harness runs with one runtime installation and one runtime credential.
- **Kei-enabled harness** — a harness governed by Kei through a **runtime installation**. Agent, organization, workspace, and installation identity come from the authenticated runtime identity handshake.
- **Runtime installation** — Kei's record for the one runtime deployed beside that harness (one harness : one runtime installation : one credential, `KEI_RUNTIME_TOKEN`). The console page is called **Runtime installations**. Its card shows connectivity, policy bundle readiness, assigned agents, and a Logs view for lifecycle, connectivity, decision, and event records.
- **Agent** — an LLM configuration the harness runs (model, system prompt, tools).

## 1. Create your organization and workspace

Sign in to the web app. If you are new to Kei, create your organization and then create its first workspace. The workspace is where you configure connector metadata, groups, policies, and agent access. After creating it, confirm the workspace appears in the workspace selector before continuing.

If you already belong to an organization, select it and create or open the workspace where this integration should live. Keep separate environments or teams in separate workspaces when they need different access policies. To create one, use the left navigation **Workspaces** (`/workspaces`) and choose **Create Workspace** (`/workspaces/new`). Enter a workspace name and submit; the screenshot shows fictional example data.

![Console Workspaces navigation and Create Workspace screen with an example workspace name entered](/docs/setup/workspace-creation.png)

## 2. Invite workspace members

Open **Users** to invite the people who will administer or use this workspace. Assign only the roles they need. Organization owners manage organization membership; workspace access is controlled by workspace membership and policy.

## 3. Register the connectors you plan to use

From the left navigation, open **Data Connections** (`/connections`), choose **Add Connector**, and add a connector before starting its setup flow. The Connect, Approve tools, and Grant access screens belong to that connector, so opening a setup link before creating one will not work. Registration describes available operations; it does not grant access by itself. Keep provider credentials in your tenant environment and follow the connector's credential setup instructions.

![Connector gallery showing built-in and remote MCP options](/docs/images/connector-setup/connectors-gallery.png)

After adding the connector, connect its account, review and approve its tool manifest, then choose **Continue to grant access**. That final step opens **Policies** with the connector selected. The selected connector may have no applicable policies yet; create one for the people or agents who should use it. Reaching Policies does not grant access automatically. See [Connector setup and access](/docs/connectors/connectors#add-connect-and-grant-access) for screenshots of each step.

## 4. Define groups and policies

Create groups that match the people or workloads that need access, then configure policies for the relevant connector operations. Grant only the required actions and scope. A registered connector remains unavailable until an applicable policy allows the operation. On **Policies** (`/policies`), review each who pattern, what resource or action it matches, allow or deny effect, and priority.

## Install the kei CLI

Some setup steps require the `kei` CLI. Install it with the public release installer:

```bash
curl -fsSL https://haikeilabs.com/install.sh | sh -s -- -d "$HOME/.local/bin"
```

Verify the installation:

```bash
kei --version
```

Update to the latest version with `kei upgrade`, or re-run the installer. See [CLI authentication and runtime setup](/docs/getting-started/cli-and-runtime) for the full command reference.

## 5. Connect your harness

Go to Agent setup to choose the harness you use (Claude Code, Codex, OpenCode, or Pi) and copy its setup prompt. The prompt gives harness-specific installation steps and directs an owner/admin through runtime installation and bootstrap. Kei supports six harness types: Claude Code, Codex, OpenCode, Pi, Open WebUI, and SDK (Agentware). Pi has its own `kei-lime-pi` package and local-socket adapter; Open WebUI has its own image and tool packs; bespoke agent integrations use the Agentware SDK. Keep runtime credentials in a secret manager—never put them in prompts, source control, screenshots, or logs. Package installation does not grant policy permissions. After setup, make one call the policy allows and one it denies, then check Audit Logs. For deployed services and SDK integrations, see [CLI authentication and runtime setup](/docs/getting-started/cli-and-runtime) and [Tenant-side connector runtime](/docs/runtime/tenant-runtime). For Agentware SDK development, see [Build on the Agentware SDK](https://github.com/HaikeiLabs/agentware/tree/main/docs/getting-started).

<p><a class="docs-cta-button" href="/docs/connect-your-harness/harness-setup">Connect your harness →</a></p>

## 6. Review audit activity

Open **Audit logs** to check that governed operations produce the expected decision and redacted activity record. Investigate unexpected denials by checking workspace selection, membership, connector registration, and policy bindings. Calls do not pause for approval.

## Alternative: use an agent with public skills and the CLI

The web app is the control-plane onboarding path. If you prefer to administer runtime setup from a terminal with an agent, install the public [Kei skills](https://github.com/HaikeiLabs/skills#installing), then use the **kei administrator CLI** for supported runtime-installation and credential tasks. For a local workstation/headless harness, use `kei setup` and `kei runtime bootstrap` as described in [CLI authentication and runtime setup](/docs/getting-started/cli-and-runtime); this configures the local proxy workflow and does not deploy a service. For a deployed service or SDK (Agentware) integration, configure and package the tenant-side `kei-proxy` in the customer-owned runtime environment as described in [Tenant-side runtime](/docs/runtime/tenant-runtime). The skills and CLI do not replace organization/workspace onboarding or build an SDK integration.

See [CLI authentication and runtime setup](/docs/getting-started/cli-and-runtime) for supported commands. Never place runtime credentials in prompts, source control, or command arguments; store them in your tenant's secret manager.

## Building on the Agentware SDK

For developers integrating an agent through the SDK, see [Build on the Agentware SDK](https://github.com/HaikeiLabs/agentware/tree/main/docs/getting-started). This is a separate development path from onboarding an existing agent through the web UI or installing skills.