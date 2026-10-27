---
title: Policy file syntax
type: reference
product: kei
nav_group: Reference
nav_order: 20
---

# Policy file syntax

This page describes the source and target patterns you use when creating a Kei policy. For how policies are ordered and evaluated, see [How Kei decides](/kei/reference/how-kei-decides).

## Source patterns (who)

The `src` field identifies who the policy applies to. The wildcard `*` matches every principal.

## Who a policy can name

A policy source is a group: `group:<name>` (or a bare group name), or one of the two built-in autogroups, `autogroup:member` and `autogroup:admin`. Put the people and software you want to cover into a custom group:

- A custom group holds users, agents, and service principals. Add a principal to the group once; every policy that names the group then covers it.
- A direct subject is named only in an access grant, and only by its ID — never in a standing policy.
- A policy never names an email address. The console and CLI show emails, and resolve them to IDs when you pick a person.
- Organization role is not a policy source. Roles are managed in the console; use `autogroup:admin` to cover workspace admins and owners.
- When several policies match, any matching deny wins. A connector binding only wires a connector into a workspace; access comes from a policy.

| Syntax | Kind | Example | What it matches |
| ------ | ---- | ------- | --------------- |
| `*` | any | `*` | Every principal |
| `group:<name>` | group | `group:developers` | Members of the named group (bare names also resolve as groups) |
| `autogroup:<name>` | autogroup | `autogroup:member` | Organization role-based membership — see [Autogroups](/kei/reference/autogroups) |
| `harness:<kind>` | harness | `harness:claude_code` | Sessions running in the named harness kind |

> **Bare names** without a scheme prefix are treated as `group:<name>`. For example, `developers` is equivalent to `group:developers`.

### Autogroup sources

`autogroup:` is a special source prefix that resolves to organization role-based membership at runtime. It is never stored as a group. The available autogroup names are:

| Autogroup | Included when |
| --------- | ------------- |
| `autogroup:member` | Always — every workspace member |
| `autogroup:admin` | The user has the admin role |
| `autogroup:owner` | The user has the owner role |
| `autogroup:agent` | The caller is a registered agent |

See [Autogroups](/kei/reference/autogroups) for details on the resolved set and hierarchy.

### How source patterns are matched

For `kei policy create` (standing rules), the `--group` flag accepts a group name or an `autogroup:` prefix. Users, agents, and service principals reach a standing rule through a custom group; a direct subject belongs in an access grant, by ID:

```
kei policy create --group developers --allow "shell:git"
kei policy create --group autogroup:member --allow "shell:git log"
```

For `kei policy test`, use `--as` to specify the subject:

```
kei policy test --as group:developers "shell:git push"
```

## Target patterns (what)

The `dst` field identifies what command, tool, or capability the policy controls. The wildcard `*` matches every target.

| Syntax | Kind | Example | What it matches |
| ------ | ---- | ------- | --------------- |
| `*` | any | `*` | Every target |
| `shell:<prefix>` | shell | `shell:git push` | A whole-token argv prefix of a shell command |
| `skill:<name>` | skill | `skill:wiki` | An exact skill name |
| `path:<glob>` | path | `path:/repo/**` | A glob pattern for an absolute, lexically cleaned path |
| `capability:<name>` | capability | `capability:pull_request.read` | An exact connector capability name |
| `connector:<id>` | connector | `connector:issues-service` | An exact connector ID (`connector:*` matches any non-empty ID) |
| `tool:<name>` | tool | `tool:registered_function` | An exact tool-call name |
| `mcp:<name>` | mcp | `mcp:filesystem` | An exact MCP server name |

### Shell matching details

`shell:` matches a whole-token argv **prefix**. Each policy token must match the corresponding command token exactly.

| Policy `shell:` | Matches | Does not match |
| --------------- | ------- | -------------- |
| `shell:git` | `git push`, `git log`, `git` | `gitx`, `gitt` |
| `shell:git push` | `git push`, `git push --force` | `git`, `git pushed` |
| `shell:docker compose` | `docker compose up`, `docker compose` | `docker-compose` |

There is no quoting, escaping, or partial-token match. A `shell:*` policy allows or denies every shell command.

### Path matching details

`path:` uses glob patterns for absolute, lexically cleaned paths:

| Policy `path:` | Matches | Does not match |
| -------------- | ------- | -------------- |
| `path:/repo/**` | `/repo/file.txt`, `/repo/src/main.go`, `/repo` | `/other/file.txt` |
| `path:/repo/*.go` | `/repo/main.go` | `/repo/src/main.go` |

- `*` matches within one path segment.
- `**` as a whole segment matches zero or more path segments.

### Connector matching details

`connector:*` matches any non-empty connector ID. A `*` inside a name is literal — `connector:issues.*` matches the literal ID `issues.*`, not every connector beginning with `issues`.

### Tool and capability matching details

`tool:<name>` and `capability:<name>` match exact names with no wildcards. `tool:registered_function` matches only the named registered tool call. `capability:pull_request.read` matches only that capability.

## Effect

| Value (API/CLI) | Display | Meaning |
| --------------- | ------- | ------- |
| `permit` | Allow | Permit the matching request |
| `deny` | Deny | Deny the matching request |

The UI and documentation display Allow and Deny. The API and CLI accept `permit` as the stored value for an allow.

## Priority

An integer from 0 to 2147483647. Higher values win when multiple policies match the same request. See [How Kei decides — recommended convention](/kei/reference/how-kei-decides#choosing-precedence) for suggested priority layering.

## Enabled

`true` or `false`. Disabled policies are skipped during evaluation. Disabling a policy lets you keep it in the policy set without deleting it.

## Legacy forms

| Legacy source | Current equivalent |
| ------------- | ------------------ |
| `*` (bare wildcard) | `*` (same) |
| Bare group name | `group:<name>` |
| `email:<address>`, `user:<id>`, `agent:<id>`, `org:<role>` (for source) | Do not use on new policies; put the principal in a custom group and name `group:<name>` |

Existing policies with these forms keep working until they are migrated to groups. An `email:` form is matched against the email of the resolved user — never an email supplied by the caller.

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Autogroups](/kei/reference/autogroups) — autogroup source resolution
- [Harness rendering](/kei/reference/harness-rendering) — how policies map to each harness
- [Tools and capabilities](/kei/reference/tools-and-capabilities) — tool and capability target semantics
