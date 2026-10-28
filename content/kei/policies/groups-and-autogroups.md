---
title: Groups & autogroups
type: make-and-maintain
product: kei
nav_group: Make and maintain
nav_order: 11
validated: 2026-10-21
validated_with: kei v0.2.5
---

# Groups & autogroups

Groups are the primary way to organize who your policies apply to. Autogroups are virtual groups derived from organization roles.

## Groups

A group is a named collection of users within a workspace. Policies with a `group:` source apply to every member of that group.

### Create a group

**In the console:**

1. Open **Groups** in the workspace.
2. Select **Create Group**.
3. Enter a name and optional description.
4. Add members by selecting users.
5. Click **Save**.

![Engineering group detail with example members and the policies that use the group](/assets/images/policy-docs/group-detail-engineering.png)

*The group drawer shows its members and related policies.*

**With the CLI:**

```bash
kei groups create --name developers --workspace my-workspace --description "Software engineering team"
```

### Add members to a group

`kei groups members add` takes the group UUID and user ID, not names or emails. Use `kei groups list` and `kei users list` to look them up first:

```bash
# Get the group UUID
kei groups list --workspace my-workspace --json

# Get the user UUID
kei users list --json

# Add the user to the group
kei groups members add <group-id> <user-id> --workspace my-workspace
```

### List group members

```bash
kei groups members list <group-id> --workspace my-workspace --json
```

### Group nesting

Groups can inherit policies from other groups. A member of a nested group gets everything granted to the groups it inherits from.

- Nesting stays within one workspace.
- Cycles are rejected when groups are updated.
- The maximum nesting depth is bounded.

To see the effective policies for a group, open the group detail in the console and check the **Effective** tab.

## Autogroups

Autogroups are virtual groups whose membership is determined at runtime from the caller's organization role. Use `autogroup:` as a policy source — it works like a regular group but is never stored.

| Autogroup | Who is included | Resolved from |
| --------- | --------------- | ------------- |
| `autogroup:member` | Every organization member | Always present |
| `autogroup:admin` | Workspace admins and owners | Organization role |

These are the only two autogroups. A caller always resolves to at least `autogroup:member`; admins and owners also resolve to `autogroup:admin`. For policy, the organization Owner counts as an admin — Owner and Admin differ only in the console. To grant access to agents or service principals, add them to a custom group and use `group:<name>` as the source.

![Definitions autogroups table listing autogroup:member and autogroup:admin](/assets/images/policy-docs/autogroup-member.png)

*Member and admin are virtual sources derived from workspace roles.*

### Create a policy with an autogroup source

```bash
kei policy create \
  --group autogroup:member \
  --deny "shell:git push --force" \
  --workspace my-workspace
```

This creates a standing rule that denies `git push --force` for every organization member.

### Recommended priority convention

| Layer | Priority | Example |
| ----- | -------- | ------- |
| Guardrail denies | 100 | `shell:git push --force` deny for `autogroup:member` |
| Harness-wide allows | 50 | `shell:git` allow for `*` |
| Role or group allows | 20 | `shell:git log` allow for `group:junior-devs` |
| Baseline | 10 | `shell:git` allow for `autogroup:member` |

## Check it worked

List the policies for a group to verify they are applied:

```bash
kei policy list --workspace my-workspace
```

Test the policy for a specific autogroup:

```bash
kei policy test --as autogroup:member "shell:git push --force" --workspace my-workspace
```

Expected output:

```
Decision: deny
Decided by: <name of the deny policy>
```

See [Autogroups reference](/kei/reference/autogroups) for details on autogroup resolution and the complete reference.

## Learn more

- [Autogroups](/kei/reference/autogroups) — autogroup reference
- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
- [Give a group access](/kei/get-started/give-a-group-access) — granting access through groups
