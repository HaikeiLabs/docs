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
| Python | `haikeilabs-agentware` (PyPI, import `haikeilabs.agentware`) | Yes | No | No concrete backend | Yes (`kei/` harness surface, `KeiProxyEvaluator`) | Middleware-first: policy, audit, delegation; you bring the loop and the model |
| Go | `github.com/haikeilabs/agentware/go` | Yes | Yes (`InferenceExecutor`) | Any OpenAI-compatible endpoint | Yes (`kei/` module, `KeiProxyEvaluator`) | Full SDK |
| Rust | `agentware-kei` (Cargo workspace) | No | No | No | Scaffold mirroring `go/kei` | Early: Kei integration scaffold, not published |

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

The Python SDK is middleware-first: `AuditedToolClient`, policy rules, audit records, and delegation, plus the `kei/` harness surface for protected tool calls. It does not ship an agent loop or a model backend; you bring both.

Build guide: [Python](/agentware/build/python).

## Go

```sh
go get github.com/haikeilabs/agentware/go
```

The Go SDK is the reference implementation: middleware, framework adapters, model clients, and the `kei/` module that defines the third-party harness contract. Its [first agent example](https://github.com/HaikeiLabs/agentware/tree/main/examples/go/first-agent) runs the loop against any OpenAI-compatible endpoint.

Build guide: [Go](/agentware/build/go).

## Rust

The Rust workspace is a port in progress, not a complete SDK. It mirrors the Kei integration modules in `go/kei` and replays the shared JSON contracts; product behavior comes in follow-up work.

See the [rust folder in the Agentware repo](https://github.com/HaikeiLabs/agentware/tree/main/rust) for the current state and how to run the `governed_call` example against `kei-proxy serve`.

## Versions

For the Agentware, kei-proxy, and kei-cli versions that work together, see [Compatible versions](/content/agentware/build/overview.html#compatible-versions).
