---
title: Agentware languages and status | Agentware
description: "The Agentware SDKs for TypeScript, Python, Go, and Rust, with a status matrix: what each language ships, and what it does not yet have."
type: reference
product: agentware
nav_group: Reference
---

Agentware ships one version across four languages, and each language is at a different point on the way to a complete SDK.

| Language | Package | Published | Agent loop | Model backend | Kei integration | Status |
|---|---|---|---|---|---|---|
| TypeScript | `@haikeilabs/agentware` (npm) | Yes | Yes | Any OpenAI-compatible endpoint | Yes (`KeiProxyEvaluator`, socket client) | Full SDK |
| Python | `haikeilabs-agentware` (PyPI, import `haikeilabs.agentware`) | Yes | No | Any OpenAI-compatible endpoint (`OpenAIBackend`) | Yes (`kei/` harness surface, `KeiProxyEvaluator`) | Middleware-first: policy, audit, delegation; you bring the loop |
| Go | `github.com/haikeilabs/agentware/go` | Yes | Yes (`InferenceExecutor`) | Any OpenAI-compatible endpoint | Yes (`kei/` module, `KeiProxyEvaluator`) | Full SDK |
| Rust | `agentware-kei` (Cargo workspace) | No | No | Any OpenAI-compatible endpoint (`ServerBackend`) | Scaffold mirroring `go/kei` | In progress: Kei integration and model backend, not published |

## TypeScript

```sh
npm install @haikeilabs/agentware
```

The TypeScript SDK includes agent-loop helpers and works with any OpenAI-compatible endpoint. The [first agent example](https://github.com/HaikeiLabs/agentware/tree/main/examples/typescript/first-agent) summarizes Hacker News stories and denies a second tool with a local policy, no Kei needed.

Build guide: [TypeScript](/agentware/build/typescript).

## Python

```sh
pip install haikeilabs-agentware
```

The Python SDK is middleware-first: `AuditedToolClient`, policy rules, audit records, and delegation, plus the `kei/` harness surface for protected tool calls. It ships an OpenAI-compatible model backend (`OpenAIBackend`) but no agent loop; you bring the loop.

Build guide: [Python](/agentware/build/python).

## Go

```sh
go get github.com/haikeilabs/agentware/go
```

The Go SDK is the reference implementation: middleware, framework adapters, model clients, and the `kei/` module that defines the third-party harness contract. Its [first agent example](https://github.com/HaikeiLabs/agentware/tree/main/examples/go/first-agent) runs the loop against any OpenAI-compatible endpoint.

Build guide: [Go](/agentware/build/go).

## Rust

The Rust workspace mirrors the Kei integration modules in `go/kei` and ships an OpenAI-compatible model backend (`ServerBackend`), toolformat for every model family, and an evals module. It replays the shared JSON contracts and is not published yet.

See the [rust folder in the Agentware repo](https://github.com/HaikeiLabs/agentware/tree/main/rust) for the current state and how to run the `governed_call` example against `kei-proxy serve`.

## Model providers

Both provider paths below need Agentware 0.17.0 or later and work in TypeScript, Python, Go, and Rust.

### OpenAI-compatible endpoints

Every SDK ships an OpenAI-compatible chat backend: `OpenAIBackend` (TypeScript, Python), `NewBackend` (Go), and `ServerBackend` (Rust). Point it at any `/v1/chat/completions` server, including Gemini 3 through Google's OpenAI-compatible endpoint.

A response tool call can carry provider extras in `extra_content` — for Gemini 3, `extra_content.google.thought_signature`. The backend stores it on that call and sends the same field back on the same call in assistant history. Missing extras stay absent. Extras are model tool-call state, not reasoning display, and are never logged. Without the round-trip, Gemini 3 rejects the next request with HTTP 400 `Function call is missing a thought_signature`.

```json
{
  "id": "call-1",
  "type": "function",
  "function": {"name": "lookup", "arguments": "{\"q\":\"hello\"}"},
  "extra_content": {"google": {"thought_signature": "fixture-signature"}}
}
```

### Native Anthropic Messages

Every SDK also has native Anthropic Messages formatters: tool definitions map to `input_schema`, `tool_use` blocks parse into tool calls, and tool results go back as user `tool_result` blocks. The names are `parse_anthropic_response`, `format_anthropic_tools`, and `format_anthropic_messages` (Python and Rust), `parseAnthropicResponse`, `formatAnthropicTools`, and `formatAnthropicMessages` (TypeScript), and `ParseAnthropicResponse`, `FormatAnthropicTools`, and `FormatAnthropicMessages` (Go).

Signed `thinking` and `redacted_thinking` blocks are kept in the call's metadata and replayed unchanged. Pass system instructions in the top-level `system` parameter; the formatters produce the blocks, and you supply the HTTP transport.

```json
{
  "content": [
    {"type": "thinking", "thinking": "I need to call get_weather...", "signature": "..."},
    {"type": "tool_use", "name": "get_weather", "input": {"location": "Tokyo"}, "id": "toolu_..."}
  ]
}
```

## Versions

For the Agentware, kei-proxy, and kei-cli versions that work together, see [Compatible versions](/content/agentware/build/overview.html#compatible-versions).
