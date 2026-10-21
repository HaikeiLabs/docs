---
title: Ask for access
type: read-and-use
product: kei
nav_group: Get started
nav_order: 7
---

# Ask for access

If a tool call or command is denied, you may need access to a workspace, group, or specific capability.

## How access works

Access in Kei is granted through **policies** and **group membership**:

- An organization owner or admin creates policies that allow specific operations for a group.
- You get access by being a member of a group that has the right policies.
- Access is durable — once granted, it applies to future calls without per-call approval.

## Steps to get access

### 1. Check what you need

When a call is denied, the audit log or harness output may indicate:

- Which policy matched and denied the call
- Which capability or tool was requested
- Which group (if any) would have the needed access

See [Why was this denied?](/kei/policies/why-was-this-denied) for help interpreting denials.

### 2. Contact an owner or admin

Only organization owners and workspace admins can create policies and manage group membership. Reach out to them with:

- The specific operation you need (for example, `shell:git push` or `capability:pull_request.read`)
- The workspace you are working in
- Why you need access

### 3. Admin grants access

The admin can:

- Add you to an existing group that already has the right policies
- Create a new policy for your group
- Grant time-bound access through the console (see [Time-bound access](/kei/policies/time-bound-access))

### 4. Sync your harness

After the policy change, run `kei harness sync` on your machine to pick up updated permissions:

```bash
kei harness sync
```

The sync writes the latest policy bundle into your desktop harness's native settings.

## Access requests through the console

When a chat identity requests access to a workspace, the request appears in the **Approvals** page under the user access section. An authorized reviewer can assign the user to a compatible workspace, optionally add them to groups, and approve or deny the access request. The outcome is recorded in the audit log.

## Learn more

- [Policies, explained](/kei/policies/policies-explained) — how policies work
- [Why was this denied?](/kei/policies/why-was-this-denied) — understanding denials
- [Give a group access](/kei/get-started/give-a-group-access) — working with groups
- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
