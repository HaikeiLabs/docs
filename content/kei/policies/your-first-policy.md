---
title: Your first policy
type: make-and-maintain
product: kei
nav_group: Make and maintain
nav_order: 10
validated: 2026-10-21
validated_with: kei v0.2.5
---

# Your first policy

This page walks through creating your first Kei policy. Policies control who may run which commands, invoke which tools, or use which connector capabilities.

## Prerequisites

- You are signed in to the [Kei console](https://app.haikeilabs.com) or have the `kei` CLI installed and logged in.
- You have the owner or admin role in the organization.
- You know which workspace to apply the policy to.

## Create a policy that allows basic git commands

### In the console

1. Open **Policies**.
2. Select **Create agent command policy**.
3. Set **Who** to a group name, such as `developers`.
4. Set **What** to `shell:git`.
5. Set **Effect** to **Allow**.
6. Under **Advanced**, set **Priority** to `50`.
7. Click **Save**.

![Create policy form with engineering selected and the Group, Member, and Admin source choices open](/assets/images/policy-docs/create-policy-who.png)

*The Who field offers Group, Member, and Admin sources.*

### With the CLI

```bash
kei policy create \
  --group developers \
  --allow "shell:git" \
  --workspace my-workspace
```

This creates a policy that allows members of the `developers` group to run any `git` command.

## Create a policy that denies a dangerous operation

### In the console

1. Open **Policies**.
2. Select **Create agent command policy**.
3. Set **Who** to `developers`.
4. Set **What** to `shell:git push --force`.
5. Set **Effect** to **Deny**.
6. Set **Priority** to `100`.
7. Click **Save**.

### With the CLI

```bash
kei policy create \
  --group developers \
  --deny "shell:git push --force" \
  --workspace my-workspace
```

The higher priority (`100`) ensures the deny overrides the broader `git` allow from the first policy.

## Check it worked

Validate the policy with `kei policy test`:

```bash
kei policy test --as group:developers "shell:git push --force" --workspace my-workspace
```

Expected output:

```
Decision: deny
Decided by: <name of the deny policy>
```

Then test a command that should be allowed:

```bash
kei policy test --as group:developers "shell:git log" --workspace my-workspace
```

Expected output:

```
Decision: permit
Decided by: <name of the allow policy>
```

After confirming the policies work as expected, sync them to desktop harnesses:

```bash
kei harness sync
```

## Best practices

- Start with people and groups as sources. Add `harness:` only when a rule needs to differ by harness kind.
- Give each rule a distinct priority. Use higher values for guardrail denies and lower values for baseline allows.
- Use `kei policy test` before syncing to verify the decision logic.
- Run `kei harness sync --dry-run` to preview what will be written to each harness before applying.

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Groups & autogroups](/kei/policies/groups-and-autogroups) — managing groups and autogroup sources
- [Govern harness commands](/kei/policies/govern-harness-commands) — controlling shell, skill, and path policies
- [Test before you sync](/kei/policies/test-before-you-sync) — validating policies before syncing
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
