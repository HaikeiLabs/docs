---
title: "How do you evaluate an AI agent? A course on agent evals"
seo_title: "How do you evaluate an AI agent? Agent evals course"
description: "Learn agent evals: write cases for tool calls, grade them with code, test a skill, compare models, read a report and gate a release, in eight short lessons."
type: read-and-use
product: agentware
nav_group: Start here
nav_order: 10
course: evals
lessons:
  - what-to-evaluate
  - a-case
  - graders
  - skill-evals
  - same-cases-many-models
  - reading-a-report
  - release-gate
  - build-one
groups:
  - label: Foundations
    from: what-to-evaluate
  - label: Skills and models
    from: skill-evals
  - label: Results and release
    from: reading-a-report
finish:
  primary:
    label: Build an eval in the Playground
    href: https://playground.haikeilabs.com/evals
  secondary:
    label: How Haikei evals work
    href: /agentware/reference/how-haikei-evals-work
---

An eval gives an AI assistant a task and checks what it does. For an agent that calls tools, the most useful check is the decision itself: which tool it chose and which arguments it passed.

These eight lessons follow one small support assistant. It looks up orders, refunds them and searches an FAQ. You'll write cases for it, grade them with plain code, test a skill's wording, compare models on the same cases, read a report and turn results into a release decision. The last lesson sends you to the Playground to build and export a suite of your own.

Each lesson takes three to five minutes and ends with one question. You need to be able to read some Python and JSON. You don't need a model or an API key: every example uses recorded runs.
