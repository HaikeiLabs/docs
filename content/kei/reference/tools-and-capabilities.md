---
title: Tools and capabilities
type: reference
product: kei
nav_group: Reference
nav_order: 50
---

# Tools and capabilities

Kei policies govern tool calls and connector capabilities through `tool:` and `capability:` target patterns. This page describes how these targets work, how `required_capabilities` are evaluated, and how connector capability names are structured.

## Tool targets

A `tool:<name>` target matches a specific registered tool-call name. Tools are registered by the harness or connector and represent a single invocable operation.

| Pattern | Example | Matches |
| ------- | ------- | ------- |
| `tool:<name>` | `tool:read_file` | The exact tool name `read_file` |
| `tool:<connector>.<operation>` | `tool:issues.list` | The `list` operation on the `issues` connector |

Matching is **exact** — no wildcards and no `:` inside the name. `tool:read` does not match `tool:read_file`.

### Tool evaluation

For SDK (Agentware) integrations, `tool:` targets are evaluated by `kei-proxy authorize`. The proxy receives the tool name, the caller identity, and the workspace policy bundle, and returns allow or deny.

For desktop harnesses, a `tool:<kind>.<name>` target can name a registered native harness tool (for example, `tool:claude_code.edit`). The harness renderer handles that target according to its native permission model.

## Capability targets

A `capability:<name>` target matches a specific capability exposed by a connector. Capabilities represent discrete actions a connector supports.

| Pattern | Example | Matches |
| ------- | ------- | ------- |
| `capability:<name>` | `capability:pull_request.read` | The exact capability name `pull_request.read` |

Matching is **exact** — no wildcards. `capability:pull_request.read` does not match `capability:pull_request.write`.

### Connector capability naming

Connector capabilities follow a `<resource>.<operation>` naming convention:

| Connector | Example capabilities |
| --------- | ------------------- |
| GitHub | `pull_request.read`, `pull_request.write`, `issue.read`, `issue.write` |
| Google Drive | `file.read`, `file.write`, `folder.list` |
| Linear | `issue.read`, `issue.write`, `project.read` |

The exact capability set depends on the connector version. See the connector documentation for the full list.

## Required capabilities

A tool call can declare **required capabilities** — a set of capabilities the caller needs for that call. Kei evaluates required capabilities with **AND semantics**: every required capability must have an allow decision for the tool call to proceed.

### How it works

1. The tool call specifies one or more required capabilities.
2. Kei evaluates each required capability independently against the workspace policy bundle, using the same precedence rules as any other policy target.
3. If **all** required capabilities are allowed, the tool call proceeds.
4. If **any** required capability is denied or unmatched, the tool call is denied.

### Precedence interactions

- Each capability is evaluated separately with deny-overrides: a matching deny on that capability wins over every matching allow.
- A tool-call allow never overrides a deny effect on one of its required capabilities.
- A deny on any single required capability blocks the entire tool call.
- Unmatched capabilities (no matching policy) follow the default — denied for SDK/connector calls, native decision for desktop harnesses.

### Example

Consider a tool call that requires both `capability:pull_request.read` and `capability:pull_request.write`:

| Policy | Effect |
| ------ | ------ |
| `capability:pull_request.read` | allow |
| `capability:pull_request.write` | deny |

Result: the tool call is **denied** because `capability:pull_request.write` is denied, even though `capability:pull_request.read` is allowed.

If both capabilities are allowed, the tool call proceeds.

## Best practices

- Use `capability:` targets for coarse access control at the connector-operation level.
- Use `tool:` targets for fine-grained control over specific registered operations.
- When a connector exposes read and write capabilities, consider allowing read and denying write as separate policies to give users read-only access.
- Test your tool and capability policies with `kei policy test` before syncing to harnesses.

## Learn more

- [How Kei decides](/kei/reference/how-kei-decides) — policy ordering and precedence, including capability AND semantics
- [Policy file syntax](/kei/reference/policy-file-syntax) — source and target pattern reference
- [Harness rendering](/kei/reference/harness-rendering) — how policies map to each harness
- [How Kei governs coding agents](/kei/reference/how-it-works) — architecture overview
