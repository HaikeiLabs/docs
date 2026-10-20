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

Under **API permissions**, add exactly one **Microsoft Graph → Application permission**:

- `GroupMember.Read.All`

Then select **Grant admin consent** for the tenant and confirm that the permission status shows consent granted. This is an application permission, so it runs without a signed-in user. Do not add delegated permissions or write permissions.

`GroupMember.Read.All` is read-only and covers both `GET /groups/{id}` and `GET /groups/{id}/members`. Microsoft lists it among the application permissions accepted by [Get group](https://learn.microsoft.com/en-us/graph/api/group-get?view=graph-rest-1.0); [List group members](https://learn.microsoft.com/en-us/graph/api/group-list-members?view=graph-rest-1.0) lists `GroupMember.ReadBasic.All` as the least-privileged option for listing members and `GroupMember.Read.All` as a higher-privileged read option. The latter is sufficient for both calls used by this sync. The group members endpoint is direct, not transitive.

Record these values from Entra:

- **Tenant ID** from the tenant overview.
- **Application (client) ID** from the app registration. This is the sync application's client ID.
- **Object ID** of the security group to sync. This is the `--group-id` value; it is different from the group's display name.

## 2. Configure the Kei directory sync

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

## 3. Apply changes and keep membership current

After approving the dry-run report, turn off dry run and enable revocation so removals from Entra remove the corresponding Kei group memberships on a later sync:

```bash
kei directory-sync set --dry-run=false --revoke=true
kei directory-sync report
```

The bridge runs on its normal sync interval. Review reports after the first live run and periodically afterward. To pause all syncing, run:

```bash
kei directory-sync disable
```

Revocation follows the configured group's current direct user membership. Removing a user from the Entra group removes their membership from the synced Kei group; it does not delete the Kei user account.
