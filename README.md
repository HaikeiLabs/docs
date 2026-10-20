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

## Deploy

Deploy with Cloudflare Pages using build command `npm ci && npm run build`, output directory `dist`, and custom domain `docs.haikeilabs.com`.
