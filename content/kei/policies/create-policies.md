---
title: Create policies
type: reference
product: kei
---

# Create policies

A policy says who may do what, and whether it is allowed or denied. This page walks through writing one: the fields, how Kei orders policies that overlap, which sources and destinations to choose, and what `kei harness sync` writes into a desktop harness. For the full decision model, see [Policy priority and precedence](/content/kei/policies/policy-precedence.html). To grant an agent access through a group, follow [Give a group access](/content/kei/get-started/give-a-group-access.html).

Kei does not seed policies. Administrators create policies for their workspace.

## Anatomy of a policy

| Field | What it holds | Example |
| --- | --- | --- |
| `src` | Who the policy applies to | `group:admins`, `user:<id>`, `agent:<id>`, `*` |
| `dst` | What it matches | `shell:git push --force`, `tool:registered_function` |
| `effect` | `permit` or `deny` | `deny` |
| `priority` | An integer; higher decides first | `100` |
| `enabled` | Whether the policy takes part in decisions | `true` |

## How overlapping policies are ordered

When several enabled policies match, Kei orders them and the first one decides:

1. Priority, highest first.
2. At equal priority, deny before allow.
3. Policy ID, ascending.

When no policy matches, the result depends on where the request is decided. `kei-proxy authorize` fails closed: SDK (Agentware) integrations and connector operations get a `deny`. A desktop harness (Claude Code, Codex, OpenCode) has no rendered rule for the command, so it makes its own native decision, usually **ask**. Pi and Open WebUI use their own integrations.

## Choose a source

- **People and agents are the normal sources.** Use `user:<id>`, `group:<name>`, `agent:<id>`, or `autogroup:member` for every organization member. These apply whichever harness the person or agent is using.
- **`harness:<kind>` or `harness:<id>` is optional and narrower.** Use it only for a rule that differs by harness, such as "Codex may never run `rm`". It applies to everyone using that harness, not to a person. A `harness:` source is valid only with a harness destination (`shell:`, `skill:`, `path:`, `mcp:`, or a harness tool such as `tool:claude_code.edit`). Saving a `harness:` source with a connector, capability, resource, or other tool destination is rejected.
- **`agent:<id>` with an exact tool or capability is checked at call time.** The policy matches when its source matches either the user or the calling agent. That means a broad agent allow can grant around a user's narrower rules. To cap it, add a higher-priority deny for the operation you want to exclude.

| Source | Destination | Effect | Priority |
| --- | --- | --- | ---: |
| `agent:<id>` | `shell:git push --force` | deny | 60 |
| `agent:<id>` | `shell:git` | allow | 50 |

## Choose a destination

- `shell:<prefix>`: a whole-token command prefix. `shell:git` matches `git push`, not `gitx`.
- `skill:<name>`: an exact skill name.
- `path:<glob>`: an absolute path glob, such as `path:/repo/**`.
- `tool:<name>`: one exact tool-call name, with no wildcards.
- `capability:<name>`: one exact capability, such as `capability:pull_request.read`.
- **All tools on a connector:** in the console, pick a connection and check **All tools on this connector**. The policy covers every tool bound to that connection, including tools added later. A higher-priority `deny` on one tool still carves it out.

## Write the policy

**In the console:** open **Policies**. Use **Create agent command policy** for shell commands, skills, and file paths, and **Create Policy** for tool calls and connectors. Choose **Who** and **What**, set **Effect**, and set **Priority** under **Advanced**.

**With the CLI:**

```bash
kei policies create --name "allow git" --src-pattern "*" \
  --dst-pattern "shell:git" --effect permit --priority 10
```

To bring an existing allow list across, `kei policies import --from claude` (or `codex`, `opencode`) prints the policies it would create; add `--apply` to create them.

After a change, run `kei harness sync` so desktop harnesses pick it up.

## What renders into a desktop harness

`kei harness sync` writes `shell:`, `skill:`, and `path:` policies into each harness's native settings. A `*` source always renders. A `user:`, `email:`, or `group:` source renders only when it matches the bundle's **subject**: the user who owns the runtime installation, their email, or one of their groups. A policy for another user or a group the subject is not in is skipped. Current policy bundles carry the subject. Bundles from older control planes do not, so none of those sources render there, and sync prints a line saying so.

### A deny that cannot render still holds

| Source | Destination | Effect | Priority |
| --- | --- | --- | ---: |
| `group:admins` | `shell:git push --force` | deny | 100 |
| `*` | `shell:git` | allow | 10 |

When the bundle has no subject, or the subject is not in `admins`, the deny is skipped. Rendering the allow on its own would let `git push --force` run without asking, so sync withholds the allow too and prints a line for it:

```text
$ kei harness sync --harness claude_code --dry-run
not rendered in Claude Code: allow git (a higher-precedence user:/group: deny overlaps it; the harness will ask)
```

`~/.claude/settings.json` gets no `git` entry, so Claude Code asks before `git push --force`, and before any other `git` command. A skipped deny never becomes an allow.

When the subject is in `admins`, both policies render and Claude Code denies the push natively:

```json
"allow": ["Bash(npm test)", "Bash(git:*)"],
"deny": ["Bash(git push --force:*)"]
```

An allow that does not overlap the skipped deny still renders. For example, adding `*` `shell:git status` at priority 10 renders `Bash(git status:*)`, so `git status` runs without asking while `git push --force` still asks.

## Checklist

- Start from people and agents. Add `harness:` only for a per-harness difference.
- Give each rule a distinct priority. Guardrail denies go highest.
- Cap broad agent allows with a higher-priority deny.
- Run `kei harness sync --dry-run` and read every `not rendered` line before you sync.
