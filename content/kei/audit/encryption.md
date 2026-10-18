---
title: Audit tool-argument encryption
type: read-and-use
product: kei
---
# Audit tool-argument encryption

Audit-args encryption protects the content of governed tool calls with age encryption and customer-held X25519 keys. It is opt-in for each organization. Kei stores no customer private key, and the console never decrypts audit arguments.

## What is encrypted

Only the content of the call (tool/skill invocation arguments and payload: code body, script, prompt text passed to a skill) is encrypted. The tool/skill name, the decision (permit/deny/ask), the harness/agent/installation ids, timestamps, outcome/exit code, `args_digest`, and key ids are never encrypted; they stay plaintext and queryable.

The record list can therefore be searched by tool name and decision while argument content remains protected. The console displays whether each record is encrypted to one or more key ids or is digest-only. It does not display ciphertext or offer decryption.

## Opt in with a customer key

Encryption is off until the organization has registered at least one active customer key. Generate an age identity locally with `kei audit keys create`. By default, the CLI writes the private identity to `~/.config/kei/audit-identity.txt` with file mode `0600`; it uploads only the public key and does not print the private key. Register the printed `age1…` public key in **Settings → Audit encryption** with a name you will recognize.

Kei encrypts each new call's arguments to every active recipient. Keep the private identity backed up and protected: a record encrypted to a key can only be decrypted with that private identity. Disable a key when it should receive no new records. Disabling is permanent; the key remains listed so older records can identify their recipient. Disabling the last active customer key turns encryption off for new records. Older records retain their recipient key ids.

Use `kei audit keys list` to inspect registered keys and `kei audit keys disable` to disable a key. Decrypt a record locally with `kei audit decrypt --record ID --identity PATH`; choose an output file with `--out FILE`. The CLI writes to stdout only when explicitly requested with `--stdout`. The private key and decrypted arguments remain under customer control.

## Rotate a key

Create and register the replacement key before disabling the old key. Records are encrypted to all active recipients when they are written, so records written during the overlap can name both keys. After the old key is disabled, new records use the remaining active key recipients. Records written before rotation stay encrypted to their original key ids; decrypt them with the corresponding old private key. Disabling a key does not re-encrypt past records, so keep the old private identity protected for as long as those records need to remain readable.

## Digest-only records

When no active customer key exists, the runtime does not store arguments or payloads. The record carries an `args_digest` and `digest_key_id` only. The digest has the form `hmac-sha256:` followed by a hex HMAC-SHA-256 value over the canonical arguments JSON. It groups repeated calls and cannot be reversed. The digest key is per organization, held by Kei, and KMS-wrapped.

## Kei escrow

Escrow is off by default and can only be enabled while at least one active customer key exists. When enabled, Kei adds its escrow recipient alongside customer recipients; the private key is held by Kei in KMS-wrapped form. Escrow decryption is a later capability and is not available from the console.

## Manage keys

Open **Settings → Audit encryption** to register a public key, review active and disabled keys, or disable an active key. The browser checks that a key starts with `age1`; the catalog validates that it parses as an age X25519 recipient. Never paste a private identity into the console. See [Audit logs](/content/kei/audit/logs.html) for record fields and retention.

The console uses `GET` and `POST /api/v1/organizations/{org}/audit-encryption-keys` to list and register keys, `GET /api/v1/organizations/{org}/audit-encryption-keys/{id}` to read a key, and `POST /api/v1/organizations/{org}/audit-encryption-keys/{id}:disable` to disable one. Escrow uses `GET` and `PATCH /api/v1/organizations/{org}/settings`. The runtime retrieves recipient public keys from `GET /api/v1/runtime/audit-encryption-recipients` using its installation token.
