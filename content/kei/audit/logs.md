---
title: Audit logs
type: read-and-use
product: kei
---
# Audit logs

Kei records decision and administration metadata to support review and incident investigation. The audit model is designed around NIST audit and accountability guidance; this describes product behavior and does not claim a compliance certification. See [NIST SP 800-53, Audit and Accountability controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) and the [NIST log management guide, SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final).

## Review recent activity

Open **Audit Logs** in the web app to review recent decision records and administrative events. Search the retrieved activity by action or resource, filter decision records to permit or deny, and choose the page size (25 by default, up to 200). The live database view is a short-term recent-activity window (about 30 minutes); use the durable export for investigations that need older history. The UI reads the current recent slice rather than downloading the full audit archive.

## What is recorded

Decision records include the invoking subject, delegation span, tool name, resource identifiers, policy decision, and an arguments digest. Administrative events record actions and resource metadata. agentware middleware and the tenant-side connector runtime redact records: raw credentials, provider request/response payloads, and customer documents must remain out of control-plane audit logs.

Runtime heartbeat is operational health metadata, separate from a governed tool-call decision. The audit-log aggregator derives runtime installation connectivity from heartbeat audit records. The **Runtime installations** card shows connected, unknown, never seen, or suspended state, and its **Logs** view reads lifecycle, connectivity, decision, and event records through the Logs API. A stale or absent heartbeat does not authorize an operation; policy decisions remain fail-closed. See [tenant-side runtime setup](/docs/runtime/tenant-runtime) for bootstrap and heartbeat commands.

## Encrypted and digest-only arguments

When an organization has an active customer key, call arguments and payloads are encrypted to its active recipients. With no active key, the runtime stores no arguments and records only a keyed digest. Audit rows show **Encrypted** with recipient key ids or **Digest only**. The tool or skill name, decision, actor and runtime ids, timestamps, outcome, digest, and key ids stay plaintext and queryable in either state. The console does not decrypt arguments. See [Audit tool-argument encryption](/docs/audit/encryption) to register customer keys and decrypt records locally with the administrator CLI.

## Export and retention

For durable audit history, the S3 audit export archives records through the aggregator under organization, workspace, installation, date, and record-kind partitions. Retrieve archived objects from the configured bucket using your organization's approved S3 access; the console Logs view reads the Logs API and is not a full-archive download. Archived records contain redacted audit metadata, not provider payloads or customer content. The database retains recent records for one month, only through the archive watermark; S3 objects are retained indefinitely.

- **Audit records**: archived in batches by the aggregator to S3; database retention is one month and bounded by the archive watermark.
- **S3 audit archive**: objects are retained indefinitely.

Use NIST guidance to define your own review, access, retention, and disposal policy. Kei's audit fields can support that work, but the organization remains responsible for selecting and enforcing its retention schedule.