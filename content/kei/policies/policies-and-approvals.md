---
title: Policies and approvals
type: reference
product: kei
nav_group: Make and maintain
nav_order: 13
---

# Policies and permission requests

Policies decide whether an agent can use a connector capability against a resource in the active workspace. A policy has an allow or deny effect; evaluating a matched resource produces an allow or deny decision. On connector calls, no match is denied.

A tool call is a named function; a capability is an operation that function needs. A tool declares its `required_capabilities`, and every listed capability must be allowed. Each capability is evaluated separately using priority descending, deny before allow at equal priority, then policy id ascending. A tool-call allow never bypasses a capability deny. The `tool:` selector identifies a registered harness function; `capability:` identifies an operation. Create and review policies from the **Policies** page, keeping scope specific to the active workspace, agent, connector capability, and resource. To grant an agent access through a group, follow [Give a group access](/kei/get-started/give-a-group-access). For policy fields and worked examples, see [Create policies](/kei/policies/create-policies).

The **Policies** page shows how each policy is enforced when the catalog provides that information: call-time through kei-proxy, rendered into the harness, or not enforced with the catalog's skip reason.

Groups are workspace-scoped. Members of a group also get everything granted to the groups it inherits from. Group nesting must stay within one workspace, cycles are rejected, and nesting is limited to four edges.

You can do this in the web app, or ask an agent to guide the same workflow through the documented Kei contracts. The web app is best for reviewing policy and approval state visually; the agent path is useful for repeatable setup and multi-step changes. Both paths use the same workspace-scoped authorization rules.

## Access grants

When a chat identity requests access to a workspace (through a chat interface or other entry point), the request appears in the **Approvals** page under the user access section. An authorized reviewer can assign the user to a compatible workspace, optionally add them to groups, and approve or deny the access request. An approval grants durable access for future invocations; it does not approve a tool call or pause a denied call for review. A denied invocation remains denied. The grant outcome is recorded in the audit log.

For Claude Code, Codex, and OpenCode command policies, Kei renders `shell:`, `skill:`, and `path:` rules into native settings. The harness makes the native decision. The Kei hook only reports that decision for audit, and an unmatched command uses the harness default. Versioned policy bundles refresh periodically; run `kei harness sync` to render updated settings. Custom agents use the runtime policy evaluator.

These approvals grant durable access to a user or group before future calls. They are not per-call approvals: a governed call does not pause while a person approves it.

## Identity and consent

Use the organization onboarding flow to establish the organization and workspace, then invite the people who need access. An invitation carries an organization and a role (`owner` or `admin`) — it is **organization-scoped, not workspace-scoped**, so accepting one grants an organization membership rather than access to a particular workspace. Accepting an invitation returns the organization ID and the granted role. Scope work to a workspace separately.

Keep the person who initiated a task as the invoking subject when your harness delegates to subagents. This identity becomes part of the redacted audit metadata.

Do not put a tenant, organization, or workspace ID in agent-controlled tool parameters. Scope comes from the authenticated installation and workspace context.
