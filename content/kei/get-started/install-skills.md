---
title: Install Kei skills in your agent
type: read-and-use
product: kei
---

# Install Kei skills in your agent

Install the public Kei skills in the agent you plan to use. Skills give an agent reusable instructions for Kei setup; they do not install a runtime or grant access.

Install the router skill together with the area skill you need. For example, to install Kei harness setup for Codex:

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill kei-harness-setup -a codex -y
```

Replace `kei-harness-setup` with the area skill you need, and use the matching agent ID:

```sh
npx skills add HaikeiLabs/skills --skill haikei --skill kei-harness-setup -a claude-code -y
npx skills add HaikeiLabs/skills --skill haikei --skill kei-harness-setup -a codex -y
npx skills add HaikeiLabs/skills --skill haikei --skill kei-harness-setup -a opencode -y
```

The `haikei` router skill should always be installed alongside the area skill. Learn more about the [Agent Skills standard](https://agentskills.io/home).

Alternatively, Claude Code and Codex can use the [plugin marketplace instructions](https://github.com/HaikeiLabs/skills#installing). For Pi, install the skills as a package with `pi install git:github.com/HaikeiLabs/skills`. Restart or reload the agent if its instructions do not update.

## Check it worked

Ask your agent to list the Kei skills it can use. Continue with [Connect this machine](/kei/get-started/connect-this-machine) to install the runtime tools and connect a runtime installation.
