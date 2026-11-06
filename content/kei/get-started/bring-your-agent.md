---
title: "Bring the agent you use: first allowed and denied call with Kei"
description: "Connect Claude Code or Codex to Kei, add one allow and one deny policy, then watch Kei allow one command, deny another, and record both."
type: read-and-use
product: kei
nav_group: Get started
nav_order: 0
validated: 2026-11-05
validated_with: kei v0.3.6
---

# Bring the agent you use

You already use Claude Code or Codex. In one sitting, you will connect it to Kei, add two Kei policies, and watch Kei allow one command and deny another. Kei policies are deterministic guardrails for the tool calls your agent can make. Allow `kubectl get`. Never allow `git push --force`.

It takes about 15 minutes. No tutorial and no code.

## Before you start

- A Kei organization where you are an owner or admin. Only an owner or admin can approve `kei login`. If you are not one, ask an admin to [sign you in to Kei](/kei/get-started/sign-in) or to run steps 1, 2 and 4 for you.
- Claude Code or Codex installed on this machine, on macOS or Linux.
- A workspace name. This page uses `Default`. Run `kei workspaces list` after step 1 to see yours.

## 1. Install the kei CLI and sign in

```sh
curl -fsSL https://haikeilabs.com/install.sh | sh -s -- -d "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
kei --version
kei login
```

**What you should see:** `kei --version` prints `kei 0.3.6` or later. The installer also puts the Kei runtime, `kei-proxy`, next to `kei`. `kei login` opens your browser. Approve the request there; the CLI then prints `Logged in to Kei for organization …`. On a machine without a browser, use `kei login --no-browser` and open the URL it prints.

If `kei --version` prints kubectl output, your shell has an alias called `kei`. Run `unalias kei` and try again.

Go deeper: [Connect this machine](/kei/get-started/connect-this-machine) and the [kei CLI reference](/kei/reference/cli).

## 2. Connect Claude Code or Codex

One command does the whole setup for your coding agent:

```sh
kei connect claude-code --workspace Default
```

For Codex:

```sh
kei connect codex --workspace Default
```

`kei connect` creates the runtime installation for this machine, stores its credential in `~/.config/kei.yaml` without printing it, starts the Kei runtime, installs the runtime service and syncs your coding agent's settings. Both coding agents share one runtime installation, so you can run both commands.

**What you should see:**

```text
Organization: <your organization>
Workspace: Default
Connect this machine to Kei?
Continue? [y/N] y
…
Connected claude-code to Kei.
```

On a machine that is already connected, it prints `Runtime credential already configured at …; resuming.` and does not create a second installation. Then check the result:

```sh
kei doctor
```

Every line should start with `PASS`, including `runtime service`, `heartbeat`, `harness claude_code: Kei hook installed` (or `harness codex`) and `policy bundle: bundle … active`.

Go deeper: [Connect your agent](/kei/get-started/connect-your-agent) and [Connect a harness to an agent](/kei/connect-your-harness/harness-setup#claude-code).

## 3. Install Haikei Skills

Haikei Skills teach your coding agent how Kei works, so it can explain a denial or help you write the next policy. Skills change what the agent knows, not what it may do. Kei policies decide that.

```sh
kei skills add
```

`kei skills add` installs the Haikei Skills for the coding agents it finds on this machine. To pick the agent and skills yourself, use the command for your agent on [Install Haikei Skills in your coding assistant](/skills/). Add `--skill kei-harness-setup` for the Kei setup skill.

**What you should see:** `kei skills status` lists the installed Haikei Skills. Start a new Claude Code or Codex session and ask it to list its Haikei Skills; it should name `haikei`.

Go deeper: [Install Haikei Skills in your agent](/kei/get-started/install-skills).

## 4. Add one allow and one deny policy

Create two policies for every member of your organization (`autogroup:member`): allow `kubectl get`, deny `git push --force`.

```sh
kei policy create --workspace Default --group autogroup:member --allow "shell:kubectl get"
kei policy create --workspace Default --group autogroup:member --deny "shell:git push --force"
```

`shell:kubectl get` matches `kubectl get pods`, `kubectl get nodes -o wide` and any other command that starts with those two words. If you don't use Kubernetes, allow `shell:git status` instead.

Check the decisions before your coding agent sees them. Put the flags before the target:

```sh
kei policy test --as autogroup:member --workspace Default "shell:git push --force"
```

```text
Decision: deny
Deciding rule: <ID of your deny policy>
Reason code: policy_deny
```

```sh
kei policy test --as autogroup:member --workspace Default "shell:kubectl get pods"
```

```text
Decision: permit
Deciding rule: <ID of your allow policy>
```

`Decision: no_match` means no policy covers the target yet. Check the workspace name and the target spelling.

Now write the policies into your coding agent's own permission settings. Preview first, then apply:

```sh
kei harness sync --dry-run
kei harness sync
```

The dry run prints a diff of the entries Kei will add. Kei edits only the entries it manages and saves a `.kei-backup-<timestamp>` copy of the file before it writes. Claude Code gets an allow and a deny entry in `~/.claude/settings.json`; Codex gets the rules in `~/.codex/rules/kei.rules`, with the deny as `forbidden`.

Go deeper: [Your first policy](/kei/policies/your-first-policy), [Test before you sync](/kei/policies/test-before-you-sync) and [Govern harness commands](/kei/policies/govern-harness-commands).

## 5. Run one allowed and one denied call

Start a new Claude Code or Codex session so it loads the new settings. Run the denied command in a scratch repository with no remote, so nothing can be pushed even if a step above went wrong:

```sh
mkdir -p /tmp/kei-try && cd /tmp/kei-try && git init
claude   # or: codex
```

Ask the agent for the allowed call:

```text
Run kubectl get pods.
```

**What you should see:** the agent runs the command without asking you for permission. It doesn't matter whether `kubectl` reaches a cluster; the call itself was allowed.

Ask the agent for the denied call:

```text
Run git push --force.
```

**What you should see:** the coding agent refuses. Claude Code reports that permission for this Bash command was denied; Codex reports that the command is forbidden by its rules. The command never runs.

### Read the audit record

Open **Audit Logs** in the [Kei console](https://app.haikeilabs.com/?source=docs-bring-your-agent-audit-logs&utm_source=docs&utm_medium=docs&utm_campaign=launch-2027-01). Filter by decision to find the two calls. Each record shows:

- which coding agent made the call (`claude_code` or `codex`) and its session
- the tool, such as `Bash`, and the decision: one allow and one deny
- you as the person who started the session, and the runtime installation from step 2
- an arguments digest; the arguments themselves stay on your machine unless your organization has [turned on audit encryption](/kei/audit/encryption)

The **Runtime installations** card for this machine shows the recent activity too. Records upload through the runtime service, so if nothing shows up after a minute, run `kei runtime service status`.

Go deeper: [Prove access with an allow and a deny](/kei/get-started/prove-it) and [Audit logs](/kei/audit/logs).

## If the deny doesn't happen

- **The agent asks instead of refusing.** The deny is missing from the native settings. Run `kei harness sync --check`; it reports drift between your settings and the current policies. A policy whose source doesn't match the subject this machine runs as is skipped, and so is any allow it overlaps. See [Skipped-deny behavior](/kei/reference/harness-rendering#skipped-deny-behavior).
- **Every command is denied.** The policy bundle may have expired. `kei doctor` shows its state. See [Troubleshoot setup](/kei/get-started/troubleshooting).
- **`kei policy test` says `no_match`.** The target or workspace doesn't match a policy. Run `kei policy list --workspace Default`.

## Next steps

- Give a team the same rules with a custom group instead of `autogroup:member`: [Give a group access](/kei/get-started/give-a-group-access) and [Groups and autogroups](/kei/policies/groups-and-autogroups).
- Grant one person temporary access with an expiry and a reason: [Time-bound access](/kei/policies/time-bound-access).
- See where a decision is made and where it is enforced: [How it works](/kei/reference/how-it-works).
- Building your own agent instead? Start with [Agentware](/agentware/build/overview).
