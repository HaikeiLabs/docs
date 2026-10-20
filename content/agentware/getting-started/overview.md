---
title: Govern an agent with agentware
type: read-and-use
product: agentware
nav_group: Reference
---

Use agentware middleware to place a shared control point around an agent's tool calls. The middleware checks the request, applies guardrails, and sends Kei-governed operations to the runtime in your environment.

## Keep the decision close to the tool

Register each tool with its input schema and executor. Send the caller identity and requested operation through the Kei integration so the runtime can evaluate the active policy before the connector runs.

Use the SDK documentation for language-specific setup. Start with one allowed operation and one denied operation, then review the resulting audit metadata.
