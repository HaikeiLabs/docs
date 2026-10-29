---
title: How policy bundles reach a runtime
type: read-and-use
product: kei
nav_group: Reference
---
# How policy bundles reach a runtime

A policy bundle is the file of rules, tools, groups, and identities that Kei builds for one runtime installation. The runtime reads the bundle to decide what an agent may do. This page explains how the bundle gets to the runtime and why a newer field can be missing from the bundle you receive.

## What a bundle is and who uses it

A bundle is plain JSON. The catalog builds it from your workspace's policies, groups, tools, and connectors, and addresses it to one installation. It is not signed or encrypted; the runtime trusts it because it arrives over an authenticated HTTPS response.

Two things read it:

- **`kei-proxy`** uses the bundle as its local policy decision point. It decides governed calls from the bundle without calling the catalog for each one.
- **Harness adapters** and `kei harness sync` use the bundle to write native permission settings for Claude Code, Codex, and OpenCode. See [Govern harness commands](/kei/policies/govern-harness-commands).

## How it is delivered

The catalog serves the bundle at:

```text
GET /api/v1/runtime/policy-bundles/current
```

`current` is the only bundle name. The request carries the runtime installation credential as a bearer token, and the catalog scopes the answer to that installation's organization and workspace. Revoked or inactive installations get no bundle.

`kei-proxy` keeps the bundle in its state directory, so it keeps deciding between fetches. It polls about once a minute and sends the digest it holds as `If-None-Match`; the catalog answers `304` when nothing has changed. A bundle is valid for 12 hours and is renewed at 6 hours. If a refresh fails, the runtime keeps enforcing the bundle it holds until that bundle expires. For the failure responses and log lines, see the runtime's [policy refresh](https://github.com/HaikeiLabs/kei-connector-runtime/blob/main/docs/policy-refresh.md) page. To check what a machine holds, run `kei-proxy policy show`.

## Why some fields are missing

A runtime checks every bundle against a closed schema: a field it does not know is an error, and it rejects the whole bundle. If the catalog sent a new field to an older runtime, that runtime would stop receiving policy.

So the catalog adds a new field only for runtimes that accept it. For each such field it keeps the first runtime release that understands it, and compares that with the version the installation last reported in its heartbeat. An operator switch can also turn a field off for everyone. An installation that has not reported a version gets the oldest shape of the bundle.

What this means for you:

- An older runtime keeps working with the bundle shape it understands.
- If a field is absent, the runtime uses its built-in behavior for that feature. Nothing is broken.
- To receive a newer field, update `kei-proxy` and let it send a heartbeat.

## Example: the harness kind registry (planned)

> **Note:** The registry below is planned and is not served yet. Today's bundles do not contain it.

Today the list of harness kinds (`claude_code`, `codex`, `opencode`, `pi`, `custom`) is built into Kei. The planned `harness_kinds` field puts that list in the bundle, so a new harness kind needs no new runtime release. Each entry has:

| Property | Meaning |
| --- | --- |
| `kind` | The kind's identifier, for example `codex`. Lowercase letters, digits, and underscores, starting with a letter. |
| `short_name` | The name the harness's hooks use for it. |
| `tool_prefix` | The prefix on that harness's tool names. |
| `shell_tool` | The tool that carries a shell command line. |
| `gateable` | Whether Kei can gate this kind's calls. |
| `decides_via` | Who decides: `pdp` (the `kei-proxy` local policy decision point) or `native` (a native allowlist that Kei renders into the harness). |
| `native_tools` | Pairs of `tool_name` (Kei's name) and `native_name` (the harness's own name) for its built-in tools. |

When the field is absent, only the built-in kinds are valid.

The release order matters:

1. **Runtime first.** The runtime change that accepts `harness_kinds` is merged but is not in a `kei-proxy` release yet.
2. **Catalog gate second.** Once a runtime release includes it, the catalog gate is set to that release and then switched on. Until then, no installation receives the field, whatever its version.

## Related pages

- [Policies, explained](/kei/policies/policies-explained)
- [How Kei decides](/kei/reference/how-kei-decides)
- [Connect a harness to an agent](/kei/connect-your-harness/harness-setup)
