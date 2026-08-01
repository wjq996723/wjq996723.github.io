(() => {
  "use strict";

  const WIDTH = 420;
  const HEIGHT = 760;
  const LANES = [90, 210, 330];
  const BASE_Y = 592;

  const LEVELS = [
    { name: "晨风草原", sky: ["#58c9d4", "#dff6d4"], ground: "#58b879", jumps: 12, jumpMs: 1220, hazard: 0.10, doubleCloud: 0.95, doubleBolt: 0.00 },
    { name: "蜜橙峡谷", sky: ["#70cbd0", "#ffe1a1"], ground: "#d97854", jumps: 13, jumpMs: 1180, hazard: 0.18, doubleCloud: 0.84, doubleBolt: 0.00 },
    { name: "翡翠雨林", sky: ["#3e9f9b", "#bbdd9b"], ground: "#337b62", jumps: 14, jumpMs: 1140, hazard: 0.25, doubleCloud: 0.76, doubleBolt: 0.05 },
    { name: "风铃雪峰", sky: ["#68accb", "#edf8f4"], ground: "#7997aa", jumps: 15, jumpMs: 1090, hazard: 0.31, doubleCloud: 0.68, doubleBolt: 0.10 },
    { name: "暮色浮岛", sky: ["#5f719b", "#ef9d75"], ground: "#69577d", jumps: 16, jumpMs: 1050, hazard: 0.37, doubleCloud: 0.60, doubleBolt: 0.18 },
    { name: "星砂云海", sky: ["#324e78", "#69afae"], ground: "#376e77", jumps: 17, jumpMs: 1010, hazard: 0.42, doubleCloud: 0.52, doubleBolt: 0.26 },
    { name: "雷鸣天阶", sky: ["#343d61", "#7c829b"], ground: "#414966", jumps: 18, jumpMs: 960, hazard: 0.49, doubleCloud: 0.44, doubleBolt: 0.35 },
    { name: "王冠之巅", sky: ["#263b5d", "#d88872"], ground: "#54466b", jumps: 20, jumpMs: 920, hazard: 0.55, doubleCloud: 0.38, doubleBolt: 0.44 }
  ];

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ui = {
    menu: document.getElementById("menuPanel"),
    message: document.getElementById("messagePanel"),
    pause: document.getElementById("pausePanel"),
    start: document.getElementById("startButton"),
    continue: document.getElementById("continueButton"),
    savedLevel: document.getElementById("savedLevel"),
    next: document.getElementById("nextButton"),
    retry: document.getElementById("retryButton"),
    home: document.getElementById("homeButton"),
    resume: document.getElementById("resumeButton"),
    pauseButton: document.getElementById("pauseButton"),
    sound: document.getElementById("soundButton"),
    left: document.getElementById("leftButton"),
    jump: document.getElementById("jumpButton"),
    right: document.getElementById("rightButton"),
    hearts: document.getElementById("heartDisplay"),
    level: document.getElementById("levelNumber"),
    coins: document.getElementById("coinCount"),
    progress: document.getElementById("progressBar"),
    resultEyebrow: document.getElementById("resultEyebrow"),
    resultTitle: document.getElementById("resultTitle"),
    resultCoins: document.getElementById("resultCoins"),
    resultScore: document.getElementById("resultScore")
  };

  const sprites = {};
  for (const [key, source] of Object.entries({
    hero: "assets/hero.svg",
    monster: "assets/monster.svg",
    princess: "assets/princess.svg"
  })) {
    const image = new Image();
    image.src = source;
    sprites[key] = image;
  }

  let state = "menu";
  let levelIndex = 0;
  let unlockedLevel = readNumber("cloudboundUnlocked", 0);
  let totalCoins = readNumber("cloudboundCoins", 0);
  let score = readNumber("cloudboundScore", 0);
  let levelStartCoins = totalCoins;
  let levelStartScore = score;
  let health = 3;
  let playerLane = 1;
  let playerX = LANES[1];
  let jumpElapsed = 0;
  let isJumping = false;
  let jumpIndex = 0;
  let currentRow = { lanes: [0, 1, 2], tint: "#f8fbef" };
  let nextRow = null;
  let attack = null;
  let bolts = [];
  let invulnerable = 0;
  let shake = 0;
  let worldTime = 0;
  let rescueTime = 0;
  let lastTime = performance.now();
  let audioContext = null;
  let muted = false;
  let particles = [];
  let swipeStartX = null;

  function readNumber(key, fallback) {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem("cloudboundUnlocked", String(unlockedLevel));
      localStorage.setItem("cloudboundCoins", String(totalCoins));
      localStorage.setItem("cloudboundScore", String(score));
    } catch {
      // Local files can run with storage disabled; gameplay still works.
    }
  }

  function syncMenu() {
    if (unlockedLevel > 0) {
      ui.continue.classList.remove("is-hidden");
      ui.savedLevel.textContent = String(Math.min(unlockedLevel + 1, 8));
    }
  }

  function updateHud() {
    ui.level.textContent = String(levelIndex + 1);
    ui.coins.textContent = String(totalCoins);
    ui.progress.style.width = `${Math.min(100, (jumpIndex / LEVELS[levelIndex].jumps) * 100)}%`;
    ui.hearts.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const heart = document.createElement("span");
      heart.className = `heart${i >= health ? " is-empty" : ""}`;
      heart.textContent = "♥";
      ui.hearts.appendChild(heart);
    }
  }

  function hidePanels() {
    ui.menu.classList.remove("is-visible");
    ui.message.classList.remove("is-visible");
    ui.pause.classList.remove("is-visible");
  }

  function startLevel(index) {
    initAudio();
    levelIndex = Math.max(0, Math.min(index, LEVELS.length - 1));
    state = "playing";
    health = 3;
    playerLane = 1;
    playerX = LANES[1];
    jumpElapsed = 0;
    isJumping = false;
    jumpIndex = 0;
    invulnerable = 0;
    attack = null;
    bolts = [];
    currentRow = { lanes: [0, 1, 2], tint: "#f8fbef" };
    rescueBurstDone = false;
    levelStartCoins = totalCoins;
    levelStartScore = score;
    particles = [];
    hidePanels();
    prepareJump();
    updateHud();
    playTone("start");
  }

  function prepareJump() {
    const level = LEVELS[levelIndex];
    jumpElapsed = 0;

    let safeCount = Math.random() < level.doubleCloud ? 2 : 1;
    if (levelIndex === 0 && jumpIndex < 3) safeCount = 3;

    const reachable = [playerLane];
    if (playerLane > 0) reachable.push(playerLane - 1);
    if (playerLane < 2) reachable.push(playerLane + 1);
    const primary = reachable[Math.floor(Math.random() * reachable.length)];
    const rowLanes = [primary];
    const others = shuffle([0, 1, 2].filter((lane) => lane !== primary));
    while (rowLanes.length < safeCount) rowLanes.push(others.shift());
    rowLanes.sort();

    const rewardLane = rowLanes[Math.floor(Math.random() * rowLanes.length)];
    const heartLane = health < 3 && jumpIndex > 4 && jumpIndex % 7 === 0 ? rewardLane : -1;
    nextRow = {
      lanes: rowLanes,
      coinLane: heartLane === -1 ? rewardLane : -1,
      heartLane,
      tint: levelIndex >= 6 ? "#dbe2ef" : "#f7fbef"
    };

    attack = null;
    if (jumpIndex > 1 && Math.random() < level.hazard) {
      const boltCount = Math.random() < level.doubleBolt ? 2 : 1;
      attack = {
        lane: Math.floor(Math.random() * 3),
        cooldown: 0.55 + Math.random() * 0.45,
        remaining: boltCount
      };
    }
  }

  function resolveLanding() {
    isJumping = false;
    const safe = nextRow.lanes.includes(playerLane);
    if (safe) {
      currentRow = nextRow;
      if (nextRow.coinLane === playerLane) collectCoin();
      if (nextRow.heartLane === playerLane && health < 3) {
        health += 1;
        score += 250;
        playTone("heart");
        burst(LANES[playerLane], BASE_Y - 70, "#ff6b67", 12);
      }
      score += 35 + levelIndex * 5;
      playTone("land");
    } else {
      takeDamage();
      currentRow = { lanes: [playerLane], tint: "#f4cfa8", emergency: true };
    }

    jumpIndex += 1;
    updateHud();
    if (health <= 0) {
      showGameOver();
      return;
    }
    if (jumpIndex >= LEVELS[levelIndex].jumps) {
      finishLevel();
      return;
    }
    prepareJump();
  }

  function collectCoin() {
    totalCoins += 1;
    score += 120 + levelIndex * 10;
    burst(LANES[playerLane], BASE_Y - 72, "#ffd34e", 10);
    playTone("coin");
  }

  function takeDamage() {
    if (invulnerable > 0 || state !== "playing") return false;
    health -= 1;
    invulnerable = 1.28;
    shake = 0.42;
    burst(playerX, BASE_Y - 85, "#ff6556", 14);
    playTone("hurt");
    if (navigator.vibrate) navigator.vibrate(80);
    updateHud();
    return true;
  }

  function finishLevel() {
    score += health * 300 + (levelIndex + 1) * 200;
    unlockedLevel = Math.max(unlockedLevel, Math.min(levelIndex + 1, 7));
    saveProgress();
    if (levelIndex === LEVELS.length - 1) {
      state = "rescue";
      rescueTime = 0;
      playTone("victory");
      return;
    }
    state = "levelComplete";
    showResult("云层已突破", `${LEVELS[levelIndex].name}完成`, false);
  }

  function showGameOver() {
    state = "gameOver";
    totalCoins = levelStartCoins;
    score = levelStartScore;
    updateHud();
    showResult("风暴来袭", "再接近一点", true);
  }

  function showVictory() {
    state = "victory";
    unlockedLevel = 7;
    saveProgress();
    showResult("星羽公主获救", "八重云境通关", false, true);
  }

  function showResult(eyebrow, title, retry, victory = false) {
    ui.resultEyebrow.textContent = eyebrow;
    ui.resultTitle.textContent = title;
    ui.resultCoins.textContent = String(totalCoins);
    ui.resultScore.textContent = String(score);
    ui.retry.classList.toggle("is-hidden", !retry);
    ui.next.classList.toggle("is-hidden", retry || victory);
    ui.home.textContent = victory ? "再次启程" : "返回云港";
    ui.message.classList.add("is-visible");
  }

  function goHome() {
    state = "menu";
    hidePanels();
    syncMenu();
    ui.menu.classList.add("is-visible");
    ui.pauseButton.textContent = "Ⅱ";
  }

  function togglePause(forceResume = false) {
    if (state === "playing") {
      state = "paused";
      ui.pause.classList.add("is-visible");
      ui.pauseButton.textContent = "▶";
    } else if (state === "paused" || forceResume) {
      state = "playing";
      ui.pause.classList.remove("is-visible");
      ui.pauseButton.textContent = "Ⅱ";
      lastTime = performance.now();
    }
  }

  function jumpPlayer(direction) {
    if (state !== "playing" || isJumping) return;
    playerLane = Math.max(0, Math.min(2, playerLane + direction));
    jumpElapsed = 0;
    isJumping = true;
    playTone("jump");
  }

  function shuffle(values) {
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        life: 0.45 + Math.random() * 0.35,
        size: 2 + Math.random() * 4,
        color
      });
    }
  }

  function update(dt) {
    worldTime += dt;
    particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 180 * dt;
      particle.life -= dt;
    });
    particles = particles.filter((particle) => particle.life > 0);

    if (shake > 0) shake = Math.max(0, shake - dt);
    if (invulnerable > 0) invulnerable = Math.max(0, invulnerable - dt);

    if (state === "rescue") {
      rescueTime += dt;
      playerX += (LANES[1] - playerX) * Math.min(1, dt * 5);
      if (rescueTime > 3.1) showVictory();
      return;
    }

    if (state !== "playing") return;
    playerX += (LANES[playerLane] - playerX) * Math.min(1, dt * 13);
    updateStorm(dt);
    if (state !== "playing" || !isJumping) return;
    jumpElapsed += dt * 1000;
    const phase = Math.min(1, jumpElapsed / LEVELS[levelIndex].jumpMs);

    if (phase >= 1) resolveLanding();
  }

  function updateStorm(dt) {
    if (attack && attack.remaining > 0) {
      attack.cooldown -= dt;
      if (attack.cooldown <= 0) {
        throwBolt(attack.lane);
        attack.remaining -= 1;
        attack.cooldown = 0.62 + Math.random() * 0.28;
      }
    }

    const heroPhase = isJumping ? Math.min(1, jumpElapsed / LEVELS[levelIndex].jumpMs) : 0;
    const heroY = BASE_Y - 76 - Math.sin(heroPhase * Math.PI) * 146;
    const heroCenterY = heroY + 27;

    bolts.forEach((bolt) => {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.age += dt;
      if (!bolt.hit && Math.abs(bolt.x - playerX) < 25 && Math.abs(bolt.y - heroCenterY) < 31) {
        bolt.hit = true;
        if (takeDamage() && health <= 0) showGameOver();
      }
    });
    bolts = bolts.filter((bolt) => !bolt.hit && bolt.y < HEIGHT + 40);
  }

  function throwBolt(monsterLane) {
    const flightTime = Math.max(0.82, 1.14 - levelIndex * 0.035);
    const startX = LANES[monsterLane];
    const targetX = LANES[playerLane];
    bolts.push({
      x: startX,
      y: 174,
      vx: (targetX - startX) / flightTime,
      vy: 405 + levelIndex * 11,
      age: 0,
      hit: false
    });
    playTone("bolt");
  }

  function draw() {
    const level = LEVELS[levelIndex] || LEVELS[0];
    ctx.save();
    if (shake > 0) {
      const amount = shake * 13;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }

    drawBackground(level);
    const phase = isJumping ? Math.min(1, jumpElapsed / level.jumpMs) : 0;

    if (state === "menu") {
      drawMenuScene();
    } else if (state === "rescue" || state === "victory") {
      drawRescueScene();
    } else {
      drawGameScene(phase);
    }

    drawParticles();
    ctx.restore();
  }

  function drawBackground(level) {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, level.sky[0]);
    gradient.addColorStop(0.72, level.sky[1]);
    gradient.addColorStop(1, level.ground);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (levelIndex >= 4) {
      ctx.fillStyle = "rgba(255, 242, 176, .75)";
      for (let i = 0; i < 19; i += 1) {
        const x = (i * 83 + 31) % WIDTH;
        const y = 120 + ((i * 47) % 280);
        const glow = 0.35 + Math.sin(worldTime * 1.7 + i) * 0.2;
        ctx.globalAlpha = glow;
        ctx.fillRect(x, y, i % 3 === 0 ? 3 : 2, i % 3 === 0 ? 3 : 2);
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "rgba(255,255,255,.11)";
    ctx.beginPath();
    ctx.arc(350, 165, 64, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 8; i += 1) {
      const x = ((i * 137 + worldTime * (7 + i % 3)) % 560) - 80;
      const y = 145 + ((i * 89) % 390);
      drawMistCloud(x, y, 0.45 + (i % 3) * 0.16, 0.12 + (i % 2) * 0.06);
    }

    drawDistantIslands(level);
  }

  function drawDistantIslands(level) {
    const bob = Math.sin(worldTime * 0.45) * 4;
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = level.ground;
    ctx.beginPath();
    ctx.moveTo(-20, 500 + bob);
    ctx.quadraticCurveTo(70, 445 + bob, 150, 504 + bob);
    ctx.quadraticCurveTo(235, 455 + bob, 325, 510 + bob);
    ctx.quadraticCurveTo(380, 475 + bob, 450, 515 + bob);
    ctx.lineTo(450, 760);
    ctx.lineTo(-20, 760);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMistCloud(x, y, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 12, 65, 20, 0, 0, Math.PI * 2);
    ctx.arc(-25, 0, 24, 0, Math.PI * 2);
    ctx.arc(8, -6, 31, 0, Math.PI * 2);
    ctx.arc(37, 5, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMenuScene() {
    drawPlatform(210, 628, 1.25, "#f7fbef");
    drawPlatform(75, 460, 0.78, "#f7fbef");
    drawPlatform(345, 360, 0.72, "#f7fbef");
  }

  function drawGameScene(phase) {
    const currentY = BASE_Y + phase * 150;
    const targetY = BASE_Y - 190 + phase * 190;

    if (attack) drawAttack();
    if (currentRow) drawRow(currentRow, currentY, 1 - phase * 0.2, false);
    if (nextRow) drawRow(nextRow, targetY, 0.78 + phase * 0.22, true);
    drawBolts();

    const hop = isJumping ? Math.sin(phase * Math.PI) : 0;
    const idleBob = isJumping ? 0 : Math.sin(worldTime * 3.2) * 1.5;
    const heroY = BASE_Y - 76 - hop * 146 + idleBob;
    const lean = (LANES[playerLane] - playerX) * 0.0025;
    drawHero(playerX, heroY, lean, hop);
  }

  function drawRow(row, y, scale, isTarget) {
    row.lanes.forEach((lane) => {
      drawPlatform(LANES[lane], y, scale, row.tint, row.emergency);
      if (isTarget && row.coinLane === lane && row.heartLane !== lane) {
        drawCoin(LANES[lane], y - 54, scale);
      }
      if (isTarget && row.heartLane === lane) {
        drawHeartPickup(LANES[lane], y - 56, scale);
      }
    });
  }

  function drawPlatform(x, y, scale = 1, tint = "#f7fbef", emergency = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(20, 67, 73, .16)";
    ctx.beginPath();
    ctx.ellipse(0, 13, 48, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = emergency ? "#f1c493" : tint;
    ctx.beginPath();
    ctx.ellipse(0, 0, 47, 17, 0, 0, Math.PI * 2);
    ctx.arc(-27, -9, 17, 0, Math.PI * 2);
    ctx.arc(-4, -17, 22, 0, Math.PI * 2);
    ctx.arc(23, -10, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = emergency ? "#d99a6a" : "rgba(94, 173, 175, .28)";
    ctx.beginPath();
    ctx.ellipse(2, 9, 35, 8, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }

  function drawCoin(x, y, scale) {
    const spin = Math.max(0.22, Math.abs(Math.cos(worldTime * 6)));
    ctx.save();
    ctx.translate(x, y + Math.sin(worldTime * 4) * 3);
    ctx.scale(spin * scale, scale);
    ctx.fillStyle = "#ffd34e";
    ctx.strokeStyle = "#e59c20";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(-5, -8, 3, 12);
    ctx.restore();
  }

  function drawHeartPickup(x, y, scale) {
    ctx.save();
    ctx.translate(x, y + Math.sin(worldTime * 4) * 3);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ff675c";
    ctx.shadowColor = "rgba(255,255,255,.8)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.bezierCurveTo(-24, -3, -14, -21, 0, -10);
    ctx.bezierCurveTo(14, -21, 24, -3, 0, 13);
    ctx.fill();
    ctx.restore();
  }

  function drawAttack() {
    const x = LANES[attack.lane];
    const windup = attack.remaining > 0 ? Math.max(0, 1 - attack.cooldown / 0.55) : 0;
    drawMonster(x, 132 + Math.sin(worldTime * 4) * 4, 0.67 + windup * 0.035);
    if (windup > 0.45) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 238, 95, ${0.25 + windup * 0.45})`;
      ctx.shadowColor = "#fff582";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, 170, 4 + windup * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBolts() {
    bolts.forEach((bolt) => {
      ctx.save();
      ctx.translate(bolt.x, bolt.y);
      ctx.rotate(Math.atan2(bolt.vy, bolt.vx) - Math.PI / 2);
      ctx.shadowColor = "#fff36b";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffe74f";
      ctx.strokeStyle = "#fff8b0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(-7, -3);
      ctx.lineTo(0, -4);
      ctx.lineTo(-5, 15);
      ctx.lineTo(8, 1);
      ctx.lineTo(2, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#fff472";
      ctx.beginPath();
      ctx.arc(bolt.x - bolt.vx * 0.035, bolt.y - bolt.vy * 0.035, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHero(x, y, lean, hop) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    const squash = hop < 0.08 ? 0.94 : 1;
    ctx.scale(0.78 / squash, 0.78 * squash);
    if (invulnerable > 0 && Math.floor(worldTime * 14) % 2 === 0) ctx.globalAlpha = 0.35;
    if (sprites.hero.complete && sprites.hero.naturalWidth) {
      ctx.drawImage(sprites.hero, -44, -22, 88, 120);
    } else {
      ctx.fillStyle = "#ef6657";
      ctx.fillRect(-18, 22, 36, 48);
      ctx.fillStyle = "#ffd2a6";
      ctx.beginPath();
      ctx.arc(0, 4, 19, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMonster(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (sprites.monster.complete && sprites.monster.naturalWidth) {
      ctx.drawImage(sprites.monster, -52, -44, 104, 88);
    } else {
      ctx.fillStyle = "#6a5d9e";
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRescueScene() {
    const t = Math.min(1, rescueTime / 2.1);
    const ease = 1 - Math.pow(1 - t, 3);
    const cageY = 185 + ease * 170;
    drawPlatform(210, 630, 1.28, "#fff8dc");
    drawPlatform(210, cageY + 105, 1.05, "#fff8dc");
    drawCage(210, cageY, rescueTime);
    const heroHop = rescueTime > 1.5 ? Math.sin(Math.min(1, (rescueTime - 1.5) / 1.1) * Math.PI) * 95 : 0;
    drawHero(playerX, 520 - heroHop, 0, 0.5);
    if (rescueTime > 2.1) {
      burstOnceForRescue();
    }
  }

  let rescueBurstDone = false;
  function burstOnceForRescue() {
    if (rescueBurstDone) return;
    rescueBurstDone = true;
    burst(210, 320, "#ffd34e", 36);
    burst(210, 350, "#ff7461", 22);
  }

  function drawCage(x, y, time) {
    const open = Math.max(0, Math.min(1, (time - 1.75) / 0.55));
    ctx.save();
    ctx.translate(x, y);
    if (sprites.princess.complete && sprites.princess.naturalWidth) {
      ctx.drawImage(sprites.princess, -31, 1, 62, 86);
    }
    ctx.strokeStyle = "#6a4f37";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 5, 38, Math.PI, 0);
    ctx.moveTo(-38, 5);
    ctx.lineTo(-38, 93);
    ctx.lineTo(38, 93);
    ctx.lineTo(38, 5);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (let i = -24; i <= 24; i += 16) {
      const slide = i > 0 ? open * 70 : -open * 70;
      ctx.beginPath();
      ctx.moveTo(i + slide, 3);
      ctx.lineTo(i + slide, 91);
      ctx.stroke();
    }
    ctx.fillStyle = "#876545";
    ctx.fillRect(-44, 90, 88, 10);
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, particle.life * 2.5);
      ctx.fillStyle = particle.color;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(worldTime * 3 + particle.x);
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      ctx.restore();
    });
  }

  function initAudio() {
    if (audioContext) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) audioContext = new AudioCtor();
  }

  function playTone(type) {
    if (muted || !audioContext) return;
    if (audioContext.state === "suspended") audioContext.resume();
    const settings = {
      start: [392, 0.16, "triangle"],
      move: [260, 0.035, "sine"],
      jump: [330, 0.10, "triangle"],
      bolt: [720, 0.08, "sawtooth"],
      land: [180, 0.045, "triangle"],
      coin: [880, 0.11, "sine"],
      heart: [660, 0.20, "triangle"],
      hurt: [110, 0.22, "sawtooth"],
      victory: [523, 0.45, "triangle"]
    };
    const [frequency, duration, wave] = settings[type] || settings.move;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    if (type === "coin" || type === "victory") {
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, audioContext.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration + 0.02);
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function bindJumpButton(button, direction) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.classList.add("is-pressed");
      jumpPlayer(direction);
    });
    const release = () => button.classList.remove("is-pressed");
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  }

  ui.start.addEventListener("click", () => startLevel(0));
  ui.continue.addEventListener("click", () => startLevel(unlockedLevel));
  ui.next.addEventListener("click", () => startLevel(levelIndex + 1));
  ui.retry.addEventListener("click", () => startLevel(levelIndex));
  ui.home.addEventListener("click", goHome);
  ui.resume.addEventListener("click", () => togglePause(true));
  ui.pauseButton.addEventListener("click", () => {
    if (state === "playing" || state === "paused") togglePause();
  });
  ui.sound.addEventListener("click", () => {
    initAudio();
    muted = !muted;
    ui.sound.textContent = muted ? "×" : "♪";
    ui.sound.setAttribute("aria-label", muted ? "开启音效" : "关闭音效");
    if (!muted) playTone("coin");
  });
  bindJumpButton(ui.left, -1);
  bindJumpButton(ui.jump, 0);
  bindJumpButton(ui.right, 1);

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowUp", "ArrowRight", "KeyA", "KeyW", "KeyD", "Space", "Escape"].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    if (event.code === "ArrowLeft" || event.code === "KeyA") jumpPlayer(-1);
    if (event.code === "ArrowUp" || event.code === "KeyW" || event.code === "Space") jumpPlayer(0);
    if (event.code === "ArrowRight" || event.code === "KeyD") jumpPlayer(1);
    if (event.code === "Escape") togglePause();
  });

  canvas.addEventListener("touchstart", (event) => {
    swipeStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  canvas.addEventListener("touchend", (event) => {
    if (swipeStartX === null) return;
    const touchX = event.changedTouches[0].clientX;
    const delta = touchX - swipeStartX;
    if (Math.abs(delta) > 24) {
      jumpPlayer(delta > 0 ? 1 : -1);
    } else {
      const bounds = canvas.getBoundingClientRect();
      const ratio = (touchX - bounds.left) / bounds.width;
      jumpPlayer(ratio < 0.36 ? -1 : ratio > 0.64 ? 1 : 0);
    }
    swipeStartX = null;
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") togglePause();
  });

  syncMenu();
  updateHud();
  requestAnimationFrame(frame);
})();
