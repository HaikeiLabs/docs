---
title: Read connector secrets from your secret manager
description: "Let the Kei runtime (kei-proxy) read connector secrets from your own AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager. Kei stores only the name."
type: read-and-use
product: kei
nav_group: Make and maintain
nav_order: 18
---
# Read connector secrets from your secret manager

Use this page when a connector's secret, such as an API key for an `http_api` connector, already lives in your own AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager, and you want the Kei runtime (`kei-proxy`) to read it from there.

Kei never sees the secret value. The connector stores only the secret's name. The runtime looks the name up in your secret manager with its own cloud identity, and reads the value when it needs it.

The setup has five parts:

1. Pick the runtime's one secret backend with `KEI_SECRETS_BACKEND`.
2. Give the runtime's cloud identity read access to the secret.
3. Create the connector with the secret's name as its credential reference.
4. Run `kei-proxy credential sync`, which checks that the secret exists.
5. Wait for the next heartbeat, which reports the connector as active.

This page assumes the runtime is already installed, bootstrapped, and sending heartbeats. If it isn't, start with [Tenant-side connector runtime](/kei/runtime/tenant-runtime).

## Choose one backend per runtime

Each runtime install uses exactly one secret store. Set it with `KEI_SECRETS_BACKEND` in the runtime's environment:

| `KEI_SECRETS_BACKEND` | Secret store |
| --- | --- |
| `aws-secrets-manager` | AWS Secrets Manager |
| `azure-key-vault` | Azure Key Vault |
| `gcp-secret-manager` | GCP Secret Manager |
| unset (default) | No secret store. Every secret lookup fails closed. |

- Leave it unset only on a runtime that never reads a secret, such as a local coding harness that signs in with SSO.
- Any other value stops the runtime at startup with an error that names the value.
- The runtime builds only the backend you name. It cannot read a secret from a second cloud. If your secrets live in two clouds, run one runtime per cloud.

## AWS Secrets Manager

**Environment**

```text
KEI_SECRETS_BACKEND=aws-secrets-manager
AWS_REGION=us-east-1
```

The runtime uses the AWS SDK default credential chain and its default region. It looks up a bare secret name in that region, so the secret must be in the same region as the runtime's default (for example, `AWS_REGION`).

**Identity**

Run the runtime with a role, not static keys: IRSA on EKS, an ECS task role, or an EC2 instance role. The default chain picks it up.

**Permissions**

The runtime checks and reads the secret with `GetSecretValue`. Grant only that action, on only the secrets the runtime needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:crm-api-key-*"
    }
  ]
}
```

- The `-*` suffix matches the six random characters AWS adds to every secret ARN.
- If the secret is encrypted with a customer managed KMS key, AWS also requires `kms:Decrypt` on that key. The default AWS managed key needs no extra grant.
- Store the value as a text secret (`SecretString`). The runtime treats a secret with no text value as not found.

## Azure Key Vault

**Environment**

```text
KEI_SECRETS_BACKEND=azure-key-vault
KEI_SECRETS_AZURE_VAULT_URL=https://example-vault.vault.azure.net
AZURE_CLIENT_ID=<client ID of a user-assigned managed identity>
```

- `KEI_SECRETS_AZURE_VAULT_URL` is the vault's origin only: `https://<vault>.vault.azure.net`, with no path. The runtime builds `<vault URL>/secrets/<name>` from it.
- While `KEI_SECRETS_AZURE_VAULT_URL` is unset, the runtime cannot resolve any secret name. `kei-proxy credential sync` prints one warning naming the variable, and the connector stays `pending`.

**Identity**

The runtime authenticates with `DefaultAzureCredential`. In Azure, use a managed identity or AKS workload identity. With a user-assigned managed identity, set `AZURE_CLIENT_ID` to that identity's client ID so the credential picks the right one.

**Permissions**

The runtime checks and reads the secret with the Key Vault `GetSecret` operation. Grant the built-in **Key Vault Secrets User** role, scoped to the secret (or to the vault, if the runtime needs several secrets):

```sh
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id 00000000-0000-0000-0000-000000000000 \
  --assignee-principal-type ServicePrincipal \
  --scope "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/example-rg/providers/Microsoft.KeyVault/vaults/example-vault/secrets/crm-api-key"
```

If the vault uses access policies instead of Azure RBAC, grant the identity the **Get** secret permission only.

## GCP Secret Manager

**Environment**

```text
KEI_SECRETS_BACKEND=gcp-secret-manager
```

**Identity**

The runtime uses Application Default Credentials. On GKE, use workload identity so the pod's service account is used directly. Set `GOOGLE_APPLICATION_CREDENTIALS` only for local development; the runtime reads no key files of its own.

**Permissions**

The runtime checks and reads the secret with `AccessSecretVersion` on the latest version. Grant `roles/secretmanager.secretAccessor` on each secret, not on the project:

```sh
gcloud secrets add-iam-policy-binding crm-api-key \
  --project example-project \
  --member "serviceAccount:kei-runtime@example-project.iam.gserviceaccount.com" \
  --role roles/secretmanager.secretAccessor
```

## Enter the credential reference

When you create the connector, the credential reference is the secret's **name**, never its value:

| Backend | What to enter | Example |
| --- | --- | --- |
| `aws-secrets-manager` | The secret name | `crm-api-key` |
| `azure-key-vault` | The secret name: 1–127 letters, digits, and dashes | `crm-api-key` |
| `gcp-secret-manager` | The full resource name | `projects/example-project/secrets/crm-api-key` |

- Do not add a URL or a scheme such as `https://` or `aws-secrets-manager://`. Kei rejects a reference with a scheme.
- For GCP, the runtime reads the latest version.

```bash
kei connectors create \
  --name crm \
  --provider http_api \
  --base-url https://crm.example.com \
  --methods GET \
  --paths "/api/leads,/api/leads/*" \
  --credential-ref crm-api-key \
  --workspace my-workspace
```

The connector starts as `pending`. It becomes `active` only after the runtime has found the secret.

## Verify

1. On the runtime, run credential sync. It needs `KEI_RUNTIME_TOKEN`, `KEI_RUNTIME_CONTROL_PLANE_URL`, `KEI_CREDENTIAL_SYNC_KEY_ID`, and `KEI_CREDENTIAL_SYNC_PRIVATE_KEY`, and must use the same `KEI_RUNTIME_STATE_DIR` as `kei-proxy serve` or `kei-proxy runtime heartbeat`:

   ```sh
   kei-proxy credential sync | jq '.external_refs'
   ```

   Sync lists the connector references for this runtime and checks that each one exists in the configured store. It reads nothing into its output: the JSON names connector IDs only, never a reference or a value.

   ```json
   {
     "listed": true,
     "resolved_connector_ids": ["5f0c2a1e-8d4b-4c7a-9b1e-2f6d3a4c5b7e"]
   }
   ```

   A connector under `unresolved_connector_ids` was not found or could not be read. See the table below.

2. The next runtime heartbeat reports each resolved connector, and Kei moves it from `pending` to `active`. Check from an admin workstation:

   ```sh
   kei connectors list --workspace my-workspace
   ```

   The connector's `STATE` column changes from `pending` to `connected`. `kei connectors list --json` shows the raw `status`, `active`.

Run `kei-proxy credential sync` again after you create a connector or change its reference. A connector whose secret is no longer found drops out of the resolved list on the next sync.

## Troubleshooting

`kei-proxy credential sync` never prints why a secret could not be read, so the error can't leak the reference. To narrow it down, try the same read with your cloud's own CLI while signed in as the runtime's identity.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Connector in `unresolved_connector_ids`; the secret exists | The secret is in another region (AWS) or project (GCP), or the name is misspelled | AWS: put the secret in the runtime's default region. GCP: check the project in `projects/<project>/secrets/<secret>`. Then rerun sync. |
| Connector in `unresolved_connector_ids`; the name is right | The runtime's identity lacks read permission | Grant the permission from the backend's section above, then rerun sync. |
| Every connector unresolved | `KEI_SECRETS_BACKEND` is unset, or names a different cloud than the secrets | Set `KEI_SECRETS_BACKEND` to the store the secrets are in. A runtime reads from one backend only. |
| `credential sync failed: create secret store: …` | `KEI_SECRETS_BACKEND` has a value the runtime does not recognize | Use `aws-secrets-manager`, `azure-key-vault`, or `gcp-secret-manager`. |
| `warning: external credential refs are bare Azure Key Vault names; set KEI_SECRETS_AZURE_VAULT_URL to resolve them`; connector stays `pending` | `KEI_SECRETS_AZURE_VAULT_URL` is unset, or is not a bare `https://<vault>.vault.azure.net` origin | Set it to the vault origin with no path, then rerun sync. |
| `credential sync requires KEI_CREDENTIAL_SYNC_KEY_ID and KEI_CREDENTIAL_SYNC_PRIVATE_KEY` | The runtime has no credential-sync key | Give the runtime a sync key. Sync is the step that checks your references. |
| `"listed": false` | The control plane does not list connector references for this runtime yet | No reference is checked. Contact Haikei support. |
| Resolved in sync output, but the connector stays `pending` | The heartbeat runs with a different `KEI_RUNTIME_STATE_DIR`, or no heartbeat is running | Run sync with the same state directory as `kei-proxy serve` or `kei-proxy runtime heartbeat`, and confirm heartbeats are running. |

For runtime startup and heartbeat problems, see [Troubleshoot the runtime container](/kei/runtime/troubleshooting).
