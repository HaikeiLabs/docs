---
title: "Where policy decisions happen—and where they are enforced"
description: "Where policy decisions happen and where they are enforced: PDPs, PEPs, and how Kei enforces policy for coding agents and connectors."
type: reference
product: kei
nav_group: Reference
---

## The Principal Model in Kei

**A practical guide to Policy Decision Points (PDPs), Policy Enforcement Points (PEPs), and coding agents under Kei policies**  
Haikei Labs · October 2026

*Updated November 2026: the runtime decides and releases credentials; the harness performs provider calls.*

Also available as a [PDF](https://haikeilabs.com/whitepapers/policy-decision-and-enforcement.pdf).

## Executive summary

An authorization decision only protects a system when the request passes through a component that can enforce it. The **Policy Decision Point (PDP)** evaluates a request against policy and returns a decision. The **Policy Enforcement Point (PEP)** stands in the path of the protected operation and carries out that decision: it permits the operation to proceed or stops it.

Kei separates policy guardrails from the place where an action is decided and enforced. The Kei control plane is the policy authority and catalog: administrators create policy there, and the control plane distributes policy and records redacted audit metadata. The live enforcement path depends on the harness:

- **Claude Code, Codex, and OpenCode** have native permission systems. Kei renders policy into their native settings. The editor's own permission engine decides and enforces tool calls; Kei's reporting hook records events but does not decide them.
- **Custom or cloud harnesses and connector calls that Kei checks** ask the tenant-side `kei-proxy` runtime for a decision. It evaluates the applicable policy locally (PDP) and, only on permit, releases the credential for that one call (PEP at the credential boundary). The harness then calls the provider itself inside the tenant environment; the runtime never calls the provider.

When several policies match one request, the answer does not depend on their order or number: **a matching deny always wins** (deny-overrides). A request that matches no policy fails closed on the runtime path.

This distinction keeps policy administration central while keeping data access at the boundary where it can actually be controlled. Customer payloads, provider results, and credentials remain in the tenant environment.

## 1. PDP and PEP in plain language

| Role | What it does | The question it answers |
| --- | --- | --- |
| **PDP — Policy Decision Point** | Evaluates the request, identity, resource, action, context, and applicable policy. Returns a decision such as permit or deny. | “Should this request be allowed?” |
| **PEP — Policy Enforcement Point** | Intercepts the protected operation and applies the decision before the operation reaches its target. | “Can this request reach the resource?” |
| **PAP — Policy Administration Point** | Lets authorized people create and manage policy. | “What rules should govern access?” |
| **PIP — Policy Information Point** | Supplies attributes used during evaluation, such as identity, group, resource, or environment information. | “What facts does the decision need?” |

The PDP and PEP may be separate services, or one local component may perform both functions. Their responsibilities still differ: a decision without an enforcement point is only advice; an enforcement point without a trusted decision source has no policy to apply.

In Kei, “PDP” must be read in context. The control plane administers and distributes policy. It is **not** a central, synchronous PDP for every connector request. For custom harness and connector operations, `kei-proxy` evaluates the distributed policy at the tenant-side boundary. For pre-built editors, the editor's native permission engine makes and enforces its own decision from settings rendered by Kei.

## 2. Two enforcement paths

### Pre-built coding editors: native decision, native enforcement

An administrator writes command and tool policy once in Kei. A developer machine runs one Kei runtime installation. Each supported editor is registered as a separate harness session of that installation. The runtime synchronizes policy and translates the supported rules into each editor's native permission format.

The flow: **Kei control plane** (policy authority · catalog; admin writes policy once) → policy sync → **one runtime per machine** (syncs policy · registers sessions; renders native editor settings) → native permissions → **editor permission engine** (Claude Code · Codex · OpenCode; decides and enforces tool calls) → report-only event → **Kei audit records** (editor kind · session; redacted activity metadata).

Here, the editor's permission engine performs the decision and enforcement for its own tool calls. The runtime's reporting hook is not an authorization gate and does not replace the editor's decision. It records the harness kind and session so activity can be reviewed in Kei.

**Example:** An administrator permits `git status` in a repository and denies a destructive command. Kei renders those rules into the editor's native permission settings. When the agent proposes a command, the editor evaluates its settings and allows, denies, or asks according to its own permission behavior. Kei records the resulting tool-call event for audit.

### Custom harnesses and connectors: runtime-local decision and enforcement

A custom harness does not have one of the supported editors' native policy renderers. Before a protected tool call, the harness asks the tenant-side runtime for a decision. The runtime loads the policy assigned to its installation, evaluates the request against the applicable attributes, and controls whether the operation can proceed by releasing, or withholding, the credential the call needs.

The flow: **custom harness** (tool request · invoking identity) → protected request → **tenant-side `kei-proxy`** (PDP: evaluates policy locally; PEP: gates the operation) → **permit**: release the credential for this call only → **harness** calls the provider inside the tenant environment — or — **deny**: no credential is released, so the call stops before provider access → decision metadata → **Kei control plane** (redacted audit metadata; no customer payload or credential).

For this path, `kei-proxy` performs both the live policy evaluation (PDP function) and the access gate (PEP function). The gate is the credential: on permit, the runtime releases the credential for that call only, and the harness makes the provider call with it. On deny, no credential is released, so the call cannot be authenticated to the provider. Missing, invalid, expired, or out-of-scope policy state does not grant access: the runtime fails closed. The runtime records the decision; it never executes the provider call and never holds provider payloads or results. Those stay with the harness in the tenant environment, and Kei receives decision and redacted audit metadata only.

The same runtime-local policy boundary applies to connector calls that Kei checks, regardless of which harness initiated them. The runtime resolves connector bindings and credentials from the tenant's configured secret or OAuth backend and releases a credential only when the request is permitted. The harness performs the provider call, including any write, with that credential.

## 3. How policies combine: deny overrides

Several policies can match one request. Kei resolves them with one rule, used by every component that decides:

1. If **any** matching policy denies the request, the decision is **deny**. It does not matter how many permits also match, or in what order the policies were written.
2. Otherwise, if at least one matching policy permits the request, the decision is **permit**.
3. Otherwise, nothing matches. On the runtime path (custom harnesses and connector calls that Kei checks) the request is **denied**: the runtime fails closed. A desktop editor falls back to its own native ask behavior.

Policies are not ranked. There is no priority number and no tie-break to learn. A reader can predict the outcome by asking one question first: does any deny match?

A policy names only **groups** as its source: a custom group such as `group:engineering`, or one of the two built-in groups, `autogroup:member` (every workspace member) and `autogroup:admin` (workspace admins and owners). A policy never names an individual by email address; a person receives access by belonging to a group.

**Worked example.** A workspace has two policies:

| Policy | Source | Effect | Target |
| --- | --- | --- | --- |
| A | `group:engineering` | permit | `shell:git *` |
| B | `group:engineering` | deny | `shell:git push *` |

| Request from a member of `group:engineering` | Matches | Decision |
| --- | --- | --- |
| `git push origin main` | A and B | **Deny.** B matches, so it wins even though A also permits. |
| `git status` | A only | **Permit.** |
| `npm publish` | Neither | **Deny** on the runtime path (fail closed). A desktop editor asks, as it does for any command it has no entry for. |

The decision order: **request** (group membership · target) → any matching deny? → **yes: deny**, regardless of permits or order; **no: any matching permit?** → yes: **permit**; no: the runtime path **denies** and a desktop editor asks.

**Where this applies today.** The control plane has stopped reading the old priority field when it orders policies, and the console no longer offers it. Distributing the deny-overrides rule to runtimes is gated by runtime version: it reaches a runtime only once that runtime's release accepts it, starting with the kei-proxy release that ships deny-overrides. Until then, runtimes keep receiving the policy set in the form they already accept, ordered so that denies come first.

## 4. What Kei controls—and what it does not

**Kei controls policy guardrails.** The control plane stores policy and connector metadata, installation and harness bindings, and redacted audit metadata. It distributes the policy applicable to an installation and makes guardrails visible to administrators.

**The decision and enforcement location depends on the operation.** For supported editor-native command and tool permissions, the editor decides and enforces; Kei's hook reports. For custom harness and connector operations, the tenant-side runtime evaluates policy locally and enforces the decision by releasing a credential only on permit. This is why “Kei checks every editor command” would be inaccurate for the native-editor path, while “the editor enforces connector policy” would be inaccurate for the connector path.

**Kei is not the customer data plane.** The control plane does not receive provider payloads or results, store customer credentials, or execute customer connector operations. The harness performs those operations inside the tenant environment, with a credential the tenant-side runtime releases only on permit, so the data stays in the tenant environment.

## 5. Identity, sessions, and audit

One runtime installation represents a developer machine. A developer may use multiple editors, and each editor is represented as its own harness session. This lets audit records identify the editor kind and session without confusing the machine installation with an individual interaction.

Audit supports accountability; it does not itself authorize an operation. For native editor calls, the report identifies the harness kind and session and does not make or change the editor's decision. For custom or connector calls that the runtime checks, the runtime records the policy decision and its redacted context. In both cases, audit metadata is distinct from customer content and secrets.

## 6. Design principles

1. **Put enforcement at the unavoidable access boundary.** A policy decision is meaningful only if the protected action cannot bypass the PEP.
2. **Use native permissions where the editor owns the action.** Kei renders the policy; the editor applies its own permission semantics.
3. **Gate custom and connector operations at the credential boundary in the tenant environment.** The runtime evaluates each protected operation and releases the credential for it only on permit; the harness then performs the provider call inside the tenant environment.
4. **Fail closed on the runtime path.** Missing or invalid authorization state must not become an implicit permit.
5. **Let a deny win.** When policies disagree, any matching deny decides, independent of order and of how many permits match.
6. **Separate policy metadata from customer data.** Central guardrails do not require central custody of customer payloads, results, or credentials.
7. **Make audit useful without turning it into a data copy.** Record decision lineage and session metadata while keeping provider content in the tenant environment.

## 7. Planned capabilities

Kei plans to apply team and role policy automatically for each signed-in developer and to support model selection per editor. These are planned capabilities; they are not required for the policy distribution and enforcement paths described above.

## Conclusion

PDP and PEP describe two different jobs: deciding whether a request is permitted and enforcing that decision at the access boundary. Kei uses the boundary that fits the harness. Supported coding editors decide and enforce their own native permissions, while Kei records their activity. For custom harness and connector requests, the tenant-side runtime evaluates policy locally and releases the credential for a call only when the request is allowed, so the harness cannot authenticate to the provider otherwise. Policies combine by one rule, deny-overrides, so a matching deny always wins and an unmatched request does not become a permit on the runtime path. That split connects centralized policy guardrails with local, enforceable boundaries and tenant-owned data.

## References

- NIST, [SP 800-162: Guide to Attribute Based Access Control (ABAC) Definition and Considerations](https://csrc.nist.gov/pubs/sp/800/162/upd2/final).
- Kei, ADR-011: Tenant-Side Proxy Data Plane (see [Tenant-side connector runtime](/kei/runtime/tenant-runtime)).
- Kei, ADR-026: Policy Bundle Lifecycle (see [How policy bundles reach a runtime](/kei/reference/how-policy-bundles-reach-a-runtime)).
- Kei, ADR-029: Harness Command Policy (see [Govern harness commands](/kei/policies/govern-harness-commands)).
- Kei, Taxonomy; Tool Definition Contract; and Customer-Managed Connector Secret References (internal design documents).
