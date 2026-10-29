---
title: Grant a connector
type: make-and-maintain
product: kei
nav_group: Make and maintain
nav_order: 18
validated: 2026-10-22
validated_with: kei v0.2.10
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
