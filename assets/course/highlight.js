export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

// --- Syntax highlighting -------------------------------------------------
// Build-time only: each language is an ordered list of [class, regex] rules.
// The first rule that matches at the cursor wins; anything else is plain text.
const SH_KEYWORDS = 'if|then|else|elif|fi|for|in|do|done|while|case|esac|function|export|local|return|set|unset|source|cd|echo|sudo|exit';
const rules = {
  tokens: [['k', /<\|[^\n]*?\|>/y], ['p', /<\/?[A-Za-z][^>]*>/y], ['s', /"(?:\\.|[^"\\])*"|'[^']*'/y]],
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

