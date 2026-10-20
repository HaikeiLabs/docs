---
title: Troubleshoot the runtime container
type: read-and-use
product: kei
---
# Troubleshoot the runtime container

For workstation heartbeat service setup and status, see [Keep your runtime online](/kei/connect-your-harness/harness-setup#keep-your-runtime-online).

Use this page when a container that runs the connector runtime (`kei-proxy`) beside your harness fails to start or never connects. Each entry lists a symptom, its root cause, the fix, and how to verify the fix. Find the entry whose symptom matches your container logs.

For the normal installation steps, see [Tenant-side connector runtime](/kei/runtime/tenant-runtime). For `kei login` and CLI authentication failures, see [Troubleshooting `kei login`](/kei/reference/cli#sign-in-troubleshooting).

For harness command-permission sync and its current limitations, see [Run your own harness with Kei permissions](/kei/connect-your-harness/harness-setup#harness-permissions).

To send a bug report from your terminal, see [Report a bug from your harness](/kei/connect-your-harness/harness-setup#report-bug-from-harness).

## Agent and model readiness

On the troubleshooting page, **Agent and model: N ready** counts agents that have completed initialization and default-policy bootstrap and are now ready. An agent moves from initializing to ready after its policies are bootstrapped. Only ready agents can authorize or resolve a model profile. If an agent is not counted, reconcile it and confirm that an active model profile is assigned to the agent. The assigned profile is delivered to the runtime through kei-proxy; the harness does not hold provider keys.

## Runtime heartbeat and audit health

The **Runtime heartbeat and audit health** panel lists the selected organization's runtime installations. Each one shows the audit-log aggregator's connectivity state:

- **Connected**: the runtime heartbeated recently.
- **Unknown**: the platform lost contact. The runtime stopped heartbeating, for example because its container stopped. Restart it and confirm that `kei-proxy runtime heartbeat` is running.
- **Never seen**: no heartbeat has arrived yet. Finish `kei-proxy runtime bootstrap` on the customer's host.
- **Suspended**: the installation is disabled or revoked.

The fleet freshness, active-installation, and aggregator-lag tiles show **Unavailable** because those metrics are not yet published to the console. If the panel shows **Runtime liveness metrics are unavailable**, the runtime-health request itself failed. See Runtime liveness panel: endpoint and validation for the endpoint contract and verification.

After the first successful heartbeat, the tenant runtime also checks the assigned model profile against its provider and reports a redacted result. This is separate from heartbeat: a connected runtime can still have an unreachable provider, rejected credential, rate limit, or unexpected provider response. The Connect step shows the result for its installation; check the provider credential in the tenant secret store and inspect the installation logs when the result is not ready.

## TLS: certificate signed by unknown authority

### Symptom

During `kei-proxy runtime bootstrap`, the container logs show:

```text
tls: failed to verify certificate: x509: certificate signed by unknown authority
```

Bootstrap fails, so the harness or Node server that should start after it never starts.

### Root cause

`node:22-slim` and other Debian `*-slim` base images do not include the `ca-certificates` package. `kei-proxy` is a Go program, and Go's `crypto/tls` verifies server certificates against the system CA bundle. Without that bundle, every HTTPS call from `kei-proxy` fails, starting with the bootstrap call to the control plane.

In a multi-stage Dockerfile, installing CA certificates in an earlier build stage does not help. The certificates must be in the final stage, where `kei-proxy` runs.

### Fix

Add this to the final stage of the Dockerfile:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
```

`kei-proxy` 0.1.10 and later falls back to built-in root certificates when the image has none, so a slim base image no longer breaks bootstrap. Installing `ca-certificates` in the final stage is still recommended: custom or enterprise CAs, such as a TLS-inspecting proxy's CA, are only trusted through the system store.

### Verify

1. Rebuild the image, then check that the CA bundle is in it:

   ```sh
   docker run --rm --entrypoint ls <image> /etc/ssl/certs/ca-certificates.crt
   ```

   The command prints the file path. A `No such file or directory` error means the package is still missing from the final stage.

2. Start the container and check its logs. Bootstrap should complete without the `x509` error, and the harness or Node server should start after it.

3. In the web app, open **Agents**, then **Installations** for the agent. The runtime installation should show status `active` and a recent heartbeat timestamp.