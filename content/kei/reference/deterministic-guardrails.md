---
title: Deterministic guardrails
type: reference
product: kei
nav_group: Reference
---

# Deterministic guardrails

Kei policies are deterministic guardrails for tool-call authorization. A fixed rule engine makes the decision; the agent's model does not. Given the same policy, subject, and call, the result is the same because Kei decides with deny-overrides: any matching deny wins over every matching allow, whatever the order. This makes a narrow deny able to override a broad allow.

## Where Kei enforces policy

For SDK and connector calls, `kei-proxy authorize` evaluates the active workspace policy before the operation proceeds. A missing match denies these calls. For Claude Code, Codex, and OpenCode desktop command policies, `kei harness sync` renders eligible rules into each harness's native permission settings, and the harness makes its own allow, deny, or ask decision. Kei's desktop hook reports activity; it does not decide or block a call. Group membership changes reach desktop settings at the next sync.

## How the models compare

These systems address different parts of agent security. The table summarizes their decision models and where the decision takes effect.

| Model | Default | Conflict resolution | Conditions and context | Formal analysis | Enforcement point |
| --- | --- | --- | --- | --- | --- |
| **Kei** | Unmatched SDK and connector calls deny; unmatched desktop calls use the harness mode, usually ask | Deny-overrides: any matching deny wins | Identity, groups, harness, and registered tool, capability, resource, or connector targets | No policy analyzer or formal verification today | `kei-proxy authorize`, or rules synced to native desktop harness settings |
| **Cedar** | Default deny | Any matching `forbid` overrides `permit`; policy order does not matter | Principal, action, resource, and supplied context, including conditions validated against a schema | Schema validation; Cedar documents a formal proof of validator soundness | Application integration, Amazon Verified Permissions, or an AgentCore gateway |
| **OPA / Rego** | Defined by the policy author; no universal allow/deny default | The policy author defines how results such as `allow` and `deny` combine | Rego evaluates structured input and data; the application supplies relevant context | Rego supports schema-based type checking; no single policy analysis model is imposed | OPA API, embedded library, or WebAssembly; the integrating application enforces the result |
| **OpenAPPA** | Its configured label and flow rules govern each action | Algebraic information-flow labels accumulate across a trajectory; it can return policy-based remedy plans | Data origin, audience, trust, action history, and policy configuration; reusable batteries cover tool sets | Its paper states formal safety invariants; its site describes validation and benchmarks | Pre-call and result checks in hooks or protocol gateways; child branches can confine untrusted reads |
| **LLM-as-judge / auto-mode** | Depends on the harness and its configuration | A model judges each proposed action; the result can vary | Prompt, transcript, tool call, and judge instructions; the judge may not see prior tool outputs and may be influenced by prompt injection | No formal guarantee that the judge applies a rule consistently | The harness asks a classifier or reviewer before executing an action |

The systems also differ in the properties they govern. Kei answers who may call which tool or connector operation. OpenAPPA focuses on how information from one action may flow into later actions. It also describes reusable policy batteries, remedy plans, and child branches inspired by the Dual-LLM pattern. Kei's own benchmark comparison is not included here; OpenAPPA reports its benchmark figures on its [evaluation page](https://www.openappa.com/evaluation). For example, OpenAPPA reports 88–90% task completion for its guarded setup and 37–45% for tested FIDES configurations on Bench-Corp. Those are OpenAPPA-reported results, not an independent comparison.

## Where Kei fits

Kei provides identity- and group-based authorization for agent tool calls. It can limit which users or groups may invoke registered tools and connector capabilities. It does not track the flow of information read by one tool into a later tool call. Information-flow labels, as used by OpenAPPA, can complement identity-based authorization: one governs who may act, while the other governs where data may flow.

## Not yet supported

Kei policies do not yet support conditions such as time windows or transaction amounts, time-bound just-in-time grants, or formal or SMT policy analysis. Desktop-harness decisions also do not yet include Kei policy-ID attribution.

## References

- [Cedar documentation](https://docs.cedarpolicy.com/)
- [Amazon Verified Permissions](https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/what-is-avp.html) and [Policy in Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html)
- [OpenAPPA](https://www.openappa.com/), its [paper](https://arxiv.org/abs/2607.24625), and its [reported benchmarks](https://www.openappa.com/evaluation)
- [Open Policy Agent](https://www.openpolicyagent.org/)
- [How Kei decides](/kei/reference/how-kei-decides)
