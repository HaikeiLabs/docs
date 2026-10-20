---
title: Connectors
type: read-and-use
product: kei
---
# Connectors

## Add, connect, and grant access {#add-connect-and-grant-access}

Connector setup starts after a connector has been added to the workspace. Open **Data Connections** in the left navigation, choose **Add Connector**, and select a built-in connector or a remote MCP template. Complete its setup form and create it. The connector then has its own setup flow; a connector must exist before its Connect screen can load.

![Connector gallery with built-in providers and a remote MCP template](/assets/images/connector-setup/connectors-gallery.png)

1. **Connect.** Open the new connector. This setup screen shows the account model and current connection status, then continues to tool review. For a shared OAuth connector, start account consent from **Data Connections → Connect OAuth** (or **Reconnect OAuth** if consent has expired); for other credential types, follow the configured tenant credential-store process. For a per-user connector, each harness user signs in from their harness or uses the kei CLI. Both entry points open the same sign-in page for that connector. The available entry point depends on the harness; see its setup guide for details. Never enter secret values in documentation or screenshots.

   ![Connector Connect step with its status and the next-step button](/assets/images/connector-setup/connector-connect.png)

2. **Approve tools.** Continue to the manifest review, inspect the tools and their descriptions, then approve the manifest when it is appropriate for your workspace.

   ![Connector tool manifest review step](/assets/images/connector-setup/connector-tools.png)

3. **Grant access.** Continue to grant access. Kei opens **Policies** with the connector selected as the destination. If the workspace has no matching policy yet, the page may show **No policies yet**; this is expected and does not mean the connector failed. Create a workspace policy for the intended principal and connector capability/tool. Access is granted only when an applicable policy permits it.

   ![Policies page reached from Grant access, showing the empty workspace policy state](/assets/images/connector-setup/grant-access-policies.png)

The setup rail links to each step so you can return to review or adjust access later. The Grant access step is complete when an applicable policy exists. For broader workspace onboarding, start with [Sign in to Kei](/kei/get-started/sign-in).

## Per-user connection {#per-user-connection}

Each harness user can sign in from their harness or use the kei CLI. Both entry points open the same sign-in page for the connector. Which entry point is available depends on the harness; follow that harness's setup guide for its sign-in steps.

## Custom MCP server fields {#custom-mcp-servers}

The connector slug cannot be changed after creation. Policies use it to name a tool, such as `mcp:billing.read_invoice`.

Use **Streamable HTTP** for a server that supports the current MCP transport. Choose **SSE** when the server requires the older HTTP+SSE transport.

The expected issuer is an advanced setting for custom OAuth servers. Set it when the authorization server uses a specific token issuer; otherwise leave it blank.

## Credential store scope {#credential-store-scope}

The organization credential store is the default for its workspaces. A workspace override takes precedence for that workspace. Removing the override returns the workspace to the organization default; disabling an override does not remove it.

## Google Drive setup

The Google Drive & Docs connector asks for these OAuth scopes:

- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/documents`
- `openid` and `email`

Connections made before this scope change keep the old read-only grant. Reconnect Google Drive in the console to grant the new scopes.

Each user connects their own Google Drive account. Kei does not store the user's access token in plain text, and the CLI never prints it.

### Who writes

Kei never writes to Drive. The harness performs a Drive write with the user's token, after `kei-proxy authorize` allows the call and the user confirms the change. The broad scopes do not decide what an agent may do: Kei policy does. Grant each agent only the Drive capabilities it needs, such as `drive.search`, `docs.read`, `drive.doc.create` or `drive.doc.update`.

Claude Code and Codex can call the Drive REST API with the user's token after confirming the intended change. Pydantic agents use `drive_create_doc` and `drive_update_doc`; the harness presents the preview and asks the user to confirm before committing the write.

## Set up Drive for your own account

Use these steps when you set up Drive and Docs access in your own Google Cloud project.

1. Create or select a GCP project.
2. Enable the Drive API and the Docs API for that project:

   ```sh
   gcloud services enable drive.googleapis.com docs.googleapis.com --project <project-id>
   ```

3. Open **Google Auth Platform → Data Access** and add the `https://www.googleapis.com/auth/drive` and `https://www.googleapis.com/auth/documents` scopes to the consent screen.
4. Choose the **Audience**:
   - **Internal** works immediately for accounts in your Google Workspace domain.
   - **External** with these restricted scopes needs Google app verification and a CASA security assessment before users outside your domain can consent.
5. For the Kei connector, create a **Web application** OAuth client and add Kei's redirect URI. Put the client ID and client secret in the connected secret manager. Never paste either value into the console UI or commit it to a repository.
6. For local tools (gcloud, scripts, Claude Code or Codex on your machine), create your own **Desktop app** client under **Credentials → Create client → Desktop app** and download its JSON file. gcloud's built-in client is blocked from the full `drive` scope ("access blocked" when it requests the scope), so local tools must use your own client:

   ```sh
   gcloud auth application-default login \
     --client-id-file=<path-to-client.json> \
     --scopes=https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/cloud-platform
   ```

   The client JSON file holds a client secret. Keep it outside every repository and never commit it.
7. Set the quota project (see [Quota project and 403 errors](#quota-project-and-403-errors)).
8. Connect Google Drive in the Kei console, or reconnect it if you connected before the scope change.

### Quota project and 403 errors

User OAuth credentials need a quota project. Configure `GOOGLE_QUOTA_PROJECT` for the harness/runtime or send it on each request with the `x-goog-user-project` header. If Drive returns a 403 requiring a quota project or reports `SERVICE_DISABLED`, set the quota project and enable the Drive API in that project:

```sh
gcloud auth application-default set-quota-project <project-with-Drive-API>
```

When making API calls, include `x-goog-user-project: <project-id>`.

## Find a Google shared drive ID

Open the shared drive under **Shared drives** in Google Drive. Its ID is the last segment of its URL. For example, `https://drive.google.com/drive/u/1/folders/0AExampleSharedDrive01` has the shared drive ID `0AExampleSharedDrive01`.

Shared drive IDs start with `0A`. Folder IDs inside a drive usually start with `1`; they identify folders and are not shared drive IDs.

The URL `https://drive.google.com/drive/u/0/my-drive` opens **My Drive**, which has no shared drive ID. Leave the Drive ID field blank to use My Drive and every shared drive the signed-in user can access.

The `/u/N/` segment identifies a Google account in the browser. At OAuth consent, choose the same account whose Drive URL you used.
