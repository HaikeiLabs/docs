---
title: Install Haikei Skills in your agent
description: "Install Haikei Skills in your coding agent so it knows how to set up and use Kei. Skills do not install a runtime or grant access."
type: read-and-use
product: kei
nav_group: Get started
nav_order: 5
---

# Install Haikei Skills in your agent

Install the public Haikei Skills in the agent you plan to use. Skills give an agent reusable instructions for Kei setup; they do not install a runtime or grant access. For the install command for every assistant, see [/skills/](/skills/).

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

Ask your agent to list the Haikei Skills it can use. Continue with [Prove access with an allow and a deny](/kei/get-started/prove-it) to check that Kei allows one tool call and denies another.

Stuck? See [Troubleshoot setup](/kei/get-started/troubleshooting).
