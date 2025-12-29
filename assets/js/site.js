function closeMobileNav(nav) {
  if (!nav) return;
  nav.classList.remove('open');
  const toggle = nav.querySelector('.nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  nav.querySelectorAll('.has-submenu.is-open').forEach((item) => {
    item.classList.remove('is-open');
    const btn = item.querySelector('a, button');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

(function () {

  function initLangDropdown() {
    const dropdowns = document.querySelectorAll('.lang-dropdown');
    if (!dropdowns.length) {
      console.warn('[lang] dropdown not found');
      return;
    }

    dropdowns.forEach((dropdown) => {
      const btn = dropdown.querySelector('.lang-btn');
      const menu = dropdown.querySelector('.lang-menu');
      if (!btn || !menu) return;

      if (dropdown.dataset.bound === '1') return;
      dropdown.dataset.bound = '1';

      function close() {
        dropdown.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }

      btn.addEventListener('click', (e) => {
        const nav = dropdown.closest('.nav');
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        if (nav && nav.classList.contains('open') && isMobile) {
          closeMobileNav(nav);
        }
        e.stopPropagation();
        dropdown.classList.toggle('open');
        btn.setAttribute('aria-expanded', dropdown.classList.contains('open') ? 'true' : 'false');
      });

      document.addEventListener('click', close);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
      });
    });

    console.log('[lang] dropdown initialized');
  }

  // Nav active
  function initNavActive() {
  const nav = document.querySelector('.nav-links');
  if (!nav) return;

  const links = Array.from(nav.querySelectorAll('a[href]'));
  if (!links.length) return;

  // 规范化 path：去掉末尾 /
  const currentPath = (location.pathname || '/').replace(/\/$/, '');
  const currentHash = (location.hash || '').toLowerCase();

  // 先清空
  links.forEach(a => a.classList.remove('active'));

  // 1) 优先处理：在首页并且有 #solutions → 高亮 Solutions
  const onIndex = /\/de\/index\.html$/.test(currentPath) || currentPath === '/de';
  if (onIndex && currentHash === '#solutions') {
    const sol = links.find(a => (a.getAttribute('href') || '').toLowerCase().includes('/de/index.html#solutions'));
    if (sol) sol.classList.add('active');
    return;
  }

  // 2) 普通页面：按 pathname 精确匹配（忽略 hash）
  const best = links.find(a => {
    const href = a.getAttribute('href') || '';
    // 只比较 pathname 部分
    const aPath = href.split('#')[0].replace(/\/$/, '');
    return aPath === currentPath;
  });

  // 3) 如果匹配不到（比如 /de/ 访问首页），兜底高亮 Home
  if (best) {
    best.classList.add('active');
  } else if (onIndex) {
    const home = links.find(a => (a.getAttribute('href') || '').replace(/\/$/, '') === '/de/index.html');
    if (home) home.classList.add('active');
  }
}

document.addEventListener('header:loaded', () => {
  initLangDropdown();
  initNavActive();
});

document.addEventListener('DOMContentLoaded', () => {
  initLangDropdown();
});

// hash 改变时（例如点击 Solutions 这种锚点）也更新一次
window.addEventListener('hashchange', initNavActive);
window.addEventListener('popstate', initNavActive);



})();

// ===== Mobile nav toggle (event delegation) =====
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.nav-toggle');
  if (!toggle) return;

  const nav = toggle.closest('.nav');
  if (!nav) return;

  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

document.addEventListener('click', (e) => {
  const openNavs = document.querySelectorAll('.nav.open');
  if (!openNavs.length) return;

  openNavs.forEach((nav) => {
    const clickedInsideNav = nav.contains(e.target);
    const clickedLang = e.target.closest('.lang-dropdown');
    if (!clickedInsideNav || clickedLang) {
      closeMobileNav(nav);
    }
  });
});

// ===== Mobile submenu toggle =====
document.addEventListener('click', (e) => {
  const link = e.target.closest('.has-submenu > a, .has-submenu > button');
  if (!link) return;

  if (link.tagName.toLowerCase() === 'a') {
    e.preventDefault();
  }

  const nav = link.closest('.nav');
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  if (!nav || !nav.classList.contains('open') || !isMobile) return;

  const item = link.parentElement;
  // Close other open submenus before toggling this one.
  nav.querySelectorAll('.has-submenu.is-open').forEach((openItem) => {
    if (openItem === item) return;
    openItem.classList.remove('is-open');
    const openBtn = openItem.querySelector('a, button');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
  });
  const isOpen = item.classList.toggle('is-open');
  link.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});






