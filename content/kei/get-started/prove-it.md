---
title: Prove access with an allow and a deny
type: read-and-use
product: kei
nav_group: Get started
nav_order: 6
---

# Prove access with an allow and a deny

Use the connected agent to make two safe test requests: one the group is allowed to make and one it is not allowed to make. Choose test data that is safe to access. A denied request should stop before the external operation runs.

Open **Audit Logs** and confirm both requests have a decision record. Check the actor, operation, resource, and decision. Audit records contain redacted metadata; keep credentials and customer data in your environment.

## Check it worked

You can find one allow and one deny for the agent in Audit Logs. If a request is denied unexpectedly, check workspace selection, group membership, the applicable policy, and [runtime troubleshooting](/kei/runtime/troubleshooting).
