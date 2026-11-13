# Contributing to Haikei docs

The docs site is built from Markdown in `content/`. Keep pages useful to a public reader: do not include secrets, customer names, internal URLs, or private implementation details.

## Add or edit a page

Put Kei pages under `content/kei/<section>/<slug>.md`, agentware pages under `content/agentware/<section>/<slug>.md`, and cross-product skill guidance in `content/skills.md`. The sidebar is generated from these folders.

Start every page with YAML front matter:

```yaml
---
title: A useful page title
description: One or two short sentences that say what the reader can do with this page.
type: read-and-use
product: kei
---
```

Every page needs a `description`. It becomes the page's meta description and its share text (`og:description`), so write it for someone reading a search result: say what the page helps them do, in plain words. Keep it to 160 characters or fewer; `npm run check:frontmatter` and the build reject a missing, blank, or longer description.

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

## Search metadata

The build writes the search and share metadata; you do not add it by hand:

- Each page's `<head>` has a canonical URL (`https://docs.haikeilabs.com/<path>`, no `.html`), the meta description from front matter, Open Graph tags, and `twitter:card` `summary_large_image`. The share image is `/assets/social/share-docs-1200x627.png`, copied from the design system into `assets/social/`.
- `dist/sitemap.xml` lists the home and every page in `dist/index.json`. `dist/robots.txt` allows all crawlers and names the sitemap.
- The raw Markdown copies are served with a `Link: <page URL>; rel="canonical"` header from `dist/_headers`, so search engines index the HTML page instead of the copy. Cloudflare Pages allows 100 `_headers` rules; the build fails before that limit so the copies can move to one `X-Robots-Tag: noindex` rule.

## Agentware versions

The Agentware compatibility table in `content/agentware/build/overview.md` is generated between `<!-- compat:begin -->` and `<!-- compat:end -->` from agentware's `VERSION` file and README table. Don't edit it by hand. After an agentware release, run `npm run sync:compat` (or `npm run sync:compat -- --from ../agentware` for a local checkout). It refreshes the vendored copy in `scripts/data/agentware-compat.json` and the block.

`npm test` and `npm run check:compat` run offline against the vendored copy. They fail when the block is stale, when a page keeps its own "Compatible versions:" line, or when a page names an Agentware version other than the current one without writing it as a floor. Write feature floors as "from Agentware 0.11.0" or "Agentware 0.11.0 or later", and link to the shared block for the versions that work together.

## Page conventions

- The page `title` is rendered in the header row; a leading `# Title` in the body is dropped.
- Callouts: start a blockquote with `**Note:**` or `**Warning:**` (`> **Warning:** this deletes the installation.`). Other blockquotes stay plain.
- Fenced code shows its language as a label. Use `title="file.json"` in the info string to show a filename instead (` ```json title="policy.json" `). Highlighted languages: sh/bash, json, python, dockerfile.
- Headings get anchors and an "On this page" entry (h2/h3). `{#custom-id}` after a heading sets its id.
- Prev/next follow the sidebar order.
- Sidebar: Agentware comes first, then Kei. `nav_group` is `Start here`, `Get started`, `Make and maintain` or `Reference` (the default). `Start here` is the Agentware entry group (Build on Agentware, tutorials, Install Haikei Skills, the language guides); every other group is placed under the page's `product`.
- Order: add `nav_order: <non-negative integer>` to place a page in its sidebar group (the legacy `order` field still works). Ordered pages come first, ascending; pages without one follow by path. Each `nav_order` is used once per group: the build fails on a duplicate. The sidebar, prev/next links and `index.json` all use this order. Kei Get started is a journey: sign-in 1, connect-this-machine 2, connect-your-agent 3, give-a-group-access 4, install-skills 5, prove-it 6.
- Tutorials: `content/tutorials/<slug>.md` is served at `/tutorials/<slug>`, and `content/tutorials/index.md` at `/tutorials/`, which lists every tutorial page. `seo_title` (optional) replaces the `<title>` and `og:title` when the page title and the search title differ.
