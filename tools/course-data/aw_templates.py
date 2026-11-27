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
# Reproductions of the gaps still open, shown in lesson 10 as REPL transcripts.
# Each code string is run as written: every line but the last is executed, the
# last line is evaluated, and the output is its repr, as the Python REPL prints it.
import ast
from haikeilabs.agentware.executor.executor import ExecuteRequest, InferenceExecutor, InferenceExecutorConfig
from haikeilabs.agentware.llm.response import ToolCall as LlmToolCall
class ScriptedBackend:
    """Asks for get_weather once, then answers. Records every message list it receives."""
    def __init__(self): self.seen=[]
    def model_name(self): return "Qwen/Qwen3-8B"
    def supports_native_tool_calling(self): return True
    def context_window_size(self): return 32768
    def complete(self,messages,tools=None):
        self.seen.append(list(messages))
        if len(self.seen)==1:
            return Response(tool_calls=[LlmToolCall(id="call_1",name="get_weather",arguments={"city":"Tokyo"})],finish_reason="tool_calls")
        return Response(content="It's 22°C and raining in Tokyo.",finish_reason="stop")
class WeatherRunner:
    def execute(self,name,args,caller): return json.dumps({"temp":22,"sky":"rain"}),True,None
backend=ScriptedBackend()
executor=InferenceExecutor(InferenceExecutorConfig(backend=backend,registry=reg,tool_executor=WeatherRunner(),formatter=get_formatter("Qwen/Qwen3-8B")))
def repl(code,ns):
    tree=ast.parse(code); last=tree.body.pop()
    exec(compile(tree,"<repro>","exec"),ns)
    return repr(eval(compile(ast.Expression(last.value),"<repro>","eval"),ns))
REPROS=[
 ("GPT-OSS", "GPT-OSS: a Harmony tool call in text mode",
  'fmt = get_formatter("openai/gpt-oss-20b")\n'
  'fmt.parse_tool_calls(\'<|channel|>commentary to=functions.get_weather <|constrain|>json<|message|>{"city": "Tokyo"}<|call|>\')'),
 ("MiniMax", "MiniMax: a real MiniMax M2 tool call",
  'fmt = get_formatter("MiniMax-M2")\n'
  'fmt.model_family(), fmt.parse_tool_calls(\'<minimax:tool_call><invoke name="get_weather"><parameter name="city">Tokyo</parameter></invoke></minimax:tool_call>\')'),
 ("Tool result text", "Tool result text: what InferenceExecutor sends back (scripted model)",
  'executor.execute(ExecuteRequest(system_prompt="You are a weather assistant.", user_message="Weather in Tokyo?"))\n'
  'backend.seen[-1][-1].content'),
]
ns={"get_formatter":get_formatter,"executor":executor,"backend":backend,"ExecuteRequest":ExecuteRequest}
out["repro_entries"]=[{"gap":gap,"label":label,"code":code,"output":repl(code,dict(ns))} for gap,label,code in REPROS]
print(json.dumps(out,indent=1))
