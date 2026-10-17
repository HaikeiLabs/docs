# Contributing to Haikei docs

The docs site is built from Markdown in `content/`. Keep pages useful to a public reader: do not include secrets, customer names, internal URLs, or private implementation details.

## Add or edit a page

Put Kei pages under `content/kei/<section>/<slug>.md`, agentware pages under `content/agentware/<section>/<slug>.md`, and cross-product skill guidance in `content/skills.md`. The sidebar is generated from these folders.

Start every page with YAML front matter:

```yaml
---
title: A useful page title
type: read-and-use
product: kei
---
```

Use one of these `type` values:

- `read-and-use` for an explanation or walkthrough a reader follows.
- `make-and-maintain` for instructions that change or operate a Kei or agentware installation.
- `reference` for a stable lookup page, such as a glossary or field list.

Use `product: kei` or `product: agentware`. Pages of type `make-and-maintain` must also include the date and CLI version you verified against:

```yaml
validated: 2026-10-17
validated_with: kei v0.1.32
```

Use an ISO `YYYY-MM-DD` date. Recheck the documented steps with the named Kei CLI version before changing these values. The build rejects missing or malformed validation metadata on `make-and-maintain` pages.

## Preview and check

```sh
npm ci
npm test
npm run build
npm run preview
```

The preview server serves the generated site at <http://localhost:4173>. Each rendered page has a sibling raw Markdown file for editing, review, and agent consumption.
