---
title: Research
description: Haikei Labs white papers on Kei policy architecture, with every published version of each paper, its date and its source commit.
type: reference
product: kei
nav_order: 1
---

Haikei Labs white papers explain the ideas behind Kei. The current paper describes how Kei works today. Earlier papers stay here exactly as they were written, as a record of how the design developed.

## Current

### Where policy decisions happen—and where they are enforced

Policy Decision Points (PDPs), Policy Enforcement Points (PEPs), and how Kei enforces policy for coding agents and connectors. October 2026, updated November 2026.

- [Read the white paper](/research/policy-decision-and-enforcement)
- [Download the PDF](https://haikeilabs.com/whitepapers/policy-decision-and-enforcement.pdf)

## Historical

### The Principal Model: User-Delegated ABAC for Agentic AI Systems

An early design for user-delegated attribute-based access control (ABAC): an AI agent acts with the authority of the person it works for, every tool call is checked against policy, and every decision is attributed to that person. The current policy architecture replaces the components this paper describes, so read it as history, not as a description of Kei today.

| Version | Date | Source commit | What changed | PDF |
|---|---|---|---|---|
| [1.0](/research/principal-model-v1-0-2026-07-23) | 2026-07-23 | `81fba36f` | Original draft. | [PDF](https://haikeilabs.com/whitepapers/principal-model-v1-0-2026-07-23.pdf) |
| [1.1](/research/principal-model-v1-1-2026-10-07) | 2026-10-07 | `97dca0c1` | Last revision. | [PDF](https://haikeilabs.com/whitepapers/principal-model-v1-1-2026-10-07.pdf) |

Between the two published versions, the paper was revised several times:

| Date | Commit | Change |
|---|---|---|
| 2026-07-25 | `50b88155` | Added a link for NIST SP 800-162 and a research reference on agent interoperability protocols. |
| 2026-08-05 | `675712c7`, `279424ec` | Corrected component specifications; added the policy cache, OAuth state validation, and token hashing. |
| 2026-08-05 | `94344f4b`, `1da16f3a` | Removed infrastructure details, focused the paper on the access-control model, and added research references (document version 1.1). |
| 2026-10-07 | `97dca0c1` | Added a banner marking the paper as a historical draft that points to the current policy architecture paper. |

Commit hashes refer to the Kei source repository, where the paper was kept as `whitepaper.md`.
