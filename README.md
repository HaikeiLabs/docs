# Haikei documentation

Markdown sources for Kei, agentware, and the public Haikei skills, with a small static renderer for [docs.haikeilabs.com](https://docs.haikeilabs.com).

## Local preview

```sh
npm ci
npm test
npm run build
npm run preview
```

The preview server serves `dist/` at <http://localhost:4173>.

## Brand package

The site vendors `@haikeilabs/brand` 0.8.0 in `vendor/haikeilabs-brand-0.8.0.tgz`. The static build copies the package's flattened stylesheet from `node_modules/@haikeilabs/brand/dist/styles.flat.css` to `dist/assets/brand.css` and loads it on each page. `assets/tokens.css` contains the docs-only syntax highlighting colours and the browser colour-scheme setting; shared brand tokens come from the package.

To update the package, use a design-system checkout that contains `scripts/vendor-into.mjs`. From the docs repository root, run the following with the desired design-system Git ref (shown here as `origin/main`):

```sh
node /path/to/design-system/scripts/vendor-into.mjs "$PWD" --ref origin/main
npm install
npm run build
npm test
```

Commit the updated tarball, `package.json`, and `package-lock.json` together. The build uses the flattened CSS and does not require the package's Solid components.

## Deploy

Deploy with Cloudflare Pages using build command `npm ci && npm run build`, output directory `dist`, and custom domain `docs.haikeilabs.com`.

The build also writes `sitemap.xml`, `robots.txt`, `_redirects`, and `_headers` (canonical `Link` headers for the raw `.md` copies) into `dist/` for Cloudflare Pages. See [CONTRIBUTING.md](CONTRIBUTING.md#search-metadata).
