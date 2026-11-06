---
title: Add permissions and audit to your agent | Agentware
description: "Add Kei policies to the Hacker News agent: deny a tool, read the audit record, then let Kei decide. Needs Node 22.18+ and an OpenAI-compatible API key."
type: read-and-use
product: agentware
nav_group: Start here
nav_order: 8
---

# Add permissions and audit to your agent

In the previous tutorial you built a Hacker News research agent that checks every tool call against a policy you wrote in your code. In this tutorial you keep that agent, read the audit record it produces, and then move the allow and deny decisions from your code to Kei, so someone else can manage the policy. It takes about 15 minutes.

## What you'll build

- A local policy in the agent you built that denies a tool before it runs, with a rule name and a reason.
- An audit record for every tool call, printed as an `AUDIT` line: the tool, the arguments and the decision.
- A connection to Kei: the agent asks `kei-proxy` over a Unix socket, and Kei policies decide allow or deny.
- One allowed call and one denied call, with a machine-readable reason code and a hint on the denial.

## Before you start

Finish [Build a Hacker News research agent](/tutorials/hacker-news-research-agent) first. You keep using that project: the `first-agent` example in the [Agentware repository](https://github.com/HaikeiLabs/agentware/tree/main/examples/typescript/first-agent), with `OPENAI_API_KEY` set and Node 22.18 or later.

Steps 1 and 2 stay inside the agent you built, on your machine. Steps 3 and 4 use the [minimal-harness example](https://github.com/HaikeiLabs/agentware/tree/main/examples/typescript/minimal-harness) from the same repository. The offline run in step 4 needs no Kei account and runs on your machine. To connect to Kei for real, you need a server or container with a Kei runtime installation, a Kei organization where you are an owner or admin, and the kei CLI signed in there with `kei login` (`kei login --no-browser` on a machine without a browser). See [Bring the agent you use](/kei/get-started/bring-your-agent) for the sign-in steps.

## 1. Add a local policy that denies a tool

The agent from the previous tutorial holds its policy in code. In `agent.ts`, the `evaluate` function inside `withPolicy` decides for every tool call:

```typescript
    const allowed = name === 'hn_top_stories';
    const rule = name === 'hn_post_comment' ? 'deny-comments' : allowed ? 'read-stories' : 'deny-other-tools';
    return { action: allowed ? Action.ALLOW : Action.DENY, rule,
      reason: allowed ? 'Reading stories is allowed' : 'Only reading stories is allowed', timestamp: new Date() };
```

`Action.ALLOW` lets the call run. `Action.DENY` stops it before the tool executes, with the rule that decided and a reason for the user. The example denies two kinds of calls: `hn_post_comment` under `deny-comments`, and any other tool under `deny-other-tools`. The model never sees `hn_post_comment`, because it is not registered, so only your code can call it, and the policy still stops it.

To deny a tool of your own, add its name to `evaluate` and return `Action.DENY` with a rule and a reason.

## 2. Read the audit record

Every tool call is audited, allowed or denied. `agent.ts` creates an auditor and hands the client two functions:

```typescript
const auditor = new InMemoryAuditor();
```

```typescript
    record(record) { auditor.record(record); printAudit(record); },
    query(filter) { return auditor.query(filter); },
```

`record` keeps the audit record in memory and prints it. The printer writes one line per call:

```typescript
  printAudit: (record: AuditRecord) => void = (record) => console.log('AUDIT', JSON.stringify(record)),
```

A run prints the allow:

```text
AUDIT {"session_id":"","tool_name":"hn_top_stories","args":{},"decision":{"action":"allow","rule":"read-stories","reason":"Reading stories is allowed",...},...,"framework":"first-agent"}
```

And the deny:

```text
AUDIT {"session_id":"","tool_name":"hn_post_comment","args":{"story_id":1,"text":"Nice post"},"decision":{"action":"deny","rule":"deny-comments","reason":"Only reading stories is allowed",...},...,"framework":"first-agent"}
```

Each record shows the tool name, the arguments, the decision with its rule and reason, and the framework that made the call. `query` reads the stored records back, so your code can review the calls the agent made. The record stays in your process. When the agent talks to Kei in the next steps, every decision is also recorded in the Kei audit log.

## 3. Connect to Kei so someone else manages the policy

With `withPolicy`, the rules live in your code: you change them, you ship them. To let a policy admin manage them instead, point the same check at Kei. Kei policies are deterministic guardrails for the tool calls your agent can make: the active policy bundle decides, and the agent asks before every call. The ask goes to `kei-proxy`, the Kei runtime next to the agent, over a Unix socket.

The [minimal-harness example](https://github.com/HaikeiLabs/agentware/tree/main/examples/typescript/minimal-harness) shows the wiring. It uses the SDK you built in the previous tutorial. Install the example and typecheck it:

```sh
cd examples/typescript/minimal-harness
npm ci
npm run typecheck
```

The imports bring in the evaluator and the socket client:

```typescript
import {
  Action,
  KeiProxyEvaluator,
  selectAuthorizationClient,
} from "@haikeilabs/agentware";
import type {
  CallerContext,
  KeiProxyAuthorizeRequest,
} from "@haikeilabs/agentware";
```

The example reads the socket path, opens the client, and builds a `KeiProxyEvaluator` that sends every call to `kei-proxy authorize`:

```typescript
  const socketPath = process.env.KEI_RUNTIME_SOCKET_PATH;
  if (!socketPath) throw new Error("KEI_RUNTIME_SOCKET_PATH is required");

  const client = selectAuthorizationClient("example", { socketPath });
  let authorization: Authorization = {};
  const evaluator = new KeiProxyEvaluator({
    authorize: async (request: KeiProxyAuthorizeRequest): Promise<unknown> => {
      const response: unknown = await client.authorize(request);
      authorization = isRecord(response) ? response : {};
      return response;
    },
  }, { logger: () => undefined });
  const caller: CallerContext = {
    user_id: "local-user",
    invoking_subject: "local-user",
    trusted: false,
  };
```

`KEI_RUNTIME_SOCKET_PATH` is the path of the kei-proxy socket. The runtime token comes from `KEI_RUNTIME_TOKEN`; the agent ID is discovered from the runtime installation. The caller context names the person the call runs for, `user_id` and `invoking_subject`, and the audit record keeps that identity.

Each call then goes through the evaluator:

```typescript
    const decision = await evaluator.evaluate(tool, args, caller);
    const result = decision.action === Action.ALLOW ? echo.execute(args) : undefined;
```

This evaluator takes the place of the local `evaluate` function from step 1. The rule that denies `hn_post_comment` moves out of `agent.ts` and into a Kei policy that an admin can change without a code change.

To run the check for real, the agent runs where it is deployed: a server or a container with a Kei runtime installation, not your laptop. On that machine, create the runtime installation and register the example against it:

```sh
kei bot init
kei harness add --kind custom --installation INSTALLATION_ID
kei-proxy serve
```

Use the `installation_id` that `kei bot init` returns. If the CLI reports no assigned agent for the installation, run `kei bot agents add --installation INSTALLATION_ID --agent AGENT_ID --default` first. Register each tool so the policy bundle lists it. [Runtime setup](/agentware/build/runtime-setup) covers ToolSpec registration, group policies and audit entries. Then write the policies that allow and deny your tools; see [Create policies](/kei/policies/create-policies).

## 4. See an allowed and a denied call

Start offline, with no Kei account. The example ships a fake proxy that permits `echo`, denies `delete_everything` with separate reason code and hint fields, and prints one audit line per authorization:

```sh
npm start -- --fake
```

```text
{"tool":"echo","decision":"allow",...,"reason_code":null,"hint":null,"result":"hello"}
{"tool":"delete_everything","decision":"deny",...,"reason_code":"no_matching_policy","hint":"Add a policy for this tool: kei policies create"}
```

`echo` matches the fake's allow policy, so the tool runs and returns `hello`. `delete_everything` matches no policy, and no matching policy is a deny: the tool never runs. The `reason_code` says why, and the `hint` says what to do next. Preserve and surface both, so the user can act on the denial.

On your laptop, the offline run above is the one to use. The real run happens where the agent is deployed, on the server or container from step 3. On the server or container, set the socket path and the runtime token, then start:

```sh
export KEI_RUNTIME_SOCKET_PATH="/path/to/kei-proxy.sock"
export KEI_RUNTIME_TOKEN="your-runtime-token"
npm start
```

The same two calls run, and the decisions come from the policy bundle in your workspace. The allow carries the ID of the policy that matched, and a denial carries its reason code and hint. Every decision is recorded in the Kei audit log. Open **Audit Logs** in the [Kei console](https://app.haikeilabs.com/?source=docs-add-permissions-and-audit-audit-logs&utm_source=docs&utm_medium=docs&utm_campaign=launch-2027-01). Each record shows the time, the person who started the call (the `invoking_subject`), the agent, the tool, `permit` or `deny`, the policy that matched and, on a denial, the reason code and hint. See [Audit logs](/kei/audit/logs) for the recorded fields.

## Next steps

- [Policy and audit for Agentware SDK harnesses](/agentware/build/policy-and-audit) — how the socket check works, and what the runtime records.
- [Runtime setup](/agentware/build/runtime-setup) — installations, ToolSpec registration, group policies and audit entries.
- [Create policies](/kei/policies/create-policies) — write the allow and deny policies for your tools.
- [Audit logs](/kei/audit/logs) — the fields Kei records for every decision.
- [Bring the agent you use](/kei/get-started/bring-your-agent) — connect Claude Code or Codex to Kei and watch it allow one command and deny another.

More step by step guides are in the [tutorials index](/tutorials/).
