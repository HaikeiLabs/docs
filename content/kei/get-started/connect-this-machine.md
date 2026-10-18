---
title: Connect this machine
type: read-and-use
product: kei
---

# Connect this machine

Install the `kei` CLI and bundled `kei-proxy` runtime on the machine that will run your agent. An organization owner or admin must create a runtime installation and provide its credential through your approved secret store.

```sh
curl -fsSL https://haikeilabs.com/install.sh | sh -s -- -d "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
kei --version
```

Sign in to the CLI as an organization owner or admin, then configure and check the runtime:

```sh
kei login
kei setup
kei runtime bootstrap
```

`kei login` uses your administrator account. `kei setup` configures the runtime credential; do not put that credential in an agent prompt, source control, shell history, or command argument. If you are not an owner or admin, ask one to complete the installation setup.

## Check it worked

The bootstrap command completes successfully and the runtime installation shows a recent heartbeat in Kei. If it does not, see [runtime troubleshooting](/content/kei/runtime/troubleshooting.html).
