/* ============================================
   visitor.js - 访客统计 & 留言板
   简洁、克制、真实
   ============================================ */

class VisitorTracker {
  constructor() {
    this.counterKey = SITE_CONFIG.visitor.counterKey;
    this.guestbookKey = SITE_CONFIG.visitor.guestbookKey;
    this.visitorId = this.getOrCreateVisitorId();
  }

  init() {
    this.recordVisit();
    this.render();
    this.bindEvents();
  }

  getOrCreateVisitorId() {
    let id = localStorage.getItem('ynxsg_visitor_id');
    if (!id) {
      id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ynxsg_visitor_id', id);
    }
    return id;
  }

  recordVisit() {
    let count = parseInt(localStorage.getItem(this.counterKey) || '0');
    const lastVisit = localStorage.getItem('ynxsg_last_visit');
    const today = new Date().toDateString();
    if (lastVisit !== today) {
      count++;
      localStorage.setItem(this.counterKey, count.toString());
      localStorage.setItem('ynxsg_last_visit', today);
    }
    const visitInfo = {
      id: this.visitorId,
      time: new Date().toISOString(),
      platform: this.getPlatform(),
    };
    const visits = JSON.parse(localStorage.getItem('ynxsg_visits') || '[]');
    visits.push(visitInfo);
    if (visits.length > 100) visits.shift();
    localStorage.setItem('ynxsg_visits', JSON.stringify(visits));
    return count;
  }

  count() {
    return parseInt(localStorage.getItem(this.counterKey) || '0');
  }

  getPlatform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Other';
  }

  render() {
    const counter = document.getElementById('stat-visitors');
    if (counter) counter.textContent = this.count();

    const list = document.getElementById('guestbook-list');
    if (!list) return;

    let entries = this.getGuestbook();
    if (entries.length === 0) {
      // 首次访问，添加示例留言
      const samples = [
        { id: 1, name: '小绿', message: '这里的绿荫好清爽，喜欢这种调调。', time: this.daysAgo(3) },
        { id: 2, name: '柚子', message: '路过，记一笔。', time: this.daysAgo(5) },
        { id: 3, name: '过客', message: '愿你夏日安好。', time: this.daysAgo(8) },
      ];
      localStorage.setItem(this.guestbookKey, JSON.stringify(samples));
      entries = samples;
    }

    list.innerHTML = entries.map(e => `
      <div class="visitor-item">
        <div class="visitor-msg">
          <div class="visitor-name">${this.escape(e.name)}</div>
          <div class="visitor-content">${this.escape(e.message)}</div>
        </div>
        <div class="visitor-time">${this.formatTime(e.time)}</div>
      </div>
    `).join('');
  }

  bindEvents() {
    const submitBtn = document.getElementById('guest-submit');
    if (submitBtn) submitBtn.addEventListener('click', () => this.submit());

    const msgInput = document.getElementById('guest-message');
    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.submit();
      });
    }
  }

  submit() {
    const nameInput = document.getElementById('guest-name');
    const msgInput = document.getElementById('guest-message');
    const name = nameInput.value.trim();
    const message = msgInput.value.trim();

    if (!name) {
      window.showToast('请输入昵称', 'error');
      nameInput.focus();
      return;
    }
    if (!message) {
      window.showToast('留句话吧', 'error');
      msgInput.focus();
      return;
    }

    const entry = {
      id: Date.now(),
      name,
      message,
      time: new Date().toISOString(),
    };

    let entries = this.getGuestbook();
    entries.unshift(entry);
    if (entries.length > 50) entries = entries.slice(0, 50);
    localStorage.setItem(this.guestbookKey, JSON.stringify(entries));

    nameInput.value = '';
    msgInput.value = '';

    this.render();
    window.showToast('已记录你的足迹', 'success');
  }

  getGuestbook() {
    try {
      return JSON.parse(localStorage.getItem(this.guestbookKey) || '[]');
    } catch {
      return [];
    }
  }

  daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  formatTime(iso) {
    const date = new Date(iso);
    const diff = Date.now() - date;
    const min = Math.floor(diff / 60000);
    const hour = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min} 分钟前`;
    if (hour < 24) return `${hour} 小时前`;
    if (day < 7) return `${day} 天前`;
    return `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
  }

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.visitorManager = new VisitorTracker();
