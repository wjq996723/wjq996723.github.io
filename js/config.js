/* ============================================
   config.js - 站点配置
   ============================================ */

const SITE_CONFIG = {
  // 站点信息
  siteName: '芋泥球香柑.日记',
  siteAuthor: '芋泥球香柑',

  // GitHub 仓库配置 (部署后修改)
  github: {
    owner: '',           // GitHub 用户名
    repo: '',            // 仓库名
    branch: 'main',      // 分支名
    token: '',           // Personal Access Token (存于 localStorage)
    dataFile: 'data/diaries.json',  // 日记数据文件路径
  },

  // 音乐播放器配置
  music: {
    // 爱在西元前 - 周杰伦
    // 音频源：可替换为本地文件 /assets/audio/love-before-bc.mp3
    songs: [
      {
        title: '爱在西元前',
        artist: '周杰伦',
        // 尝试多个音频源，按顺序加载
        sources: [
          '/assets/audio/love-before-bc.mp3',
          // 备用在线源（如有可用的音乐API）
        ],
        cover: '🎶',
      },
    ],
    autoplay: true,       // 尝试自动播放
    defaultVolume: 0.4,   // 默认音量 (0-1)
    loop: true,           // 循环播放
  },

  // Giscus 评论系统配置 (部署后修改)
  // 参考: https://giscus.app
  giscus: {
    enabled: false,       // 部署后设为 true
    repo: '',             // 如 'username/repo'
    repoId: '',           // 从 giscus.app 获取
    category: 'Announcements',
    categoryId: '',       // 从 giscus.app 获取
    mapping: 'pathname',
    theme: 'light',
    lang: 'zh-CN',
  },

  // 访客统计配置
  visitor: {
    // 使用 localStorage 存储访客信息 (本地统计)
    // 如需跨访客统计，推荐接入 GoatCounter / Umami 等
    counterKey: 'ynxsg_visitor_count',
    guestbookKey: 'ynxsg_guestbook',
  },
};

// 从 localStorage 加载 GitHub 配置
function loadGithubConfig() {
  const saved = localStorage.getItem('ynxsg_github');
  if (saved) {
    try {
      const cfg = JSON.parse(saved);
      Object.assign(SITE_CONFIG.github, cfg);
    } catch (e) {
      console.warn('Failed to load GitHub config:', e);
    }
  }
}

// 保存 GitHub 配置到 localStorage
function saveGithubConfig(cfg) {
  Object.assign(SITE_CONFIG.github, cfg);
  localStorage.setItem('ynxsg_github', JSON.stringify({
    owner: SITE_CONFIG.github.owner,
    repo: SITE_CONFIG.github.repo,
    branch: SITE_CONFIG.github.branch,
    token: SITE_CONFIG.github.token,
  }));
}

// 检查是否已配置 GitHub
function isGithubConfigured() {
  return !!(SITE_CONFIG.github.owner && SITE_CONFIG.github.repo && SITE_CONFIG.github.token);
}

// 初始化
loadGithubConfig();
