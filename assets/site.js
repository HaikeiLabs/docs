// Tiny vanilla enhancements: theme toggle, copy buttons, mobile nav.
(function () {
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
    var code = button.closest('.code-block').querySelector('code').textContent;
    var done = function () {
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = 'Copy'; }, 1500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done);
  });
})();
