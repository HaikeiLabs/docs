---
title: Why was this denied?
type: read-and-use
product: kei
nav_group: Get started
nav_order: 8
---

# Why was this denied?

When a tool call or command is denied, you can investigate the reason using Kei's audit logs and the `kei policy test` command.

## Check the audit log

The audit log records every policy decision. Each entry includes:

- **Decided by** — the policy that made the decision
- **Outranked** — other matching policies that lost or were disabled
- **Decision** — allow or deny
- **Target** — the tool, command, or capability that was requested

Open the **Audit Logs** in the console or use the `kei` CLI to review recent decisions.

## Test with the CLI

Use `kei policy test` to check what decision a policy bundle would make for a specific subject and target:

```bash
kei policy test --as user:<id> "shell:git push --force"
kei policy test --as group:developers "capability:pull_request.read"
```

The command returns the decision and the policy that decided it:

```
Decision: deny
Decided by: Deny force-push for developers (id: abc123)
```

This lets you verify a denial without making the actual call.

## Common reasons for denials

| Symptom | Likely cause |
| ------- | ------------ |
| A command you expect to work is denied | A higher-priority deny policy matches the request. Check the audit log for the **Decided by** policy. |
| A tool call is denied on a connector | The connector capability is not allowed by any policy for your user or group. Ask an admin to add a policy. |
| A command is denied for a teammate but works for you | A group- or user-specific policy applies to them. Check if you are in the same group. |
| A command asks for confirmation instead of running | No matching deny; no matching allow either. The harness used its default (ask) mode. An admin can add an allow policy. |
| Everything is denied on a new harness | The policy bundle may not be synced yet. Run `kei harness sync`. |

## What to do next

- If you need access, see [Ask for access](/kei/policies/ask-for-access).
- If you are an admin and the denial is unexpected, review the matching policies and priorities in the console or with `kei policy list`. See [How Kei decides](/kei/reference/how-kei-decides) for the precedence model.
- If the denial is from a disabled policy, the admin can enable it in the console.

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Ask for access](/kei/policies/ask-for-access) — request access to a workspace or capability
- [Test before you sync](/kei/policies/test-before-you-sync) — validate policies before syncing
- [Audit logs](/kei/audit/logs) — reviewing audit events
