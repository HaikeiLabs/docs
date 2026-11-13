---
title: "Runtime, CLI and policies"
seo_title: "Kei runtime, CLI and policy management for AI agents"
description: "Set up the kei-proxy runtime, use the kei CLI, write allow and deny policies, and protect sensitive command arguments with your own keys."
type: read-and-use
product: kei
nav_group: Make and maintain
nav_order: 0
---

Three things protect an agent with Kei: the runtime that decides each call in your environment, the `kei` CLI that sets it up, and the policies it enforces. This page shows each one and links to the full guide.

## The runtime

`kei-proxy` is the local policy decision point. It checks the caller's identity and the requested tool, action, and resource against the workspace policy before anything runs, and only the decision and redacted metadata go back to Kei. Credentials, payloads, and results stay in your environment. Run `kei runtime bootstrap` to verify the installation and send its first heartbeat on a workstation, or `kei-proxy runtime bootstrap` inside a service container. See [Tenant-side connector runtime](/kei/runtime/tenant-runtime), [Connect this machine](/kei/get-started/connect-this-machine), and [How policy bundles reach a runtime](/kei/reference/how-policy-bundles-reach-a-runtime).

## The kei CLI

The `kei` CLI is for people administering Kei runtime installations. Sign in as an organization owner or admin with `kei login`, configure the workstation with `kei setup`, then manage workspaces, groups, policies, and connectors, and render policy into your coding agent's native settings with `kei harness sync`. Everything the console does is also available from your terminal. See the [kei CLI reference](/kei/reference/cli).

## Policy management

A policy says who (a group) may do what (run a shell command, invoke a tool, or use a connector capability), with an allow or deny effect. Kei uses deny-overrides: any matching deny wins, and there are no priorities to tune. Test a policy with `kei policy test` before you sync it. See [Policies, explained](/kei/policies/policies-explained), [Policy file syntax](/kei/reference/policy-file-syntax), and [Test before you sync](/kei/policies/test-before-you-sync).

## Data protection

For CLI commands and tool calls that may carry sensitive data, you can encrypt the call arguments in the audit log to age keys you hold, while tool names and decisions stay searchable. With no key registered, Kei stores only a one-way digest. See [Audit tool-argument encryption](/kei/audit/encryption) and [Audit logs](/kei/audit/logs).

## Next

- [Add guardrails to your agent](/tutorials/add-permissions-and-audit) — allow, deny, audit
- [Sign in to Kei](https://app.haikeilabs.com) — get started in the console
- [Policy decision and enforcement (whitepaper)](/kei/reference/whitepaper-policy-decision-and-enforcement)
