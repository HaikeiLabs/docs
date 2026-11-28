---
id: build-one
num: 8
title: "How do you build your own agent eval?"
seo_title: "How do you build and export your own agent eval?"
description: "Build an agent eval suite in the Haikei Playground, run it on a practice agent, and export the suite as one JSON file you can run with your own model."
mins: 4
updated: 2026-11-27
lede: "In the Playground you write cases for a practice agent, run them and export the suite as one JSON file. To run that file at home, you need the Agentware eval runner and a model profile."
quiz:
  q: You exported a suite. What do you need to run it at home?
  opts:
    - The Agentware eval runner and a model profile for your model
    - Nothing else, the file runs by itself
    - The Playground open in a browser
    - A copy of the Playground's API key
  a: 0
  why: The suite holds the prompt, tools and cases. The runner calls a model, so it needs a profile that points at your own model server.
finish: true
---

## Build, run and export a suite

Now you write your own cases. In the Playground you pick a practice agent: the support assistant from this course, with `lookup_order`, `refund_order` and `search_faq` as mock tools and a few seeded orders. You write a case per situation, with the prompt and what to expect, and a JSON pane shows the exact file as you type. Then you run the cases on a scripted model or a live one and read which check failed and why.

When the suite does what you want, you export it. The export is one `agentware.eval-suite.v1` file like the one below: [[1]] the format name, [[2]] the system prompt the agent reads, [[3]] the tools with their JSON schemas, and [[4]] the cases, written the same way as in Lesson 2.

To run it at home, you need two things besides the file. The first is the Agentware eval runner, which calls the model, grades each case and exits 0, 1 or 2 like the gate in Lesson 7. Until the runner ships as a package, clone the Agentware repository and run `python -m evals.main` from its `python` folder. The second is a **model profile** that points at your own OpenAI-compatible model server. The export names only the environment variable that holds the server's URL, never a URL or a key.

```json title="playground.support-assistant.json" marks="2=1;5=2;6=3;23=4"
{
  "schema": "agentware.eval-suite.v1",
  "suite": "playground.support-assistant",
  "kind": "agent",
  "system_prompt": "You are a tiny support agent. Use lookup_order for status questions. Never invent an order id.",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "lookup_order",
        "description": "Look up the status of a customer order.",
        "parameters": {
          "type": "object",
          "properties": {
            "order_id": {"type": "string", "description": "Order id, e.g. 'ORD-123'"}
          },
          "required": ["order_id"]
        }
      }
    }
  ],
  "repeats": 1,
  "cases": [
    {
      "id": "status-passes-id-as-given",
      "prompt": "Check the status of order 'pending-9'.",
      "expect": {"tool": "lookup_order", "args": {"order_id": "pending-9"}}
    }
  ]
}
```
