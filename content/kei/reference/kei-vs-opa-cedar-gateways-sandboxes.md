---
title: Kei compared with OPA, Cedar, MCP gateways and sandboxes
description: "How Kei relates to Open Policy Agent, Cedar, MCP gateways and sandboxes: what each decides, where it runs, and how to use them together."
type: reference
product: kei
nav_group: Reference
---

# Kei compared with OPA, Cedar, MCP gateways and sandboxes

Kei policies are deterministic guardrails for the tool calls your agent can make. Open Policy Agent (OPA) and Cedar are policy engines: you embed one in your own service, give it a request, and enforce its answer yourself. An MCP gateway is a proxy that sees the MCP traffic routed through it. A sandbox limits which files and network hosts a process can reach. Kei is one policy layer, enforced locally: the Kei runtime (`kei-proxy`) runs beside the agent, ties each decision to the person the agent works for, and records it in an audit log. It covers plain tool calls, shell commands, connector calls and MCP tools. These tools answer different questions, so they often work together.

## At a glance

| | Kei | OPA | Cedar | MCP gateway | Sandbox |
| --- | --- | --- | --- | --- | --- |
| **What it decides** | Whether a caller may make one tool call, shell command, skill load, path access, connector call or MCP tool call. Any matching deny wins | Whatever your Rego policy computes from the input you send | Allow or deny for a principal, action, resource and context. A matching `forbid` overrides a `permit` | Which MCP tools a client can reach through the gateway, and the credentials each server gets | Which files and network hosts a process may reach |
| **Where it runs** | `kei-proxy` on the same host or in the same container as the agent, deciding from a cached policy bundle. For Claude Code, Codex and OpenCode, Kei renders rules into the coding agent's own permission settings | A server you query over HTTP, or a Go library in your program | A library in your application, or a managed service such as Amazon Verified Permissions | A proxy between MCP clients and servers, run by you or as a managed service | The operating system of the machine or container |
| **Identity** | The invoking person, their groups and autogroups, carried with each call | Whatever identity your service puts in the input | The principal your application supplies in the request | The gateway's own inbound authentication | Not part of the model: the same limits apply whoever the agent works for |
| **Audit** | Decision records with the invoking subject, tool, decision and an arguments digest | Decision logs, which OPA can send to a remote HTTP server | The authorization response names the policies that decided; logging is up to your application | Depends on the product; some include logging and call tracing | Depends on the product |
| **Coding-agent support** | Claude Code, Codex, OpenCode, Pi and Open WebUI, plus agents built with Agentware | General purpose: you write the integration | General purpose: you write the integration | Any MCP client you point at the gateway | Some coding agents include one, such as Claude Code's Bash sandbox |
| **Fails closed?** | Yes for Agentware and connector calls, and when the policy bundle expires. An unmatched desktop command uses the coding agent's own mode, usually ask | Your service decides what to do when OPA is unreachable or the result is undefined | Default deny: nothing is allowed unless a `permit` matches | Depends on the product and its configuration | Yes for what it covers: anything outside the allowed set is refused |

The Kei column comes from [How Kei decides](/kei/reference/how-kei-decides), [How Kei puts guardrails on coding agents](/kei/reference/how-it-works), [Audit logs](/kei/audit/logs) and [Tenant-side connector runtime](/kei/runtime/tenant-runtime). The sections below link the source for each other column.

## Open Policy Agent (OPA)

[OPA](https://www.openpolicyagent.org/docs) is an open source, general-purpose policy engine. It decouples policy decisions from enforcement: your software queries OPA with structured input such as JSON, and OPA returns a decision computed by a policy written in Rego. You can run OPA as a server and query it over HTTP, or embed it in a Go program as a library. OPA can [report decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) to a remote HTTP server.

**Use it when** you want one policy language across many systems you build yourself, such as Kubernetes admission, service APIs or CI checks, and you are ready to write the enforcement point in each one.

**How Kei relates.** The decision model is close: deterministic rules, decided the same way every time. OPA leaves the combining rule to the policy author, while Kei always uses deny-overrides. The difference is what comes with the engine. OPA is an engine you embed. Kei is a policy layer for agent tool calls that includes identity, a runtime beside the agent, rendering into coding agents' native settings, and audit. With OPA, you would build those parts yourself.

## Cedar

[Cedar](https://docs.cedarpolicy.com/) is an open source policy language and authorization engine. An [authorization request](https://docs.cedarpolicy.com/auth/authorization.html) has four parts: principal, action, resource and context. Nothing is allowed unless a `permit` policy matches, and any matching `forbid` overrides it. The response includes the decision and the policies that determined it. Your application calls the engine and supplies the principal. [Amazon Verified Permissions](https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/what-is-avp.html) runs Cedar as a managed service.

**Use it when** you are adding fine-grained authorization to your own application and want policies validated against a schema.

**How Kei relates.** Cedar and Kei share a decision rule: a matching deny always wins, and policy order does not matter. Cedar is an engine you embed in your application; Kei is the layer that puts that kind of rule on an agent's tool calls, with the runtime, identity and audit already wired in. Cedar supports conditions on context and schema validation. Kei policies do not yet support conditions such as time windows or amounts, or formal policy analysis. See [Deterministic guardrails](/kei/reference/deterministic-guardrails) for a longer comparison of the decision models.

## MCP gateways

An MCP gateway is a proxy between MCP clients and MCP servers. Products differ. [Docker MCP Gateway](https://docs.docker.com/ai/mcp-catalog-and-toolkit/mcp-gateway/) is an open source proxy that manages configuration, credentials and access control for MCP servers, runs them in isolated containers, and includes logging and call tracing. [Amazon Bedrock AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html) is a managed service that turns APIs and Lambda functions into MCP tools and handles inbound and outbound authentication.

**Use it when** you want one endpoint for many MCP servers or APIs, with credentials, routing and tool discovery managed in one place.

**How Kei relates.** A gateway decides only the traffic routed through it. A coding agent also runs shell commands, reads files and calls local tools, and those calls do not pass through an MCP gateway. Kei's stance is one policy layer, enforced locally: the same policies cover plain tool calls, shell commands, connector calls and MCP tools (`mcp:<slug>` or `mcp:<slug>.<tool>`), and `kei-proxy` decides on the machine where the agent runs. Each decision carries the invoking person, so you do not need a separate layer to pass identity through a proxy. See [Connectors, explained](/kei/connectors/connectors-explained) for how Kei registers MCP servers.

## Sandboxes

A sandbox limits what a process can reach. For example, [Claude Code's Bash sandbox](https://code.claude.com/docs/en/sandboxing) uses operating-system primitives (Seatbelt on macOS, bubblewrap on Linux) to limit the files and network domains that shell commands can reach. Its own documentation notes that some tools, such as the built-in file and web tools and local MCP servers, are outside the sandbox and follow permission rules instead.

**Use it when** you want to contain the blast radius of a command: if the agent runs something unexpected, it cannot write outside the project or reach an unknown host.

**How Kei relates.** A sandbox answers "what can this process touch?". Kei answers "may this person's agent make this call?". A sandbox applies the same limits whoever the agent works for. Kei can sit beside a sandbox: the sandbox contains what a command can reach, and Kei decides which commands and tool calls are allowed for which groups, and records each decision.

## Using them together

These layers do not replace each other. A typical setup for a team of coding agents:

1. **Sandbox** each agent's shell commands, so a mistaken command stays inside the project and the allowed hosts.
2. **Kei policies** decide which tool calls, commands and connector calls each group may make, and record every decision with the invoking person. For example: allow `kubectl get`, never `kubectl delete`.
3. **An MCP gateway**, if you already run one, keeps managing your MCP servers. If the gateway serves MCP at a public HTTPS URL, you can add it as a [custom MCP connector](/kei/connectors/connectors#custom-mcp-servers) and write Kei policies for its tools.
4. **OPA or Cedar** keep deciding authorization inside the services you build. Kei decides whether the agent may make the call; your service still applies its own rules when the call arrives.

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides): deny-overrides and matching rules
- [Deterministic guardrails](/kei/reference/deterministic-guardrails): decision models compared in detail
- [How Kei puts guardrails on coding agents](/kei/reference/how-it-works): how policy reaches each coding agent
- [How policy bundles reach a runtime](/kei/reference/how-policy-bundles-reach-a-runtime): local decisions from a cached bundle
- [Tenant-side connector runtime](/kei/runtime/tenant-runtime): what stays in your environment
