---
title: Harness rendering
type: reference
product: kei
nav_group: Reference
nav_order: 40
---

# Harness rendering

Kei translates the policy bundle into native permissions for each connected harness. The translation depends on the harness type and the target kind of each policy.

## Desktop harness rendering

### Claude Code

Claude Code reads permissions from `settings.json`. Kei writes allow and deny entries for each rendered policy. Deny entries take precedence over allow entries in Claude Code's native evaluation.

| Policy effect | Claude Code representation |
| ------------- | -------------------------- |
| allow | `allow` entry |
| deny | `deny` entry (overrides any overlapping allow) |

### Codex

Codex uses a rules-based permission model. Kei writes allow as permitted commands and deny as `forbidden` entries.

| Policy effect | Codex representation |
| ------------- | -------------------- |
| allow | Allowed command |
| deny | `forbidden` entry |

### OpenCode

OpenCode uses a bash-permission configuration block. Kei writes each rendered shell-policy effect as a permission entry.

| Policy effect | OpenCode representation |
| ------------- | ----------------------- |
| allow | Permission entry (bash allow) |
| deny | Permission entry (bash deny) |

## SDK (Agentware) rendering

SDK implementations use `KeiProxyEvaluator` to call `kei-proxy authorize` for each tool invocation. The proxy evaluates the active workspace policy bundle and returns an allow or deny decision. This path fails closed: if the proxy cannot be reached or the bundle cannot be validated, the call is denied.

| Target kind | Evaluation path |
| ----------- | --------------- |
| `tool:<name>` | `kei-proxy authorize` |
| `capability:<name>` | `kei-proxy authorize` |
| `connector:<id>` | `kei-proxy authorize` |
| `mcp:<name>` | `kei-proxy authorize` |

## Pi

Pi uses its own package and a local-socket adapter. Kei renders policy into Pi-specific configuration through the adapter. See [Pi setup](/kei/connect-your-harness/harness-setup#pi).

## Open WebUI

Open WebUI uses its own container image and tool packs. Kei renders policy through the Open WebUI integration. See [Open WebUI with Kei](/kei/connect-your-harness/openwebui).

## Which policies render into which harness

### Desktop harnesses (Claude Code, Codex, OpenCode)

Only `shell:`, `skill:`, and `path:` policies with a matching source render into desktop harness native settings.

- A `*` source renders for every harness.
- A `harness:<kind>` source renders for the named harness kind.
- A `group:<name>` source renders when it matches one of the bundle subject's groups.
- An `autogroup:member` or `autogroup:admin` source resolves at runtime and renders when the subject's role matches.
- Policies written before the group-only rule with a `user:<id>`, `email:<address>`, or `org:<role>` source render only when they match the bundle subject. New policies name a group instead.

When a source does not match, its policy is **skipped** — it does not render into the harness at all. This means a skipped deny never becomes an allow, and a lower-precedence allow it would have overlapped is withheld, causing the harness to use its native ask.

### SDK (Agentware) and connectors

All target kinds (`tool:`, `capability:`, `connector:`, `mcp:`) are evaluated by `kei-proxy authorize`. Source matching follows the same rules: a `group:` or `user:` source applies only when it matches the caller.

### MCP tools

MCP tools declared in a connector are matched by `mcp:<name>` target patterns. They are evaluated through `kei-proxy authorize`.

## Skipped-deny behavior

A policy whose source does not match the bundle subject is skipped entirely. This is important for deny policies:

- **If a deny policy is skipped** because its source does not match, the deny never renders. This is correct — the deny should not apply to that subject.
- **If an allow policy is skipped** because its source does not match, a deny at a lower priority may still render if its source matches and it was not overlapping the skipped allow.

For example, a `user:alice` deny for `shell:git push --force` only renders when Alice is the bundle subject. Bob never sees that deny, so he can push if another allow covers him.

## Per-harness source matching behavior

| Source pattern | Who it matches for rendering |
| -------------- | ---------------------------- |
| `*` | Every harness |
| `harness:*` | Every harness |
| `harness:claude_code` | Claude Code only |
| `harness:codex` | Codex only |
| `harness:opencode` | OpenCode only |
| `group:developers` | Bundle subjects who are members of the developers group |
| `user:98a1b2c3` | The specific user |
| `autogroup:member` | Every bundle subject |
| `autogroup:admin` | Bundle subjects who are workspace admins or owners |

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
- [How Kei governs coding agents](/kei/reference/how-it-works) — architecture overview
- [Connect your agent](/kei/get-started/connect-your-agent) — harness setup
