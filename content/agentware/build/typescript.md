---
title: Set up a TypeScript harness
type: read-and-use
product: agentware
nav_group: Make and maintain
nav_order: 5
---

Add Kei governance to a TypeScript agent harness. The SDK provides the `KeiProxySocketAuthorizeClient` and tool registration helpers.

Compatible versions: agentware 0.11.0, kei-proxy v0.3.0, kei-cli 0.2.0. Requires Node 22.18 or later. For the full API reference, see the [TypeScript package source](https://github.com/haikeilabs/agentware/tree/main/typescript).

## Install

```sh
npm install @haikeilabs/agentware
```

## Prerequisites

Run `kei-proxy serve` beside the harness and set `KEI_RUNTIME_SOCKET_PATH` and `KEI_RUNTIME_TOKEN` in the harness process environment. The daemon owns the user session and policy decision. Do not put the token in code, arguments, or logs.

## Run the allow and deny example

From the repository root, the minimal example starts the fake socket, makes one allowed and one denied request, and prints the result:

```sh
cd examples/typescript/minimal-harness
npm ci --prefix ../../../typescript
npm --prefix ../../../typescript run build
npm ci
npm start -- --fake
```

The example prints one JSON result per authorization, including `reason_code` and `hint` on denial. Only proceed to the tool handler for an explicit allow. A socket or protocol failure fails closed.

## Register tools over the socket

Use `ToolSpec` with a `harness_executor` route. The tool name must match the name your harness authorizes:

```ts
import {
  KeiProxySocketAuthorizeClient,
  registerToolSpecs,
  type ToolSpec,
} from "@haikeilabs/agentware";

async function register(client: KeiProxySocketAuthorizeClient) {
  const specs: ToolSpec[] = [
    {
      name: "echo", description: "Echo a message", parameters: { type: "object" },
      service: "minimal_harness", source: "minimal_harness", operation_class: "read",
      route: { harness_executor: { executor: "minimal_harness", registration: "echo" } },
    },
    {
      name: "delete_everything", description: "Delete everything", parameters: { type: "object" },
      service: "minimal_harness", source: "minimal_harness", operation_class: "write",
      route: { harness_executor: { executor: "minimal_harness", registration: "delete_everything" } },
    },
  ];
  return registerToolSpecs(specs, client);
}
```

## Try against a real kei-proxy

Point the socket path at a live `kei-proxy serve` daemon and drop `--fake`:

```sh
export KEI_RUNTIME_SOCKET_PATH=/run/kei-proxy/runtime.sock
export KEI_RUNTIME_TOKEN=<your runtime token>
npm start
```

For the complete working harness, see the [TypeScript minimal harness example](https://github.com/haikeilabs/agentware/tree/main/examples/typescript/minimal-harness).

## Next steps

- [Runtime setup](/content/agentware/build/runtime-setup.html) — connect a harness to a real Kei runtime.
- [Policy and audit](/content/agentware/build/policy-and-audit.html) — create policies and view audit entries.
