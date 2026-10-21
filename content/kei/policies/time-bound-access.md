---
title: Time-bound access
type: make-and-maintain
product: kei
nav_group: Make and maintain
nav_order: 16
validated: 2026-10-21
validated_with: kei v0.2.5
---

# Time-bound access

Time-bound (just-in-time) access lets you grant a user or group temporary access to a workspace or capability. This is useful for short-term collaboration, incident response, or limited-scope tasks.

> **Note:** Time-bound access is currently available only through the Kei console. There is no CLI command for granting time-bound access.

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
