---
title: Grant a connector
description: "Create a connector with the kei CLI and give a group access to use it. Requires the owner or admin role."
type: make-and-maintain
product: kei
validated: 2026-10-22
validated_with: kei v0.2.10
nav_group: Make and maintain
nav_order: 15
---

# Grant a connector

This page walks through creating a connector and granting a group access to use it. You need the owner or admin role in the organization.

## Prerequisites

- You are signed in with the `kei` CLI (`kei login`).
- You know which workspace to use (or set `KEI_WORKSPACE`).
- You know which connector template or provider you need.

## 1. Create the connector

### With the CLI

Use `kei connectors create`. Choose a provider or a template:

```bash
# http_api connector for a homegrown CRM API
kei connectors create \
  --name crm \
  --provider http_api \
  --base-url https://crm.example.com \
  --methods GET \
  --paths "/api/leads,/api/leads/*" \
  --credential-ref kei/prod/crm/api-key \
  --workspace my-workspace
```

```bash
# MCP connector from a catalog template
kei connectors create \
  --template filesystem \
  --label "Filesystem" \
  --mcp-url https://mcp.example.com/filesystem \
  --workspace my-workspace
```

```bash
# Native built-in provider (Google Drive, GitHub, Linear, …)
kei connectors create \
  --name drive \
  --provider google_drive \
  --workspace my-workspace
```

Key flags:

| Flag | Purpose |
| ---- | ------- |
| `--name` | Connector name (letters, digits, and `. _ : / -`). Becomes the default display name and slug. |
| `--provider` | Built-in provider: `gmail`, `google_drive`, `linear`, `github`, `tito`, `skills_repo`, `crm`, or `http_api` |
| `--template` | Catalog template ID for an MCP server connector |
| `--label` | Display label for a template-based connector |
| `--credential-ref` | Reference to the credential in your secret manager (for `http_api` and skills\_repo) |
| `--base-url` | HTTPS base URL for `http_api` connectors |
| `--methods` | Allowed HTTP methods for `http_api` (GET, HEAD, POST, PATCH) |
| `--paths` | Allowed path patterns for `http_api` (a trailing `*` matches a prefix) |
| `--no-default-access` | Skip the default admin allow policy |

The connector slug is derived from `--name` (or from `--label` when using `--template`). It cannot be changed after creation. Policies target the connector with `connector:<slug>`.

### In the console

1. Open **Data Connections** in the left navigation.
2. Choose **Add Connector** and select a built-in provider or a remote MCP template.
3. Complete the setup form: name, credential reference or OAuth configuration, and any provider-specific fields.
4. Click **Create**.

## 2. Set the credential

After creation, configure how the connector authenticates.

### OAuth connectors (per-user)

Each user signs in from their harness or with the Kei CLI. Open the connector in the console, choose **Connect**, and complete the OAuth flow.

### Opaque reference connectors (http\_api, skills\_repo)

Store the secret in your secret manager, then reference it when creating the connector. The runtime resolves the reference at call time.

```bash
# The credential reference is set at creation time:
kei connectors create \
  --name crm \
  --provider http_api \
  --base-url https://crm.example.com \
  --methods GET \
  --paths "/api/leads,/api/leads/*" \
  --credential-ref kei/prod/crm/api-key
```

### Shared OAuth connectors

Open the connector in the console and complete the organization-wide OAuth consent. Use **Data Connections → Connect OAuth** (or **Reconnect OAuth** if consent has expired).

## 3. Test the connector

Verify the connector is reachable and credentials are valid:

```bash
kei connectors test <slug> --workspace my-workspace
```

If the test fails, check the connector configuration, credential reference, and network reachability. A passing test means the connector can authenticate and reach the service.

## 4. Grant access with a policy

Create a policy that allows a group to use the connector's capabilities. A connector binding only wires the connector into a workspace; access to it comes from a policy:

```bash
kei policy create \
  --group developers \
  --allow "connector:crm" \
  --workspace my-workspace
```

To restrict access to specific capabilities:

```bash
# Allow only read operations on the crm connector
kei policy create \
  --group developers \
  --allow "capability:http.get" \
  --workspace my-workspace
```

The capability name for an `http_api` connector is derived from the HTTP method: `http.get`, `http.head`, `http.post`, and `http.patch`. To see a connector's registered capabilities, use `kei connectors get <slug> --json`.

To deny access for a specific group:

```bash
kei policy create \
  --group contractors \
  --deny "connector:crm" \
  --workspace my-workspace
```

When several policies match, any matching deny wins over every allow. See [How Kei decides](/kei/reference/how-kei-decides).

### Grants and connector credentials {#grants-and-connector-credentials}

A grant on `tool:<name>` lets a group call the tool. When a harness tool runs against a connector, such as a `get_users` tool that reads the `mysql-seed` MySQL connector, the tool also needs that connector's credential. `kei-proxy` releases the credential only when the permit that allowed the call names that exact connector. A tool-only grant still allows the call, but the release is denied with reason `connector_not_named` and the tool gets no credential. A grant on a capability alone never allows a harness tool.

Name the connector when you grant the tool:

```bash
kei policy create \
  --workspace Main \
  --group db-readers \
  --allow tool:get_users \
  --connector mysql-seed
```

`--connector` takes the ID, name, display name, or slug of a connector in the workspace. If it matches none, the command fails and creates nothing. The grant is stored with the selector `{"tool": "get_users", "connector_id": "<connector ID>"}`, and the output adds a `Connector: NAME (ID)` line.

If you leave out `--connector`:

- When the workspace has exactly one connector, the CLI uses it and says so on stderr.
- When the workspace has no connectors or several, the CLI creates a tool-only grant and warns on stderr: `Warning: This tool will not receive connector credentials`. With several, it lists them so you can rerun with `--connector`.

To create a tool-only grant on purpose, pass `--no-connector`. It skips the connector lookup and prints the same warning. With this grant, `db-readers` can call `get_users`, but `kei-proxy` releases no `mysql-seed` credential for the call:

```bash
kei policy create \
  --workspace Main \
  --group db-readers \
  --allow tool:get_users \
  --no-connector
```

`--connector` and `--no-connector` apply only to `--allow tool:<name>`. On a deny or any other target they are a usage error (exit code 2), because narrowing a deny to one connector would weaken it. Denies and other targets work as before.

In the console, when you choose a harness tool under **Tool call**, the policy form shows a **Connector** picker with the workspace's connectors. It preselects the connector when the workspace has only one. Leaving it on **No connector** is allowed and shows the note *This tool will not receive connector credentials*. Tools that already have a fixed connector binding don't show the picker.

> **Note:** `--connector` and `--no-connector` ship in the first `kei` release after v0.4.0; check `kei policy create --help`. The `kei-proxy` check that denies the release with `connector_not_named` ships in a later `kei-proxy` release. Name the connector now so your tool grants keep their credentials when it does.

## Check it worked

Validate access with `kei policy test`:

```bash
# As a member of the developers group — should be allowed
kei policy test --as group:developers "connector:crm" --workspace my-workspace
```

Expected output:

```
Decision: permit
Deciding rule: <policy ID>
```

```bash
# As a member of the contractors group — should be denied
kei policy test --as group:contractors "connector:crm" --workspace my-workspace
```

Expected output:

```
Decision: deny
Deciding rule: <policy ID>
```

> The `Reason code` and `Hint` fields are not returned by the policy test endpoint. They appear in the harness and in [Audit Logs](/kei/audit/logs) when a real call is denied.

```bash
# As a user outside both groups — should be denied (no match)
kei policy test --as group:auditors "connector:crm" --workspace my-workspace
```

Expected output:

```
Decision: deny
Deciding rule: (none)
```

If you see unexpected results, review the policy target syntax and group membership. Use `kei policy test --json` to inspect the full decision including which policy decided and what outranked it.

## Best practices

- Start with a broad `connector:<slug>` allow for the team that owns the service, then add capability-specific policies for finer control.
- Use `--no-default-access` on creation if you prefer to grant access explicitly rather than relying on the default admin policy.
- Test the connector with `kei connectors test` before creating policies, so you know credential issues are separate from policy issues.
- For MCP connectors, use `mcp:<slug>` to grant access to the whole server or `mcp:<slug>.<tool>` for individual tools.
- When you grant a harness tool that uses a connector, name the connector with `--connector` (or the console's **Connector** picker). A tool-only grant gets no connector credential.

## Known limitations

- **Time-bound access grants can't name a connector yet.** A time-bound grant on a harness tool, made with `kei access grant create` or from the console's **Approvals** page, names only the tool. Once `kei-proxy` enforces the check above, such a grant allows the tool call but releases no connector credential. Until access grants can name a connector, add the user to a group with a policy grant that names the connector. See [Time-bound access](/kei/policies/time-bound-access#known-limitations).

## Learn more

- [Connectors, explained](/kei/connectors/connectors-explained) — connector kinds, credentials, and how authorization works
- [Connectors (setup guide)](/kei/connectors/connectors) — add, connect, and grant access in the console
- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
- [Test before you sync](/kei/policies/test-before-you-sync) — validating policies
