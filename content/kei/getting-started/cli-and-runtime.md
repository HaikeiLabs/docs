---
title: CLI authentication and runtime setup
type: read-and-use
product: kei
---
# CLI authentication and identity onboarding

Use the web app for organization and workspace onboarding, policy, connector, approval, and audit workflows. For the browser walkthrough, start with [Getting Started: Web Onboarding](/docs/getting-started/web-onboarding). The administrator CLI is for runtime installation and credential tasks that are easier to repeat from a terminal.

## Install the CLI now

Install the published CLI and its bundled runtime with the public release installer:

```sh
export PATH="$HOME/.local/bin:$PATH"
curl -fsSL "https://haikeilabs.com/install.sh" \
  | sh -s -- -d "$HOME/.local/bin"
kei --version
```

The installer detects your OS and architecture, verifies the downloaded archive checksum, and installs the tools. For development/source use with Go 1.26+, install from the CLI command package with `go install github.com/HaikeiLabs/kei-cli/cmd/kei@latest`; use the release installer for deployed binaries.

## Sign in as an organization administrator

Only an `owner` or `admin` can complete `kei login`. The CLI starts a device authorization flow; approve it in an authenticated browser session. The selected organization scopes the resulting token, and the token is stored in the operating-system keychain rather than printed.

```sh
kei login
```

Use `--no-browser` for a headless terminal. Organization owners and admins can approve the flow; users without an organization membership receive `403 organization administrator role is required`.

To remove the stored token for an environment:

```sh
kei logout
```

Logout removes only the local keychain credential; it does not revoke the token server-side. It is idempotent.

## Troubleshooting `kei login`

`kei login` is a device flow: the CLI prints an activation URL and a verification code, and an organization `owner` or `admin` approves the code in a signed-in browser. These are the failures that show up during that flow and how to clear them.

### The approval page asks you to confirm the code

The approval page shows the verification code in a panel labeled **Verification code** and asks you to confirm it before approving. Compare it with the code in your terminal, tick **The code matches my terminal**, choose the organization, and select **Approve CLI**. The page also says: *Confirm this code matches the one shown in your terminal.* If you did not run `kei login`, or the codes do not match, close the page and do not approve.

If you submit without ticking the box, the page returns **Code not confirmed**: *Confirm that the code matches the one shown in your terminal before approving.* Tick the box and submit again.

### The CLI is still waiting after you signed in

After you sign in with your email, the browser should land on the approval page. If it instead lands back in the web app and the CLI keeps polling, reopen the activation URL from your terminal while you are signed in. The CLI keeps polling until the code is approved, so the approval only needs to happen in a signed-in browser session.

### `kei login` prints kubectl or AWS errors

oh-my-zsh's kubectl plugin defines `alias kei='kubectl edit ingress'`, which shadows the Kei CLI. While the alias is active, `kei login` runs kubectl instead and prints kubectl or AWS credential errors.

Diagnose which `kei` your shell resolves:

```sh
type -a kei
```

If the output lists an alias, the alias is shadowing the CLI. Remove it after oh-my-zsh loads, in `~/.zshrc`:

```sh
source $ZSH/oh-my-zsh.sh
unalias kei
```

Or, without changing your shell, run `command kei login` (bypasses the alias) or the full path, `~/.local/bin/kei login`.

### Code not recognized (404)

The approval page shows **Code not recognized**: *This code was not recognized. Run kei login again in your terminal to get a new code.* The code was never issued or was already consumed. Run `kei login` again to get a fresh code.

### Code expired (409)

The approval page shows **Code expired**: *This code has expired or was already used. Run kei login again in your terminal to get a new code.* Run `kei login` again to get a fresh code.

### Not an owner or admin (403)

Only an organization `owner` or `admin` can approve. A non-admin who opens the activation URL sees **Approval not allowed**: *An organization owner or admin role is required to approve the Kei CLI.* Have an owner or admin approve the code instead.

### CLI identity and API access

`kei login` uses the identity service's AIP device authorization flow. The CLI creates a device authorization with `POST /api/v1/deviceAuthorizations` and exchanges the approved device code with `POST /api/v1/deviceAuthorizations:exchange` at its default host, `https://api.haikeilabs.com`. Approve the request at [https://app.haikeilabs.com/cli/activate](https://app.haikeilabs.com/cli/activate) in a signed-in browser as an organization owner or admin.

The stored CLI token is an identity ES256 bearer token. It authenticates requests to the `/api/v1` routes that the console allowlists for CLI callers; it is not limited to `/api/cli/*`. The web console still uses its browser session for its own requests. The CLI does not provide commands for organization and workspace onboarding, policies, groups, or users; use the web app for those workflows.

## Create your organization and workspace

Create your organization and first workspace in [Getting Started: Web Onboarding](/docs/getting-started/web-onboarding). A workspace is the operational and policy boundary: agents, connectors, policies, and approvals must be scoped to it.

## Create a runtime installation

After login, create a runtime installation and inspect it with the CLI. The **installation ID** is a non-secret identifier for that runtime installation. It is not a credential and cannot authenticate a runtime. The **runtime token** is the secret credential issued for the installation; store it in a secret manager and never share or log it.

```sh
kei bot init --platform cli --name "Local coding runtime"
kei bot status --installation INSTALLATION_ID
kei bot agents list --installation INSTALLATION_ID
```

`--platform` accepts exactly `cli`, `teams`, `discord`, `slack`, `whatsapp`, or `openwebui` (`cli` since release 0.1.4, for a local coding-harness runtime; `whatsapp` since 0.1.7; `openwebui` since 0.1.15, for [Open WebUI with Kei](/docs/connect-your-harness/openwebui)); any other value is rejected. The CLI does not itself provide an AWS deployment workflow. Use the web app for organization and workspace administration.

### Workspace discovery

List available workspaces to find workspace IDs and names:

```sh
kei workspaces list
```

The `--workspace` flag on `kei bot credential` accepts a workspace name or ID.

Remove an installation with `kei bot delete --installation INSTALLATION_ID --yes`.

## Configure a local CLI/proxy workflow

`kei setup` writes a local runtime configuration to `~/.config/kei.yaml` (mode `0600`) after verifying the runtime installation token against the control plane. `kei runtime bootstrap` then verifies the installation and sends its heartbeat using the bundled runtime component:

```sh
kei setup
kei runtime bootstrap
```

For non-interactive setup, pipe the token from your secret manager: when standard input is not a terminal, `kei setup` reads the token as the first line and uses defaults for anything not passed as a flag.

```sh
<secret-manager read command> | kei setup --control-plane-url https://app.haikeilabs.com
```

Avoid `--runtime-token`: a token passed on the command line may be recorded in shell history and is visible in the process list. Use `--config PATH` for a separate configuration file.

This is the current path on a workstation. A deployed runtime (container or server) instead sets `KEI_RUNTIME_*` in its environment and runs its runtime bootstrap itself; see [Tenant-side runtime](/docs/runtime/tenant-runtime). `kei setup` and `kei runtime bootstrap` use the runtime token, not your `kei login` session.

## Upgrade the CLI

```sh
kei upgrade
```

`kei upgrade` downloads the matching macOS/Linux and amd64/arm64 release binary from the official public release endpoint, verifies its SHA-256 checksum, and replaces the running executable; Go is not required. Use `kei upgrade --version 0.1.6` or `kei upgrade --version v0.1.6` to pin a release; the optional leading `v` is normalized away when constructing the release URL. The current executable's directory must be writable.

## Runtime credentials

Runtime credentials are secret material. When using `kei bot credential`, pipe stdout to a secret manager; the CLI refuses to emit a credential to an interactive terminal.

```sh
kei bot credential --installation INSTALLATION_ID --workspace WORKSPACE | secret-manager import
```