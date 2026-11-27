---
id: tags
num: 4
title: "What does an LLM actually read? Chat templates and tags"
seo_title: "What does an LLM actually read? Chat templates and tags"
description: "Learn how a chat template turns your messages and tool calls into one string of text, and how Qwen3 ChatML and GPT-OSS Harmony tag tool calls differently."
mins: 4
updated: 2026-11-27
lede: "The model never sees your JSON: the server turns your messages and tools into one string of text. Each model family uses its own text format, with its own tags."
quiz:
  q: Which format splits an assistant turn into analysis, commentary and final channels?
  opts:
    - ChatML
    - Harmony
    - Anthropic Messages API
    - JSON Schema
  a: 1
  why: Harmony, used by GPT-OSS, puts reasoning, tool calls and the answer on separate channels.
---

## How does a chat template turn messages into text?

To see how Qwen3 knows who asked about the umbrella, start with the two messages your program sends [[1]]. Each has a `role` that identifies the speaker and `content` that holds the words.

A **chat template** is a set of rules for writing those messages as one string. Qwen3’s template marks the start and end of each message [[2]]. It ends with the start of an assistant turn [[3]], which tells the model whose words to write next.

```tokens title="before and after" marks="2=1;6=2;10=3"
# What you send
{"role": "system", "content": "You are a concise weather assistant."}
{"role": "user", "content": "Do I need an umbrella in Tokyo?"}

# What Qwen3 reads
<|im_start|>system
You are a concise weather assistant.<|im_end|>
<|im_start|>user
Do I need an umbrella in Tokyo?<|im_end|>
<|im_start|>assistant
```

## How do Qwen3, GPT-OSS and Claude mark a tool call?

Look for `get_weather` in each tab. Qwen3 uses a format called **ChatML**. It wraps the request in `<tool_call>` tags, and the result comes back inside `<tool_response>` tags in a user turn.

GPT-OSS uses **Harmony**, a format that labels parts of an assistant turn by purpose. These labels are called channels. `analysis` carries reasoning, `commentary` carries the call addressed to `functions.get_weather`, and `final` carries the answer.

Claude’s hosted service handles the underlying text format for you. In the Claude tab you see the JSON blocks your program exchanges with the service.

[widget:compare data=compare-tags]

# Reference

## More formats

Other model families you'll meet when self-hosting.

[widget:compare data=compare-tags-more]

## Server flags for self-hosting

vLLM, a popular open-source model server, needs to know which format to parse. If the flag doesn't match the model, tool calls come back as plain text and `tool_calls` stays empty. The labels in the margin mark each model's command. The Qwen3 parser is called `hermes` because Qwen uses the tool-call format first published with the Hermes models; `openai` is vLLM's Harmony parser for GPT-OSS, and `--reasoning-parser` does the same job for reasoning (Lesson 5).

```bash title="serve.sh" marks="2=Qwen3;5=GPT-OSS;8=MiniMax M2"
vllm serve Qwen/Qwen3-8B --enable-auto-tool-choice \
  --tool-call-parser hermes --reasoning-parser qwen3

vllm serve openai/gpt-oss-20b --enable-auto-tool-choice \
  --tool-call-parser openai --reasoning-parser openai_gptoss

vllm serve MiniMaxAI/MiniMax-M2 --enable-auto-tool-choice \
  --tool-call-parser minimax_m2 --reasoning-parser minimax_m2
```
