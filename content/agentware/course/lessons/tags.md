---
id: tags
num: 4
title: "Tags: what the model actually reads"
mins: 4
lede: The model never sees your JSON. Each model family reads its own text format, with its own tags.
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

## Your JSON becomes one string

Your messages [[1]] never reach the model as JSON. The server runs the model's **chat template**, a small file shipped with the model that lays the messages out as one string [[2]]. The string ends by opening an assistant turn [[3]] for the model to continue.

Hosted APIs like Claude's do this out of sight.

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

## Same call, three formats

Each family has a **prompt format**: the text layout its chat template produces. Qwen uses **ChatML**, which wraps every message in `<|im_start|>` and `<|im_end|>`. GPT-OSS uses **Harmony**, which splits each assistant turn into channels: `analysis` for reasoning, `commentary` for tool calls, and `final` for the answer. Here is the same call in each.

[widget:compare data=compare-tags]

# Reference

## More formats

Other model families you'll meet when self-hosting.

[widget:compare data=compare-tags-more]

## Server flags for self-hosting

vLLM needs to know which format to parse. If the flag doesn't match the model, tool calls come back as plain text and `tool_calls` stays empty.

```bash title="serve.sh" marks="2=Qwen3;5=GPT-OSS;8=MiniMax M2"
vllm serve Qwen/Qwen3-8B --enable-auto-tool-choice \
  --tool-call-parser hermes --reasoning-parser qwen3

vllm serve openai/gpt-oss-20b --enable-auto-tool-choice \
  --tool-call-parser openai --reasoning-parser openai_gptoss

vllm serve MiniMaxAI/MiniMax-M2 --enable-auto-tool-choice \
  --tool-call-parser minimax_m2 --reasoning-parser minimax_m2
```
