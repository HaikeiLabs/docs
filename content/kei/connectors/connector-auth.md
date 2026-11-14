---
title: Connector authentication
description: "How Kei authenticates connectors: SSO reuse, OAuth tiers, secret references, token exchange, service principals, and SAML — and where each credential lives."
type: reference
product: kei
nav_group: Reference
nav_order: 47
---

# Connector authentication

A connector's credential decides which account a call runs as. Kei keeps the credential out of your harness: it decides whether a call is allowed, and only on allow does it release the credential for that session. Authentication and authorization are separate questions — the credential model selects the account, while Kei policies decide whether the call is permitted at all.

This page explains the credential models Kei supports or is building. For which connector uses which model, see the [Connector catalog](/kei/connectors/connector-catalog).

## SSO reuse

`sso_reuse` reuses the invoking user's existing SSO identity. The connector stores no provider-specific registration: the call runs as the person who is already signed in to the harness, and the identity comes from that session. It is the model for local bring-your-own harnesses such as Claude Code, which use SSO identity and no secret store, and it is one of the options for GitHub.

## OAuth

OAuth has two tiers.

- **Tier 1** is a hard-coded SSO app: one registration held by Haikei, shared by every organization that uses the connector. Gmail uses tier 1.
- **Tier 2** is a per-organization registration the customer brings. Linear uses tier 2, and Power BI uses an Entra on-behalf-of flow that is moving to token exchange.

In both tiers the user (or one shared organization account) completes the provider's consent screen through Kei, and the resulting tokens stay in the runtime's session memory — encrypted at rest, never printed by the CLI, never written to your harness. The token is released at call time over the runtime's owner-only Unix socket, so it exists only for the session it serves. The harness makes the provider call with it.

A connector can be **per user** — each user connects their own account — or **shared**, where one account serves every user of the connector. The catalog records the account model per connector.

OAuth scope handling follows the operation contract: each operation records the scopes it needs, and a harness requests only those scopes.

## Secret references

`secret_ref` means the connector holds only a pointer to a secret: an `opaque_ref` into the secret backend configured for that runtime installation. A customer-held secret is never stored in the connector and never travels through the console; only the reference does. Kei never shows the value: the console, the CLI, and audit records all see the reference, not the secret.

Each runtime installation uses exactly one secret backend, selected by `KEI_SECRETS_BACKEND`. For remote cloud deployments that backend is AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager; HashiCorp Vault is planned. The runtime resolves the reference from that one backend and releases the credential to the harness for the session, after an allow. The harness places it on the provider call.

This is the model used by database connectors that take a read-only DSN, by generic HTTP API connectors, and as an alternative for GitHub with a fine-grained personal access token.

## Token exchange

Planned — `kei_token_exchange`. For enterprise setups where a long-lived credential should not reach the harness at all, Kei will exchange the stored credential for a short-lived token scoped to the call. The harness receives only that short-lived token, which expires quickly and is valid only for the session it was issued for. The long-lived credential stays in the runtime.

## Service-principal keys

Planned — `service_principal_key`. For providers that authenticate with a service principal or service account — Snowflake is the first planned connector — the key lives in the installation's configured secret store, and the connector references it the same way a secret reference works. The key-pair JWT is minted harness-side, and the key is never pasted into the console or written to a harness config file.

## SAML

Planned — `saml`. SAML is an identity method, not a connector credential: it is how your people sign in to Kei through your enterprise identity provider. SAML sign-in decides who a user is in Kei; it does not authenticate a connector to an external service. Connector credentials still use one of the models above.

## Where each credential lives

| Model | Who acts | Where the credential lives | Released how |
| ----- | -------- | -------------------------- | ------------ |
| `sso_reuse` | The invoking user | The existing SSO session | With the session |
| `oauth` (tier 1 or tier 2) | The connected user, or one shared organization account | Runtime session memory | Per session, over the owner-only Unix socket |
| `secret_ref` / `opaque_ref` | The connector's shared account | The installation's one configured secret backend (`KEI_SECRETS_BACKEND`) | Per session, after an allow |
| `kei_token_exchange` (planned) | The invoking user | Exchanged by the runtime; the harness sees only a short-lived token | Per call |
| `service_principal_key` (planned) | The service principal | The installation's configured secret backend | Per session, after an allow |
| `saml` (planned) | A person signing in to Kei | The identity provider session | Not a connector credential |

## Which connectors use which model

The [Connector catalog](/kei/connectors/connector-catalog) carries the full row per connector, including availability. This table records the auth method and account model from the auth matrix.

| Connector | Auth method(s) | Account model |
| --------- | -------------- | ------------- |
| GitHub | `sso_reuse` or `secret_ref` (fine-grained PAT) | Per user; shared |
| Linear | `oauth` (tier 2, per-org registration) | Per user |
| Generic HTTP API | `secret_ref` | Shared |
| Generic database | `secret_ref` (DSN, read-only role) | Shared |
| Snowflake | `service_principal_key` (key-pair JWT minted harness-side) | Shared |
| Generic MCP server | `oauth` | Per user |
| Notion | `oauth` or `secret_ref` | Per user; shared |
| Power BI | `oauth` (Entra on-behalf-of), moving to `kei_token_exchange` | Per user |
| Gmail | `oauth` (tier 1, hard-coded SSO app) | Per user |
| Postgres | `secret_ref` (DSN, read-only role) | Shared |
| Supabase, MySQL, MSSQL, Google Sheets, Airtable, HubSpot, Atlassian, Omni, Sentry | planned, TBD | Planned |

For which connectors are available today, see the [Connector catalog](/kei/connectors/connector-catalog). For how Kei checks each call, see [Connectors, explained](/kei/connectors/connectors-explained).
