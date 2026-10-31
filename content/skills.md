---
description: Install Haikei Skills to guide a coding agent building with Agentware or working with Kei.
title: Use Kei skills with your agent
type: reference
product: kei
nav_group: Reference
---

The public [Kei skills repository](https://github.com/HaikeiLabs/skills) gives agents repeatable guidance for working with Kei. Choose the installation method documented for your agent, then ask it to show the available skills.

Skills provide instructions. They do not install a runtime integration, configure credentials, or grant a policy permission. The agent's governed operations still need to pass through the Kei integration and runtime.


## Build with Agentware

Install the router and SDK guidance for Codex:

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill agentware-sdk -a codex -y
```

For Claude Code, Cursor, OpenCode, or Pi, replace `codex` with `claude-code`, `cursor`, `opencode`, or `pi`. Ask your coding agent to help build a custom agent with typed tools and tests. Continue with the [Agentware build guide](/agentware/build/overview) for SDK installation and an offline example.
