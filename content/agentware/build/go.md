---
title: Set up a Go harness
type: read-and-use
product: agentware
nav_group: Make and maintain
nav_order: 3
---

Add Kei governance to a Go agent harness using the `runtimesocket` client. The socket client sends each tool call to `kei-proxy authorize` over the local Unix socket and returns the decision.

Compatible versions: agentware 0.11.0, kei-proxy v0.3.0, kei-cli 0.2.0. For the full API reference, see the [Go module documentation](https://github.com/haikeilabs/agentware/tree/main/go).

## Install

```sh
go get github.com/haikeilabs/agentware/go
```

The module path is lowercase; `github.com/HaikeiLabs/agentware/go` does not resolve. Releases are tagged `go/vX.Y.Z` at the same version as the npm and PyPI packages.

## Prerequisites

Run `kei-proxy serve` beside the harness and set `KEI_RUNTIME_SOCKET_PATH` and `KEI_RUNTIME_TOKEN` in the harness process environment. The daemon owns the user session and policy decision. Do not put the token in code, arguments, or logs.

## Authorize a tool

Open a session for the caller, make authorization requests, and execute the tool only after an explicit allow:

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/haikeilabs/agentware/go/kei/evaluator"
	"github.com/haikeilabs/agentware/go/kei/runtimesocket"
)

func main() {
	ctx := context.Background()
	runtime := &runtimesocket.Client{}
	session, err := runtime.OpenSession(ctx, runtimesocket.Identity{
		Source: "minimal_harness", ExternalID: "user-123",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer runtime.CloseSession(ctx, session)

	for _, tool := range []string{"echo", "delete_everything"} {
		answer, err := runtime.Authorize(ctx, session, evaluator.AuthorizeRequest{
			Tool: tool, Action: "execute",
		})
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("tool=%s decision=%v reason_code=%v hint=%v\n",
			tool, answer["decision"], answer["reason_code"], answer["hint"])
	}
}
```

A deny response carries `reason_code` and `hint`. A socket or protocol failure returns an error and fails closed. Proceed to the tool handler only after an explicit allow.

## Register tools over the socket

Use `ToolSpec` with a `harness_executor` route. The tool name must match the name your harness authorizes:

```go
import (
	"context"

	"github.com/haikeilabs/agentware/go/kei/runtimesocket"
	"github.com/haikeilabs/agentware/go/kei/toolsync"
	"github.com/haikeilabs/agentware/go/toolspec"
)

func register(ctx context.Context) error {
	specs := []toolspec.ToolSpec{
		{Name: "echo", Description: "Echo a message", Service: "minimal_harness", Source: "minimal_harness", OperationClass: "read",
			Route: &toolspec.Route{HarnessExecutor: &toolspec.HarnessExecutor{Executor: "minimal_harness", Registration: "echo"}}},
		{Name: "delete_everything", Description: "Delete everything", Service: "minimal_harness", Source: "minimal_harness", OperationClass: "write",
			Route: &toolspec.Route{HarnessExecutor: &toolspec.HarnessExecutor{Executor: "minimal_harness", Registration: "delete_everything"}}},
	}
	return (toolsync.SocketRegistrar{Client: &runtimesocket.Client{}}).Send(ctx, specs)
}
```

## Try locally with the fake socket

From the repository root, start the fake socket in one terminal:

```sh
python3 fixtures/kei/fake-kei-proxy-socket.py ./.runtime.sock --audit ./.runtime-audit.jsonl
```

In another terminal, run with `KEI_RUNTIME_SOCKET_PATH` pointing to that socket and `KEI_RUNTIME_TOKEN=offline-example-token`. The fake permits `echo` and denies `delete_everything`.

For the complete working harness layout, see the [Go minimal harness example](https://github.com/haikeilabs/agentware/tree/main/examples/go/minimal-harness).

## Next steps

- [Runtime setup](/content/agentware/build/runtime-setup.html) — connect a harness to a real Kei runtime.
- [Policy and audit](/content/agentware/build/policy-and-audit.html) — create policies and view audit entries.
