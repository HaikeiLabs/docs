---
title: Test before you sync
type: make-and-maintain
product: kei
nav_group: Make and maintain
nav_order: 17
validated: 2026-10-21
validated_with: kei v0.2.5
---

# Test before you sync

Before applying policy changes to your harnesses, test them with `kei policy test` and preview the sync with `kei harness sync --dry-run`.

## Test individual policy decisions

Use `kei policy test` to evaluate a specific subject and target against the current policy bundle:

```bash
kei policy test --as group:developers "shell:git push --force" --workspace my-workspace
```

The command returns the decision and the policy that decided it:

```
Decision: deny
Decided by: Deny force-push for developers (id: abc123)
```

### Test different subjects

```bash
# Test as a specific user
kei policy test --as user:98a1b2c3 "shell:git log"

# Test as an autogroup
kei policy test --as autogroup:member "capability:pull_request.read"

# Test as a group
kei policy test --as group:engineering "shell:deploy"
```

The `--as` flag accepts a source pattern: `group:<name>`, `autogroup:member`, `autogroup:admin`, `harness:<kind>`, or `*`. Policies name groups, so test a person or agent through a group they belong to.

## Preview harness sync changes

Use `kei harness sync --dry-run` to see what policies will be written to each desktop harness without applying the changes:

```bash
kei harness sync --dry-run
```

The output shows which policies will render into each harness and highlights any policies that are skipped:

```text
$ kei harness sync --dry-run --harness claude_code
not rendered in Claude Code: allow git (a higher-precedence user:/group: deny overlaps it; the harness will ask)
```

Read every `not rendered` line — it indicates a policy that will be skipped because its source does not match the bundle subject.

### Per-harness dry run

```bash
# Test only Claude Code
kei harness sync --dry-run --harness claude_code

# Test only Codex
kei harness sync --dry-run --harness codex
```

## Check for drift

After syncing, use `kei harness sync --check` to detect drift between the native configuration, the sync ledger, and the current policy bundle:

```bash
kei harness sync --check
```

Exit code `1` means drift was detected. Use `--json` for a machine-readable report:

```bash
kei harness sync --check --json
```

## Full workflow

1. **Create** or update policies in the console or with `kei policy create`.
2. **Test** decisions with `kei policy test --as <subject> <target>`.
3. **Preview** the harness sync with `kei harness sync --dry-run`.
4. **Apply** the sync with `kei harness sync`.
5. **Verify** with `kei harness sync --check`.

## Check it worked

Run the following sequence to verify your policies and sync are correct:

```bash
# Test a decision
kei policy test --as group:developers "shell:git push" --workspace my-workspace

# Preview sync
kei harness sync --dry-run

# Apply sync
kei harness sync

# Check for drift
kei harness sync --check
```

All commands should exit with code `0` and show the expected decisions and rendered rules.

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Your first policy](/kei/policies/your-first-policy) — creating your first allow and deny policies
- [Govern harness commands](/kei/policies/govern-harness-commands) — controlling shell, skill, and path policies
- [Harness rendering](/kei/reference/harness-rendering) — per-harness rendering reference
