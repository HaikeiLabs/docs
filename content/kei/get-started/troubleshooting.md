---
title: Troubleshoot setup
type: read-and-use
product: kei
nav_group: Get started
nav_order: 7
---

# Troubleshoot setup

This page lists the most common issues encountered during the Kei setup journey. Each entry shows the symptom, the root cause, and the fix. Entries are in alphabetical order by symptom.

If your issue is not listed here, try the [runtime container troubleshooting](/kei/runtime/troubleshooting), [CLI sign-in troubleshooting](/kei/reference/cli#sign-in-troubleshooting), or ask in the [Haikei Discord community](https://discord.gg/g6QaTYWXDa).

## A setup step does not tick

**Symptom:** In the console setup wizard, a step shows no checkmark after you complete it.

**Cause:** Each step checks a specific condition on the control plane. The wizard checks conditions in order and may not update until you complete the prerequisite step. The machine must be connected to the runtime before the agent appears.

**Fix:** Complete the steps in the listed order — [connect the machine](/kei/get-started/connect-this-machine) first, then the agent and group steps. Refresh the page after each step.

---

## Harness list is empty after sync

**Symptom:** After running `kei harness sync`, `kei harness list` shows no entries.

**Cause:** Desktop harnesses (Claude Code, Codex, OpenCode) are sessions of the runtime installation and are configured by `kei harness sync`. They do not need `kei harness add` and are not listed by `kei harness list`. Only custom (SDK-based) harnesses appear there.

**Fix:** For desktop harnesses, confirm the hooks are installed:

```sh
kei doctor
```

Look for `PASS  harness <kind>: Kei hook installed` in the output. For custom harnesses, register them explicitly:

```sh
kei harness add --kind custom --installation <installation-id> --agent <agent-id>
```

---

## Hooks are not active after running `kei harness sync`

**Symptom:** The agent's audit or permission hooks do not fire, or a restarted harness uses the old configuration.

**Cause:** `kei harness sync` installs the hook files, but the running agent session loaded its configuration before the sync completed. The agent does not reload hooks mid-session.

**Fix:** Restart the harness session after `kei harness sync` completes:

```sh
kei harness sync
# Then close and restart your agent session
```

When the agent starts again, it picks up the new hooks.

---

## `install.sh` fails with "Permission denied" writing to `/usr/local/bin`

**Symptom:** The installer exits with a permission error:

```text
mkdir: /usr/local/bin: Permission denied
```

**Cause:** The installer defaults to `/usr/local/bin`, which requires root or `sudo` access on most systems.

**Fix:** Install to a user-local directory instead:

```sh
curl -fsSL https://haikeilabs.com/install.sh | sh -s -- -d "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
```

Add the `export PATH` line to your shell profile (`~/.zshrc`, `~/.bashrc`, or equivalent) so the directory is always on your PATH. Verify the installation:

```sh
kei --version
```

---

## `kei runtime --help` shows "unknown command"

**Symptom:** Running `kei runtime --help` prints an error:

```text
unknown runtime command "--help"
```

**Cause:** The `runtime` subcommand does not accept `--help` directly. This is by design — `runtime` is a command group that delegates to its subcommands (`bootstrap`, `heartbeat`, `service`).

**Fix:** Use the top-level help to see runtime subcommands:

```sh
kei help runtime
```

For help on a specific runtime subcommand, use:

```sh
kei runtime bootstrap --help
kei runtime heartbeat --help
kei runtime service --help
```

---

## `kei runtime bootstrap` fails: "read config: open ~/.config/kei.yaml"

**Symptom:** Bootstrap exits with a file-not-found error:

```text
read config: open /Users/<user>/.config/kei.yaml: no such file or directory
```

**Cause:** `kei setup` has not been run yet. The config file does not exist.

**Fix:** Run `kei setup` first to write the runtime configuration:

```sh
kei setup
```

The command prompts for the runtime installation token and writes the config file. After setup completes, run bootstrap again:

```sh
kei runtime bootstrap
```

---

## `kei setup` prompts "Runtime installation token:" and you do not know where to find it

**Symptom:** `kei setup` asks for a token and you do not have one.

**Cause:** The runtime installation token (credential) is created when an organization owner or admin sets up the runtime installation in the console.

**Fix:** Get the token from one of these sources:

- **Console setup wizard.** Open the console, navigate to the setup page for your runtime installation, and find the credential in **Step 3**. The credential is shown once — copy it and pipe it into `kei setup`.
- **Organization owner or admin.** Ask an organization owner or admin to run `kei bot credential` and pipe the output to your secret manager, or to share the token through your approved secure channel.
- **Your agent (if you have one).** If your agent has been granted access to the credential store, ask it to pipe the token into `kei setup`.

When you have the token, pipe it to avoid shell history and terminal echo:

```sh
# Replace <token> with the actual credential; or use your secret manager
echo "<token>" | kei setup
```

> **Warning:** Never paste a runtime token into a chat prompt, source control, or command argument that appears in shell history.

---

## "No group grant reaches this agent yet"

**Symptom:** In the console setup wizard, step 5 ("Give a group access") shows this message and does not tick.

```text
No group grant reaches this agent yet
```

**Cause:** The workspace has no enabled allow policy whose subject is a group that **you** (the agent's user) are a member of. The policy must use group membership, not an individual agent ID.

**Fix:** Open **Policies** in the console and create or edit an allow policy whose **Subject** is set to a group that **you** belong to. For example, if you are in `Engineering`, set the subject to `group:Engineering`. Make sure the policy is enabled.

To confirm your group membership:

```sh
kei groups list --workspace <workspace-name>
```

---

## Opening the control-plane URL in a browser shows 404

**Symptom:** Navigating to the control-plane URL (for example, `https://runtime.haikeilabs.com`) in a browser returns `404 Not Found` or you land on a page that does not look like a web app.

**Cause:** The control-plane URL is an API endpoint, not a web application. It serves API requests from the `kei-proxy` runtime. The web console is at a different URL (`https://app.haikeilabs.com` or the URL your organization uses).

**Fix:** This is expected behavior. The control-plane URL in `kei setup` (the `--control-plane-url` flag) is the API base URL that `kei-proxy` communicates with. Use the web console URL — `https://app.haikeilabs.com` — in your browser for the admin interface.

If you meant to open the console and see a 404, verify you are using the correct URL for your organization.

---

## Policies page shows "Something went wrong" after changing the subject to "Agent"

**Symptom:** In the console Policies page, setting the policy subject to `Agent` and saving produces a "Something went wrong" error message.

**Cause:** The console could not evaluate a policy whose subject was an individual agent ID. This was fixed in a deployment on 2026-10-20.

**Fix:** Refresh the console page. If you still see the error, use groups as the policy subject instead of `Agent`. Create or select a group, add the agent's user to it, and set the policy subject to that group.

```sh
# Create a group for the agent's users
kei groups create --name "My Agent Users" --workspace <workspace-name>

# Confirm the group exists
kei groups list --workspace <workspace-name> --json
```

If the problem persists after refreshing, report it in the [Haikei Discord community](https://discord.gg/g6QaTYWXDa).

---

## Sessions do not appear in the console

**Symptom:** The machine is connected, but no sessions show up in the console. `kei doctor` reports a `WARN` for the heartbeat check with `no heartbeat time recorded`.

**Cause:** Active sessions need a working heartbeat and hooks — the `PASS` lines in `kei doctor`. The runtime heartbeat did not reach the control plane. Typical causes seen in the logs: the runtime identity request returned `401` because the installation credential is not accepted, or `kei runtime heartbeat` is refused because another `kei-proxy` process owns the runtime state directory (`kei-proxy serve` already reports heartbeats, so run only that one). The audit collector can also log `flush returned status 400` and keep a growing spool.

**Fix:** Run `kei doctor` and `kei runtime service status`:

```sh
kei doctor
kei runtime service status
```

Check the `kei-runtime.log` and `kei-proxy-serve.log` files in your Logs directory for the heartbeat error, and make sure only one process owns the runtime state directory. If the log shows `401`, sign in again and check the installation:

```sh
kei login
kei bot status --installation <installation-id>
```

Restart the harness session after fixing. Sessions appear once `kei doctor` reports `PASS` for the heartbeat and hook checks.

---

## Sign-in on a phone fails with invalid OAuth state

**Symptom:** Signing in on a phone fails with an `invalid OAuth state` error.

**Cause:** The sign-in began in one browser context and the callback returned in another, so the state cookie was missing. This happens when the provider app takes over the flow, in an in-app browser or private mode, when cross-site tracking prevention blocks the cookie, or when the page is reloaded or opened in a second tab.

**Fix:** Close all Haikei tabs, then use one normal tab in the phone's default browser. Open the sign-in page, finish the provider screens in that same tab without going back or reloading, and decline the provider app prompt if one appears. Then open the CLI activation link in the same tab.

For a remote machine, use `--no-browser`, which prints a URL and a code to open on any device and approve:

```sh
kei login --no-browser
```

If sign-in keeps failing after this, submit a bug report:

```sh
kei feedback --description "Sign-in on a phone fails with invalid OAuth state"
```

Descriptions only — do not attach transcripts unless asked.
