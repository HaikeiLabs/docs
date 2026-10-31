---
description: Install the Agentware Python SDK and run an offline harness that demonstrates allowed and denied tool calls.
title: Set up a Python harness
type: read-and-use
product: agentware
nav_group: Make and maintain
nav_order: 4
---

Add Kei governance to a Python agent harness. The SDK provides the `KeiProxySocketAuthorizeClient` and optional helper types for assembling a harness.

For Kei compatibility with your installed SDK version, check the [Agentware compatibility table](https://github.com/HaikeiLabs/agentware#compatibility). For the full API reference, see the [Python package source](https://github.com/haikeilabs/agentware/tree/main/python).

## Install

```sh
pip install haikeilabs-agentware
```

Requires Python 3.10 or later.

## Prerequisites for a real runtime

The fake example below does not need Kei. For a real integration, run `kei-proxy serve` beside the harness and set `KEI_RUNTIME_SOCKET_PATH` and `KEI_RUNTIME_TOKEN` in the harness process environment. The daemon owns the user session and policy decision. Do not put the token in code, arguments, or logs.

## Run the allow and deny example

From the repository root, the minimal example starts the fake socket, makes one allowed and one denied request, and prints the result:

```sh
cd python
uv run python ../examples/python/minimal-harness/main.py --fake
```

Output:

```text
ALLOW tool=echo policy_id=fake-allow-echo
DENY tool=delete_everything reason_code=no_matching_policy hint=Add a policy for this tool: kei policies create
```

Only proceed to the tool handler for an explicit allow. A socket or protocol failure fails closed.

## Register tools over the socket

Use `ToolSpec` with a `harness_executor` route. The tool name must match the name your harness authorizes:

```python
from haikeilabs.agentware import ToolSpec, serialize_tool_specs

async def register(client):
    specs = [
        ToolSpec(
            name="echo", description="Echo a message", service="minimal_harness",
            source="minimal_harness", operation_class="read",
            route={"harness_executor": {"executor": "minimal_harness", "registration": "echo"}},
        ),
        ToolSpec(
            name="delete_everything", description="Delete everything", service="minimal_harness",
            source="minimal_harness", operation_class="write",
            route={"harness_executor": {"executor": "minimal_harness", "registration": "delete_everything"}},
        ),
    ]
    return await client.register_tools(serialize_tool_specs(specs))
```

## Python helpers

The Python package provides optional helper types for assembling a harness: `HarnessContract`, `HarnessManifest`, and `validate_contract`. Python integrations can also use `KeiProxyEvaluator` and the runtime socket client. Verify exact signatures and behavior against the Python source and tests.

## Try against a real kei-proxy

Point the socket path at a live `kei-proxy serve` daemon and drop `--fake`:

```sh
export KEI_RUNTIME_SOCKET_PATH=/run/kei-proxy/runtime.sock
export KEI_RUNTIME_TOKEN=<your runtime token>
uv run python ../examples/python/minimal-harness/main.py
```

For the complete working harness, see the [Python minimal harness example](https://github.com/haikeilabs/agentware/tree/main/examples/python/minimal-harness).

## Next steps

- [Runtime setup](/content/agentware/build/runtime-setup.html) — connect a harness to a real Kei runtime.
- [Policy and audit](/content/agentware/build/policy-and-audit.html) — create policies and view audit entries.
