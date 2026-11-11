---
title: Connector authentication
description: "How Kei authenticates connectors: OAuth, secret references, service principals, token exchange, and SAML — and where each credential lives."
type: reference
product: kei
nav_group: Reference
nav_order: 47
---

# Connector authentication

A connector's credential decides which account a call runs as. Kei keeps the credential out of your harness: it decides whether a call is allowed, and only on allow does it release the credential to the harness for that session. This page explains the credential models Kei supports or is building.

## OAuth

Kei signs the user in to the provider. Each user (or one shared organization account) completes the provider's consent screen through Kei, and the resulting tokens stay in Kei — encrypted at rest, never printed by the CLI, never written to your harness. When a call is allowed, Kei releases the token to the harness for the session, and the harness makes the provider call with it.

This is the model used by the native connectors such as GitHub, Google Drive, and Linear.

## Secret references

An admin stores the key in the organization's secret store, and the connector holds only a reference to it. Each runtime installation uses one secret store set in its configuration — AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager for remote cloud deployments, with HashiCorp Vault planned. Kei never shows the value: the console, the CLI, and audit logs all see the reference, not the secret. At call time, after an allow, the runtime resolves the reference and releases the credential to the harness for the session.

Local bring-your-own harnesses such as Claude Code use SSO identity and no secret store.

This is the model used by database connectors such as Postgres and by generic HTTP API connectors.

## Service principals

Planned. For providers that authenticate with a service principal or service account — for example Snowflake or Microsoft Entra applications — the key lives in the runtime's configured secret store, and the connector references it the same way secret references work. The key is never pasted into the console.

## Token exchange

Planned. For enterprise setups where a long-lived credential should not reach the harness at all, Kei will exchange the stored credential for a short-lived delegated token scoped to the call. The harness receives only that short-lived token, which expires quickly and is valid for the session it was issued for.

## SAML

Planned. SAML is an identity method, not a connector credential: it is how your people sign in to Kei through your enterprise identity provider. SAML sign-in decides who a user is in Kei; it does not authenticate a connector to an external service. Connector credentials still use one of the models above.

See the [Connector catalog](/kei/connectors/connector-catalog) for which connectors use which model, and [Connectors, explained](/kei/connectors/connectors-explained) for how Kei checks each call.
