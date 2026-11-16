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

### Name the connector when you grant a harness tool

Some harness tools run their own code and ask the runtime for a connector's credential, for example a `mysql_query` tool that opens a database connection. A grant on such a tool must name the connector whose credential the tool may receive.

The rule, enforced by the Kei runtime (`kei-proxy`) from its next release:

- The runtime releases a connector's credential only when the allow that permitted the call names that connector.
- A tool-only grant, one that names no connector, still allows the tool call. It releases no credential, so the release is denied with the reason code `connector_not_named`.
- A grant that names a different connector is denied the same way.

Tools bound to a single connector when they were registered already carry their connector, and connector grants such as `connector:crm` are not affected.

#### With the CLI

`kei policy create --allow tool:NAME` takes `--connector`. It accepts the connector's ID, name, display name, or slug in that workspace:

```bash
kei policy create --workspace my-workspace --group db-readers --allow tool:mysql_query --connector orders-ro
```

- **One connector in the workspace:** you can leave out `--connector`. The CLI uses that connector, names it on stderr, and adds a `Connector: NAME (ID)` line to its output.
- **No connector, or several:** the grant is still created as a tool-only grant, and the CLI warns `This tool will not receive connector credentials`. With several connectors, it lists them so you can pass `--connector`.
- **A tool that needs no credential:** pass `--no-connector` to skip the lookup. The CLI prints the same warning and creates a tool-only grant.

```bash
kei policy create --workspace my-workspace --group researchers --allow tool:web_search --no-connector
```

- If `--connector` matches no connector in the workspace, the command fails and creates nothing.
- `--connector` and `--no-connector` work only with `--allow tool:NAME`. On a deny or any other target they are a usage error, because narrowing a deny to one connector would weaken it.

`--connector` and `--no-connector` are available from the next kei CLI release. Check `kei policy create --help` on your installed version.

#### In the console

When you create a **Tool call** policy for a harness tool, the policy form shows a **Connector** picker that lists the workspace's connectors.

- If the workspace has exactly one connector, the picker preselects it.
- Otherwise it starts empty. You can leave it empty, and the form shows the note "This tool will not receive connector credentials".
- Editing an existing tool-only grant does not preselect a connector. The grant keeps what it had until you pick one.

#### Known limitation: time-bound access grants

A time-bound (just-in-time) access grant cannot name a connector yet, from the CLI (`kei access grant create`) or the console. Its allow therefore releases no connector credential: the tool call is allowed, and the credential release is denied with `connector_not_named`. To give someone temporary use of a connector's credential, add them to a group whose tool grant names the connector, and remove them when the work is done.

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

## Learn more

- [Connectors, explained](/kei/connectors/connectors-explained) — connector kinds, credentials, and how authorization works
- [Connectors (setup guide)](/kei/connectors/connectors) — add, connect, and grant access in the console
- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
- [Test before you sync](/kei/policies/test-before-you-sync) — validating policies
