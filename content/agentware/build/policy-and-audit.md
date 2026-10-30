---
title: Policy and audit for Agentware SDK harnesses
type: read-and-use
product: agentware
nav_group: Make and maintain
nav_order: 7
---

An Agentware SDK harness sends every governed tool call through `kei-proxy authorize`. The proxy evaluates the active policy and returns an allow or deny decision; every decision is recorded in the Kei audit log.

Compatible versions: agentware 0.11.0, kei-proxy v0.3.0, kei-cli 0.2.0.

## How policy evaluation works

When a tool call reaches `kei-proxy authorize`, the runtime:

1. Resolves the caller identity (`user_id`, `invoking_subject`) from the session context.
2. Matches the tool name against the active policy bundle for the workspace.
3. Returns `allow` (decision: `permit`) with the matching policy ID, or `deny` with a `reason_code` and `hint`.

The SDK (Agentware) integration uses `KeiProxyEvaluator` → `kei-proxy authorize`, fail closed. A missing caller identity or authenticated runtime context must fail closed. Do not infer identity from prompt text or an agent-supplied environment value.

No matching policy results in a deny. See the [Create policies](/content/kei/policies/create-policies.html) guide for how to write policies, choose sources and destinations, and understand precedence.

## Exit codes

The one-shot `kei-proxy authorize` command uses its exit status as part of the CLI contract:

| Exit code | Meaning |
| --- | --- |
| `0` | The call is permitted. |
| `1` | The call is denied, including a policy-state denial such as `policy_bundle_missing`. The JSON decision is printed to stdout. |
| `2` | An error stopped the call before any decision (bad flags, missing input such as `--tool` or `KEI_RUNTIME_TOKEN`, or a runtime failure). Nothing is written to stdout. |

SDK clients treat any exit code other than `0` as no-permit and fail closed.

## Audit lineage and data boundaries

Record each authorization outcome with its harness or framework and the invoking user preserved through delegation. Keep the decision and its reason available for audit. Do not log the runtime token or other credentials.

The harness and agentware run on the tenant side. Kei is a metadata-only control plane: provider payloads and results, customer content, credentials, embeddings, and indexes never enter Kei. The proxy may use metadata and credential references from the control plane, but resolves credentials and executes providers within the tenant runtime.

## View audit entries

In the Kei console, open **Audit Logs**. Each record shows:

- Timestamp
- User (the `invoking_subject` from the authorization request)
- Agent
- Harness
- Action (tool name)
- Result (`permit` or `deny`)
- Policy (the policy ID that matched)
- Reason code and hint (on denial)

See the [Audit logs](/content/kei/audit/logs.html) page for the recent activity view and recorded fields.

## Sessions and delegation

Open or reuse a runtime session for the authenticated caller identity. Keep sessions isolated per user; do not use a shared service identity to represent all users. When your agent delegates work, carry the original invoking subject through the delegation context so audit records continue to identify the initiating human.

The runtime session preserves:

- `user_id` — identifies the invoking user.
- `invoking_subject` — preserves the same human identity across delegation.
- `framework` — identifies the harness or framework making the call.
- The runtime token establishes the workspace and installation scope. Do not treat caller-supplied workspace or installation values as authority.

Do not send `agent_id` to `authorize`. Agent identity is discovered from the runtime identity event when the harness needs it; it is not an authorization request field.

## Deny responses

A denial includes a machine-readable `reason_code` and a user-facing `hint`. Preserve and surface those values so the user can understand the next step. See the [Deny reason codes](/content/agentware/reference/deny-hints.html) reference for the full table.

## Using agentware as a team

### Developer machines

Use one runtime installation per developer environment. Each developer links their own chat identity and uses their own runtime credential, supplied to the harness through the environment or a secret manager. Keep separate socket paths and credentials for separate local environments. Do not share one developer's credential across the team.

### Staging and production

Use a distinct installation for each deployed environment, such as staging and production. Inject that environment's runtime credential at process start from its secret manager. Keep the credential out of manifests, source control, command-line arguments, and logs.

### CI

Use a dedicated agent profile for CI instead of a developer identity. Bind the CI runtime installation and its credential to the CI environment, and keep policy scoped to the operations that the pipeline needs. The profile describes the agent; each human-triggered run should still retain the initiating user's identity where the harness provides one. Do not use CI credentials for local development.

## Next steps

- [Deny reason codes](/content/agentware/reference/deny-hints.html) — reference for every `reason_code` and its `hint`.
- [Create policies](/content/kei/policies/create-policies.html) — write policies for the workspace.
- [Audit logs](/content/kei/audit/logs.html) — view recent activity and recorded fields.
