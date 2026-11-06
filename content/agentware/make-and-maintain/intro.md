---
title: Introduction to Agentware
description: "What Agentware is, who it is for, and how its Go, Python, and TypeScript middleware adds Kei guardrails to the agents you build."
type: read-and-use
product: agentware
nav_group: Make and maintain
nav_order: 1
---

Agentware provides middleware for placing a shared control point around an agent's tool calls. It checks requests, applies guardrails, and sends the operations Kei checks to the runtime in your environment. Kei holds registration, policy, and audit metadata; provider payloads, customer content, and credentials stay out of the control plane.

Agentware is for engineers adding Kei guardrails to a custom agent harness. The SDK supports Go, Python, and TypeScript. The documentation describes six user-facing harness types:

- **SDK (Agentware):** harnesses built on the Agentware SDK.
- **Claude Code:** native permission files and a hook.
- **Codex:** native permission files and a hook.
- **OpenCode:** native permission files and a hook.
- **Pi:** its own package and local-socket adapter.
- **Open WebUI:** its own Python library, separate from the SDK path.

To understand how Kei checks a tool call, start with [Govern an agent with agentware](/agentware/getting-started/overview). To add Kei guardrails to your own harness, continue with [Build on Agentware](/agentware/build/overview), then choose the guide for [Go](/agentware/build/go), [Python](/agentware/build/python), or [TypeScript](/agentware/build/typescript).
