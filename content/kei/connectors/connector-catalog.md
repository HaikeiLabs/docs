---
title: Connector catalog
description: "The catalog of Kei connectors: each connector's kind, how it authenticates, its operations, whether it is usable today, and its operation contract status."
type: reference
product: kei
nav_group: Reference
nav_order: 46
---

# Connector catalog

A connector defines how a call to an external service works. The harness makes the call; Kei decides whether the call is allowed and releases the credential for the session — the harness never stores the secret itself. Operation contracts live in [`kei-connector-contracts`](https://github.com/HaikeiLabs/kei-connector-contracts): proto definitions of the requests and responses for every operation a connector exposes. buf generates Go, Python, TypeScript, and Rust types from the same proto files, so a harness can build the provider call with generated types instead of a hand-written mapping layer. Proto is the schema language only; there are no gRPC services or generated HTTP clients, and the runtime stays decision-only.

This catalog lists the connectors Kei ships or is building. Two columns track two independent questions. "Usable today" means you can create the connector now with `kei connectors create` — the CLI lists its provider as built-in, or it comes from an MCP catalog template; run `kei connectors create --help` for the current provider list. "Operation contract" means a proto contract for the connector's operations exists under `proto/kei/connectors/` in the contracts repository — Available when it does, Planned when it does not yet. The two answers can differ: Gmail and Google Drive are usable today and still await their contracts, while the generic database connector has a contract but is not in the CLI's provider list yet. For how each authentication model works, see [Connector authentication](/kei/connectors/connector-auth).

## Connectors with operation contracts

One row per connector with an operation contract. The operations link to the proto file in the contracts repository on GitHub.

| Connector | Kind | Auth method | Operations | Test status | Usable today | Operation contract |
| --------- | ---- | ----------- | ---------- | ----------- | ------------ | ------------------ |
| GitHub | native | `sso_reuse` or `secret_ref` (fine-grained PAT) | [github.issues.get](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/github/v1/issues.proto), [github.issues.list](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/github/v1/issues.proto), [github.pulls.get](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/github/v1/pulls.proto), [github.contents.put](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/github/v1/contents.proto) | Four operations in the pilot gate; request and response fixtures unmarshal in Go, Python, and Rust | Yes | Available |
| Linear | native | `oauth` (tier 2, per-org registration) | [linear.issues.get](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/linear/v1/issues.proto), [linear.issues.create](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/linear/v1/issues.proto), [linear.issues.search](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/linear/v1/issues.proto) | Three operations in the pilot gate; request and response fixtures unmarshal in Go, Python, and Rust | Yes | Available |
| Generic HTTP API | http_api | `secret_ref` | [http_api.records.list](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/http_api/v1/records.proto), [http_api.records.get](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/http_api/v1/records.proto) | Two operations in the pilot gate; request and response fixtures unmarshal in Go, Python, and Rust | Yes | Available |
| Database (generic contract) | database | `secret_ref` (read-only DSN) | [database.query.run](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/database/v1/query.proto) | One operation in the pilot gate; request and response fixtures unmarshal in Go, Python, and Rust | No | Available |

The pilot gate covers ten operations across the four connectors with contracts. Each operation has a synthetic request and a synthetic response fixture. The runtime unmarshal is lenient — a new provider key does not break a release — while a strict drift check reads the same fixtures and fails when a provider payload no longer fits the declared shape.

## Connectors without operation contracts

These connectors have no operation contract yet; their contracts are planned.

| Connector | Kind | Auth method | Usable today | Operation contract |
| --------- | ---- | ----------- | ------------ | ------------------ |
| Google Drive | native | `oauth` (per user, shared, or domain delegation) | Yes | Planned |
| Gmail | native | `oauth` (tier 1, hard-coded SSO app) | Yes | Planned |
| Generic MCP server | mcp | `oauth` | Yes | Planned |
| Notion | native | `oauth` or `secret_ref` | No | Planned |
| Omni | native | planned, TBD | No | Planned |
| Power BI | native | `oauth` (Entra on-behalf-of), moving to `kei_token_exchange` | No | Planned |
| Snowflake | database | `service_principal_key` (key-pair JWT minted harness-side) | No | Planned |
| Postgres | database | `secret_ref` (DSN, read-only role) | No | Planned |
| Supabase | database | planned, TBD | No | Planned |
| MySQL | database | planned, TBD | No | Planned |
| MSSQL | database | planned, TBD | No | Planned |
| Google Sheets | native | planned, TBD | No | Planned |
| Airtable | native | planned, TBD | No | Planned |
| HubSpot | native | planned, TBD | No | Planned |
| Atlassian Jira and Confluence | native | planned, TBD | No | Planned |
| Sentry | native | planned, TBD | No | Planned |

For the setup flow — adding a connector, connecting an account, approving its tools, and granting access — see [Connectors](/kei/connectors/connectors). For what a connector is and how Kei checks each call, see [Connectors, explained](/kei/connectors/connectors-explained). For the rules every operation contract follows, see [Contracts, Agentware, and how to build a custom connector](/kei/reference/contracts-vs-agentware#operation-contracts).
