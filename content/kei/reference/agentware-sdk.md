---
title: Build on the Agentware SDK
type: reference
product: kei
---
# Build on the Agentware SDK

This guide is for developers integrating an agent through the Agentware SDK. Start with the [Agentware SDK getting-started guide](https://github.com/HaikeiLabs/agentware/tree/main/docs/getting-started). For onboarding an existing agent through the browser, follow [Getting Started: Web Onboarding](/kei/get-started/sign-in). If you use a supported coding agent, you can also [install the public Kei skills](https://github.com/HaikeiLabs/skills#installing) in that agent; skills installation is separate from SDK development.

## agentware SDK middleware

Use the public [agentware SDK](https://github.com/HaikeiLabs/agentware) middleware in your harness. It intercepts tool calls so a shared middleware path can validate inputs, apply guardrails, record redacted audit metadata, and allow or deny execution. The SDK includes guardrails such as response validation, step enforcement, error tracking, and nudges; use its evaluation tools to check agent behavior. Define tools in a closed registry and implement the tool executor once to templatize calls: each operation reuses its declared name and schema, caller context, validation, and execution path.

For Kei authorization, agentware's Kei integration routes governed connector calls through the tenant-side connector runtime. The middleware passes trusted caller identity and the requested tool/action/resource context to the runtime. The runtime evaluates the active workspace policy locally, then permits the connector operation or denies it before a provider call. See [how the tenant-side connector runtime enforces policy](/kei/runtime/tenant-runtime). The Kei integration ships in Go, Python, and TypeScript; each language provides a `KeiProxyEvaluator` over kei-proxy.

Kei provides the policy, connector catalog, and audit control plane. Keep provider credentials, request payloads, and results in your tenant environment. Only the policy decision and redacted audit metadata are returned to the control plane.

Register the connectors and operations the harness needs in the web app, then bind them through workspace policy. Verify both an allowed operation and an operation that should be denied before enabling the harness for users.