---
title: Prove access with an allow and a deny
type: read-and-use
product: kei
nav_group: Get started
nav_order: 6
---

# Prove access with an allow and a deny

Use the connected agent to make two safe test requests: one the group is allowed to make and one it is not allowed to make. This proves the policy is working and that Kei enforces both allows and denies without exposing the runtime credential.

## Before you start

Complete the setup journey in order:

1. [Sign in to Kei](/kei/get-started/sign-in)
2. [Connect this machine](/kei/get-started/connect-this-machine)
3. [Connect your agent](/kei/get-started/connect-your-agent)
4. [Give a group access](/kei/get-started/give-a-group-access)
5. [Install Kei skills in your agent](/kei/get-started/install-skills)

You need at least one policy that permits an operation and at least one operation your group is **not** permitted to perform. If you do not have a deny policy yet, create one that denies a safe test tool (for example, a `web_search` or `connector:read` call on a resource your group does not need).

## Step 1: Make an allowed call

Ask the connected agent to perform a governed operation your group's policy permits. For example, if your group has a permit for `connector:read` on a specific connector:

```
Read the list of open issues from the <connector-name> connector.
```

The agent should execute the governed call successfully.

## Step 2: Make a denied call

Ask the connected agent to perform a governed operation that your group's policy **denies** or does not cover. For example, if your group has no permit for `web_search`:

```
Search the web for "Kei documentation".
```

The agent should refuse to run the call. The harness will report the deny to you without exposing the runtime credential (`KEI_RUNTIME_TOKEN`). You never need to export or type the token to verify a deny — the agent and its harness handle the governed call through `kei-proxy authorize` automatically using the runtime token in the environment.

## Step 3: Check Audit Logs

Open the console and go to **Audit Logs**. Both requests should appear with a decision record.

1. Find the **allow** entry for the first call. Confirm the actor, operation, resource, and decision.
2. Find the **deny** entry for the second call. Confirm the actor, operation, resource, and `deny` decision.

Audit records contain redacted metadata. Credentials and sensitive data stay in your environment and are never sent to Kei.

## Step 4: Verify with `kei doctor` (optional)

Run the CLI doctor to confirm the runtime, hooks, and policy bundle are healthy without handling the credential:

```sh
kei doctor
```

The output shows:

- Runtime service status
- Heartbeat health
- Harness hook installation
- Policy bundle version and expiration

All checks pass without the runtime token. The doctor uses the token already configured by `kei setup` in `~/.config/kei.yaml`.

## Step 5: Test policy evaluation (optional)

Use `kei policy test` to evaluate what a policy would decide for a given subject without making a real tool call. This also requires no credential export:

```sh
kei policy test --as group:Engineering --workspace <workspace-name> tool:web_search
```

The command prints whether the policy would allow or deny the operation for the specified subject. The evaluation happens server-side and is read-only — it does not change any policy or make a governed tool call.

## Check it worked

You can find one allow and one deny for the agent in Audit Logs. The deny was enforced without anyone handling or exporting the runtime token. If a request is denied unexpectedly, check workspace selection, group membership, the applicable policy, and [setup troubleshooting](/kei/get-started/troubleshooting).

## What was proven

- **Allow:** Kei permitted a governed tool call matching the group's policy.
- **Deny:** Kei blocked a governed tool call that the group's policy does not cover.
- **Audit trail:** Both decisions are recorded with full context.
- **No token exposure:** The runtime credential stayed in the runtime environment and was never exported, pasted, or typed into a prompt.
