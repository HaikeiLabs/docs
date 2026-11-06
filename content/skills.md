---
description: One command teaches your coding assistant to build with Agentware and Kei. Pick your assistant, copy the command, and try a starter prompt.
title: Install Haikei Skills in Claude Code, Codex, Cursor, OpenCode or Pi
type: reference
product: kei
nav_group: Reference
---

# Install Haikei Skills in your coding assistant

One command teaches your coding assistant to build with Agentware and Kei. Pick your assistant, copy the command, and try a starter prompt.

## Claude Code

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill agentware-sdk -a claude-code -y
```

You can also use the Claude Code plugin: `/plugin marketplace add HaikeiLabs/skills`, then `/plugin install haikei@haikei`.

## Codex

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill agentware-sdk -a codex -y
```

## Cursor

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill agentware-sdk -a cursor -y
```

## OpenCode

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill agentware-sdk -a opencode -y
```

## Pi

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill agentware-sdk -a pi -y
```

You can also install the Pi package: `pi install git:github.com/HaikeiLabs/skills`.

## Try a starter prompt

```text
Use the Haikei Skills to build a small Agentware agent in TypeScript with one tool that reads the Hacker News top stories. Add a test and run it.
```

## Add the Kei setup skill for your assistant

For the Kei setup path, add the `kei-harness-setup` skill to the same command:

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill kei-harness-setup -a claude-code -y
```

Replace `claude-code` with `codex`, `cursor`, `opencode`, or `pi`.

## Check it worked

Ask your coding assistant to list its Haikei Skills. It should name the `haikei` router and the skills you installed.

Next: [Build your first agent](/agentware/build/overview) or [Connect your coding assistant to Kei](/kei/get-started/connect-your-agent).
