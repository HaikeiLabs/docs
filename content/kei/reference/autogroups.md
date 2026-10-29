---
title: Autogroups
type: reference
product: kei
nav_group: Reference
nav_order: 30
---

# Autogroups

An **autogroup** is a virtual group whose membership is determined by a caller's organization role. You can use `autogroup:` as a policy source, just like a regular group, but its members are never stored — they are resolved at runtime from the caller's role.

## Available autogroups

| Autogroup | Who is included | Resolved from |
| --------- | --------------- | ------------- |
| `autogroup:member` | Every organization member | Always present for any authenticated caller |
| `autogroup:admin` | Workspace admins and owners | Organization role |

These are the only two autogroups. A caller always resolves to at least `autogroup:member`; admins and owners also resolve to `autogroup:admin`. For policy, the organization Owner counts as an admin — Owner and Admin differ only in the console.

To grant access to agents or service principals, put them in a custom group (`group:<name>`) and use that group as the policy source. There is no `autogroup:owner` and no `autogroup:agent`.

### Resolved set

| Caller attributes | Resolved autogroups |
| ----------------- | ------------------- |
| Any member | `autogroup:member` |
| Member with admin role | `autogroup:member`, `autogroup:admin` |
| Member with owner role | `autogroup:member`, `autogroup:admin` |

- A caller with both the admin and owner roles resolves as `autogroup:member`, `autogroup:admin`, with `autogroup:admin` listed once.

## Using autogroups in policies

Use an `autogroup:` source in any policy `src` pattern. The `--group` flag of `kei policy create` accepts `autogroup:` prefixes directly:

```shell
# Allow every member to use basic git commands
kei policy create --group autogroup:member --allow "shell:git log"

# Deny a dangerous operation for everyone in a group
kei policy create --group contractors --deny "shell:git push --force"
```

> **Warning:** `autogroup:member` resolves for every caller, including admins and owners. Kei decides with deny-overrides, so an allow for `autogroup:admin` cannot lift a deny for `autogroup:member`. To exempt admins, deny a custom group that does not contain them instead of `autogroup:member`. See [How Kei decides](/kei/reference/how-kei-decides).

## How autogroups differ from regular groups

| Aspect | Regular group | Autogroup |
| ------ | ------------- | --------- |
| Storage | Stored as a group resource with explicit members | Never stored; membership resolved at runtime |
| Management | Created and managed by org admins; can hold users and agents | Automatically derived from org roles; only `member` and `admin` exist |
| Nesting | Supports group nesting | No nesting — autogroups are flat |
| Scope | Workspace-scoped | Organization-role-based; available in every workspace |
| Policy source | `group:<name>` or bare name | `autogroup:<name>` |

## Not yet available

The following autogroups have been proposed but are **not yet shipped**:

- `autogroup:harness:<kind>` — harness-specific autogroups
- `autogroup:auditor` — auditor-role autogroup

When these become available, they will appear here and in the CLI reference.

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
- [Give a group access](/kei/get-started/give-a-group-access) — working with groups in the console
