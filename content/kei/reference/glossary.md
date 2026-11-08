---
title: Kei terms
description: "Definitions of the terms used across the Kei docs: agent, harness, workspace, runtime, policy, and more."
type: reference
product: kei
nav_group: Reference
---

## Agent

An LLM configuration that a harness runs, including its model, instructions, and tools.

## Agentware

The open-source SDK for building your own AI agents: the agent loop, tools, model adapters, and guardrails, plus an optional permission boundary for tool calls.

## Audit record

The record Kei writes for every protected tool call: who invoked the agent, the call itself, and the decision the runtime made.

## Coding agent

A coding assistant such as Claude Code, Codex, Cursor, OpenCode, or Pi that an engineer runs to change code with tools.

## Connector

A data source or service an agent reads from or writes to through Kei, such as GitHub or Linear. Connectors live inside a workspace boundary.

## Guardrails

The checks in your agent's own workflow, such as Agentware middleware: policy rules, response validators, step limits. Kei's tool-call permissions are called Kei policies, not guardrails; see [Kei policies](#kei-policies).

## Haikei Labs

The company behind Agentware and Kei. Haikei is the sovereign context framework: build and run agents while you keep your own models and your own data.

## Haikei Skills

Instructions you install into a coding assistant (Claude Code, Codex, Cursor, OpenCode, Pi) so it knows how to use Agentware and Kei.

## Harness

Software that lets an agent use tools. A harness connects through an integration that sends protected operations to the Kei runtime. You build one with Agentware, or use an existing one such as Claude Code.

## Kei

The platform that protects agents: shared permissions, identity, audit, and data protection for every tool call, enforced by a runtime in your environment.

## Kei policies

Deterministic guardrails on the tool calls an agent can make, enforced by the Kei runtime (kei-proxy).

## Runtime (kei-proxy)

The kei-proxy process in your environment. It decides each protected call locally and fails closed when no policy matches.

## Tool call

An action an agent takes through a tool, such as reading a file or calling an API. A protected call touches tenant data, external systems, or credentials and goes through the Kei runtime; a local call never reaches Kei.

## Tool-call boundary

The single point where every tool call passes through Agentware, so it can be checked against policy and recorded.

## Workspace

A boundary for a team's connectors, users, groups, policies, and setup activity.
