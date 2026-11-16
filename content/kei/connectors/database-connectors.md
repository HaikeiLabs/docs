---
title: Set up a database connector
description: "Connect Postgres, Supabase, MySQL, or Microsoft SQL Server to Kei with a read-only role, a DSN in your secret manager, and a group policy for query.run."
type: read-and-use
product: kei
nav_group: Make and maintain
nav_order: 19
---

# Set up a database connector

A database connector lets an agent run read-only SQL against one of your databases. Kei decides whether each query is allowed. On allow, the Kei runtime (`kei-proxy`) releases the connection string to your harness for that call, and the harness runs the query itself. Kei never connects to your database, and query results never pass through Kei.

This page covers Postgres, Supabase, MySQL, and Microsoft SQL Server. Snowflake is in preview; see [Snowflake (preview)](#snowflake-preview).

> **Release status.** The Postgres, MySQL, and Microsoft SQL Server connector templates are live in Kei, and the runtime releases their connection strings today. The steps to **create** the connector are available from the next kei CLI release. Until then, the [Connector catalog](/kei/connectors/connector-catalog) lists these connectors as not yet usable. You can do everything else on this page now: create the read-only role, store the DSN, and prepare the runtime.

## What you get

| | Postgres | Supabase | MySQL | Microsoft SQL Server |
| --- | --- | --- | --- | --- |
| Connector template | `postgres` | `postgres` | `mysql` | `mssql` |
| Query dialect | `DIALECT_POSTGRES` | `DIALECT_SUPABASE` | `DIALECT_MYSQL` | `DIALECT_MSSQL` |
| Capability | `query.run` (read) | `query.run` (read) | `query.run` (read) | `query.run` (read) |
| Credential | `dsn`, by reference | `dsn`, by reference | `dsn`, by reference | `dsn`, by reference |
| Account model | Shared | Shared | Shared | Shared |

- **Reads only.** Each connector has one capability, `query.run`, the `database.query.run` operation in the [database contract](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/database/v1/query.proto). Writes are not modelled. Kei has no write capability to grant, so the read-only database role you create below is what keeps the connection read-only.
- **Supabase is Postgres.** A Supabase database uses the `postgres` template. The harness sets the dialect to `DIALECT_SUPABASE` in the query request.
- **Shared account only.** One database role serves every user who is allowed to query the connector. Per-user database credentials are not supported yet. Kei policies decide who may run queries, and every query runs as the connector's role.

## Before you start

- A Kei runtime installed beside your harness, bootstrapped, and sending heartbeats. See [Tenant-side connector runtime](/kei/runtime/tenant-runtime).
- kei-proxy 0.8.0 or later, run as `kei-proxy serve` with `KEI_CREDENTIAL_RELEASE=identity`. Earlier releases cannot release a connection string from your secret store.
- A secret backend for the runtime (`KEI_SECRETS_BACKEND`) and read access to the secret for the runtime's cloud identity. See [Read connector secrets from your secret manager](/kei/runtime/secret-manager).
- The owner or admin role in the Kei organization, signed in with `kei login`.
- An administrator account on the database, to create the read-only role.

## 1. Create a read-only role

Create one login for the connector and grant it only what agents should read. Use a long, randomly generated password, and give the role access to a schema of reporting tables or views rather than the whole database.

The examples use a database named `analytics`, a schema named `reporting`, and a role named `kei_reader`. Replace them with your own names. `<generated password>` is a placeholder: generate the password straight into your password manager or secret manager, and never commit it.

### Postgres

Run as a role that owns the `reporting` schema:

```sql
CREATE ROLE kei_reader WITH LOGIN PASSWORD '<generated password>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Sessions start read-only, and runaway queries are stopped.
ALTER ROLE kei_reader SET default_transaction_read_only = on;
ALTER ROLE kei_reader SET statement_timeout = '30s';

GRANT CONNECT ON DATABASE analytics TO kei_reader;
GRANT USAGE ON SCHEMA reporting TO kei_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO kei_reader;

-- Tables created later in this schema by the current role are readable too.
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO kei_reader;
```

- Grant `SELECT` per schema. Avoid the predefined `pg_read_all_data` role: it can read every table in the database.
- `ALTER DEFAULT PRIVILEGES` covers only tables created by the role that runs it. If another role creates tables in `reporting`, add `FOR ROLE <that role>`.
- `default_transaction_read_only` is a second guard, not the guarantee. A session can turn it off, so the grants are what keep the role read-only.

### Supabase

Run the Postgres statements above in the Supabase SQL editor, which connects as the `postgres` role. Supabase specifics:

- Use the `public` schema or your own schema in place of `reporting`.
- Row level security still applies. `kei_reader` has no `BYPASSRLS`, so on tables with row level security turned on it sees only the rows a policy grants to it. Add a `SELECT` policy for `kei_reader` on each such table, or point the role at views that already filter the rows.
- Do not use the `service_role` key or the `postgres` role for the connector. Both bypass row level security.

### MySQL

```sql
CREATE USER 'kei_reader'@'%' IDENTIFIED BY '<generated password>' REQUIRE SSL;

GRANT SELECT ON analytics.* TO 'kei_reader'@'%';

-- Optional: cap concurrent connections from the harness.
ALTER USER 'kei_reader'@'%' WITH MAX_USER_CONNECTIONS 5;
```

- Replace `'%'` with the harness's host or network range when you can, for example `'kei_reader'@'10.0.%'`.
- For a narrower grant, use `GRANT SELECT ON analytics.orders TO 'kei_reader'@'%';` per table, or grant on views.
- Grant `SELECT` only. Do not grant `FILE`, `PROCESS`, `SUPER`, or any write privilege.

### Microsoft SQL Server

On SQL Server, create a login on the server and a user in the database:

```sql
-- In master
CREATE LOGIN kei_reader WITH PASSWORD = '<generated password>', CHECK_POLICY = ON;

-- In the database the agents read
USE analytics;
CREATE USER kei_reader FOR LOGIN kei_reader;
ALTER ROLE db_datareader ADD MEMBER kei_reader;
```

- `db_datareader` can read every table in the database. To limit it to one schema, skip the role and grant on the schema instead: `GRANT SELECT ON SCHEMA::reporting TO kei_reader;`
- On Azure SQL Database, create a contained user in the database instead of a login: `CREATE USER kei_reader WITH PASSWORD = '<generated password>';`, then grant as above.
- Do not add the user to `db_datawriter`, `db_owner`, or `db_ddladmin`.

## 2. Build the connection string

The connector stores one secret field, `dsn`: the connection string your harness's database driver opens. Kei does not parse or rewrite it. The runtime releases it to the harness exactly as stored, so write it in the format your driver expects. Always turn on TLS.

| Database | Common format (URL) | Drivers that accept it |
| --- | --- | --- |
| Postgres | `postgres://kei_reader:<password>@db.example.com:5432/analytics?sslmode=verify-full` | libpq, pgx (Go), psycopg (Python), node-postgres |
| Supabase | `postgres://kei_reader.<project ref>:<password>@<pooler host>:6543/postgres?sslmode=require` | The same Postgres drivers |
| MySQL | `kei_reader:<password>@tcp(db.example.com:3306)/analytics?tls=true` | go-sql-driver/mysql (Go) |
| MySQL | `mysql://kei_reader:<password>@db.example.com:3306/analytics`, plus your driver's TLS option | URL-style drivers, such as mysql2 (Node) |
| Microsoft SQL Server | `sqlserver://kei_reader:<password>@db.example.com:1433?database=analytics&encrypt=true` | go-mssqldb (Go) |
| Microsoft SQL Server | `Server=db.example.com,1433;Database=analytics;User Id=kei_reader;Password=<password>;Encrypt=True;` | ADO.NET-style drivers, such as Microsoft.Data.SqlClient and ODBC |

- URL-encode special characters in the password (`@`, `:`, `/`, `?`, `#`, `%`) in URL formats.
- For Supabase, copy the pooler connection string from the project's **Connect** dialog and replace the user and password with `kei_reader` and its password. Use the session pooler (port 5432) or the transaction pooler (port 6543), whichever your driver supports.
- The connection string must be between 8 and 4096 characters long.
- `<password>`, `<project ref>`, and `<pooler host>` are placeholders. Never paste a real connection string into a ticket, a chat, or a command-line argument.

## 3. Choose where the connection string lives

The runtime reads the DSN from its one secret backend. Kei never stores or shows the value. There are two ways to get it there:

- **You store it (recommended when you already manage secrets).** Put the DSN in your secret manager yourself, then create the connector with `--credential-ref` and the secret's name. The DSN never passes through the kei CLI.
- **The kei CLI delivers it.** Give the DSN to `kei connectors create`. The CLI seals it to the workspace's runtimes before it sends anything, and `kei-proxy credential sync` writes it into the runtime's secret store. This needs a credential store and a runtime with a credential-sync key; see [Tenant-side connector runtime](/kei/runtime/tenant-runtime).

To store it yourself:

1. Create the secret in AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager as a text secret holding the DSN. Write it from your password manager or a pipe, not from a value typed on the command line.
2. Grant the runtime's identity read access to that one secret.
3. Note the secret's name for the next step, for example `analytics-ro-dsn` (AWS and Azure) or `projects/example-project/secrets/analytics-ro-dsn` (GCP).

The backend settings, IAM statements, and the reference format for each cloud are on [Read connector secrets from your secret manager](/kei/runtime/secret-manager).

## 4. Create the connector

> **Available from the next kei CLI release.** The `postgres`, `mysql`, and `mssql` providers arrive in the next kei CLI release. Earlier releases reject them with `--provider must be one of …`. Run `kei connectors create --help` and look for the database providers before you start.

### With the CLI

If the DSN is already in your secret manager, pass the secret's name:

```bash
kei connectors create \
  --workspace my-workspace \
  --provider postgres \
  --name analytics-ro \
  --credential-ref analytics-ro-dsn
```

To have the CLI deliver the DSN, leave out `--credential-ref`. The CLI reads the DSN in one of three ways:

```bash
# 1. From a prompt that does not echo what you type
kei connectors create --workspace my-workspace --provider postgres --name analytics-ro

# 2. From one line on stdin, piped straight from your secret manager
<secret-manager read> | kei connectors create --workspace my-workspace --provider mysql --name orders-ro

# 3. From a file, for example one your secret manager mounts
kei connectors create --workspace my-workspace --provider mssql --name finance-ro --secret-file ./finance-ro.dsn
```

- `--provider` is `postgres`, `mysql`, or `mssql`. Supabase uses `postgres`.
- The DSN is never accepted as a flag. `--set dsn=…` is rejected, and the error does not repeat the value. `--secret-file` cannot be combined with `--credential-ref`.
- The CLI checks the DSN's length before it sends anything, then seals it to the workspace's runtimes. The value never appears in its output.
- The account model is shared. You can pass `--account-model shared`, but you do not need to. `--account-model per_user` is rejected before anything is sent.
- The connector's capability is `query.run`, the only one these providers offer.
- `--name` becomes the connector's slug, which policies use as `connector:<slug>`. The slug cannot be changed after creation.
- By default, creating the connector also allows the `admins` group to use it. Pass `--no-default-access` to grant access only through the policy in step 5.
- Delete a `--secret-file` once the connector is created, unless your secret manager owns that file.

### In the console

The console's **Add Connector** gallery does not list the database providers yet. Use the kei CLI until a console update adds them.

### Check it is active

The connector starts as `pending`. On the runtime, run credential sync with the same `KEI_RUNTIME_STATE_DIR` as `kei-proxy serve`:

```sh
kei-proxy credential sync | jq '.external_refs'
```

After the next heartbeat, the connector shows as connected:

```sh
kei connectors list --workspace my-workspace
```

If it stays `pending`, see the troubleshooting table on [Read connector secrets from your secret manager](/kei/runtime/secret-manager#troubleshooting).

## 5. Grant `query.run` to a group

A connector does nothing until a policy allows a group to use it. Policy sources are groups (`group:<name>`, or `autogroup:member` and `autogroup:admin`), never individual email addresses.

```bash
kei policy create \
  --workspace my-workspace \
  --group analysts \
  --allow "connector:analytics-ro"
```

The connector's only capability is `query.run`, so allowing the connector allows read queries and nothing else. To keep some people out, add a deny. Any matching deny wins over every allow:

```bash
kei policy create \
  --workspace my-workspace \
  --group contractors \
  --deny "connector:analytics-ro"
```

Check the decision before an agent depends on it:

```bash
kei policy test "connector:analytics-ro" --workspace my-workspace --as group:analysts
```

For temporary access for one person, use an access grant with an expiry instead of a new policy. See [Grant a connector](/kei/connectors/grant-a-connector) and [How Kei decides](/kei/reference/how-kei-decides).

## What the harness does

The harness never stores the DSN. For each query:

1. **Authorize.** The harness asks `kei-proxy serve`, over its owner-only Unix socket, for the connector's credential with `POST /v1/credentials:release`, naming the connector, the `query.run` capability, and the registered connector tool making the call. The runtime decides locally against the workspace's policy bundle.
2. **Credential released.** Only on allow, and only for a shared connector, the runtime reads the DSN from your secret store and returns it in the response. A tenant-stored DSN has no expiry, so the harness asks again for every query. On deny, the response carries a reason code and no credential.
3. **The harness runs the SQL.** It opens a connection with its own driver, runs the statement with positional bind parameters, and stops reading at its row limit. Kei never sees the statement's results.
4. **Typed result.** The harness returns a `RunQueryResponse` from the [database contract](https://github.com/HaikeiLabs/kei-connector-contracts/blob/main/proto/kei/connectors/database/v1/query.proto): `columns` (name and engine type), `rows` in column order, and `truncated` when the row limit cut the result short.

The request it answers is a `RunQueryRequest`: `dialect`, `sql`, positional `params`, and an optional `max_rows`. Generated Go, Python, TypeScript, and Rust types for both messages come from the contracts repository.

Audit records the decision and whether a credential was released. They never hold the DSN, the SQL results, or the secret's name.

| Denial reason code | What it means |
| --- | --- |
| `credential_unavailable` | The runtime could not read the secret: credential sync has not found it yet, the runtime lacks read permission, or the name is wrong. |
| `account_model_not_supported` | The connector is not shared. Database connectors are shared only. |
| `credential_source_not_supported` | The request was not tied to a registered connector tool, or this runtime release cannot release tenant-stored credentials. |

## Snowflake (preview)

> **Preview.** The Snowflake connector template ships with a catalog update that is in review. Until it is live, you cannot create a Snowflake connector. You can prepare the Snowflake side now.

Snowflake uses key-pair authentication against the [Snowflake SQL API v2](https://docs.snowflake.com/en/developer-guide/sql-api/index), not a DSN. Kei keeps the service user's private key in your secret store. On allow, the runtime releases the key to the harness, and the harness mints a short-lived JWT and calls Snowflake itself. The private key never reaches Kei.

### Create the service user, role, and warehouse

Generate the key pair. The Agentware helper does not accept passphrase-protected keys, so create an unencrypted PKCS#8 key and move it straight into your secret manager:

```sh
openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -nocrypt -out kei_svc_key.p8
openssl rsa -in kei_svc_key.p8 -pubout -out kei_svc_key.pub
```

Store `kei_svc_key.p8` in your secret manager, then delete the local file. Keys must be RSA with at least 2048 bits.

In Snowflake, create a read-only role, an X-Small warehouse that suspends itself, and a service user that signs in with the public key:

```sql
USE ROLE SYSADMIN;
CREATE WAREHOUSE KEI_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;

USE ROLE SECURITYADMIN;
CREATE ROLE KEI_READER;
GRANT USAGE ON WAREHOUSE KEI_WH TO ROLE KEI_READER;
GRANT USAGE ON DATABASE ANALYTICS TO ROLE KEI_READER;
GRANT USAGE ON SCHEMA ANALYTICS.REPORTING TO ROLE KEI_READER;
GRANT SELECT ON ALL TABLES IN SCHEMA ANALYTICS.REPORTING TO ROLE KEI_READER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA ANALYTICS.REPORTING TO ROLE KEI_READER;

USE ROLE USERADMIN;
CREATE USER KEI_SVC
  TYPE = SERVICE
  DEFAULT_ROLE = KEI_READER
  DEFAULT_WAREHOUSE = KEI_WH
  RSA_PUBLIC_KEY = '<public key body without the BEGIN and END lines>';

USE ROLE SECURITYADMIN;
GRANT ROLE KEI_READER TO USER KEI_SVC;
```

- `TYPE = SERVICE` means the user cannot sign in with a password or through the browser.
- Grant `SELECT` only. Do not grant `OWNERSHIP`, `INSERT`, `UPDATE`, or `DELETE`.
- Check the key: `DESC USER KEI_SVC;` shows `RSA_PUBLIC_KEY_FP`, which equals `openssl rsa -pubin -in kei_svc_key.pub -outform DER | openssl dgst -sha256 -binary | base64` with a `SHA256:` prefix.

### What the harness needs

The Agentware Snowflake helper (`connectors/snowflake` in Go, `haikeilabs.agentware.connectors.snowflake` in Python, `snowflakeJwt` in TypeScript) mints the JWT from three inputs:

| Input | Example | Secret? |
| --- | --- | --- |
| Account identifier | `MYORG-MYACCOUNT` (organization form, with a hyphen) or an account locator such as `XY12345` | No |
| User | `KEI_SVC` | No |
| Private key | The unencrypted PKCS#8 or PKCS#1 PEM | Yes: keep it in your secret store |

The helper upper-cases the account and user and caps the token's lifetime at one hour. It makes no network calls. Pass the account as `ORG-ACCOUNT`, not `ORG.ACCOUNT`, and never as a `snowflakecomputing.com` host name.

How these inputs are laid out in the stored secret is set by the Snowflake connector template. This section will name the secret's fields when the template ships.

The harness then calls `POST https://<account>.snowflakecomputing.com/api/v2/statements` with `Authorization: Bearer <token>` and `X-Snowflake-Authorization-Token-Type: KEYPAIR_JWT`, with the warehouse and role in the request body, and returns a `RunQueryResponse` with the dialect `DIALECT_SNOWFLAKE`.

## Learn more

- [Connector catalog](/kei/connectors/connector-catalog): which connectors are usable today
- [Connector authentication](/kei/connectors/connector-auth): how `secret_ref` and service-principal keys work
- [Read connector secrets from your secret manager](/kei/runtime/secret-manager): backends, permissions, and troubleshooting
- [Grant a connector](/kei/connectors/grant-a-connector): policies, denies, and testing access
