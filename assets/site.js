// Tiny vanilla enhancements: theme toggle, copy buttons, mobile nav.
(function () {
  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');
  function paint() { toggle.textContent = root.dataset.theme === 'dark' ? 'Light' : 'Dark'; }
  toggle.addEventListener('click', function () {
    var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('haikei-theme', next); } catch (e) {}
    paint();
  });
  paint();

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
