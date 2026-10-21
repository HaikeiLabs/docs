---
title: Govern harness commands
type: make-and-maintain
product: kei
nav_group: Make and maintain
nav_order: 15
validated: 2026-10-21
validated_with: kei v0.2.5
---

# Govern harness commands

Kei can control which shell commands, skills, and file paths each desktop harness (Claude Code, Codex, OpenCode) may access. These policies are written into each harness's native permission settings by `kei harness sync`.

## Command policies

Command policies use `shell:`, `skill:`, or `path:` destinations.

| Destination | What it controls | Example |
| ----------- | ---------------- | ------- |
| `shell:<prefix>` | Shell commands matching a whole-token argv prefix | `shell:git push`, `shell:npm install` |
| `skill:<name>` | Skills by exact name | `skill:wiki`, `skill:linear` |
| `path:<glob>` | File paths matching a glob pattern | `path:/repo/**`, `path:/etc/config` |

### Shell matching

Each token in the policy must match the corresponding command token exactly.

| Policy `shell:` | Matches | Does not match |
| --------------- | ------- | -------------- |
| `shell:git` | `git push`, `git log`, `git` | `gitx`, `gitt` |
| `shell:git push` | `git push`, `git push --force` | `git`, `git pushed` |
| `shell:docker compose` | `docker compose up`, `docker compose` | `docker-compose` |

There is no quoting, escaping, or partial-token match. `shell:*` allows or denies every shell command.

### Skill matching

Skills are matched by exact name. `skill:wiki` matches `wiki`, not `wiki-admin`.

### Path matching

Paths use glob patterns for absolute, lexically cleaned paths. `*` matches within one segment; `**` as a whole segment matches zero or more segments.

| Policy `path:` | Matches | Does not match |
| -------------- | ------- | -------------- |
| `path:/repo/**` | `/repo/file.txt`, `/repo/src/main.go` | `/other/file.txt` |
| `path:/repo/*.go` | `/repo/main.go` | `/repo/src/main.go` |

## How policies render into each harness

| Harness | How policies are applied |
| ------- | ----------------------- |
| Claude Code | Written to `~/.claude/settings.json` as `allow` and `deny` entries. Deny takes precedence over allow. |
| Codex | Allow entries become permitted commands; deny entries become `forbidden`. |
| OpenCode | Written as bash permission entries in the permission configuration. |

## Skipped-deny behavior

A policy whose source does not match the bundle subject is skipped. If a deny is skipped, it does not render. If a higher-priority deny that overlaps an allow is skipped, the allow is also withheld so the harness asks instead of silently allowing.

For example:

| Source | Destination | Effect | Priority |
| ------ | ----------- | ------ | -------: |
| `group:admins` | `shell:git push --force` | deny | 100 |
| `*` | `shell:git` | allow | 10 |

When the subject is not in `admins`, the deny is skipped. The allow would let `git push --force` run without asking, so sync withholds it too. The harness asks before any `git` command.

When the subject is in `admins`, both policies render and Claude Code denies the push natively:

```json
"allow": ["Bash(npm test)", "Bash(git:*)"],
"deny": ["Bash(git push --force:*)"]
```

## Check it worked

Use the dry-run flag to preview what will be written to each harness:

```bash
kei harness sync --dry-run
```

Examine the output for each harness. Then apply the sync:

```bash
kei harness sync
```

Verify the rendered settings are in place — for Claude Code, check `~/.claude/settings.json`:

```bash
cat ~/.claude/settings.json
```

Use `kei policy test` to verify the decision logic for a specific subject:

```bash
kei policy test --as group:developers "shell:git push --force" --workspace my-workspace
```

## Best practices

- Use `kei harness sync --dry-run` before every sync to preview changes.
- Read every `not rendered` line in the dry-run output — it indicates a policy that was skipped.
- Give deny policies a higher priority than the allows they should override.
- Prefer group- and user-based sources over harness-specific sources unless the rule genuinely differs per harness.

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence
- [Harness rendering](/kei/reference/harness-rendering) — per-harness rendering reference
- [Your first policy](/kei/policies/your-first-policy) — creating your first allow and deny policies
- [Test before you sync](/kei/policies/test-before-you-sync) — validating policies before syncing
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
