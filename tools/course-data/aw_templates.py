import json
from dataclasses import dataclass
from haikeilabs.agentware.toolformat import get_formatter
from haikeilabs.agentware.tools import Result, ToolRegistry
from haikeilabs.agentware.prompts.generator import DefaultPromptGenerator
from haikeilabs.agentware.reasoning import ReasoningAdapter

SCHEMA={"type":"object","properties":{"city":{"type":"string","description":"City name, e.g. Tokyo"},"unit":{"type":"string","enum":["celsius","fahrenheit"]}},"required":["city"]}
class Weather:
    name="get_weather"; description="Get the current weather for a city."
    input_schema=SCHEMA
    def execute(self,args): return Result(success=True,data={"temp":22})
reg=ToolRegistry(); reg.register(Weather())
out={}
out["schemas"]=json.dumps(DefaultPromptGenerator().generate_tool_schemas(reg),indent=2)
out["section"]=DefaultPromptGenerator().generate_tool_section(reg)
for m in ["claude-sonnet-4-5","Qwen/Qwen3-8B","openai/gpt-oss-20b","MiniMax-M2"]:
    f=get_formatter(m)
    out["fmt_"+m]={"family":f.model_family(),"defs":f.format_tool_definitions([Weather()]),
      "result":f.format_tool_result("get_weather",Result(success=True,data='{"temp": 22}'),call_id="toolu_01A")}
q=get_formatter("qwen3")
out["qwen_parse_official"]=str(q.parse_tool_calls('<tool_call>\n{"name": "get_weather", "arguments": {"city": "Tokyo"}}\n</tool_call>'))
out["qwen_parse_aw"]=str(q.parse_tool_calls('<tool_call><tool name="get_weather">{"city": "Tokyo"}</tool></tool_call>'))
a=get_formatter("claude")
out["anth_parse"]=str(a.parse_tool_calls('<function_calls>\n<invoke tool="get_weather">{"city": "Tokyo"}</invoke>\n</function_calls>'))
ra=ReasoningAdapter()
for label,raw in [("thinking_tag","<thinking>Need weather</thinking>Calling tool."),("think_tag","<think>Need weather</think>Calling tool."),
                  ("field",{"choices":[{"message":{"content":"Calling tool.","reasoning_content":"Need weather"}}]})]:
    try: out["reason_"+label]=repr(ra.strip(raw))
    except Exception as e: out["reason_"+label]="ERROR "+type(e).__name__
# Tools never reach the model: record what run_inference hands the backend.
import asyncio
from haikeilabs.agentware.llm import Message
from haikeilabs.agentware.llm.request import Role, ToolDefinition
from haikeilabs.agentware.llm.response import Response
from haikeilabs.agentware.middleware.inference import InferenceConfig, run_inference
class RecordingBackend:
    calls=[]
    def model_name(self): return "Qwen/Qwen3-8B"
    def supports_native_tool_calling(self): return True
    def context_window_size(self): return 32768
    def complete(self,messages,tools=None):
        RecordingBackend.calls.append({"messages":len(messages),"tools":None if tools is None else [t.name for t in tools]})
        return Response(content="Done.",finish_reason="stop")
spec=ToolDefinition(name=Weather.name,description=Weather.description,input_schema=SCHEMA)
asyncio.run(run_inference([Message(role=Role.USER,content="Weather in Tokyo?")],
    InferenceConfig(client=RecordingBackend(),tool_specs=[spec],max_attempts=1),session_id="s"))
call=RecordingBackend.calls[0]
out["tools_sent"]={"tool_specs":[spec.name],"backend_received":call["tools"]}
print(json.dumps(out,indent=1))
