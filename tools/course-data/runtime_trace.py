"""Record a real Agentware 0.17.0 runtime trace for the debugger lesson.

The model is scripted; everything else is the SDK: run_inference (reasoning
adapter + ResponseValidator + retry nudges) and AuditedToolClient (policy + audit).
"""
import asyncio
import json

from haikeilabs.agentware.llm import Message
from haikeilabs.agentware.llm.request import Role, ToolDefinition
from haikeilabs.agentware.llm.response import Response, ToolCall
from haikeilabs.agentware.middleware import (Action, AuditedToolClient, CallerContext, Decision)
from haikeilabs.agentware.middleware.guardrails.response_validator import ResponseValidator
from haikeilabs.agentware.middleware.inference import InferenceConfig, run_inference
from haikeilabs.agentware.reasoning import ReasoningAdapter

EVENTS = []
def ev(kind, **kw):
    EVENTS.append({"kind": kind, **kw})

def msg_json(m):
    d = {"role": m.role.value, "content": m.content}
    if m.tool_calls:
        d["tool_calls"] = [{"id": t.id, "name": t.name, "arguments": t.arguments} for t in m.tool_calls]
    if m.tool_call_id:
        d["tool_call_id"] = m.tool_call_id
    if m.meta and getattr(m.meta, "type", None) and m.meta.type.value != "":
        d["meta"] = m.meta.type.value
    return d

# ── tools and policy ──────────────────────────────────────────
def get_weather(city):
    return {"Tokyo": {"temp": 22, "sky": "rain"}, "Seoul": {"temp": 17, "sky": "clear"}}[city]

def post_to_slack(channel, text):
    return {"ok": True}

def final_answer(text):
    return {"delivered": True}

FUNCS = {"get_weather": get_weather, "post_to_slack": post_to_slack, "final_answer": final_answer}
SPECS = [ToolDefinition(name=n, description=d, input_schema=s) for n, d, s in [
    ("get_weather", "Get the current weather for a city.",
     {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}),
    ("post_to_slack", "Post a message to a Slack channel.",
     {"type": "object", "properties": {"channel": {"type": "string"}, "text": {"type": "string"}}, "required": ["channel", "text"]}),
    ("final_answer", "Give the user the final answer and end the task.",
     {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]})]]

class LocalPolicy:
    RULES = {"get_weather": ("read-weather", Action.ALLOW, "Reading weather is allowed"),
             "final_answer": ("answer-user", Action.ALLOW, "Answering the user is allowed"),
             "post_to_slack": ("no-posting", Action.DENY, "Posting to Slack needs a person to approve it")}
    def evaluate(self, tool_name, args, caller):
        rule, action, reason = self.RULES.get(tool_name, ("default-deny", Action.DENY, "No rule for this tool"))
        d = Decision(action=action, rule=rule, reason=reason)
        ev("policy", tool=tool_name, args=args, action=action.value, rule=rule, reason=reason,
           subject=caller.invoking_subject)
        return d

# ── instrumented SDK pieces ───────────────────────────────────
class TracedAdapter(ReasoningAdapter):
    def strip(self, raw):
        out = super().strip(raw)
        ev("reasoning", raw_content=raw.get("content", ""), reasoning=raw.get("reasoning_content", ""), clean=out)
        return out

class TracedValidator(ResponseValidator):
    def validate_tool_calls(self, calls):
        r = super().validate_tool_calls(calls)
        ev("validate", mode="tool_calls", input=[{"tool": c.tool, "args": c.args} for c in calls],
           ok=not r.needs_retry, nudge=r.nudge.content if r.nudge else None)
        return r
    def validate_text_response(self, text):
        r = super().validate_text_response(text)
        ev("validate", mode="text", input=text, ok=not r.needs_retry,
           rescued=[{"tool": c.tool, "args": c.args} for c in r.tool_calls],
           nudge=r.nudge.content if r.nudge else None)
        return r

SCRIPT = [
    Response(reasoning="I need the weather for both cities.",
             tool_calls=[ToolCall(id="call_1", name="weather_lookup", arguments={"city": "Tokyo"})],
             finish_reason="tool_calls"),
    Response(reasoning="The tool is called get_weather. Check both cities.",
             tool_calls=[ToolCall(id="call_2", name="get_weather", arguments={"city": "Tokyo"}),
                         ToolCall(id="call_3", name="get_weather", arguments={"city": "Seoul"})],
             finish_reason="tool_calls"),
    Response(reasoning="Tokyo is rainy. I'll tell the travel channel.",
             tool_calls=[ToolCall(id="call_4", name="post_to_slack",
                                  arguments={"channel": "#travel", "text": "Rain in Tokyo today"})],
             finish_reason="tool_calls"),
    Response(content="Tokyo is warmer at 22°C, but it's raining. Bring an umbrella.",
             reasoning="Posting was denied. Just answer.", finish_reason="stop"),
    Response(reasoning="Plain text isn't allowed here. Use final_answer.",
             tool_calls=[ToolCall(id="call_5", name="final_answer",
                                  arguments={"text": "Tokyo is warmer (22°C vs 17°C), but it's raining there, so bring an umbrella. I couldn't post to #travel: that needs approval."})],
             finish_reason="tool_calls"),
]

class ScriptedBackend:
    def __init__(self): self.i = 0
    def model_name(self): return "Qwen/Qwen3-8B"
    def supports_native_tool_calling(self): return True
    def context_window_size(self): return 32768
    def complete(self, messages):
        r = SCRIPT[self.i]; self.i += 1
        ev("complete", messages=[msg_json(m) for m in messages],
           response={"content": r.content, "reasoning_content": r.reasoning,
                     "tool_calls": [{"id": t.id, "name": t.name, "arguments": t.arguments} for t in r.tool_calls],
                     "finish_reason": r.finish_reason})
        return r

async def main():
    caller = CallerContext(user_id="alex", invoking_subject="alex", session_id="sess-1", source="weather-agent")
    client = AuditedToolClient(source="weather-agent").with_policy(LocalPolicy())
    cfg = InferenceConfig(client=ScriptedBackend(), validator=TracedValidator([s.name for s in SPECS]),
                          tool_specs=SPECS, reasoning=TracedAdapter(), max_attempts=3)
    messages = [Message(role=Role.SYSTEM, content="You are a weather assistant. Always finish with final_answer."),
                Message(role=Role.USER, content="Is it warmer in Tokyo or Seoul? Tell #travel if it's raining.")]
    lap = 0
    while lap < 5:
        lap += 1
        ev("lap", lap=lap)
        result = await run_inference(messages, cfg, session_id="sess-1")
        ev("inference_done", attempts=result.attempts, retries_added=[msg_json(m) for m in result.new_messages[len(messages):]])
        messages = result.new_messages
        resp = result.response
        messages.append(Message(role=Role.ASSISTANT, content=resp.content, tool_calls=resp.tool_calls))
        finished = False
        for call in resp.tool_calls:
            try:
                out = await client.Execute(call.name, call.arguments, "alex", "sess-1", None, FUNCS[call.name], caller=caller)
                content, status = json.dumps(out), "ok"
            except PermissionError as e:
                content, status = json.dumps({"error": str(e)}), "denied"
            rec = client.records()[-1]
            ev("execute", tool=call.name, args=call.arguments, status=status, output=content,
               audit={"session_id": rec.session_id, "invoking_subject": rec.invoking_subject, "framework": rec.framework,
                      "tool_name": rec.tool_name, "decision": rec.decision.action.value, "rule": rec.decision.rule,
                      "delegation_depth": rec.delegation_depth})
            messages.append(Message(role=Role.TOOL, content=content, tool_call_id=call.id))
            ev("append", message=msg_json(messages[-1]))
            if call.name == "final_answer" and status == "ok":
                finished = True
        if finished:
            ev("done", text=resp.tool_calls[-1].arguments["text"], laps=lap, audit_count=len(client.records()))
            break

asyncio.run(main())
json.dump(EVENTS, open("runtime_trace.json", "w"), indent=1, ensure_ascii=False)
for e in EVENTS:
    print(e["kind"], {k: v for k, v in e.items() if k not in ("kind", "messages")})
