---
title: "Reference: kei CLI"
type: reference
product: kei
nav_group: Reference
---

# Reference: kei CLI

The `kei` CLI is for people administering Kei runtime installations. Use `kei help` or a command's `--help` output to see commands and flags supported by your installed version.

| Task | Command |
| --- | --- |
| Sign in as an organization owner or admin | `kei login` |
| List or create workspaces | `kei workspaces list` / `kei workspaces create --name NAME` |
| List or create groups in a workspace | `kei groups list --workspace WORKSPACE` / `kei groups create --name NAME --workspace WORKSPACE` |
| List or create, update, or resolve users | `kei users list` / `kei users create --email EMAIL` / `kei users update USER` / `kei users resolve --email EMAIL` |
| List, get, create, delete, or test workspace policies | `kei policy list|get|create|delete|test --workspace WORKSPACE` |
| Manage workspace connectors | `kei connectors create|test|list|get|connect|reconnect|delete --workspace WORKSPACE` |
| List connector templates or manage connector tool manifests | `kei connectors templates` / `kei connectors manifests list|show|approve --workspace WORKSPACE` |
| Inspect runtime installations | `kei bot status --installation INSTALLATION_ID` |
| Configure a local runtime | `kei setup` |
| Verify and send the first heartbeat | `kei runtime bootstrap` |
| Preview or apply harness configuration | `kei harness sync --dry-run` / `kei harness sync` |
| Show the CLI version | `kei --version` |

The CLI can manage workspaces, groups, users, policies, and connectors as shown above. It does not create organizations. Group management has no update command; `kei groups delete` is available and may require `--force` when policies reference the group. User commands also include `get` and identity lookup; connector commands include manifest list, show, and approve. Use `kei --help`, then `kei <command> -h`, to see the syntax supported by your installed version. Do not pass runtime credentials as command-line arguments. See [Connect this machine](/kei/get-started/connect-this-machine) for installation instructions.

## Sign-in troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Approval page asks you to confirm the code | The page requires an explicit match confirmation. | Compare the displayed verification code with the terminal, select **The code matches my terminal**, then approve. If you did not start the login or the codes differ, close the page. |
| CLI keeps waiting after browser sign-in | The activation page was not completed in the signed-in browser session. | Reopen the activation URL printed by `kei login` and finish the approval. |
| `kei login` prints kubectl or AWS errors | A shell alias such as oh-my-zsh's `kei='kubectl edit ingress'` shadows the Kei CLI. | Run `type -a kei`; remove the alias after oh-my-zsh loads, or invoke `command kei login` / the CLI's full path. |
| **Code not recognized** (404) | The code was not issued or has already been consumed. | Run `kei login` again and use the new code. |
| **Code expired** (409) | The code expired or was already used. | Run `kei login` again and use the new code. |
| **Approval not allowed** (403) | The approving account is not an organization owner or admin. | Ask an owner or admin to approve the code. |

## Upgrade the CLI

Run `kei upgrade` to download and verify the matching macOS or Linux release binary. Pin a version with `kei upgrade --version 0.1.6` (a leading `v` is also accepted). The CLI executable's directory must be writable; Go is not required.
