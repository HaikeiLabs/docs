import MarkdownIt from 'markdown-it';

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

// --- Syntax highlighting -------------------------------------------------
// Build-time only: each language is an ordered list of [class, regex] rules.
// The first rule that matches at the cursor wins; anything else is plain text.
const SH_KEYWORDS = 'if|then|else|elif|fi|for|in|do|done|while|case|esac|function|export|local|return|set|unset|source|cd|echo|sudo|exit';
const rules = {
  sh: [
    ['c', /#.*/y],
    ['s', /"(?:\\.|[^"\\])*"|'[^']*'/y],
    ['v', /\$(?:\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*)/y],
    ['f', /(?<![\w-])--?[A-Za-z][\w-]*/y],
    ['k', new RegExp(`(?<![\\w-])(?:${SH_KEYWORDS})(?![\\w-])`, 'y')],
    ['n', /(?<![\w.-])\d+(?:\.\d+)*(?![\w.-])/y],
  ],
  json: [
    ['p', /"(?:\\.|[^"\\])*"(?=\s*:)/y],
    ['s', /"(?:\\.|[^"\\])*"/y],
    ['k', /\b(?:true|false|null)\b/y],
    ['n', /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
  ],
  python: [
    ['c', /#.*/y],
    ['s', /(?:"""[\s\S]*?"""|'''[\s\S]*?'''|f?"(?:\\.|[^"\\\n])*"|f?'(?:\\.|[^'\\\n])*')/y],
    ['k', /\b(?:def|class|return|import|from|as|if|elif|else|for|while|in|not|and|or|is|None|True|False|with|try|except|finally|raise|pass|lambda|yield|async|await)\b/y],
    ['n', /\b\d+(?:\.\d+)?\b/y],
  ],
  dockerfile: [
    ['c', /#.*/y],
    ['s', /"(?:\\.|[^"\\])*"|'[^']*'/y],
    ['k', /^(?:FROM|RUN|CMD|ENTRYPOINT|COPY|ADD|ENV|ARG|WORKDIR|USER|EXPOSE|VOLUME|LABEL|HEALTHCHECK|AS)\b/imy],
    ['v', /\$(?:\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*)/y],
  ],
};
const aliases = { bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh', py: 'python', docker: 'dockerfile', jsonc: 'json' };

export function highlight(code, lang) {
  const ruleSet = rules[aliases[lang] ?? lang];
  if (!ruleSet) return escapeHtml(code);
  let out = '';
  let plain = '';
  let index = 0;
  const flush = () => { out += escapeHtml(plain); plain = ''; };
  scan: while (index < code.length) {
    for (const [cls, re] of ruleSet) {
      re.lastIndex = index;
      const match = re.exec(code);
      if (match && match[0].length) {
        flush();
        out += `<span class="tok-${cls}">${escapeHtml(match[0])}</span>`;
        index += match[0].length;
        continue scan;
      }
    }
    plain += code[index++];
  }
  flush();
  return out;
}

// --- Headings, anchors, TOC ---------------------------------------------
export function slugify(text) {
  return text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
}

function inlineText(token) {
  return (token.children ?? []).filter((child) => ['text', 'code_inline'].includes(child.type)).map((child) => child.content).join('');
}

function headingsPlugin(md) {
  md.core.ruler.push('haikei_headings', (state) => {
    const seen = new Map();
    state.env.toc = [];
    state.tokens.forEach((token, i) => {
      if (token.type !== 'heading_open') return;
      const inline = state.tokens[i + 1];
      // Support the `{#custom-id}` suffix the content already uses.
      const last = inline.children?.[inline.children.length - 1];
      const custom = last?.type === 'text' && last.content.match(/\s*\{#([\w-]+)\}\s*$/);
      if (custom) last.content = last.content.slice(0, custom.index);
      const text = inlineText(inline);
      const base = custom ? custom[1] : slugify(text);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count ? `${base}-${count}` : base;
      token.attrSet('id', id);
      const level = Number(token.tag.slice(1));
      if (level === 2 || level === 3) state.env.toc.push({ level, id, text });
      if (level >= 2) {
        const anchor = new state.Token('html_inline', '', 0);
        anchor.content = `<a class="anchor" href="#${id}" aria-label="Link to ${escapeHtml(text)}">#</a>`;
        inline.children.push(anchor);
      }
    });
  });
}

// --- Callouts: > **Note:** ... and > **Warning:** ... --------------------
const CALLOUTS = { note: 'note', warning: 'warning' };

function calloutsPlugin(md) {
  md.core.ruler.push('haikei_callouts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') continue;
      const inline = tokens[i + 2];
      if (tokens[i + 1]?.type !== 'paragraph_open' || inline?.type !== 'inline') continue;
      const [open, text, close] = (inline.children ?? []).filter((child) => child.type !== 'text' || child.content);
      const kind = open?.type === 'strong_open' && close?.type === 'strong_close' && CALLOUTS[text?.content.replace(/:$/, '').toLowerCase()];
      if (!kind) continue;
      tokens[i].attrJoin('class', `callout callout-${kind}`);
      tokens[i].attrSet('role', 'note');
    }
  });
}

// --- Fenced code ---------------------------------------------------------
export function parseInfo(info) {
  const [lang = ''] = info.trim().split(/\s+/);
  const title = info.match(/title="([^"]+)"/)?.[1] ?? '';
  return { lang: lang.replace(/\{.*$/, ''), title };
}

function fencePlugin(md) {
  md.renderer.rules.fence = (tokens, i) => {
    const token = tokens[i];
    const { lang, title } = parseInfo(token.info);
    const label = title || lang || 'text';
    const body = highlight(token.content.replace(/\n$/, ''), lang);
    return `<div class="code-block"><div class="code-head"><span class="code-label${title ? ' is-file' : ''}">${escapeHtml(label)}</span><button class="copy" type="button" aria-label="Copy ${escapeHtml(label)} code">Copy</button></div><pre tabindex="0"><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${body}</code></pre></div>\n`;
  };
}

// The page title is rendered in the header row, so a leading `# Title` would repeat it.
export function stripLeadingTitle(body) {
  return body.replace(/^\s*# [^\n]*\n+/, '');
}

export function createMarkdown() {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  md.use(headingsPlugin).use(calloutsPlugin).use(fencePlugin);
  return md;
}

export function renderToc(toc) {
  if (toc.length < 3) return '';
  const items = toc.map((entry) => `<li class="toc-l${entry.level}"><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>`).join('');
  return `<aside class="toc" aria-label="On this page"><h2>On this page</h2><ul>${items}</ul></aside>`;
}

// Flat reading order for prev/next; returns neighbours of `current`.
export function neighbours(ordered, current) {
  const index = ordered.indexOf(current);
  if (index < 0) return { prev: null, next: null };
  return { prev: ordered[index - 1] ?? null, next: ordered[index + 1] ?? null };
}
