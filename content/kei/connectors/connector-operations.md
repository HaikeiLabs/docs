---
title: Connector operations
description: "How connector contracts, connections, and operations define access to external services."
type: concept
product: kei
nav_group: Reference
nav_order: 48
---

# Connector operations

A connector has three parts:

- The **API contract** defines typed request and response messages for the connector's operations.
- The **connection** defines the authentication method and setup fields needed to reach a provider.
- The **operations** are typed functions an agent can call, such as `github.issues.get`.

The public [connector contracts repository](https://github.com/HaikeiLabs/kei-connector-contracts) is the source of truth for contracts. Its [connector documentation](https://github.com/HaikeiLabs/kei-connector-contracts/tree/main/docs/connectors) describes individual connectors. The contracts provide types for Go, Python, TypeScript, and Rust.

## Operations and policy

An operation id names the capability a policy grants. A policy can target an exact id, such as `github.issues.get`, or a wildcard, such as `github.issues.*`.

Operations distinguish reads from writes. Reads retrieve data. Writes create or change data. A write can also have a **destructive** flag to identify an operation that can remove or irreversibly alter data.

A resource template identifies the resource a policy can scope access to. For example, `github:repo/{owner}/{repo}` identifies a GitHub repository. A policy can use the operation id to select a capability and the resource to limit where that capability applies.

## How a call runs

Agentware's `OperationRunner` authorizes each call through `kei-proxy`. The credential is released only for an allowed call. The runner then calls the provider itself and returns the typed response. Kei never performs the provider call.

## Status

Connector contracts have shipped. Catalog policy targets and the Agentware SDK runner are in progress.
