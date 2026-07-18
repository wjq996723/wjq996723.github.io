/* ============================================
   app.js - 主应用逻辑 & 路由
   ============================================ */

// ===== Toast 提示 =====
window.showToast = function(message, type = 'info', duration = 2400) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
};

// ===== 图片灯箱 =====
window.openLightbox = function(url) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (!lightbox) return;
  img.src = url;
  lightbox.classList.add('show');
};

// ===== 路由 =====
class Router {
  constructor() {
    this.routes = {
      '/': 'view-home',
      '/tags': 'view-tags',
      '/about': 'view-about',
      '/editor': 'view-editor',
    };
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const parts = hash.split('/').filter(Boolean);

    document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    let viewId = 'view-home';
    let navRoute = '/';

    if (parts.length === 0) {
      viewId = 'view-home';
      navRoute = '/';
      if (window.diaryManager) {
        window.diaryManager.renderTagFilter();
        window.diaryManager.renderList();
      }
    } else if (parts[0] === 'diary' && parts[1]) {
      viewId = 'view-diary';
      window.diaryManager.renderDetail(parts[1]);
    } else if (parts[0] === 'tags') {
      viewId = 'view-tags';
      navRoute = '/tags';
      window.diaryManager.renderTagCloud();
    } else if (parts[0] === 'about') {
      viewId = 'view-about';
      navRoute = '/about';
      if (window.visitorManager) window.visitorManager.render();
    } else if (parts[0] === 'editor') {
      viewId = 'view-editor';
      navRoute = '/editor';
    }

    const view = document.getElementById(viewId);
    if (view) view.classList.add('view-active');

    const navLink = document.querySelector(`.nav-link[data-route="${navRoute}"]`);
    if (navLink) navLink.classList.add('active');

    const menu = document.getElementById('nav-menu');
    if (menu) menu.classList.remove('open');

    if (viewId !== 'view-diary') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
}

// ===== App =====
class App {
  constructor() { this.init(); }

  async init() {
    // 隐藏加载屏
    setTimeout(() => {
      const ls = document.getElementById('loading-screen');
      if (ls) ls.classList.add('hidden');
    }, 1000);

    this.bindNav();
    this.bindLightbox();
    this.bindSearch();

    // 加载数据
    if (window.diaryManager) await window.diaryManager.load();
    if (window.visitorManager) window.visitorManager.init();
    if (window.diaryEditor) window.diaryEditor.init();

    this.router = new Router();

    // 初始统计
    if (window.diaryManager) {
      window.diaryManager.renderTagFilter();
      window.diaryManager.renderList();
      this.updateStats();
    }
  }

  updateStats() {
    const s = window.diaryManager.stats();
    const v = document.getElementById('stat-diaries');
    const t = document.getElementById('stat-tags');
    const vis = document.getElementById('stat-visitors');
    if (v) v.textContent = s.diaries;
    if (t) t.textContent = s.tags;
    if (vis && window.visitorManager) vis.textContent = window.visitorManager.count();
  }

  bindNav() {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('nav-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => menu.classList.toggle('open'));
    }
  }

  bindLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.getElementById('lightbox-close');
    if (!lightbox) return;
    if (closeBtn) closeBtn.addEventListener('click', () => lightbox.classList.remove('show'));
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.classList.remove('show');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') lightbox.classList.remove('show');
    });
  }

  bindSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    let timer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.diaryManager.searchQuery = e.target.value.trim();
        window.diaryManager.renderList();
      }, 200);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
