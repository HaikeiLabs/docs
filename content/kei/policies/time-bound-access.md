---
title: Time-bound access
description: "Grant a user or group temporary access to a workspace or capability from the Kei console or CLI, for incidents or short tasks."
type: make-and-maintain
product: kei
validated: 2026-10-21
validated_with: kei v0.2.5
nav_group: Make and maintain
nav_order: 11
---

# Time-bound access

Time-bound (just-in-time) access lets you grant a user or group temporary access to a workspace or capability. This is useful for short-term collaboration, incident response, or limited-scope tasks.

> **Warning:** Time-bound access is in beta. We have not tested end to end that a grant stops working when its TTL runs out. Each step has its own automated tests, run against test servers and fixtures:
>
> - `kei access grant create` turns `--ttl` into an expiry time and sends it.
> - Kei rejects a grant with no expiry, an expiry in the past, or a TTL longer than the maximum (7 days by default).
> - Policy bundles sent to a runtime leave out expired and revoked grants.
> - `kei-proxy` denies a call that matches only an expired grant, with reason `access_grant_expired`.
>
> Before you rely on expiry, check it yourself: after the TTL passes, run the call again and confirm it is denied. If you use time-bound access or it doesn't behave as described here, tell us in the [Haikei Discord community](https://discord.gg/g6QaTYWXDa).

## Grant time-bound access with the CLI

```bash
kei access grant create \
  --workspace my-workspace \
  --principal user:<user-id> \
  --target shell:git \
  --ttl 4h \
  --reason "incident follow-up"
```

`--principal` takes a typed ID such as `user:<id>` or `agent:<id>`, and `--ttl` sets how long the grant lasts.

## Grant time-bound access in the console

1. Open the **Approvals** page in the workspace.
2. Under **User access**, find the pending access request or select **Grant access**.
3. Choose the user or group to grant access to.
4. Optionally add them to a group that has the right policies.
5. Set an expiration for the access grant.
6. Click **Approve** or **Grant**.

The grant is recorded in the audit log. After granting access, the user can use the permitted operations until the grant expires.

## What time-bound access does

- Grants durable access for a limited time period.
- Does not pause a denied call for per-call approval.
- Does not override existing policies — the user or group still needs matching allow policies for the operations they want to perform.
- The grant is recorded in the audit log with the expiration time.

> **Known limitation: no connector credentials.** A time-bound access grant cannot name a connector yet, in the console or the CLI. The Kei runtime releases a connector's credential only to an allow that names that connector, so a time-bound grant on a tool allows the call but releases no credential. The release is denied with `connector_not_named`. To give temporary use of a connector, add the person to a group whose tool grant names the connector, and remove them when the work is done. See [Name the connector when you grant a harness tool](/kei/connectors/grant-a-connector#name-the-connector-when-you-grant-a-harness-tool).

## Check it worked

1. Verify the grant appears in the **Approvals** page.
2. Ask the user to run `kei harness sync` to pick up any updated policies.
3. Check the audit log for the grant record.

To verify the user's effective access, use `kei policy test` as the user:

```bash
kei policy test --as user:<user-id> "shell:git push" --workspace my-workspace
```

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Ask for access](/kei/policies/ask-for-access) — requesting access as a user
- [Audit logs](/kei/audit/logs) — reviewing audit events
