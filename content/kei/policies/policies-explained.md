---
title: Policies, explained
type: read-and-use
product: kei
nav_group: Get started
nav_order: 5
---

# Policies, explained

A policy is a rule that says **who** (a group) may do **what** (run a shell command, invoke a tool, or use a connector capability) and whether it is **allowed** or **denied**.

Kei uses policies to make deterministic authorization decisions for agent tool calls. Unlike an AI model judging each request, Kei matches the request against a fixed set of rules and returns a predictable result. For the full decision model, see [How Kei decides](/kei/reference/how-kei-decides).

## Key concepts

- **Source** — who the policy applies to: a group, or `autogroup:member` (every member) or `autogroup:admin` (admins and owners). Custom groups hold users, agents, and service principals; a policy never names an individual or an email.
- **Destination** — what the policy controls, such as a shell command prefix, a tool name, or a connector capability.
- **Effect** — allow or deny.
- **Deny-overrides** — when multiple policies match, any matching deny wins over every allow.

## How policies work

1. An admin or owner creates a policy in the console or with the Kei CLI.
2. Kei distributes the policy to each developer machine's runtime installation.
3. When an agent makes a call, Kei checks the matching policies.
4. If any matching policy denies, the call is denied. Otherwise, if one allows, it is allowed. With no match, the call fails closed or uses the harness's own mode.

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
