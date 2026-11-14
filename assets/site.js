// Tiny vanilla enhancements: theme toggle, copy buttons, mobile nav, GA4 events.
(function () {
  // GA4 events (C4). gtag is absent on localhost or when blocked, so track() is a no-op then.
  function track(name, params) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
    } catch (e) {}
  }
  // The build sets data-assistant on skills commands; the -a flag is the fallback.
  function classifyCopy(text, assistant, page) {
    if (/\bskills add\b/.test(text)) {
      var flag = text.match(/\s-a\s+([\w-]+)/);
      return { name: 'skills_command_copy', params: { assistant: assistant || (flag ? flag[1] : 'auto'), page: page } };
    }
    var language = /\b(npm (install|i)|pnpm add|yarn add)\b/.test(text) ? 'ts'
      : /\b(pip3? install|uv (add|pip install))\b/.test(text) ? 'python'
      : /\bgo (get|install)\b/.test(text) ? 'go' : '';
    return language ? { name: 'sdk_install_copy', params: { language: language } } : null;
  }
  function outboundDestination(href) {
    var host;
    try { host = new URL(href).hostname; } catch (e) { return null; }
    if (host === 'github.com' || host.slice(-11) === '.github.com') return 'github';
    if (host === 'discord.gg' || host === 'discord.com' || host.slice(-12) === '.discord.com') return 'discord';
    if (host === 'substack.com' || host.slice(-13) === '.substack.com') return 'substack';
    return null;
  }
  window.haikeiAnalytics = { track: track, classifyCopy: classifyCopy, outboundDestination: outboundDestination };

  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');
  function renderMermaid() {
    if (!window.mermaid) return;
    var dark = root.dataset.theme === 'dark';
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: dark ? {
        background: '#07110d', primaryColor: '#064e3b', primaryTextColor: '#f6f8f6',
        primaryBorderColor: '#34d399', lineColor: '#6ee7b7', secondaryColor: '#0f1c17',
        tertiaryColor: '#0b1712', nodeTextColor: '#f6f8f6', mainBkg: '#064e3b',
        clusterBkg: '#0f1c17', clusterBorder: '#34d399', edgeLabelBackground: '#0f1c17',
        fontFamily: 'Inter, system-ui, sans-serif'
      } : {
        background: '#f6f8f6', primaryColor: '#d1fae5', primaryTextColor: '#07110d',
        primaryBorderColor: '#047857', lineColor: '#047857', secondaryColor: '#ffffff',
        tertiaryColor: '#ecfdf5', nodeTextColor: '#07110d', mainBkg: '#d1fae5',
        clusterBkg: '#ffffff', clusterBorder: '#047857', edgeLabelBackground: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif'
      }
    });
    var wrappers = document.querySelectorAll('.mermaid-wrap');
    wrappers.forEach(function (wrapper) {
      wrapper.innerHTML = '<pre class="mermaid"></pre>';
      wrapper.firstElementChild.textContent = wrapper.getAttribute('data-source');
    });
    window.mermaid.run({ nodes: document.querySelectorAll('pre.mermaid') });
  }
  function paint() { toggle.textContent = root.dataset.theme === 'dark' ? 'Light' : 'Dark'; }
  toggle.addEventListener('click', function () {
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('haikei-theme', next); } catch (e) {}
    paint();
    renderMermaid();
  });
  paint();
  renderMermaid();

  var nav = document.querySelector('.nav-toggle');
  nav.addEventListener('click', function () {
    var open = document.body.classList.toggle('nav-open');
    nav.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest('.copy');
    if (!button) return;
    var block = button.closest('.code-block');
    var code = block.querySelector('code').textContent;
    var copied = classifyCopy(code, block.getAttribute('data-assistant') || '', location.pathname);
    if (copied) track(copied.name, copied.params);
    var done = function () {
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = 'Copy'; }, 1500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done);
  });

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var card = link.closest('.path-card[data-path]');
    if (card) track('path_choice', { path: card.getAttribute('data-path') });
    var destination = outboundDestination(link.href);
    if (destination) track('outbound_click', { destination: destination });
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('button[data-checkpoint]');
    if (!button) return;
    var main = button.closest('main[data-tutorial]');
    if (!main) return;
    track(button.getAttribute('data-checkpoint'), { tutorial: main.getAttribute('data-tutorial'), language: button.getAttribute('data-language') });
    var confirmation = button.nextElementSibling;
    if (confirmation) confirmation.textContent = 'Nice.';
  });

  // tutorial_start: once the reader scrolls past the "Before you start" heading.
  var tutorialMain = document.querySelector('main[data-tutorial]');
  var start = tutorialMain && tutorialMain.querySelector('#before-you-start');
  if (start) {
    var onScroll = function () {
      if (start.getBoundingClientRect().bottom >= 0) return;
      window.removeEventListener('scroll', onScroll);
      track('tutorial_start', { tutorial: tutorialMain.getAttribute('data-tutorial') });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
