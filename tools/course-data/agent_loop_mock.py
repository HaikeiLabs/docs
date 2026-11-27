"""
agent_loop_mock.py — one agent loop, three wire formats, no frameworks.

The "model" is scripted so the run is deterministic, but every request we
build is exactly what you would send over HTTP:

  anthropic : POST /v1/messages        (JSON blocks; no raw tokens exposed)
  gpt-oss   : POST /v1/completions     (we render Harmony tokens ourselves)
  qwen      : POST /v1/completions     (we render Qwen3 ChatML tokens ourselves)

Run:  python agent_loop_mock.py anthropic|gpt-oss|qwen   [--json]
"""
import json
import re
import sys

# ─────────────────────────────────────────────────────────────
# 1. The tool: a plain Python function + a JSON Schema describing it
# ─────────────────────────────────────────────────────────────
def get_weather(city: str, unit: str = "celsius") -> dict:
    fake = {"Tokyo": (22, "rain"), "Seoul": (17, "clear")}
    temp_c, sky = fake.get(city, (20, "unknown"))
    temp = temp_c if unit == "celsius" else round(temp_c * 9 / 5 + 32)
    return {"city": city, "temp": temp, "unit": unit, "sky": sky}


TOOL = {
    "name": "get_weather",
    "description": "Get the current weather for a city.",
    "parameters": {  # JSON Schema
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "City name, e.g. Tokyo"},
            "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
        },
        "required": ["city"],
    },
}

REGISTRY = {"get_weather": get_weather}  # name -> callable

SYSTEM = "You are a concise weather assistant."
QUESTION = "Is it warmer in Tokyo or Seoul right now? Do I need an umbrella in either?"


def run_tool(name: str, args: dict) -> str:
    fn = REGISTRY.get(name)
    if fn is None:
        return json.dumps({"error": f"unknown tool {name}"})
    try:
        return json.dumps(fn(**args))
    except TypeError as e:  # bad arguments from the model
        return json.dumps({"error": str(e)})


# ─────────────────────────────────────────────────────────────
# 2a. ANTHROPIC — native Messages API (structured blocks)
# ─────────────────────────────────────────────────────────────
def anthropic_tools():
    return [{"name": TOOL["name"], "description": TOOL["description"],
             "input_schema": TOOL["parameters"]}]


def anthropic_request(messages):
    return {
        "model": "claude-model-id",
        "max_tokens": 1024,
        "system": SYSTEM,
        "thinking": {"type": "enabled", "budget_tokens": 2048},
        "tools": anthropic_tools(),
        "messages": messages,
    }


def anthropic_step(messages, response):
    """Append the assistant turn, run tools, append results. Returns done?"""
    messages.append({"role": "assistant", "content": response["content"]})
    if response["stop_reason"] != "tool_use":
        return True, None
    results, ran = [], []
    for block in response["content"]:
        if block["type"] == "tool_use":
            out = run_tool(block["name"], block["input"])
            ran.append({"name": block["name"], "args": block["input"], "result": out})
            results.append({"type": "tool_result", "tool_use_id": block["id"],
                            "content": out})
    # all results from one turn go back together, in ONE user message
    messages.append({"role": "user", "content": results})
    return False, ran


ANTHROPIC_SCRIPT = [
    {"id": "msg_01", "type": "message", "role": "assistant", "stop_reason": "tool_use",
     "content": [
         {"type": "thinking",
          "thinking": "Need current weather for both cities. I can call get_weather twice in parallel.",
          "signature": "EuYBCkQYAiJA...opaque..."},
         {"type": "tool_use", "id": "toolu_01A", "name": "get_weather",
          "input": {"city": "Tokyo"}},
         {"type": "tool_use", "id": "toolu_01B", "name": "get_weather",
          "input": {"city": "Seoul"}},
     ]},
    {"id": "msg_02", "type": "message", "role": "assistant", "stop_reason": "end_turn",
     "content": [
         {"type": "text",
          "text": "Tokyo is warmer (22°C vs 17°C in Seoul). Bring an umbrella in Tokyo—it's raining. Seoul is clear."}
     ]},
]


# ─────────────────────────────────────────────────────────────
# 2b. GPT-OSS — Harmony format, rendered by hand
# ─────────────────────────────────────────────────────────────
def harmony_type(prop):
    if "enum" in prop:
        return " | ".join(f'"{v}"' for v in prop["enum"])
    return {"string": "string", "number": "number", "integer": "number",
            "boolean": "boolean"}.get(prop.get("type"), "any")


def harmony_tools_block():
    p = TOOL["parameters"]
    lines = ["# Tools", "", "## functions", "", "namespace functions {", "",
             f"// {TOOL['description']}", f"type {TOOL['name']} = (_: {{"]
    for key, prop in p["properties"].items():
        if "description" in prop:
            lines.append(f"// {prop['description']}")
        opt = "" if key in p.get("required", []) else "?"
        lines.append(f"{key}{opt}: {harmony_type(prop)},")
    lines += ["}) => any;", "", "} // namespace functions"]
    return "\n".join(lines)


def harmony_render(history):
    """history: list of already-rendered message strings (assistant/tool)."""
    system = ("<|start|>system<|message|>You are ChatGPT, a large language model trained by OpenAI.\n"
              "Knowledge cutoff: 2024-06\nCurrent date: 2026-11-20\n\n"
              "Reasoning: medium\n\n"
              "# Valid channels: analysis, commentary, final. Channel must be included for every message.\n"
              "Calls to these tools must go to the commentary channel: 'functions'.<|end|>")
    developer = (f"<|start|>developer<|message|># Instructions\n\n{SYSTEM}\n\n"
                 f"{harmony_tools_block()}<|end|>")
    user = f"<|start|>user<|message|>{QUESTION}<|end|>"
    return system + developer + user + "".join(history) + "<|start|>assistant"


HARMONY_CALL = re.compile(
    r"<\|channel\|>commentary to=functions\.(\w+)\s*(?:<\|constrain\|>json)?<\|message\|>(.*?)<\|call\|>",
    re.S)
HARMONY_FINAL = re.compile(r"<\|channel\|>final<\|message\|>(.*?)(?:<\|return\|>|$)", re.S)


def harmony_step(history, completion):
    # the completion continues after "<|start|>assistant"
    call = HARMONY_CALL.search(completion)
    if call is None:
        final = HARMONY_FINAL.search(completion).group(1)
        return True, None, final
    name, args = call.group(1), json.loads(call.group(2))
    out = run_tool(name, args)
    # keep the model's own tokens (incl. analysis) while the task is unfinished
    history.append("<|start|>assistant" + completion)
    history.append(f"<|start|>functions.{name} to=assistant<|channel|>commentary"
                   f"<|message|>{out}<|end|>")
    return False, [{"name": name, "args": args, "result": out}], None


HARMONY_SCRIPT = [  # gpt-oss tends to call one function per message
    '<|channel|>analysis<|message|>Need weather for Tokyo and Seoul. Start with Tokyo.<|end|>'
    '<|start|>assistant<|channel|>commentary to=functions.get_weather <|constrain|>json'
    '<|message|>{"city":"Tokyo"}<|call|>',
    '<|channel|>analysis<|message|>Tokyo 22C rain. Now Seoul.<|end|>'
    '<|start|>assistant<|channel|>commentary to=functions.get_weather <|constrain|>json'
    '<|message|>{"city":"Seoul"}<|call|>',
    '<|channel|>analysis<|message|>Seoul 17C clear. Tokyo warmer, umbrella for Tokyo.<|end|>'
    '<|start|>assistant<|channel|>final<|message|>Tokyo is warmer (22°C vs 17°C). '
    'Take an umbrella in Tokyo—it\'s raining. Seoul is clear.<|return|>',
]


# ─────────────────────────────────────────────────────────────
# 2c. QWEN3 — ChatML + Hermes-style <tool_call> JSON, rendered by hand
# ─────────────────────────────────────────────────────────────
def qwen_render(history):
    tool_json = json.dumps({"type": "function", "function": TOOL})
    system = (f"<|im_start|>system\n{SYSTEM}\n\n# Tools\n\n"
              "You may call one or more functions to assist with the user query.\n\n"
              "You are provided with function signatures within <tools></tools> XML tags:\n"
              f"<tools>\n{tool_json}\n</tools>\n\n"
              "For each function call, return a json object with function name and arguments "
              "within <tool_call></tool_call> XML tags:\n<tool_call>\n"
              '{"name": <function-name>, "arguments": <args-json-object>}\n</tool_call><|im_end|>\n')
    user = f"<|im_start|>user\n{QUESTION}<|im_end|>\n"
    return system + user + "".join(history) + "<|im_start|>assistant\n"


QWEN_CALL = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.S)
QWEN_THINK = re.compile(r"<think>.*?</think>\s*", re.S)


def qwen_step(history, completion):
    calls = [json.loads(m) for m in QWEN_CALL.findall(completion)]
    if not calls:
        return True, None, QWEN_THINK.sub("", completion).replace("<|im_end|>", "").strip()
    history.append("<|im_start|>assistant\n" + completion + "\n")
    ran, responses = [], []
    for c in calls:
        out = run_tool(c["name"], c["arguments"])
        ran.append({"name": c["name"], "args": c["arguments"], "result": out})
        responses.append(f"<tool_response>\n{out}\n</tool_response>")
    # consecutive tool results are grouped into ONE user turn
    history.append("<|im_start|>user\n" + "\n".join(responses) + "<|im_end|>\n")
    return False, ran, None


QWEN_SCRIPT = [
    '<think>\nI need the weather in both cities. I can call get_weather for each.\n</think>\n\n'
    '<tool_call>\n{"name": "get_weather", "arguments": {"city": "Tokyo"}}\n</tool_call>\n'
    '<tool_call>\n{"name": "get_weather", "arguments": {"city": "Seoul"}}\n</tool_call><|im_end|>',
    '<think>\nTokyo 22 rain, Seoul 17 clear.\n</think>\n\n'
    'Tokyo is warmer (22°C vs 17°C). Bring an umbrella in Tokyo—it\'s raining. Seoul is clear.<|im_end|>',
]


# ─────────────────────────────────────────────────────────────
# 3. The loop — same shape for every format
# ─────────────────────────────────────────────────────────────
def loop(style, max_iters=6):
    log = []
    if style == "anthropic":
        messages = [{"role": "user", "content": QUESTION}]
        for i, resp in enumerate(ANTHROPIC_SCRIPT[:max_iters]):
            req = json.loads(json.dumps(anthropic_request(messages)))  # snapshot
            before = len(messages)
            done, ran = anthropic_step(messages, resp)
            log.append({"iteration": i + 1, "request": req, "response": resp,
                        "tools_run": ran, "done": done, "appended": messages[before:]})
            if done:
                break
    else:
        render, step, script = ((harmony_render, harmony_step, HARMONY_SCRIPT)
                                if style == "gpt-oss" else
                                (qwen_render, qwen_step, QWEN_SCRIPT))
        history = []
        # The same conversation as the OpenAI-compatible server would hold it.
        chat = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": QUESTION}]
        for i, completion in enumerate(script[:max_iters]):
            prompt = render(history)
            req = {"model": "openai/gpt-oss-20b" if style == "gpt-oss" else "Qwen/Qwen3-8B",
                   "prompt": prompt, "max_tokens": 1024,
                   "skip_special_tokens": False}
            chat_snapshot = json.loads(json.dumps(chat))
            done, ran, final = step(history, completion)
            reasoning = extract_reasoning(style, completion)
            if done:
                chat.append({"role": "assistant", "content": final,
                             "reasoning_content": reasoning})
            else:
                ids = [f"call_{i + 1}{chr(97 + k)}" for k in range(len(ran))]
                chat.append({"role": "assistant", "content": None,
                             "reasoning_content": reasoning,
                             "tool_calls": [{"id": cid, "type": "function",
                                             "function": {"name": t["name"],
                                                          "arguments": json.dumps(t["args"])}}
                                            for cid, t in zip(ids, ran)]})
                for cid, t in zip(ids, ran):
                    chat.append({"role": "tool", "tool_call_id": cid, "content": t["result"]})
            log.append({"iteration": i + 1, "request": req, "chat_request": {
                            "model": req["model"], "messages": chat_snapshot,
                            "tools": [{"type": "function", "function": TOOL}]},
                        "response": completion, "tools_run": ran, "done": done,
                        "final": final, "appended": chat[len(chat_snapshot):]})
            if done:
                break
    return log


def extract_reasoning(style, completion):
    if style == "gpt-oss":
        parts = re.findall(r"<\|channel\|>analysis<\|message\|>(.*?)<\|end\|>", completion, re.S)
    else:
        parts = re.findall(r"<think>\s*(.*?)\s*</think>", completion, re.S)
    return "\n".join(p.strip() for p in parts)


if __name__ == "__main__":
    style = sys.argv[1] if len(sys.argv) > 1 else "anthropic"
    result = loop(style)
    if "--json" in sys.argv:
        print(json.dumps(result, ensure_ascii=False))
    else:
        for it in result:
            print(f"\n══════ iteration {it['iteration']} ══════")
            r = it["request"]
            print(json.dumps(r, indent=2, ensure_ascii=False) if "messages" in r else r["prompt"])
            print("── model returned ──")
            print(json.dumps(it["response"], indent=2, ensure_ascii=False)
                  if isinstance(it["response"], dict) else it["response"])
            for t in it["tools_run"] or []:
                print(f"── ran {t['name']}({t['args']}) -> {t['result']}")
        print("\nDONE")
