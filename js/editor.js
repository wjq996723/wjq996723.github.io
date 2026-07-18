/* ============================================
   editor.js - 在线编辑器
   简洁版：标题/日期/标签/图片视频/Markdown/实时预览/GitHub 保存
   ============================================ */

class DiaryEditor {
  constructor() {
    this.titleInput = document.getElementById('edit-title');
    this.dateInput = document.getElementById('edit-date');
    this.tagsInput = document.getElementById('edit-tags');
    this.imagesInput = document.getElementById('edit-images');
    this.videosInput = document.getElementById('edit-videos');
    this.contentInput = document.getElementById('edit-content');
    this.preview = document.getElementById('edit-preview');
  }

  init() {
    this.bindEvents();
    this.checkConfig();
    this.setDefaultDate();
    this.updatePreview();
  }

  bindEvents() {
    if (this.contentInput) {
      this.contentInput.addEventListener('input', () => this.updatePreview());
    }
    const saveBtn = document.getElementById('btn-save-diary');
    if (saveBtn) saveBtn.addEventListener('click', () => this.save());
    const clearBtn = document.getElementById('btn-clear-diary');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clear());

    const showCfg = document.getElementById('show-token-config');
    if (showCfg) {
      showCfg.addEventListener('click', () => {
        const cfg = document.getElementById('token-config');
        if (cfg) cfg.style.display = 'block';
        this.loadConfigForm();
      });
    }
    const saveCfg = document.getElementById('save-config');
    if (saveCfg) saveCfg.addEventListener('click', () => this.saveConfig());
    const cancelCfg = document.getElementById('cancel-config');
    if (cancelCfg) {
      cancelCfg.addEventListener('click', () => {
        const cfg = document.getElementById('token-config');
        if (cfg) cfg.style.display = 'none';
      });
    }
  }

  checkConfig() {
    const warn = document.getElementById('editor-warning');
    if (!warn) return;
    warn.style.display = isGithubConfigured() ? 'none' : 'block';
  }

  setDefaultDate() {
    if (this.dateInput) this.dateInput.value = new Date().toISOString().split('T')[0];
  }

  loadConfigForm() {
    const g = SITE_CONFIG.github;
    const o = document.getElementById('cfg-owner');
    const r = document.getElementById('cfg-repo');
    const b = document.getElementById('cfg-branch');
    const t = document.getElementById('cfg-token');
    if (o) o.value = g.owner || '';
    if (r) r.value = g.repo || '';
    if (b) b.value = g.branch || 'main';
    if (t) t.value = g.token || '';
  }

  saveConfig() {
    const o = document.getElementById('cfg-owner').value.trim();
    const r = document.getElementById('cfg-repo').value.trim();
    const b = document.getElementById('cfg-branch').value.trim() || 'main';
    const t = document.getElementById('cfg-token').value.trim();
    if (!o || !r || !t) {
      window.showToast('请填写完整信息', 'error');
      return;
    }
    SITE_CONFIG.github = { ...SITE_CONFIG.github, owner: o, repo: r, branch: b, token: t };
    localStorage.setItem('ynxsg_github', JSON.stringify({ owner: o, repo: r, branch: b, token: t }));
    window.showToast('配置已保存', 'success');
    document.getElementById('token-config').style.display = 'none';
    this.checkConfig();
  }

  updatePreview() {
    if (!this.preview || !this.contentInput) return;
    const text = this.contentInput.value;
    if (!text.trim()) {
      this.preview.innerHTML = '<p style="color:var(--ink-light);font-style:italic;">预览区域</p>';
      return;
    }
    if (typeof marked !== 'undefined') {
      const html = marked.parse(text);
      this.preview.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
    } else {
      this.preview.innerHTML = text.split('\n').map(l => `<p>${this.escape(l)}</p>`).join('');
    }
  }

  async save() {
    const title = this.titleInput.value.trim();
    const content = this.contentInput.value.trim();
    if (!title) {
      window.showToast('请填写标题', 'error');
      this.titleInput.focus();
      return;
    }
    if (!content) {
      window.showToast('内容不能为空', 'error');
      this.contentInput.focus();
      return;
    }

    const diary = {
      id: 'd_' + Date.now(),
      title,
      date: this.dateInput.value || new Date().toISOString().split('T')[0],
      tags: this.tagsInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      images: this.imagesInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      videos: this.videosInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      content,
    };

    const saveBtn = document.getElementById('btn-save-diary');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中…';
    }

    const ok = await window.diaryManager.saveDiary(diary);

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存日记';
    }

    if (ok) {
      this.clear();
      if (window.app && window.app.updateStats) window.app.updateStats();
      // 重新渲染首页列表与标签，让新日记立即可见
      if (window.diaryManager) {
        window.diaryManager.renderTagFilter();
        window.diaryManager.renderList();
      }
      // 跳回首页
      setTimeout(() => { window.location.hash = '#/'; }, 600);
    }
  }

  clear() {
    if (this.titleInput) this.titleInput.value = '';
    if (this.tagsInput) this.tagsInput.value = '';
    if (this.imagesInput) this.imagesInput.value = '';
    if (this.videosInput) this.videosInput.value = '';
    if (this.contentInput) this.contentInput.value = '';
    this.setDefaultDate();
    this.updatePreview();
  }

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.diaryEditor = new DiaryEditor();
