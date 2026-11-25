export function mount(el, data, ctx) {
  if (!document.querySelector('link[data-course-widget="_stub"]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/assets/course/widgets/_stub.css';
    css.dataset.courseWidget = '_stub'; document.head.append(css);
  }
  el.textContent = el.dataset.widget || 'Widget';
}
