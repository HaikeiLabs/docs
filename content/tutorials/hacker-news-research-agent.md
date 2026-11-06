---
title: Build a Hacker News research agent in TypeScript | Agentware
description: "Build an AI agent that reads today's top Hacker News stories and answers questions. About 15 minutes; needs Node 22.18+ and an OpenAI-compatible API key."
type: read-and-use
product: agentware
nav_group: Start here
nav_order: 3
---

# Build a Hacker News research agent

In this tutorial you build an AI agent that reads today's top Hacker News stories and answers questions about them. The agent uses one tool to fetch the titles and URLs of the top five stories, checks every tool call against a local policy, and prints an audit record for each call. It takes about 15 minutes. No Kei account is required.

## What you'll build

A small TypeScript agent built with the [Agentware](/agentware/build/overview) SDK:

- A model loop that answers the prompt "Summarize today's top five Hacker News stories."
- One tool, `hn_top_stories`, that fetches the top five story titles and URLs from the Hacker News API.
- A local policy that allows `hn_top_stories` and denies everything else, so a second tool call (`hn_post_comment`) is blocked before it runs.
- An `AUDIT` line for every tool call, with the tool name and the policy decision.

## Before you start

You need:

- Node 22.18 or later.
- An OpenAI-compatible API key.
- Network access to your model endpoint and to the Hacker News API.

The default model is `gpt-4o-mini`. To use another model or an OpenAI-compatible endpoint, you can set `MODEL` and `OPENAI_BASE_URL` later.

## 1. Install Haikei Skills (optional)

Haikei Skills teach your coding assistant how to work with Agentware and Kei, so it can answer questions while you build. Install them from the [Skills page](/skills/) if you want that help. You can also skip this step and follow the tutorial on its own.

## 2. Create the project

The example lives in the [Agentware repository](https://github.com/HaikeiLabs/agentware/tree/main/examples/typescript/first-agent). Clone the repository, build the SDK, and install the example:

```sh
git clone https://github.com/HaikeiLabs/agentware.git
cd agentware
cd typescript
npm ci
npm run build
cd ../examples/typescript/first-agent
npm ci
```

Then set your API key:

```sh
export OPENAI_API_KEY="your-api-key"
```

To use another model or an OpenAI-compatible endpoint, set `MODEL` and optionally `OPENAI_BASE_URL`:

```sh
export MODEL="your-model"
export OPENAI_BASE_URL="https://your-endpoint.example/v1"
```

## 3. Add the top-stories tool

The example's `agent.ts` wires the tool into the model loop. Three pieces do the work:

- An `AuditedToolClient` named `first-agent`. Its executor fetches the top-stories list from the Hacker News API, reads the first five items, and returns each story's title and URL.
- A `ToolRegistry` with one tool, `hn_top_stories`. The tool declares a name, a description, and an input schema, and its `execute` routes the call through `client.execute` so the policy check and audit happen on every call.
- An `AgentLoop` that runs the model against the registry with a `ResponseValidator` and a maximum of six iterations.

You only register `hn_top_stories` with the model. The deny path in the next step uses a tool that is not registered, which shows that the policy check happens in your code, not in the model.

## 4. Run the agent loop

```sh
npm start
```

The agent asks: "Summarize today's top five Hacker News stories." It needs network access to the model endpoint and the Hacker News API.

The run prints an `AUDIT` line for every tool call, with the tool name and the local policy decision. First the model calls `hn_top_stories`, which the policy allows, and the summary follows:

```text
AUDIT {"session_id":"","tool_name":"hn_top_stories","args":{},"decision":{"action":"allow","rule":"read-stories","reason":"Reading stories is allowed",...},...,"framework":"first-agent"}
Here are today's top five Hacker News stories: ...
```

Then the run tries `hn_post_comment` through the same client. The local policy denies it, so the tool never runs, and the deny is audited too:

```text
Now trying hn_post_comment, a tool the local policy denies:
AUDIT {"session_id":"","tool_name":"hn_post_comment","args":{"story_id":1,"text":"Nice post"},"decision":{"action":"deny","rule":"deny-comments","reason":"Only reading stories is allowed",...},...,"framework":"first-agent"}
DENIED hn_post_comment: denied by policy: Only reading stories is allowed
```

That deny is a guardrail with no Kei involved: `withPolicy` in `agent.ts` holds the rule. The comment tool is not registered with the model, so only your code can call it, and the policy still stops it.

## 5. Add your own tool

Add a tool to the registry in `agent.ts`, give it a name, description and input schema, and route its execution through `client.execute`. Add its implementation and an allow rule to the local evaluator. Try a new prompt that asks the model to use it.

## Next steps

### Add permissions and audit

The local policy in this tutorial is a guardrail you wrote and run yourself. To have Kei make the allow and deny decisions instead, add Kei policies to the agent. See [Policy and audit for Agentware SDK harnesses](/agentware/build/policy-and-audit) for how `kei-proxy` checks each tool call and records the decision in the audit log.

### Build it in Go

The same agent exists in Go: [examples/go/first-agent](https://github.com/HaikeiLabs/agentware/tree/main/examples/go/first-agent). It needs Go 1.27 or later and runs with `go run .` against any OpenAI-compatible endpoint. The loop, the `hn_top_stories` tool and the audited tool client live in `agent/agent.go`; a local rule in `agent/policy.go` denies `hn_post_comment` the same way. The example also ships a test that runs the whole loop against a fake model and a fake Hacker News API, so it needs no key and no network.

### Related tutorials

See the [tutorials index](/tutorials/) for more step by step guides.
