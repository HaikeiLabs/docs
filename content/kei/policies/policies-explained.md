---
title: Policies, explained
type: read-and-use
product: kei
nav_group: Get started
nav_order: 5
---

# Policies, explained

A policy is a rule that says **who** (a person, group, or agent) may do **what** (run a shell command, invoke a tool, or use a connector capability) and whether it is **allowed** or **denied**.

Kei uses policies to make deterministic authorization decisions for agent tool calls. Unlike an AI model judging each request, Kei matches the request against a fixed set of rules and returns a predictable result. For the full decision model, see [How Kei decides](/kei/reference/how-kei-decides).

## Key concepts

- **Source** — who the policy applies to, such as a group, a user, or every organization member.
- **Destination** — what the policy controls, such as a shell command prefix, a tool name, or a connector capability.
- **Effect** — allow or deny.
- **Priority** — when multiple policies match, the highest-priority policy wins.

## How policies work

1. An admin or owner creates a policy in the console or with the Kei CLI.
2. Kei distributes the policy to each developer machine's runtime installation.
3. When an agent makes a call, Kei checks matching policies in priority order.
4. The first matching policy decides — allow or deny.

Desktop harnesses (Claude Code, Codex, OpenCode) receive the policy as native permission settings. The harness makes its own decision from those settings. SDK (Agentware) integrations and connector calls go through `kei-proxy authorize`, which evaluates the policy bundle and returns a decision.

## What policies can control

| Destination kind | Examples |
| ---------------- | -------- |
| Shell commands | `git push`, `npm install`, `docker compose up` |
| Skills | `wiki`, `linear` |
| File paths | `/repo/src/**`, `/etc/config` |
| Tool calls | `read_file`, `list_issues` |
| Connector capabilities | `pull_request.read`, `file.write` |

## What happens when no policy matches

- **Desktop harness:** the harness uses its native permission mode, usually **ask**.
- **SDK (Agentware) or connector:** the call is **denied** (fail closed).

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [What can I do here?](/kei/policies/what-can-i-do-here) — your next steps based on your role
- [Ask for access](/kei/policies/ask-for-access) — request access to a workspace or capability
- [Why was this denied?](/kei/policies/why-was-this-denied) — understanding denials
