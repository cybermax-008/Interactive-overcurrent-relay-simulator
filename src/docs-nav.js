// Self-contained site navigation bar — injects CSS + HTML into any page.
// Used on simulator, docs, and blog pages.

const NAV_LINKS = [
  { href: '/', label: 'Simulator', section: '' },
  { href: '/docs/', label: 'Docs', section: 'docs' },
  { href: '/blog/', label: 'Blog', section: 'blog' },
];

const GITHUB_URL = 'https://github.com/cybermax-008/Interactive-overcurrent-relay-simulator';

function getActiveSection() {
  const p = location.pathname;
  if (p.startsWith('/docs')) return 'docs';
  if (p.startsWith('/blog')) return 'blog';
  return '';
}

function createNav() {
  const style = document.createElement('style');
  style.textContent = `
    .site-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:48px;
      background:rgba(10,14,23,0.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
      border-bottom:1px solid #1e293b;display:flex;align-items:center;padding:0 24px;
      font-family:'JetBrains Mono',monospace;}
    .site-nav-brand{color:#f59e0b;font-weight:600;font-size:0.8rem;text-decoration:none;
      display:flex;align-items:center;gap:8px;white-space:nowrap;}
    .site-nav-links{display:flex;gap:4px;margin-left:auto;}
    .site-nav-link{color:#8494a7;text-decoration:none;font-size:0.72rem;font-weight:500;
      padding:6px 14px;border-radius:6px;transition:background 0.2s,color 0.2s;}
    .site-nav-link:hover{color:#e2e8f0;background:rgba(255,255,255,0.05);}
    .site-nav-link.active{color:#f59e0b;background:rgba(245,158,11,0.1);}
    .site-nav-gh{color:#8494a7;text-decoration:none;font-size:0.85rem;margin-left:12px;
      padding:4px;transition:color 0.2s;}
    .site-nav-gh:hover{color:#e2e8f0;}
    .site-nav-toggle{display:none;margin-left:auto;background:none;border:none;
      color:#8494a7;font-size:1.2rem;cursor:pointer;padding:4px 8px;}
    body{padding-top:48px!important;}
    @media(max-width:640px){
      .site-nav{padding:0 12px;}
      .site-nav-toggle{display:block;}
      .site-nav-links{display:none;position:absolute;top:48px;left:0;right:0;
        background:#111827;flex-direction:column;padding:8px;border-bottom:1px solid #1e293b;
        gap:2px;}
      .site-nav-links.open{display:flex;}
      .site-nav-link{padding:10px 14px;}
      .site-nav-gh{display:none;}
    }
  `;
  document.head.appendChild(style);

  const active = getActiveSection();
  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.innerHTML = `
    <a href="/" class="site-nav-brand">\u26a1 IDMT Relay Simulator</a>
    <button class="site-nav-toggle" aria-label="Toggle navigation">\u2630</button>
    <div class="site-nav-links">
      ${NAV_LINKS.map(l =>
        `<a href="${l.href}" class="site-nav-link${active === l.section ? ' active' : ''}">${l.label}</a>`
      ).join('')}
    </div>
    <a href="${GITHUB_URL}" class="site-nav-gh" target="_blank" rel="noopener" aria-label="GitHub repository">\u2B50</a>
  `;
  document.body.prepend(nav);

  const toggle = nav.querySelector('.site-nav-toggle');
  const links = nav.querySelector('.site-nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    // Close on link click (mobile)
    links.querySelectorAll('.site-nav-link').forEach(a =>
      a.addEventListener('click', () => links.classList.remove('open'))
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createNav);
} else {
  createNav();
}
