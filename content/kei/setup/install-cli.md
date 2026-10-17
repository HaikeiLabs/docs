---
title: Install and check the Kei CLI
type: make-and-maintain
product: kei
validated: 2026-10-17
validated_with: kei v0.1.32
---

Install the published Kei CLI and its bundled runtime with the release installer. The installer checks the downloaded archive before installing it.

```sh
export PATH="$HOME/.local/bin:$PATH"
curl -fsSL "https://haikeilabs.com/install.sh" \
  | sh -s -- -d "$HOME/.local/bin"
```

Check which CLI version is installed:

```sh
kei --version
```

This page was checked with Kei CLI v0.1.32 on 2026-10-17.
