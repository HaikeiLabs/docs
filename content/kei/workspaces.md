---
title: Workspaces, explained
description: "What a Kei workspace scopes, and how to set up a new workspace, test it, and promote it to real use."
type: read-and-use
product: kei
validated: 2026-11-15
validated_with: kei v0.3.7
nav_group: Get started
nav_order: 12
---

# Workspaces, explained

A workspace is the boundary Kei draws around one team's setup: the people in it, the groups they form, the policies that apply to them, the connectors they can use, the runtime installations bound to it, and the audit records it keeps. Every group, policy, and connector belongs to exactly one workspace.

This page explains the model, then shows how to set up a new workspace, how to test it before real use, and how to fix the mistakes that come from working in the wrong one.

## Organization or workspace

An **organization** is your tenant. It owns the users you invite, the workspaces you create, and the settings shared across all of them, such as the credential store and directory sync. You create an organization in the console when you sign up; the `kei` CLI does not create organizations.

A **workspace** is a boundary inside one organization. Two teams can work in the same organization without sharing groups, policies, connectors, or audit records.

| | Organization | Workspace |
| --- | --- | --- |
| Created by | Sign-up in the console | An organization owner or admin |
| Holds | Users, workspaces, the shared credential store, directory sync | Members, groups, policies, connectors, runtime credentials, audit records |
| Boundaries | The whole tenant | One team's setup |
| In the CLI | The login is scoped to exactly one organization | Selected by name: `--workspace`, `KEI_WORKSPACE`, or `kei workspaces use` |

Because a CLI login token is minted for one organization, the CLI never asks which organization you mean. It does have to know which workspace you mean.

## What is scoped to a workspace

| Object | Where it lives | What that means |
| --- | --- | --- |
| Members and groups | One workspace | A group belongs to a single workspace, and nested groups stay in that workspace. Each user is a member of every workspace separately. |
| Policies | One workspace | A policy applies only in the workspace where it was created. The same target can be allowed in one workspace and denied in another. |
| Connectors | One workspace | A connector is created in a workspace. Its tool manifests and its agent bindings live there too. |
| Runtime installations | The organization, with a workspace-bound credential | An installation is an organization object. The credential it issues is bound to one workspace, and that binding decides which policy bundle the runtime receives. |
| Audit records | One workspace | Records are partitioned by organization, workspace, installation, date, and record kind. |
| Model profiles | One workspace | A profile is created for a workspace and can be that workspace's default. |

Two things stay organization-wide: the credential store, which a workspace can override, and directory sync.

## The default workspace

Every organization has one default workspace. It is created with the organization and is usually named `Default`. The console cannot delete it.

The default workspace is where the CLI lands when you do not name a workspace:

```bash
kei workspaces list
kei workspaces current
```

`kei workspaces list` prints the workspaces you can reach and marks the current one with `*`. `kei workspaces current` prints the workspace the CLI would use now, or `No current workspace set; run kei workspaces use NAME.`

The CLI picks a workspace in this order:

1. the `--workspace` flag
2. the `KEI_WORKSPACE` environment variable
3. the deprecated `KEI_WORKSPACE_ID` environment variable
4. the workspace saved with `kei workspaces use`
5. the organization's default workspace

> **Note:** `KEI_WORKSPACE_ID` is deprecated. Use `KEI_WORKSPACE` with a workspace name, or run `kei workspaces use`.

## Who can create or switch workspaces

- **Create a workspace:** an organization owner or admin. The creator becomes the workspace's first member. In the CLI, `kei workspaces create --name NAME`. In the console, open **Settings → Workspaces** and choose **Create Workspace**, or follow the **New Workspace** link in the left navigation.
- **Switch workspaces:** anyone who is a member of the target workspace. The console has a workspace picker in the left navigation and a **Switch** button on the **Settings → Workspaces** tab. The CLI uses `kei workspaces use NAME`, which saves the choice for your login on that machine.
- **Configure a workspace:** workspace admins and owners create groups, policies, connectors, and runtime credentials. The `autogroup:admin` source covers them. See [Groups & autogroups](/kei/policies/groups-and-autogroups).
- **Join a workspace:** an owner or admin invites you, or approves your request on the **Approvals** page. See [Ask for access](/kei/policies/ask-for-access).

## Set up a new workspace

### In the console

1. **Create the workspace.** Open **Settings → Workspaces** and choose **Create Workspace**, or follow the **New Workspace** link in the left navigation. Give it a name that says who it is for, such as `payments-team`. The new workspace becomes your current one.
2. **Add members and groups.** Open **Settings → Groups** in the new workspace and choose **New group**. Add the users and agents that should share access. Membership is per workspace, so add each person in every workspace they need.
3. **Bind connectors.** Open **Data Connections**, choose **Add Connector**, and create the connector in this workspace. Approve its tool manifest, then use **Grant access** to create a policy that lets the group use it. A connector binding wires the connector in; only a policy grants access. See [Grant a connector](/kei/connectors/grant-a-connector).
4. **Bind a runtime installation.** Open **Agents → Add Agent**, name the agent, and choose this workspace for its model profile. The wizard creates the runtime installation and reveals the installation credential once. Store it in your secret manager. See [Connect a harness to an agent](/kei/connect-your-harness/harness-setup).
5. **Connect your coding agent.** A [harness](/kei/reference/glossary#harness) such as Claude Code or Codex talks to the runtime through `kei-proxy`. Name the workspace so the runtime is bound to the one you just built:

   ```bash
   kei connect claude-code --workspace payments-team
   ```

### With the CLI

```bash
# 1. Create the workspace
kei workspaces create --name payments-team

# 2. Make it the current one for this machine
kei workspaces use payments-team

# 3. Add a group and put the agent's users in it
kei groups create --name developers --workspace payments-team
kei groups members add developers <user-id> --workspace payments-team

# 4. Bind a connector to the workspace and wire it to the agent
kei connectors create --name crm --provider http_api \
  --base-url https://crm.example.com \
  --allow-group developers \
  --workspace payments-team
kei connector-bindings create --agent <agent-id> --connector <connector-id> \
  --workspace payments-team

# 5. Bind a runtime installation to the workspace
kei bot init --platform cli --name payments-agent --agent <agent-id> \
  --workspace payments-team
kei bot credential --installation <installation-id> --workspace payments-team

# 6. Connect the coding agent
kei connect claude-code --workspace payments-team
```

Step 5 is the one that matters most. The credential is bound to a workspace, and that binding decides which policy bundle the runtime receives.

Then check the setup:

```bash
kei doctor
```

## Test a new workspace before real use

Build the workspace twice: once as a test workspace, once as the real one. Test first, then promote the same shape.

### 1. Use a separate test workspace

Create a second workspace and keep production data out of it:

```bash
kei workspaces create --name payments-team-test
kei workspaces use payments-team-test
```

Give the test workspace its own groups, policies, and connectors. A connector belongs to one workspace, so point the test connector at a sandbox account or a test repository rather than the production service.

### 2. Make one allowed call and one denied call

Create one allow policy and one deny policy for the test group:

```bash
kei policy create --workspace payments-team-test --group developers --allow "tool:web_search"
kei policy create --workspace payments-team-test --group developers --deny "shell:git push --force"
```

Test the decisions before you make real calls:

```bash
kei policy test --as group:developers "tool:web_search" --workspace payments-team-test
kei policy test --as group:developers "shell:git push --force" --workspace payments-team-test
```

Then make one call the policy allows and one it denies, and check both decisions. See [Test before you sync](/kei/policies/test-before-you-sync) for the full test-then-sync sequence, including `kei harness sync --dry-run`.

### 3. Read the audit records

Every decision is recorded. Open **Audit Logs** in the console and filter to the test workspace. You should see one allow record and one deny record for the test agent, each with the invoking subject, the tool, the decision, and the policy that matched. A denial carries a reason code and a hint.

Audit records are partitioned by organization, workspace, installation, date, and record kind. The console shows the recent window; the durable archive lives in the configured S3 bucket. See [Audit logs](/kei/audit/logs).

### 4. Promote the setup to the real workspace

Promote by recreating the same setup in the real workspace, not by moving the test workspace. Groups, policies, and connectors do not carry over between workspaces.

1. Create the real workspace and switch to it.
2. Re-create the groups and their members.
3. Re-create the policies, starting from the ones you tested.
4. Re-create the connectors and connect the accounts your team uses.
5. Create a runtime installation in the real workspace and issue its credential there.
6. Connect the coding agent with `--workspace <real-workspace>`.
7. Re-run the allow and deny checks in the real workspace before you hand it to the team.

To carry the policies over, read them out of the test workspace and create them by hand in the real one:

```bash
kei policy list --workspace payments-team-test
```

### 5. Clean up the test workspace

Delete the policies, groups, and connectors you created in the test workspace, then delete the workspace itself. The **Settings → Workspaces** tab has a **Manage** button with **Delete workspace**. The default workspace cannot be deleted.

## Troubleshooting

### The coding agent is connected to the wrong workspace

**Symptom:** The agent's calls are decided by policies you did not write, or a policy you wrote has no effect.

**Cause:** `kei bot init` without `--workspace` leaves the installation with no workspace binding, and the credential issued for it falls back to the organization's default workspace — so the runtime ends up in the default workspace. `kei connect` without `--workspace` picks the default workspace for you. Either way the runtime receives the default workspace's policy bundle.

**Fix:** Bind the credential and the harness to the workspace you meant:

```bash
kei workspaces current
kei workspaces use <workspace-name>
kei bot credential --installation <installation-id> --workspace <workspace-name>
kei connect claude-code --workspace <workspace-name>
```

`kei connect` prints the organization and the workspace it picked before it asks you to confirm. Read that line.

### Policies do not show up

**Symptom:** `kei policy list` returns nothing, or returns policies you did not create.

**Cause:** The CLI is reading a different workspace. When nothing is selected, the CLI falls back to the organization's default workspace, so a policy you created in another workspace is invisible.

**Fix:** Name the workspace explicitly, then list again:

```bash
kei policy list --workspace <workspace-name>
kei workspaces current
```

If the workspace name is misspelled, the CLI refuses to guess and lists the workspaces you can reach.

### The runtime is bound to a different workspace

**Symptom:** The runtime authenticates, but every protected call is denied, or the policy bundle is empty.

**Cause:** The runtime credential was issued for another workspace. The credential decides the workspace scope of the policy bundle, so a runtime bound to the wrong workspace never sees your policies.

**Fix:** Check the installation, then issue a new credential for the right workspace:

```bash
kei bot status --installation <installation-id>
kei bot credential --installation <installation-id> --workspace <workspace-name>
```

Rotating replaces the old credential. Send the new token to the runtime's secret manager, then run `kei runtime bootstrap` to verify the installation and send its first heartbeat with the new credential.

## Learn more

- [Policies, explained](/kei/policies/policies-explained) — how a policy decides a call
- [Connectors, explained](/kei/connectors/connectors-explained) — how a connector is authorized
- [Groups & autogroups](/kei/policies/groups-and-autogroups) — groups inside a workspace
- [Test before you sync](/kei/policies/test-before-you-sync) — test decisions before they reach your agents
- [Audit logs](/kei/audit/logs) — what each audit record holds
- [Kei terms](/kei/reference/glossary) — the vocabulary in one place
