/**
 * 云端同步模块
 * 仓库：WJQ996723/WJQ996723
 * 作者：WJQ996723
 */

const CLOUD_CONFIG = {
    owner: 'WJQ996723',
    repo: 'WJQ996723',
    branch: 'main',
    token: '在这里粘贴你的Token',   // ← 只改这一行！
    path: 'data.json'
};

async function loadFromCloud() {
    const url = `https://api.github.com/repos/${CLOUD_CONFIG.owner}/${CLOUD_CONFIG.repo}/contents/${CLOUD_CONFIG.path}`;
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `token ${CLOUD_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (res.status === 404) return null;
        const data = await res.json();
        const content = atob(data.content.replace(/\n/g, ''));
        return { data: JSON.parse(content), sha: data.sha };
    } catch (e) {
        console.warn('云端加载失败:', e);
        return null;
    }
}

async function saveToCloud(stateObj, sha) {
    const url = `https://api.github.com/repos/${CLOUD_CONFIG.owner}/${CLOUD_CONFIG.repo}/contents/${CLOUD_CONFIG.path}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(stateObj, null, 2))));
    const body = {
        message: `更新数据 ${new Date().toLocaleString('zh-CN')}`,
        content: content,
        branch: CLOUD_CONFIG.branch
    };
    if (sha) body.sha = sha;
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${CLOUD_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return res.ok;
    } catch (e) {
        console.warn('云端保存失败:', e);
        return false;
    }
}

// 合并策略：云端优先，本地兜底
async function syncWithCloud() {
    const cloud = await loadFromCloud();
    if (cloud) {
        // 云端有数据，用云端的
        Object.assign(state, cloud.data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud.data));
        console.log('✅ 已从云端加载数据');
        return cloud.sha;
    } else {
        // 云端没有，把本地推上去
        const sha = await saveToCloud(state);
        console.log('✅ 已初始化云端数据');
        return sha;
    }
}

// 自动同步（每次操作后触发）
let syncTimer = null;
function autoSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
        await saveToCloud(state);
        console.log('☁️ 已自动同步到云端');
    }, 1500);
}
