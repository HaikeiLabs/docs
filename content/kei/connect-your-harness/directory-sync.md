---
title: Sync an Entra security group to Kei
type: read-and-use
product: kei
nav_group: Make and maintain
nav_order: 10
---
# Sync an Entra security group to Kei

This runbook configures one Microsoft Entra security group as a Kei group and syncs its direct user members into a Kei organization. You need an Entra administrator who can grant tenant-wide admin consent and a Kei organization admin.

The sync reads one group by its Entra object ID. It includes direct user members only: nested groups are not expanded, and devices, service principals, and other non-user members are ignored. The Kei group uses the Entra group's display name. Synced users receive an identity source of `entra` and an identity value of `<tenant-id>/<user-object-id>`.

## 1. Register a read-only Entra application

In the Microsoft Entra admin center, create an app registration for the directory sync. Use a customer-managed name such as `Directory sync for <organization>`. The registration creates an enterprise application (service principal) in the tenant.

Under **API permissions**, add these **Microsoft Graph → Application permissions**:

- `GroupMember.Read.All`
- `User.Read.All`

`GroupMember.Read.All` lets the sync read the group and its direct members. `User.Read.All` lets it read the user fields needed to create Kei users when `--create-users=true`: `mail`, `userPrincipalName`, `displayName`, `givenName`, `accountEnabled` and `userType`. The group-membership mode does not need `Application.Read.All`; that permission is only used by app-role mode.

Grant admin consent for both application permissions and confirm that each shows consent granted. These are application permissions, so they run without a signed-in user. All permissions are read-only; do not add delegated permissions or write permissions.

The group mode calls `GET /groups/{id}` and `GET /groups/{id}/members`. The latter is direct, not transitive. When creating users, it also reads their profile fields through Microsoft Graph. `Application.Read.All` is not needed for this mode.

Record these values from Entra:

- **Tenant ID** from the tenant overview.
- **Application (client) ID** from the app registration. This is the sync application's client ID.
- **Object ID** of the security group to sync. This is the `--group-id` value; it is different from the group's display name.

## 2. Add a federated credential to the sync app

The bridge signs in to Entra with a federated credential. It uses a short-lived, automatically rotated token; no client secret is created or shared.

1. On the sync app registration, go to **Certificates & secrets → Federated credentials → Add credential**.
2. Choose **Kubernetes accessing Azure resources** (or **Other issuer**).
3. Enter these values:

   | Field | Value |
   |---|---|
   | Cluster issuer URL | `https://oidc.eks.us-east-1.amazonaws.com/id/7AD200EBD688652018CBF106B042AD88` |
   | Namespace | `kei` |
   | Service account | `oidc-bridge` |
   | Subject identifier | `system:serviceaccount:kei:oidc-bridge` |
   | Audience | `api://AzureADTokenExchange` |

   With **Other issuer**, enter the issuer URL, subject and audience directly.
4. Do not create a client secret.

## 3. Configure the Kei directory sync

Install a kei-cli version that supports `--group-id` and sign in as an organization admin. Set the tenant, sync app, and group IDs. The default is dry run; state it explicitly for the first configuration:

```bash
kei directory-sync set \
  --tenant-id <tenant-id> \
  --client-id <sync-app-client-id> \
  --group-id <entra-security-group-object-id> \
  --dry-run=true \
  --create-users=true
```

`--group-id` selects security-group membership and is mutually exclusive with `--app-id`, which selects app-role assignments. These commands do not include `--app-id`.

Enable the sync while it is still in dry-run mode, then inspect its report:

```bash
kei directory-sync enable
kei directory-sync report
```

Review the proposed group and user changes, confirm the group name and membership, and resolve any reported errors before writing changes. The direct members returned by Entra can include other object types; only user objects are imported. Each imported user's identity source is `entra`, with the value `<tenant-id>/<user-object-id>`.

## 4. Apply changes and keep membership current

After approving the dry-run report, ask Haikei to enable live mode for your organization. Haikei enforces dry run for every organization until live mode is enabled, so turning off dry run alone does not make writes happen. Once live mode is enabled, turn off dry run and enable revocation so removals from Entra remove the corresponding Kei group memberships on a later sync:

```bash
kei directory-sync set --dry-run=false --revoke=true
kei directory-sync report
```

The bridge runs on its normal sync interval. Review reports after the first live run and periodically afterward. To pause all syncing, run:

```bash
kei directory-sync disable
```

Revocation follows the configured group's current direct user membership. Removing a user from the Entra group removes their membership from the synced Kei group; it does not delete the Kei user account.

## Troubleshooting

| Error or symptom | Cause | Fix |
|---|---|---|
| `401` or `400` with `invalid_client` | Entra rejected the federated sign-in | Check the sync app's federated credential issuer, subject and audience against step 2. |
| `403` from Microsoft Graph | The app lacks consented Graph permissions | Confirm `GroupMember.Read.All` and `User.Read.All` have tenant-wide admin consent. |
