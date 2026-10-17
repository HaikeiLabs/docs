---
title: Set up Open WebUI with Kei
type: read-and-use
product: kei
---
# Set up Open WebUI with Kei

> Source of truth: [kei-openwebui docs/setup.md](https://github.com/HaikeiLabs/kei-openwebui/blob/main/docs/setup.md). This page is a copy; changes land there first. The kei-openwebui repository is private today, so its links open only for accounts Haikei has given access.

This guide takes you from nothing to an Open WebUI where every model call and every governed tool call is decided and audited by Kei. It uses the published `openwebui-kei` image. For how the connector works inside, see [design.md](https://github.com/HaikeiLabs/kei-openwebui/blob/main/docs/design.md). For how Haikei cuts releases, see [release.md](https://github.com/HaikeiLabs/kei-openwebui/blob/main/docs/release.md).

The examples use a neutral customer, Acme, with a tool pack `acme_orders`. Replace the names, IDs and registry with your own.

```
Kei (control plane)                       your platform
┌─────────────────────────────┐           ┌──────────────── openwebui-kei container ───────────────┐
│ runtime installation        │◄─ token ──┤ kei-proxy: bootstrap, serve, heartbeat                  │
│   platform openwebui        │           │ boot: tool sync (PUT /api/v1/runtime/tools), seeding    │
│ agent + model profile       │── bundle ►│ Open WebUI + Kei Pipe + kei_guard + your tool pack      │
│ policies, users, groups     │◄─ audit ──┤                                                         │
└─────────────────────────────┘           └─────────────────────────────────────────────────────────┘
```

## Before you start

- A Kei organization and workspace, and an owner or admin who can run `kei login`.
- The `kei` CLI. `kei directory-sync` needs a release newer than kei-cli v0.1.29.
- A secret manager your container platform can read (Azure Key Vault, AWS Secrets Manager, GCP Secret Manager, a Kubernetes Secret).
- A container platform that runs `linux/amd64` images and lets you set the container user.
- An OpenAI-compatible model endpoint for the model profile.

## 1. Kei side

Everything in this section is admin work with the `kei` CLI (or the Kei console). Run `kei login` first. Each command below is in `kei --help`. Use the CLI's `--help` usage, not this page, if the two ever disagree.

### 1.1 The agent and the installation

The installation is the runtime's identity in Kei. Its platform must be `openwebui`: that is what makes Open WebUI users resolve as `(openwebui, <Open WebUI user id>)` identities.

1. Create the chat agent in the Kei console (the CLI has no agent create command) and note its ID.
2. Create the installation, bound to that agent:

```bash
kei bot init --platform openwebui --name acme-chat --agent <agent-id> --workspace <workspace>
kei bot list                                   # note the installation ID
kei bot agents list --installation <installation-id>
```

### 1.2 The runtime credential

The runtime credential is `KEI_RUNTIME_TOKEN`. Kei shows it once. `kei bot credential` refuses to write it to a terminal, so pipe it straight into your secret manager:

```bash
kei bot credential --installation <installation-id> --workspace <workspace> \
  | <your secret-manager import command>
```

Never print it, paste it, or put it in a file in the repository. To rotate it later, use `kei bot credential --rotate` the same way, then restart the container: the old token stops working immediately.

You also need `KEI_RUNTIME_CONTROL_PLANE_URL`, the Kei control plane's base URL (no `/api/v1` suffix). The console shows it next to the credential.

### 1.3 The model profile

The Kei Pipe is Open WebUI's only model provider. It lists the models the agent's model profile gives it, so with no profile Open WebUI shows no models.

```bash
kei model-profiles create --workspace <workspace> --display-name acme-chat-model \
  --endpoint https://models.acme.example/v1 --auth-type none \
  --default-model <model-id> --agent <agent-id>
kei model-profiles assignment --workspace <workspace> --agent <agent-id>
kei model-profiles readiness acme-chat-model --workspace <workspace>
```

- `--endpoint` must be an `https://` URL with no credentials, query or fragment.
- `--auth-type api_key` reads the key from stdin and seals it to a runtime that can receive it. The CLI refuses (`no runtime in this scope can receive the API key; set up a runtime with a credential-sync key first`) when there is none. Credential sync is covered by the `kei-runtime-setup` skill in HaikeiLabs/skills.
- A profile that already exists is assigned with `kei model-profiles assign <profile> --workspace <workspace> --agent <agent-id>`.

### 1.4 Policies

Two kinds of permit make a working chat. Both are evaluated by the `kei-proxy` daemon in the container, against the user the agent session resolved to.

| Governs | `--dst-pattern` | Example `--src-pattern` |
| --- | --- | --- |
| Model calls through the Kei Pipe | `model:invoke` | `group:chat-users` |
| One governed tool | `tool:<name>`, the tool's declared name exactly | `group:chat-users` |

```bash
kei policies create --workspace <workspace> --name chat-users-models \
  --src-pattern group:chat-users --dst-pattern model:invoke --effect permit --agent-id <agent-id>
kei policies create --workspace <workspace> --name chat-users-list-orders \
  --src-pattern group:chat-users --dst-pattern tool:acme.orders.list_orders --effect permit \
  --agent-id <agent-id>
kei policies list --workspace <workspace>
```

- `--src-pattern` names who: `user:<id>`, `group:<name>`, or `*`.
- The `kei-proxy` in current images evaluates v1 policy bundles, where `model:invoke` permits decide model calls. In v2 bundles the agent's model profile assignment decides them instead (HAI-459), so keep the assignment from step 1.3 either way.
- Bind the permits to the chat agent with `--agent-id`. kei-cli v0.1.28 and later accept it; on older versions set the agent on the policy in the console.
- Kei policy alone decides. There is no confirmation step: a write tool runs as soon as a permit allows it.
- A policy only applies to a tool that is registered for the installation. The image registers its pack's tools at boot ([section 3](#section-3-tool-packs)). Until then a call is refused `tool_not_registered` whatever the policies say.
- Read/write isn't part of the request, so a policy that separates reads from writes names the read and write tools themselves.

### 1.5 Linking users

Each Open WebUI user is identified by Open WebUI's own user ID, whatever SSO you configured. Kei must link that ID to an email-keyed Kei user before the user's calls are allowed. Until then the user is **unlinked** and every governed call is refused.

- **Claim link (any SSO).** The first time an unlinked user triggers a governed tool, the connector shows them a one-time claim link as an Open WebUI notification, to that user only. They open it, sign in to Kei, and ask again. The link is never in the chat, the model's context, or a log.
- **Entra directory sync.** With Microsoft Entra, Kei can create your users and groups from the Entra app's role assignments, one Kei group per app role value:

```bash
kei directory-sync set --tenant-id <tenant-guid> --client-id <sync-app-guid> --app-id <app-guid> \
  --dry-run=true --create-users=true
kei directory-sync enable
kei directory-sync report        # read the dry-run report before going live
kei directory-sync set --dry-run=false
```

Synced users are Kei users and group members, so `group:<role value>` permits apply to them. Each user still links their Open WebUI identity with the claim link once. The Azure side (app roles, the sync app's Graph permissions, the federated credential) is in the `kei-directory-sync` skill in HaikeiLabs/skills.

Check a user's links with `kei users resolve --email <email>` and `kei users remote-identities list <user>`.

## 2. The image

### 2.1 Pull or mirror by digest

`openwebui-kei` is on ECR Public and needs no credentials: `public.ecr.aws/o1a1k4g0/openwebui-kei`. Each GitHub release of HaikeiLabs/kei-openwebui has an `IMAGE_DIGEST.txt`. Deploy its `image=` line, the digest, never the tag. The repository is private today: if you can't open its releases, ask Haikei for the release's digest.

```bash
docker pull public.ecr.aws/o1a1k4g0/openwebui-kei@sha256:<digest>
```

To mirror into your own registry, copy by digest so the digest doesn't change. Azure Container Registry:

```bash
az acr import --name <your-acr> \
  --source public.ecr.aws/o1a1k4g0/openwebui-kei@sha256:<digest> \
  --image openwebui-kei:<tag>
```

Then deploy `<your-acr>.azurecr.io/openwebui-kei@sha256:<digest>`. Other registries: any tool that copies a manifest by digest (for example `crane copy` or `skopeo copy`) works the same way.

Plain-data tool declarations (below) need **v0.1.2 or later**. The boot tool sync needs v0.1.1 or later.

### 2.2 Run as UID/GID 10001

The image runs as user `kei`, **UID 10001, GID 10001**. Set your platform's container user, and any `runAsUser`, `runAsGroup`, `fsGroup`, and the owner of mounted volumes, to 10001. A template that defaults to 1000 makes the supervisor refuse to start with `KEI_RUNTIME_STATE_DIR (...) is not a writable directory; refusing to start`.

### 2.3 Environment

| Variable | Required | What it is |
| --- | --- | --- |
| `KEI_RUNTIME_TOKEN` | yes | The runtime credential, from your secret manager |
| `KEI_RUNTIME_CONTROL_PLANE_URL` | yes | The Kei control plane base URL |
| `WEBUI_SECRET_KEY` | yes | Open WebUI's secret key, from your secret manager. Without it the supervisor refuses to start. Replicas must share it |
| `KEI_OPENWEBUI_TOOL_PACKS` | with a pack | Comma-separated pack modules, e.g. `acme_orders`. Usually set in your layer's Dockerfile |
| `KEI_PROXY_EGRESS_PROXY` | no | An HTTP proxy for `kei-proxy`'s calls to Kei, e.g. `http://localhost:1055`. Given to `kei-proxy` and the boot tool sync only, never to Open WebUI |
| `KEI_PROXY_NO_PROXY` | no | Hosts that bypass that proxy, e.g. `169.254.169.254`, plus the Kei control plane host if it is public |
| `KEI_PROXY_AUDIT` | recommended | `kei-proxy`'s audit spool path. Put it on a mounted volume, so a killed container doesn't lose unshipped records |
| `KEI_PROXY_HEARTBEAT_INTERVAL` | no | Heartbeat interval (default `1m`) |
| `KEI_PROXY_READY_TIMEOUT` | no | Seconds to wait for `kei-proxy`'s `/readyz` (default `60`) |

The image already sets `ENABLE_OPENAI_API=false`, `ENABLE_OLLAMA_API=false` and `ENABLE_DIRECT_CONNECTIONS=false`, so the Kei Pipe is the only model provider. Don't override them. Open WebUI's own settings (database, SSO, `WEBUI_URL`) are Open WebUI's; see its documentation.

On a fresh database there is no Open WebUI admin yet. The container starts, waits for the first admin to sign up, then installs the Kei functions. Until then nobody can chat, because there is no model provider.

## 3. Tool packs

Your own tools ship as a Python package, a **tool pack**, layered on the image at build time. Nothing installs at runtime.

```dockerfile
FROM public.ecr.aws/o1a1k4g0/openwebui-kei@sha256:<digest>
USER root
RUN pip install --no-cache-dir acme-orders==<version>
USER kei
ENV KEI_OPENWEBUI_TOOL_PACKS=acme_orders
```

Build it for `linux/amd64` and deploy your layer by its own digest.

### 3.1 Declare the tools as plain data

The pack's top-level module declares `TOOLKITS`. Each toolkit's `tools` list declares the governed tools as plain data. The pack never imports `kei_openwebui`.

```python
# acme_orders/__init__.py
TOOLKITS = [
    {
        "id": "acme_orders",
        "name": "Acme: orders",
        "module": "acme_orders.tools",
        "description": "Lists and cancels Acme orders.",
        "source": "acme",
        "tools": [
            {"name": "acme.orders.list_orders", "access": "read", "required_capabilities": ["orders.read"]},
            {"name": "acme.orders.cancel_order", "access": "write", "required_capabilities": ["orders.write"]},
        ],
    },
]
```

- `name` and `access` (`read` or `write`) are required. The field rules are in [release.md](https://github.com/HaikeiLabs/kei-openwebui/blob/main/docs/release.md#layer-a-tool-pack).
- **The name is the action.** Kei is asked about `tool:<name>`, and your policy's `--dst-pattern` must use the same name. The `Tools` method must pass that same name to `Governor.run`. Name each tool `<method>` or `<prefix>.<method>` after its method (`acme.orders.list_orders` → `list_orders`). From v0.1.3, a declaration whose method has a different name says so in `method` (`{"name": "acme.orders.get_order", "access": "read", "method": "orders_get"}`).
- A malformed declaration, or a name declared twice, stops the container and names the pack and entry. A pack that doesn't import stops it too.

### 3.2 The boot tool sync

Kei's policy bundle only lists tools registered for the installation. At every boot, once `kei-proxy` is ready and before Open WebUI serves, the image sends the packs' manifest to `PUT $KEI_RUNTIME_CONTROL_PLANE_URL/api/v1/runtime/tools` with the runtime token. You configure nothing else.

- The PUT replaces the installation's registered tools, so a restart converges Kei on the current packs and a dropped tool is unregistered.
- No packs configured: the sync is skipped (`tool sync skipped: no tool packs configured`).
- Packs configured but no tools exported: the container refuses to start rather than send an empty list, which would unregister every tool (`tool sync refused: ... its manifest has no tools`).
- Kei refuses, or the control plane is unreachable: the sync retries 5 times over about 15 s, then the container exits with `registering the tool packs' tools with Kei failed; refusing to start Open WebUI`.

It fails closed: Open WebUI never serves tools Kei can't govern. The tools reach `kei-proxy` on its next bundle poll, within about a minute.

## 4. Verify

Get a shell in the running container (`docker exec -it <container> bash`, `kubectl exec -it <pod> -- bash`, or `az containerapp exec ... --command bash`). Never print `KEI_RUNTIME_TOKEN`; the commands below use it in place.

1. **The boot log** shows the sync:

```
kei-seed: tool sync: registered 2 tool(s) with Kei at /api/v1/runtime/tools (added=2, removed=0, unchanged=0, updated=0)
```

followed by `kei-seed: Kei functions seeded (...)`.

2. **The export** lists your tools under the names you'll write policies for:

```bash
python -m kei_openwebui.boot --export-manifest
```

3. **The bundle** holds them, about a minute after boot:

```bash
"$KEI_PROXY_PATH" policy show
```

`tool_count` includes your tools. `state`, `policy_revision` and `last_success` show the bundle is current.

4. **The models** the agent's profile gives the Pipe:

```bash
printf 'header = "Authorization: Bearer %s"\n' "$KEI_RUNTIME_TOKEN" | \
  curl --config - -sS --unix-socket "$KEI_RUNTIME_SOCKET_PATH" http://localhost/v1/models; echo
```

5. **One allowed call.** Sign in to Open WebUI as a linked user in `group:chat-users`, pick a Kei model, enable the Acme toolkit, and ask something that lists orders. The answer has data.

6. **One denied call.** Ask for a tool with no permit, for example cancelling an order. The model answers with a refusal: `Refused (kei.denied): ...`. The tool body never runs.

7. **The audit.** The Kei console's audit view shows both decisions under the user's Kei user, with the tool and `allow` or `deny`. Before the collector ships them, they're in the spool at `$KEI_PROXY_AUDIT`.

`kei harness sync --harness openwebui --url <open-webui-url>` (admin token in `OPENWEBUI_ADMIN_TOKEN`) checks from outside that the Kei Pipe and `kei_guard` are installed and active. It is read-only and exits 1 on drift.

## 5. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| A tool call is refused `tool is not registered in the policy bundle` (`tool_not_registered`) | Kei hasn't got the tool: an image older than v0.1.1, no `KEI_OPENWEBUI_TOOL_PACKS`, a name that differs from what the method sends, or the bundle hasn't refreshed yet | Check the boot log for `tool sync: registered N tool(s)`, compare `--export-manifest` names with the refused name, wait one bundle poll and check `policy show`. A permit doesn't help until the tool is registered. See [release.md](https://github.com/HaikeiLabs/kei-openwebui/blob/main/docs/release.md#troubleshooting-tool-is-not-registered-in-the-policy-bundle) |
| The container won't start: `tool sync refused: KEI_OPENWEBUI_TOOL_PACKS=... is set but its manifest has no tools` | The pack declares no governed tools (no `tools` list), or the image is older than v0.1.2 and doesn't read plain-data `tools` | Add a `tools` list to each toolkit, and use v0.1.2 or later |
| The container won't start: `tool sync with Kei failed: PUT /api/v1/runtime/tools failed after 5 attempt(s): HTTP 401 ...` | The runtime token is wrong, or was rotated | Put the current credential in the secret manager and restart |
| The same, with `HTTP 404` | `KEI_RUNTIME_CONTROL_PLANE_URL` is wrong (for example it ends in `/api/v1`), or the control plane doesn't serve the tool sync route | Use the base URL with no path. If it is right, ask Haikei |
| The same, with `HTTP 409` | A tool name is already registered in the workspace by an admin or another installation | Rename the tool, or remove the other registration in the console |
| The same, with a network error | Egress | Set `KEI_PROXY_EGRESS_PROXY`, or add the control plane host to `KEI_PROXY_NO_PROXY` if it is public |
| The container won't start: `KEI_RUNTIME_STATE_DIR (...) is not a writable directory` | The container runs as a UID other than 10001 | Run as 10001:10001 and give mounted volumes that owner |
| The container won't start: `WEBUI_SECRET_KEY is not set` | No Open WebUI secret key | Set `WEBUI_SECRET_KEY` from the secret manager |
| The container won't start: `kei-proxy runtime bootstrap failed` | The token or control plane URL is wrong, the installation was deleted, or egress is blocked | Check the token and URL; `kei bot status --installation <id>` |
| A user is told their account isn't linked (`Refused (identity.unlinked)`) | Their Open WebUI user isn't linked to a Kei user | They open the claim link Open WebUI showed them and sign in to Kei. With no link, an admin checks `kei users remote-identities list <user>` |
| The audit shows a user's calls as the installation's owner, marked **via installation**, and they're denied | The call had no session user: the Open WebUI user is unlinked, so the row falls back to the installation subject (who set up the runtime) | Link the user (claim link). Their next calls show under their own Kei user |
| A call is denied although a permit exists | The user isn't in the permit's group, the permit isn't bound to the chat agent, or the bundle hasn't refreshed | Check the user's groups and the permit's agent; wait one poll and check `policy_revision` with `policy show` |
| No models in Open WebUI's model list | `kei-proxy` isn't ready, the agent has no model profile, or nobody holds a `model:invoke` permit | `kei model-profiles assignment --workspace <ws> --agent <id>`; add a `model:invoke` permit; check `/v1/models` (Verify, step 4) |
| A chat turn fails with `Kei governance is unavailable, so this request was not sent` | The `kei_guard` filter found `kei-proxy` not ready | Check the container log for `kei-proxy` errors; the container exits if `kei-proxy` dies |
| The boot log warns `tool sync: <toolkit>.<method> is left out of the manifest: ...` | No declaration is matched to that `Tools` method. Either it really is ungoverned, or its tool name doesn't follow `<prefix>.<method>` and names no `method` | From v0.1.3, set the declaration's `method` to the method that runs it. Before v0.1.3, the warning is diagnostic only if the registered count is right and each method sends its declared name; otherwise declare the tool or rename it after its method |

## Related

- [release.md](https://github.com/HaikeiLabs/kei-openwebui/blob/main/docs/release.md): releases, `IMAGE_DIGEST.txt`, the tool-pack contract, registering tools by hand on v0.1.0.
- [design.md](https://github.com/HaikeiLabs/kei-openwebui/blob/main/docs/design.md): the gate, agent sessions, the supervisor, known gaps.
- [e2e.md](https://github.com/HaikeiLabs/kei-openwebui/blob/main/docs/e2e.md): the end-to-end harness against a local control plane.
- HaikeiLabs/skills: `kei-openwebui`, `kei-cli`, `kei-runtime-setup`, `kei-credential-rotation`, `kei-directory-sync`.