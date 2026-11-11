---
title: Connector catalog
description: "The catalog of Kei connectors: each connector's kind, how it authenticates, and whether it is available today or planned."
type: reference
product: kei
nav_group: Reference
nav_order: 46
---

# Connector catalog

A connector defines how a call to an external service works. The harness makes the call; Kei decides whether the call is allowed and releases the credential for the session — the harness never stores the secret itself. Typed contract packages that a harness can import in Go, Python, TypeScript, or Rust are being rolled out; until they land, the harness builds each call from the connector's definition.

This catalog lists the connectors Kei ships or is building. Statuses change as connectors land; "planned" means the connector is on the roadmap but not yet available. For how each authentication model works, see [Connector authentication](/kei/connectors/connector-auth).

| Connector | Kind | Auth | Status |
| --------- | ---- | ---- | ------ |
| Postgres | database | Secret reference | Available |
| Supabase | database | Secret reference | Planned |
| MySQL | database | Secret reference | Planned |
| MSSQL | database | Secret reference | Planned |
| Snowflake | database | Service principal key | Planned |
| Linear | native | OAuth | Available |
| Notion | native | OAuth or secret reference | Available |
| GitHub | native | GitHub sign-in or personal access token | Available |
| Google Drive | native | Google OAuth | Available |
| Gmail | native | Google OAuth | Available |
| Google Sheets | — | — | Planned |
| Omni | — | — | Planned |
| Power BI | — | Entra on-behalf-of | Planned |
| Airtable | — | — | Planned |
| HubSpot | — | — | Planned |
| Atlassian Jira and Confluence | — | — | Planned |
| Sentry | — | — | Planned |
| Generic MCP server | mcp | OAuth or API key (secret reference) | Available |
| Generic HTTP API | http_api | Secret reference | Available |

For the setup flow — adding a connector, connecting an account, approving its tools, and granting access — see [Connectors](/kei/connectors/connectors). For what a connector is and how Kei checks each call, see [Connectors, explained](/kei/connectors/connectors-explained).
