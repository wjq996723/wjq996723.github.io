/* ============================================
   diary.js - 日记渲染与管理
   克制、自然、真实质感
   ============================================ */

class DiaryManager {
  constructor() {
    this.diaries = [];
    this.allTags = [];
    this.activeTag = 'all';
    this.searchQuery = '';
    this.currentDiaryId = null;
  }

  async load() {
    try {
      if (typeof isGithubConfigured === 'function' && isGithubConfigured()) {
        await this.loadFromGithub();
      } else {
        await this.loadFromLocal();
      }
    } catch (err) {
      console.warn('加载失败，使用本地数据:', err);
      await this.loadFromLocal();
    }
    this.mergeDrafts();
    this.diaries.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.extractTags();
  }

  async loadFromLocal() {
    try {
      const resp = await fetch('data/diaries.json?t=' + Date.now());
      if (resp.ok) {
        const data = await resp.json();
        this.diaries = data.diaries || data || [];
      } else {
        this.diaries = this.getSampleDiaries();
      }
    } catch {
      this.diaries = this.getSampleDiaries();
    }
  }

  async loadFromGithub() {
    const { owner, repo, branch, token, dataFile } = SITE_CONFIG.github;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dataFile}?ref=${branch}`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (!resp.ok) throw new Error('GitHub API error: ' + resp.status);
    const data = await resp.json();
    const content = atob(data.content.replace(/\n/g, ''));
    const parsed = JSON.parse(content);
    this.diaries = parsed.diaries || parsed || [];
    this.githubSha = data.content.sha;
  }

  async saveToGithub() {
    const { owner, repo, branch, token, dataFile } = SITE_CONFIG.github;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dataFile}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify({ diaries: this.diaries }, null, 2))));
    const body = {
      message: `更新日记 ${new Date().toLocaleString('zh-CN')}`,
      content: content,
      branch: branch,
    };
    if (this.githubSha) body.sha = this.githubSha;

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.message || '保存失败');
    }
    const data = await resp.json();
    this.githubSha = data.content.sha;
    return data;
  }

  mergeDrafts() {
    const drafts = JSON.parse(localStorage.getItem('ynxsg_drafts') || '[]');
    drafts.forEach(d => {
      if (!this.diaries.find(x => x.id === d.id)) {
        this.diaries.unshift(d);
      }
    });
  }

  extractTags() {
    const map = {};
    this.diaries.forEach(d => {
      (d.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; });
    });
    this.allTags = Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  stats() {
    return { diaries: this.diaries.length, tags: this.allTags.length };
  }

  renderList() {
    const container = document.getElementById('diary-list');
    const empty = document.getElementById('empty-state');
    if (!container) return;

    let filtered = this.diaries;
    if (this.activeTag !== 'all') {
      filtered = filtered.filter(d => (d.tags || []).includes(this.activeTag));
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.content || '').toLowerCase().includes(q) ||
        (d.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    container.innerHTML = filtered.map(d => this.renderCard(d)).join('');

    container.querySelectorAll('.diary-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = `#/diary/${card.dataset.id}`;
      });
    });
  }

  renderCard(d) {
    const excerpt = this.stripMarkdown(d.content || '').substring(0, 100);
    const more = (d.content || '').length > 100 ? '……' : '';
    const tags = (d.tags || []).map(t => `<span class="diary-tag">${this.escape(t)}</span>`).join('');
    const cover = (d.images && d.images.length > 0)
      ? `<img src="${d.images[0]}" alt="${this.escape(d.title)}" loading="lazy" style="width:100%;max-height:280px;object-fit:cover;border-radius:var(--r-md);margin-bottom:1rem;">`
      : '';

    return `
      <article class="diary-card" data-id="${d.id}">
        ${cover}
        <div class="diary-date">${this.formatDate(d.date)}</div>
        <h3 class="diary-title">${this.escape(d.title || '无题')}</h3>
        <p class="diary-excerpt">${this.escape(excerpt)}${more}</p>
        <div class="diary-tags">${tags}</div>
      </article>
    `;
  }

  renderDetail(id) {
    const container = document.getElementById('diary-detail');
    if (!container) return;

    const diary = this.diaries.find(d => d.id == id);
    if (!diary) {
      container.innerHTML = `
        <a href="#/" class="back-link">← 返回首页</a>
        <p style="text-align:center;color:var(--ink-faded);padding:4rem 0;">找不到这篇日记</p>
      `;
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    this.currentDiaryId = diary.id;
    const contentHtml = this.renderMarkdown(diary.content || '');

    const imagesHtml = (diary.images || []).map(url =>
      `<img src="${url}" alt="" loading="lazy" style="width:100%;border-radius:var(--r-md);margin:1.5rem 0;cursor:pointer;" onclick="window.openLightbox('${url}')">`
    ).join('');

    const videosHtml = (diary.videos || []).map(url => {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = this.extractYouTubeId(url);
        return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:var(--r-md);margin:1.5rem 0;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div>`;
      }
      if (url.includes('bilibili.com')) {
        const bvid = this.extractBilibiliId(url);
        return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:var(--r-md);margin:1.5rem 0;"><iframe src="https://player.bilibili.com/player.html?bvid=${bvid}&page=1" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen scrolling="no"></iframe></div>`;
      }
      return `<video src="${url}" controls style="width:100%;border-radius:var(--r-md);margin:1.5rem 0;"></video>`;
    }).join('');

    const tagsHtml = (diary.tags || []).map(t =>
      `<span class="diary-tag" style="cursor:pointer;" onclick="window.diaryManager.filterByTag('${this.escape(t)}')">${this.escape(t)}</span>`
    ).join('');

    const idx = this.diaries.findIndex(d => d.id === diary.id);
    const prev = idx < this.diaries.length - 1 ? this.diaries[idx + 1] : null;
    const next = idx > 0 ? this.diaries[idx - 1] : null;

    container.innerHTML = `
      <a href="#/" class="back-link">← 返回</a>
      <header class="diary-detail-header">
        <div class="diary-detail-date">${this.formatDate(diary.date)}</div>
        <h1 class="diary-detail-title">${this.escape(diary.title || '无题')}</h1>
        <div class="diary-detail-meta">
          <span>${tagsHtml || ''}</span>
        </div>
      </header>
      <div class="diary-detail-body">
        ${contentHtml}
        ${imagesHtml}
        ${videosHtml}
      </div>
      <nav style="display:flex;justify-content:space-between;gap:1rem;margin-top:3rem;padding-top:2rem;border-top:1px solid var(--line);font-size:0.875rem;">
        ${prev ? `<a href="#/diary/${prev.id}" class="back-link" style="margin:0;">← ${this.escape(prev.title || '上一篇')}</a>` : '<span></span>'}
        ${next ? `<a href="#/diary/${next.id}" class="back-link" style="margin:0;">${this.escape(next.title || '下一篇')} →</a>` : '<span></span>'}
      </nav>
    `;

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  renderTagCloud() {
    const container = document.getElementById('tag-cloud');
    if (!container) return;
    if (this.allTags.length === 0) {
      container.innerHTML = '<p style="color:var(--ink-faded)">暂无标签</p>';
      return;
    }
    container.innerHTML = this.allTags.map(t => `
      <span class="tag-chip ${this.activeTag === t.name ? 'active' : ''}" data-tag="${this.escape(t.name)}">
        ${this.escape(t.name)} <span style="opacity:0.5;font-size:0.85em;">${t.count}</span>
      </span>
    `).join('');
    container.querySelectorAll('.tag-chip').forEach(c => {
      c.addEventListener('click', () => this.filterByTag(c.dataset.tag));
    });
  }

  renderTagFilter() {
    const container = document.getElementById('tag-filter');
    if (!container) return;
    const tags = this.allTags.slice(0, 8);
    container.innerHTML = `
      <span class="tag-chip ${this.activeTag === 'all' ? 'active' : ''}" data-tag="all">全部</span>
      ${tags.map(t => `
        <span class="tag-chip ${this.activeTag === t.name ? 'active' : ''}" data-tag="${this.escape(t.name)}">${this.escape(t.name)}</span>
      `).join('')}
    `;
    container.querySelectorAll('.tag-chip').forEach(c => {
      c.addEventListener('click', () => {
        this.activeTag = c.dataset.tag;
        this.renderTagFilter();
        this.renderList();
      });
    });
  }

  filterByTag(tag) {
    this.activeTag = tag;
    window.location.hash = '#/';
    setTimeout(() => {
      this.renderTagFilter();
      this.renderList();
    }, 50);
  }

  // ===== 工具 =====
  renderMarkdown(content) {
    if (typeof marked !== 'undefined') {
      marked.setOptions({ breaks: true, gfm: true });
      const html = marked.parse(content);
      return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(html) : html;
    }
    return content.split('\n').map(l => `<p>${this.escape(l)}</p>`).join('');
  }

  stripMarkdown(content) {
    return content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/>\s/g, '')
      .replace(/[-*+]\s/g, '')
      .replace(/\n+/g, ' ')
      .trim();
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getFullYear()} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${String(d.getDate()).padStart(2, '0')}`;
  }

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  extractYouTubeId(url) {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?]+)/);
    return m ? m[1] : '';
  }

  extractBilibiliId(url) {
    const m = url.match(/bilibili\.com\/video\/(BV\w+)/);
    return m ? m[1] : '';
  }

  addDiary(diary) {
    diary.id = diary.id || 'd_' + Date.now();
    diary.date = diary.date || new Date().toISOString().split('T')[0];
    this.diaries.unshift(diary);
    this.diaries.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.extractTags();
    return diary;
  }

  async saveDiary(diary) {
    const idx = this.diaries.findIndex(d => d.id === diary.id);
    if (idx >= 0) this.diaries[idx] = diary;
    else this.addDiary(diary);

    if (typeof isGithubConfigured === 'function' && isGithubConfigured()) {
      try {
        await this.saveToGithub();
        window.showToast('日记已同步到 GitHub', 'success');
        return true;
      } catch (err) {
        this.saveDraft(diary);
        window.showToast('保存失败，已存到本地草稿', 'error');
        return false;
      }
    } else {
      this.saveDraft(diary);
      window.showToast('已保存到本地（配置 GitHub Token 后可在线同步）', 'info');
      return true;
    }
  }

  saveDraft(diary) {
    let drafts = JSON.parse(localStorage.getItem('ynxsg_drafts') || '[]');
    const i = drafts.findIndex(d => d.id === diary.id);
    if (i >= 0) drafts[i] = diary;
    else drafts.unshift(diary);
    localStorage.setItem('ynxsg_drafts', JSON.stringify(drafts));
  }

  getSampleDiaries() {
    return [
      {
        id: 'sample_1',
        title: '六月夏天的午后',
        date: '2026-06-15',
        tags: ['生活', '夏天', '心情'],
        content: `## 绿荫下的时光

六月的阳光总是热烈而温暖，穿过路旁茂密的梧桐叶，在地上洒下一片片斑驳的光影。

我坐在树下的长椅上，手里捧着一杯冰凉的芋泥香柑茶，耳机里循环播放着周杰伦的《爱在西元前》。

> 微风吹过，带来了夏天的味道。

### 今天的小确幸

- 在路边发现了一朵小小的野花
- 买到了最后一杯芋泥香柑茶
- 阳光刚好不会太烫，晒得人暖暖的

这样的午后，真好。`,
        images: [],
        videos: [],
      },
      {
        id: 'sample_2',
        title: '一本好书 · 《小王子》',
        date: '2026-06-10',
        tags: ['读书', '心情'],
        content: `## 重读《小王子》

每次读《小王子》，都会有新的感触。

\`\`\`
"真正重要的东西，用眼睛是看不见的。"
\`\`\`

小王子说，他的玫瑰之所以特别，不是因为她比其他玫瑰更美，而是因为他**驯服**了她，对她负有责任。

### 摘录

> 你为你的玫瑰花费的时间，使你的玫瑰变得如此重要。

也许我们每个人心里都有一朵玫瑰，值得我们用心去守护。`,
        images: [],
        videos: [],
      },
      {
        id: 'sample_3',
        title: '音乐分享 · 周杰伦',
        date: '2026-06-05',
        tags: ['音乐', '周杰伦'],
        content: `## 爱在西元前

周杰伦的歌，总能带我回到那些夏天的午后。

*祭司 神殿 征战 弓箭 是谁的从前*
*喜欢在人潮中你只属于我的那画面*

这首歌有一种穿越时空的浪漫感，像是在古老的文明中寻找爱情的痕迹。

### 我的歌单

1. 爱在西元前
2. 简单爱
3. 晴天
4. 七里香
5. 稻香

每一首都是回忆。`,
        images: [],
        videos: [],
      },
      {
        id: 'sample_4',
        title: '初夏的绿',
        date: '2026-06-20',
        tags: ['夏天', '自然'],
        content: `## 一场夏雨后

午后下过一场雨，整个城市都洗净了。

推开窗，深吸一口气——是泥土混着青草的味道。

路边的梧桐叶绿得发亮，每一片叶子都挂着小小的水珠。阳光重新出来的时候，那些水珠就像散落的宝石，闪闪发光。

有时候觉得，所谓的小确幸，就是这样不经意间撞见的美。`,
        images: [],
        videos: [],
      },
      {
        id: 'sample_5',
        title: '一杯冰茶的时间',
        date: '2026-06-12',
        tags: ['生活', '美食'],
        content: `## 慢下来的午后

点了一杯冰摇香柑茶，坐在咖啡厅的角落，看窗下行人来来往往。

时间在这里似乎变慢了。

我把思绪放空，只是单纯地看着，看阳光从窗帘的缝隙透进来，看灰尘在光柱里慢悠悠地飘。

这样的时光，难得。`,
        images: [],
        videos: [],
      },
      {
        id: 'sample_6',
        title: '夜读札记',
        date: '2026-06-08',
        tags: ['读书', '心情'],
        content: `## 关于村上春树

最近在读《挪威的森林》。

村上的文字有一种独特的味道，安静却不平淡，就像深夜里一个人的咖啡。

> "没有人喜欢孤独，只是不想失望罢了。"

有时候会想，我们是不是都在这样的矛盾中，活成了自己都认不出来的样子。`,
        images: [],
        videos: [],
      },
    ];
  }
}

window.diaryManager = new DiaryManager();
