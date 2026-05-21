const API_BASE = "";

const AUTH_STORAGE_KEY = "newbear_player_v1";
const appShell = document.querySelector(".app");
const authPage = document.getElementById("auth-page");
const authForm = document.getElementById("auth-form");
const authUsername = document.getElementById("auth-username");
const authPassword = document.getElementById("auth-password");
const authError = document.getElementById("auth-error");
const authLoginTab = document.getElementById("auth-login-tab");
const authRegisterTab = document.getElementById("auth-register-tab");
const authSubmit = document.getElementById("auth-submit");
const logoutButton = document.getElementById("logout-button");
const musicButton = document.getElementById("music-button");
const bgmAudio = document.getElementById("bgm-audio");

const companyName = document.getElementById("company-name");
const companyMeta = document.getElementById("company-meta");
const actorList = document.getElementById("actor-list");
const mapView = document.getElementById("map-view");
const floorMapPoints = document.getElementById("floor-map-points");
const logView = document.getElementById("log-view");
const inputHistory = document.getElementById("input-history");
const incidentPanel = document.getElementById("incident-panel");
const stepButton = document.getElementById("step-button");
const autoStepButton = document.getElementById("auto-step-button");
const affairInput = document.getElementById("affair-input");
const resetButton = document.getElementById("reset-button");
const workspace = document.querySelector(".workspace");
const meetingPage = document.getElementById("meeting-page");
const meetingTopSummary = document.getElementById("meeting-top-summary");
const onboardingPage = document.getElementById("onboarding-page");
const incidentOverlay = document.getElementById("incident-overlay");
const reportSection = document.getElementById("report-section");
const reportView = document.getElementById("report-view");

let isBusy = false;
let lastState = null;
let meetingIntroPrintedKey = "";
let meetingIntroVisibleChars = 0;
let meetingIntroTimer = null;
let meetingDraftText = "";
let meetingCountdownTimer = null;
let meetingRemainingSeconds = 120;
let meetingTickTimer = null;
let meetingTickInFlight = false;
let meetingFinishInFlight = false;
let meetingResultPrintedKey = "";
let meetingResultVisibleChars = 0;
let meetingResultTimer = null;
let meetingResultReturnTimer = null;
let pantryDraftText = "";
let pantryRoundTimer = null;
let pantryRoundInFlight = false;
let onboardingMode = "company";
let onboardingVisibleChars = 0;
let onboardingTimer = null;
let onboardingPrintedKey = "";
let onboardingActive = false;
let onboardingPrewarmStarted = false;
let incidentOverlayKey = "";
let incidentOverlayTimer = null;
let autoStepEnabled = false;
let autoStepTimer = null;
let queuedAffairText = "";
let authMode = "login";
let currentPlayer = loadStoredPlayer();
let musicEnabled = window.localStorage.getItem("newbear_music_enabled") !== "0";
const actorAnimationTimers = new Map();
const ACTOR_MOVE_DURATION_MS = 5000;
const ACTOR_FRAME_INTERVAL_MS = 130;
const AUTO_STEP_DELAY_MS = 0;
const INCIDENT_OVERLAY_MS = 10000;

const ROUTES = {
  world: "#/",
  meeting: "#/meeting",
  pantry: "#/pantry",
};

const ONBOARDING_STORAGE_KEY = "newbear_onboarding_seen_v1";
const INCIDENT_OVERLAY_STORAGE_KEY = "newbear_incident_seen_v1";

function loadStoredPlayer() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredPlayer(player) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(player));
}

function clearStoredPlayer() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function updateMusicButton() {
  if (!musicButton) return;

  musicButton.textContent = musicEnabled ? "音乐：开" : "音乐：关";
  musicButton.classList.toggle("is-active", musicEnabled);
}

function tryPlayBgm() {
  if (!bgmAudio || !musicEnabled) return;

  bgmAudio.volume = 0.35;
  bgmAudio.play().catch(() => {
    // 浏览器会拦截无用户手势的自动播放，下一次点击时再试。
  });
}

function pauseBgm() {
  if (!bgmAudio) return;

  bgmAudio.pause();
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  window.localStorage.setItem("newbear_music_enabled", musicEnabled ? "1" : "0");
  updateMusicButton();

  if (musicEnabled) {
    tryPlayBgm();
  } else {
    pauseBgm();
  }
}

function armBgmStartOnFirstGesture() {
  const start = () => {
    tryPlayBgm();
  };

  window.addEventListener("pointerdown", start, { once: true });
  window.addEventListener("keydown", start, { once: true });
}

function renderAuthShell() {
  const isLoggedIn = Boolean(currentPlayer?.username);

  if (authPage) {
    authPage.hidden = isLoggedIn;
  }

  if (appShell) {
    appShell.hidden = !isLoggedIn;
  }

  if (logoutButton) {
    logoutButton.textContent = isLoggedIn ? `退出 ${currentPlayer.username}` : "退出";
  }

  updateMusicButton();
}

function setAuthMode(nextMode) {
  authMode = nextMode === "register" ? "register" : "login";
  authLoginTab?.classList.toggle("is-active", authMode === "login");
  authRegisterTab?.classList.toggle("is-active", authMode === "register");
  if (authSubmit) {
    authSubmit.textContent = authMode === "register" ? "创建身份" : "进入公司";
  }
  if (authError) {
    authError.textContent = "";
  }
}

async function submitAuth(event) {
  event.preventDefault();
  tryPlayBgm();

  const username = authUsername?.value.trim() || "";
  const password = authPassword?.value.trim() || "";

  if (!username || !password) {
    if (authError) {
      authError.textContent = "请先填写玩家名和密码。";
    }
    return;
  }

  const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";

  try {
    if (authSubmit) {
      authSubmit.disabled = true;
      authSubmit.textContent = authMode === "register" ? "创建中..." : "进入中...";
    }

    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "登录失败");
    }

    currentPlayer = data.user;
    saveStoredPlayer(currentPlayer);
    renderAuthShell();
    tryPlayBgm();

    if (data.state) {
      renderState(data.state);
    } else {
      fetchState();
    }
  } catch (error) {
    if (authError) {
      authError.textContent = error.message || "登录失败，请重试。";
    }
  } finally {
    if (authSubmit) {
      authSubmit.disabled = false;
      authSubmit.textContent = authMode === "register" ? "创建身份" : "进入公司";
    }
  }
}

async function logoutPlayer() {
  stopAutoStepTimer();
  autoStepEnabled = false;
  updateAutoStepButton();

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.warn("logout failed", error);
  }

  currentPlayer = null;
  clearStoredPlayer();
  onboardingActive = false;
  onboardingPrewarmStarted = false;
  hideIncidentOverlay(false);
  renderAuthShell();
}

function currentRoute() {
  if (window.location.hash === ROUTES.meeting) return "meeting";
  if (window.location.hash === ROUTES.pantry) return "pantry";
  return "world";
}

function navigateTo(route) {
  const target = ROUTES[route] || ROUTES.world;
  if (window.location.hash !== target) {
    window.location.hash = target;
  }
}


const ACTOR_THEMES = {
  xionglaoban: { color: "#6f4a2f", bubble: "#fff0df" },
  xiongjishu: { color: "#3f5568", bubble: "#e9f1f8" },
  xiongshichang: { color: "#4f7d4f", bubble: "#eaf5e8" },
  xiongxingzheng: { color: "#9a6a45", bubble: "#fff3e5" },
};

const ACTOR_ASSETS = {
  xionglaoban: {
    idleFront: "/assets/actors/xionglaoban/idle_front.webp",
    idleBack: "/assets/actors/xionglaoban/idle_back.webp",
    walkFront: buildWalkFrames("xionglaoban", "front"),
    walkBack: buildWalkFrames("xionglaoban", "back"),
  },
  xiongjishu: {
    idleFront: "/assets/actors/xiongjishu/idle_front.webp",
    idleBack: "/assets/actors/xiongjishu/idle_back.webp",
    walkFront: buildWalkFrames("xiongjishu", "front"),
    walkBack: buildWalkFrames("xiongjishu", "back"),
  },
  xiongshichang: {
    idleFront: "/assets/actors/xiongshichang/idle_front.webp",
    idleBack: "/assets/actors/xiongshichang/idle_back.webp",
    walkFront: buildWalkFrames("xiongshichang", "front"),
    walkBack: buildWalkFrames("xiongshichang", "back"),
  },
  xiongxingzheng: {
    idleFront: "/assets/actors/xiongxingzheng/idle_front.webp",
    idleBack: "/assets/actors/xiongxingzheng/idle_back.webp",
    walkFront: buildWalkFrames("xiongxingzheng", "front"),
    walkBack: buildWalkFrames("xiongxingzheng", "back"),
  },
};

const MEETING_SCENE_ASSET = "/assets/meeting/room.jpg";

const MEETING_ACTOR_ASSETS = {
  xionglaoban: "/assets/meeting/boss-front.png",
  xiongshichang: "/assets/meeting/market-left.png",
  xiongxingzheng: "/assets/meeting/admin-left.png",
  xiongjishu: "/assets/meeting/tech-right.png",
};

const MEETING_SEATS = {
  xionglaoban: { left: 50, top: 72 },
  xiongshichang: { left: 26, top: 58 },
  xiongxingzheng: { left: 73, top: 58 },
  xiongjishu: { left: 50, top: 40 },
};

const PANTRY_SCENE_ASSET = "/assets/pantry/room.png";

const PANTRY_ACTOR_ASSETS = {
  xionglaoban: "/assets/meeting/boss-front.png",
  xiongshichang: "/assets/actors/xiongshichang/idle_front.webp",
  xiongxingzheng: "/assets/meeting/admin-left.png",
  xiongjishu: "/assets/actors/xiongjishu/idle_front.webp",
};

const PANTRY_SEATS = {
  xiongshichang: { left: 28, top: 68 },
  xionglaoban: { left: 44, top: 73 },
  xiongxingzheng: { left: 61, top: 66 },
  xiongjishu: { left: 74, top: 70 },
};

function buildWalkFrames(actorId, direction) {
  return Array.from(
    { length: 6 },
    (_, index) => `/assets/actors/${actorId}/walk_${direction}_${index + 1}.webp`
  );
}

async function fetchState() {
  if (!currentPlayer?.username) {
    renderAuthShell();
    return;
  }

  const response = await fetch(`${API_BASE}/api/state`, {
    credentials: "include",
  });
  if (response.status === 401) {
    currentPlayer = null;
    clearStoredPlayer();
    renderAuthShell();
    return;
  }

  const data = await response.json();
  renderState(data.state);
}

async function bootstrapAuth() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });
    const data = await response.json();

    if (data.authenticated && data.user) {
      currentPlayer = data.user;
      saveStoredPlayer(currentPlayer);
      renderAuthShell();
      fetchState();
      return;
    }
  } catch (error) {
    console.warn("auth bootstrap failed", error);
  }

  currentPlayer = null;
  clearStoredPlayer();
  renderAuthShell();
}

function setBusy(busy) {
  isBusy = busy;
  stepButton.disabled = busy;
  resetButton.disabled = busy;
  stepButton.textContent = busy ? "生成中..." : "推进 30 分钟";
}

function updateAutoStepButton() {
  if (!autoStepButton) return;

  autoStepButton.textContent = autoStepEnabled ? "停止自动" : "自动推进";
  autoStepButton.classList.toggle("is-active", autoStepEnabled);
}

function isWorldStepAvailable() {
  if (currentRoute() !== "world") return false;
  if (lastState?.active_meeting || getActivePantry(lastState)) return false;
  if (lastState?.active_report?.visible) return false;
  if (incidentOverlay && !incidentOverlay.hidden) return false;
  if (!onboardingPage?.hidden) return false;
  return true;
}

function toggleAutoStep() {
  autoStepEnabled = !autoStepEnabled;
  updateAutoStepButton();

  if (autoStepEnabled) {
    if (!isBusy && isWorldStepAvailable()) {
      const queuedText = queuedAffairText;
      queuedAffairText = "";
      runStep({ source: "auto", affairOverride: queuedText });
    } else {
      startAutoStepTimer();
    }
  } else {
    stopAutoStepTimer();
  }
}

function startAutoStepTimer() {
  stopAutoStepTimer();
  autoStepTimer = window.setTimeout(() => {
    autoStepTimer = null;
    if (!autoStepEnabled || isBusy || !isWorldStepAvailable()) return;
    const queuedText = queuedAffairText;
    queuedAffairText = "";
    runStep({ source: "auto", affairOverride: queuedText });
  }, AUTO_STEP_DELAY_MS);
}

function stopAutoStepTimer() {
  if (autoStepTimer) {
    window.clearTimeout(autoStepTimer);
    autoStepTimer = null;
  }
}

function queueAffairForNextStep() {
  const text = affairInput.value.trim();
  if (!text) return;

  queuedAffairText = text;
  affairInput.value = "";
}

function submitWorldInput() {
  if (isBusy) {
    queueAffairForNextStep();
    return;
  }

  runStep({ source: "manual" });
}

function maybeRunQueuedStep() {
  if (!queuedAffairText || isBusy || !isWorldStepAvailable()) return;

  const queuedText = queuedAffairText;
  queuedAffairText = "";
  runStep({ source: "queued", affairOverride: queuedText });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function onboardingStorageKey() {
  const playerId = currentPlayer?.player_id || currentPlayer?.username || "guest";
  return `${ONBOARDING_STORAGE_KEY}:${playerId}`;
}

function incidentSeenStorageKey(incident) {
  const playerId = currentPlayer?.player_id || currentPlayer?.username || "guest";
  const incidentId = incident?.incident_id || incident?.id || `${incident?.time || incident?.clock || ""}:${incident?.title || ""}`;
  return `${INCIDENT_OVERLAY_STORAGE_KEY}:${playerId}:${incidentId}`;
}

function clearIncidentSeenForCurrentPlayer() {
  const playerId = currentPlayer?.player_id || currentPlayer?.username || "guest";
  const prefix = `${INCIDENT_OVERLAY_STORAGE_KEY}:${playerId}:`;

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key && key.startsWith(prefix)) {
      window.sessionStorage.removeItem(key);
    }
  }
}

function shouldShowOnboarding(state) {
  if (!onboardingPage || !state?.onboarding) return false;
  if (onboardingActive) return true;
  if (window.localStorage.getItem(onboardingStorageKey()) === "1") return false;
  if (currentRoute() !== "world") return false;

  const company = state.company || {};
  return company.day === 1;
}

function renderOnboardingIfNeeded(state) {
  if (!onboardingPage) return;

  if (!shouldShowOnboarding(state)) {
    onboardingPage.hidden = true;
    return;
  }

  onboardingPage.hidden = false;
  onboardingActive = true;
  prewarmFirstStepDuringOnboarding(state);

  if (onboardingMode === "characters") {
    renderOnboardingCharacters(state.onboarding);
    return;
  }

  renderOnboardingCompany(state.onboarding);
}

function prewarmFirstStepDuringOnboarding(state) {
  if (onboardingPrewarmStarted || isBusy) return;

  const company = state.company || {};
  if (company.day !== 1 || company.step !== 0) return;

  onboardingPrewarmStarted = true;
  window.setTimeout(() => {
    runStep({ source: "prewarm", affairOverride: "" });
  }, 120);
}

function buildOnboardingCompanyText(onboarding) {
  const company = onboarding.company || {};
  const goals = Array.isArray(company.short_term_goals) ? company.short_term_goals : [];

  return [
    `欢迎来到${company.name || "熊起东方"}。这家公司不大，梦想倒是挺大：${company.business || "把产品做出来，把用户留下来"}。现在处在${company.stage || "要命但还挺有希望"}阶段，现金像早高峰电梯一样紧张，大家说话都很有理，账上数字更有理。`,
    `团队目前的状态是：${company.team_state || "各有各的本事，也各有各的压力"}。短期目标先记住一句话，${goals[0] || "把 Demo 做稳，把发布会扛过去"}。其他目标先别背，真背下来也不会涨工资。`,
    `${company.external_pressure ? `外面也不太消停：${company.external_pressure}。` : ""}${company.working_style ? `这里的工作方式偏${company.working_style}，所以你最好多听、多问、少闭门造车。` : ""}`,
    "你是这家公司的产品经理欧，记得和你的搭子多交流，哦对了，点击自动推进，这个世界才会运行",
  ].filter(Boolean).join("\n\n");
}

function renderOnboardingCompany(onboarding) {
  const text = buildOnboardingCompanyText(onboarding);
  const key = `company:${text.length}`;

  if (onboardingPrintedKey !== key) {
    onboardingPrintedKey = key;
    onboardingVisibleChars = 0;
    if (onboardingTimer) {
      clearInterval(onboardingTimer);
      onboardingTimer = null;
    }
    onboardingTimer = setInterval(() => {
      onboardingVisibleChars = Math.min(text.length, onboardingVisibleChars + 3);
      renderOnboardingCompany(onboarding);
      if (onboardingVisibleChars >= text.length && onboardingTimer) {
        clearInterval(onboardingTimer);
        onboardingTimer = null;
      }
    }, 34);
  }

  const printedText = text.slice(0, onboardingVisibleChars);
  const isDone = onboardingVisibleChars >= text.length;

  onboardingPage.innerHTML = `
    <article class="onboarding-printer">
      <div class="onboarding-kicker">入职培训 · 公司背景</div>
      <h2>欢迎加入熊起东方</h2>
      <pre>${escapeHtml(printedText)}${isDone ? "" : "<span class=\"printer-caret\">▋</span>"}</pre>
      <div class="onboarding-actions">
        <button id="onboarding-next-button" ${isDone ? "" : "disabled"}>认识团队</button>
      </div>
    </article>
  `;

  document.getElementById("onboarding-next-button")?.addEventListener("click", () => {
    onboardingMode = "characters";
    renderOnboardingCharacters(onboarding);
  });
}

function renderOnboardingCharacters(onboarding) {
  if (onboardingTimer) {
    clearInterval(onboardingTimer);
    onboardingTimer = null;
  }

  const characters = onboarding.characters || [];

  onboardingPage.innerHTML = `
    <section class="onboarding-roster">
      <header>
        <div>
          <span>入职培训 · 团队成员</span>
          <h2>你将和这四位小熊一起推进项目</h2>
        </div>
        <button id="onboarding-start-button">开始模拟</button>
      </header>
      <div class="onboarding-cards">
        ${characters.map(renderOnboardingCharacterCard).join("")}
      </div>
    </section>
  `;

  document.getElementById("onboarding-start-button")?.addEventListener("click", closeOnboarding);
}

function renderOnboardingCharacterCard(character) {
  const actorId = character.actor_id || "";
  const asset = ACTOR_ASSETS[actorId]?.idleFront || "";
  const intro = buildOnboardingCharacterIntro(character);

  return `
    <article class="onboarding-card actor-${escapeHtml(actorId)}">
      <div class="onboarding-card-portrait">
        ${asset ? `<img src="${escapeHtml(asset)}" alt="${escapeHtml(character.display_name || actorId)}">` : ""}
      </div>
      <div class="onboarding-card-body">
        <h3>${escapeHtml(character.display_name || actorId)}</h3>
        <p class="onboarding-card-role">${escapeHtml(character.work_title || character.job_title || character.role_name || "")}</p>
        <p class="onboarding-card-note">${escapeHtml(intro)}</p>
      </div>
    </article>
  `;
}

function buildOnboardingCharacterIntro(character) {
  const name = character.display_name || "这位同事";
  const role = character.work_title || character.job_title || character.role_name || "公司搭子";
  const lens = character.company_lens || character.kpi || "";
  const speaking = character.speaking_style || "";
  const drives = Array.isArray(character.core_drives) ? character.core_drives.slice(0, 2).join("、") : "";

  return `${name}，${role}。${lens || "他看公司的角度很现实，基本不相信空口画饼。"}${drives ? `心里惦记着${drives}。` : ""}${speaking ? `说话风格是：${speaking}。` : ""}跟他合作的秘诀很简单：把事情说具体，把锅放桌面上，别塞抽屉里。`;
}

function closeOnboarding() {
  if (onboardingTimer) {
    clearInterval(onboardingTimer);
    onboardingTimer = null;
  }

  window.localStorage.setItem(onboardingStorageKey(), "1");
  onboardingActive = false;
  onboardingPage.hidden = true;
  renderIncidentOverlay(lastState?.pending_incident);
}

async function resetWorld() {
  if (isBusy) return;

  autoStepEnabled = false;
  queuedAffairText = "";
  stopAutoStepTimer();
  updateAutoStepButton();
  setBusy(true);

  try {
    const response = await fetch(`${API_BASE}/api/reset`, {
      method: "POST",
    });

    const data = await response.json();
    affairInput.value = "";
    window.localStorage.removeItem(onboardingStorageKey());
    onboardingMode = "company";
    onboardingPrintedKey = "";
    onboardingVisibleChars = 0;
    onboardingActive = false;
    onboardingPrewarmStarted = false;
    clearIncidentSeenForCurrentPlayer();
    hideIncidentOverlay(false);
    renderState(data.state);
  } finally {
    setBusy(false);
  }
}

async function runStep(options = {}) {
  if (isBusy) {
    if (options.source !== "auto") {
      queueAffairForNextStep();
    }
    return;
  }

  const shouldClearInputAfterStep = options.affairOverride === undefined;
  const affair = String(options.affairOverride ?? affairInput.value).trim();
  const inputValueAtStart = affairInput.value;

  setBusy(true);

  try {
    const response = await fetch(`${API_BASE}/api/step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ affair }),
    });

    const data = await response.json();
    if (shouldClearInputAfterStep && affairInput.value === inputValueAtStart) {
      affairInput.value = "";
    }
    renderState(data.state);
  } finally {
    setBusy(false);
    if (queuedAffairText) {
      maybeRunQueuedStep();
    } else if (autoStepEnabled && isWorldStepAvailable()) {
      startAutoStepTimer();
    }
  }
}

async function enterMeeting() {
  const response = await fetch(`${API_BASE}/api/meeting/enter`, {
    method: "POST",
  });
  const data = await response.json();
  if (!response.ok || !data.state) {
    console.error("enterMeeting failed", data);
    return;
  }
  renderState(data.state);
}

async function startMeeting() {
  const response = await fetch(`${API_BASE}/api/meeting/start`, {
    method: "POST",
  });
  const data = await response.json();
  if (!response.ok || !data.state) {
    console.error("startMeeting failed", data);
    return null;
  }
  meetingRemainingSeconds = Number(data.state.active_meeting?.remaining_seconds || 120);
  renderState(data.state);
  return data.state;
}

async function sendMeetingMessage(message) {
  const response = await fetch(`${API_BASE}/api/meeting/say`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
  const data = await response.json();
  if (!response.ok || !data.state) {
    console.error("sendMeetingMessage failed", data);
    return;
  }
  if (currentRoute() === "meeting" && data.state.active_meeting) {
    lastState = data.state;
    renderMeetingTranscript(data.state);
    return;
  }
  renderState(data.state);
}

async function tickMeeting() {
  if (meetingTickInFlight) return;
  meetingTickInFlight = true;

  try {
    const response = await fetch(`${API_BASE}/api/meeting/tick`, {
      method: "POST",
    });
    const data = await response.json();

    if (!response.ok || !data.state) {
      console.error("tickMeeting failed", data);
      return;
    }
    if (currentRoute() === "meeting" && data.state.active_meeting) {
      lastState = data.state;
      renderMeetingTranscript(data.state);
      return;
    }
    renderState(data.state);
  } finally {
    meetingTickInFlight = false;
  }
}

async function finishMeeting() {
  if (meetingFinishInFlight) return null;
  meetingFinishInFlight = true;

  try {
    const response = await fetch(`${API_BASE}/api/meeting/finish`, {
      method: "POST",
    });
    const data = await response.json();

    if (!response.ok || !data.state) {
      console.error("finishMeeting failed", data);
      return null;
    }

    renderState(data.state);
    return data.state;
  } finally {
    meetingFinishInFlight = false;
  }
}

async function closeMeeting() {
  const response = await fetch(`${API_BASE}/api/meeting/close`, {
    method: "POST",
  });
  const data = await response.json();

  if (!response.ok || !data.state) {
    console.error("closeMeeting failed", data);
    return;
  }

  renderState(data.state);
}

function getActivePantry(state) {
  const pantry = state?.active_pantry || state?.pantry;
  if (pantry?.active === false) return null;
  return pantry || null;
}

function buildPreviewPantry(state) {
  const actors = state?.actors || [];
  const actorById = new Map(actors.map((actor) => [actor.actor_id, actor]));
  const actorIds = ["xiongshichang", "xionglaoban", "xiongxingzheng", "xiongjishu"];

  return {
    pantry_id: "preview-pantry-1700",
    time: "17:00",
    clock: state?.company?.clock || "17:00",
    title: "下班前的茶水间闲谈",
    content: "忙了一天后，大家在茶水间顺嘴聊起今天最憋着没说出口的事。",
    phase: "live",
    participants: actorIds,
    actors: actorIds.map((actorId) => ({
      actor_id: actorId,
      display_name: actorById.get(actorId)?.display_name || actorId,
    })),
    transcript: [
      { speaker: "熊市场", actor_id: "xiongshichang", kind: "actor", content: "今天那些话在会上不好说，憋到现在才像能喘口气。" },
      { speaker: "熊老板", actor_id: "xionglaoban", kind: "actor", content: "别急着定结论，茶水间里先把真想法说出来。" },
      { speaker: "熊行政", actor_id: "xiongxingzheng", kind: "actor", content: "我最担心的是大家嘴上说能扛，账和人其实都快绷住了。" },
    ],
  };
}

function ensurePantryState(state) {
  return getActivePantry(state) || buildPreviewPantry(state);
}

async function sendPantryMessage(message) {
  const pantry = ensurePantryState(lastState);

  try {
    const response = await fetch(`${API_BASE}/api/pantry/say`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    const data = await response.json();

    if (response.ok && data.state) {
      pantryDraftText = "";
      navigateTo("world");
      renderState(data.state);
      return;
    }
  } catch (error) {
    console.warn("pantry say fallback", error);
  }

  pantry.transcript = pantry.transcript || [];
  pantry.transcript.push({
    speaker: "产品经理",
    actor_id: "user",
    kind: "user",
    content: message,
  });
  pantry.transcript.push(...buildPantryFallbackLines(pantry, message));
  lastState = { ...lastState, active_pantry: pantry };
  renderPantryTranscript(lastState);
}

async function tickPantry() {
  if (pantryRoundInFlight || currentRoute() !== "pantry") return;
  pantryRoundInFlight = true;

  try {
    const response = await fetch(`${API_BASE}/api/pantry/tick`, {
      method: "POST",
    });
    const data = await response.json();

    if (response.ok && data.state) {
      lastState = data.state;
      renderPantryTranscript(data.state);
      return;
    }
  } catch (error) {
    console.warn("pantry tick fallback", error);
  } finally {
    pantryRoundInFlight = false;
  }

  const pantry = ensurePantryState(lastState);
  pantry.transcript = pantry.transcript || [];
  pantry.transcript.push(...buildPantryFallbackLines(pantry, ""));
  lastState = { ...lastState, active_pantry: pantry };
  renderPantryTranscript(lastState);
}

async function leavePantry() {
  if (pantryRoundTimer) {
    clearInterval(pantryRoundTimer);
    pantryRoundTimer = null;
  }

  try {
    const response = await fetch(`${API_BASE}/api/pantry/leave`, {
      method: "POST",
    });
    const data = await response.json();

    if (response.ok && data.state) {
      pantryDraftText = "";
      navigateTo("world");
      renderState(data.state);
      return;
    }
  } catch (error) {
    console.warn("pantry leave fallback", error);
  }

  navigateTo("world");
  if (lastState) {
    const nextState = { ...lastState };
    delete nextState.active_pantry;
    renderState(nextState);
  }
}

function renderState(state) {
  lastState = state;

  companyName.textContent = state.company.name;
  if ((getActivePantry(state) || currentRoute() === "pantry") && currentRoute() === "pantry") {
    companyMeta.textContent = `茶水间 · ${state.company.clock || "17:00"} · 闲谈`;
  } else
  if (state.active_meeting && currentRoute() === "meeting") {
    companyMeta.textContent = `会议中 · ${state.company.clock} · 固定会议`;
  } else {
    companyMeta.textContent = `第 ${state.company.day} 天 · ${state.company.clock} · 第 ${state.company.step} 步 · 现金 CNY ${state.company.cash.toFixed(2)}`;
  }

  if (state.active_meeting) {
    navigateTo("meeting");
  } else if (getActivePantry(state)) {
    navigateTo("pantry");
  } else if (currentRoute() === "meeting") {
    navigateTo("world");
  }

  renderTopSummary(state);

  renderRoute(state);
  renderOnboardingIfNeeded(state);
  renderIncidentOverlay(state.pending_incident);

  renderMap(state);
  renderIncident(state.pending_incident);
  renderFloorMapPoints(state);
  renderActors(state.actors || []);
  renderLogs(state.company.logs || []);
  renderInputHistory(state.user_inputs || []);
  renderReport(state.active_report);

  window.setTimeout(maybeRunQueuedStep, 0);
}
function renderRoute(state) {
  const inMeeting = currentRoute() === "meeting" && Boolean(state.active_meeting);
  const inPantry = currentRoute() === "pantry";

  workspace.hidden = inMeeting || inPantry;
  meetingPage.hidden = !(inMeeting || inPantry);
  stepButton.hidden = inMeeting || inPantry;
  if (autoStepButton) {
    autoStepButton.hidden = inMeeting || inPantry;
  }
  resetButton.hidden = inMeeting || inPantry;
  affairInput.disabled = inMeeting || inPantry;

  if (inMeeting) {
    stopAutoStepTimer();
    renderMeetingPage(state);
  } else if (inPantry) {
    stopAutoStepTimer();
    renderPantryPage(state);
  } else if (pantryRoundTimer) {
    clearInterval(pantryRoundTimer);
    pantryRoundTimer = null;
  }

  if (!inMeeting && !inPantry && !state.active_report?.visible && autoStepEnabled && !autoStepTimer) {
    startAutoStepTimer();
  }
}

function renderMeetingTopSummary(state) {
  const meeting = state.active_meeting;
  if (!meetingTopSummary) return;

  if (!meeting || currentRoute() !== "meeting" || (meeting.phase || "intro") === "intro") {
    meetingTopSummary.hidden = true;
    meetingTopSummary.innerHTML = "";
    return;
  }

  meetingTopSummary.hidden = false;
  meetingTopSummary.innerHTML = `
    <span>${escapeHtml(meeting.time || meeting.clock || "")} · 固定会议</span>
    <strong>${escapeHtml(meeting.title || "会议")}</strong>
    <p>${escapeHtml(meeting.content || "")}</p>
  `;
}

function renderTopSummary(state) {
  const meeting = state.active_meeting;
  const pantry = getActivePantry(state) || (currentRoute() === "pantry" ? buildPreviewPantry(state) : null);
  const incident = state.pending_incident;
  if (!meetingTopSummary) return;

  if (meeting && currentRoute() === "meeting" && (meeting.phase || "intro") !== "intro") {
    meetingTopSummary.hidden = false;
    meetingTopSummary.className = "meeting-top-summary top-summary-meeting";
    meetingTopSummary.innerHTML = `
      <span>${escapeHtml(meeting.time || meeting.clock || "")} · 固定会议</span>
      <strong>${escapeHtml(meeting.title || "会议")}</strong>
      <p>${escapeHtml(meeting.content || "")}</p>
    `;
    return;
  }

  if (pantry && currentRoute() === "pantry") {
    meetingTopSummary.hidden = false;
    meetingTopSummary.className = "meeting-top-summary top-summary-pantry";
    meetingTopSummary.innerHTML = `
      <span>${escapeHtml(pantry.time || pantry.clock || "17:00")} · 茶水间闲谈</span>
      <strong>${escapeHtml(pantry.title || "茶水间闲谈")}</strong>
      <p>${escapeHtml(pantry.content || "")}</p>
    `;
    return;
  }

  if (incident && currentRoute() === "world") {
    meetingTopSummary.hidden = false;
    meetingTopSummary.className = "meeting-top-summary top-summary-incident";
    meetingTopSummary.innerHTML = `
      <span>${escapeHtml(incident.time || incident.clock || "")} · 固定事件</span>
      <strong>${escapeHtml(incident.title || "事件")}</strong>
      <p>${escapeHtml(incident.content || "")}</p>
    `;
    return;
  }

  meetingTopSummary.hidden = true;
  meetingTopSummary.className = "meeting-top-summary";
  meetingTopSummary.innerHTML = "";
}

function renderMeetingPage(state) {
  const meeting = state.active_meeting;
  if (!meeting) {
    meetingPage.innerHTML = "";
    return;
  }

  if ((meeting.phase || "intro") === "intro") {
    renderMeetingIntro(state);
    return;
  }

  if (meeting.phase === "result") {
    renderMeetingResult(state);
    return;
  }

  renderMeetingRoom(state);
}

function renderMeetingIntro(state) {
  const meeting = state.active_meeting;
  if (!meeting) {
    meetingPage.innerHTML = "";
    return;
  }

  const printText = `${meeting.title || "会议"}\n\n${meeting.content || ""}`;
  const printKey = `${meeting.meeting_id || ""}:${meeting.title || ""}:${meeting.content || ""}`;

  if (meetingIntroPrintedKey !== printKey) {
    meetingIntroPrintedKey = printKey;
    meetingIntroVisibleChars = 0;
    if (meetingIntroTimer) {
      clearInterval(meetingIntroTimer);
      meetingIntroTimer = null;
    }
  }

  const visibleText = printText.slice(0, meetingIntroVisibleChars);

  meetingPage.innerHTML = `
    <section class="meeting-intro-page">
      <div class="meeting-intro-paper">
        <div class="meeting-intro-kicker">${escapeHtml(meeting.time || meeting.clock || "")} · 固定会议</div>
        <pre id="meeting-intro-text">${escapeHtml(visibleText)}</pre>
        <button
          id="meeting-enter-button"
          class="meeting-enter-button"
          ${meetingIntroVisibleChars < printText.length ? "disabled" : ""}
        >
          进入会议室
        </button>
      </div>
    </section>
  `;

  if (!meetingIntroTimer && meetingIntroVisibleChars < printText.length) {
    meetingIntroTimer = setInterval(() => {
      meetingIntroVisibleChars = Math.min(printText.length, meetingIntroVisibleChars + 2);
      renderMeetingIntro(state);

      if (meetingIntroVisibleChars >= printText.length && meetingIntroTimer) {
        clearInterval(meetingIntroTimer);
        meetingIntroTimer = null;
      }
    }, 70);
  }

  const enterButton = document.getElementById("meeting-enter-button");
  enterButton?.addEventListener("click", () => {
    enterMeeting();
  });
}

function renderMeetingRoom(state) {
  const meeting = state.active_meeting;
  if (!meeting) {
    meetingPage.innerHTML = "";
    return;
  }

  const actors = state.actors || [];
  const actorById = new Map(actors.map((actor) => [actor.actor_id, actor]));
  const speechByActorId = getLatestMeetingSpeechByActorId(state);

  const participantHtml = (meeting.participants || [])
    .map((actorId) => {
      const actor = actorById.get(actorId);
      const seat = MEETING_SEATS[actorId] || { left: 50, top: 50 };
      const image = MEETING_ACTOR_ASSETS[actorId] || ACTOR_ASSETS[actorId]?.idleFront || "";
      const theme = ACTOR_THEMES[actorId] || { color: "#1f2933", bubble: "#ffffff" };
      const speech = speechByActorId.get(actorId) || "";

      return `
        <article
          class="meeting-seat actor-${escapeHtml(actorId)}"
          style="left:${seat.left}%; top:${seat.top}%; --actor-color:${theme.color}; --actor-bubble:${theme.bubble};"
        >
          <div class="meeting-seat-bubble" data-meeting-bubble-actor-id="${escapeHtml(actorId)}">${escapeHtml(speech)}</div>
          <img src="${escapeHtml(image)}" alt="${escapeHtml(actor?.display_name || actorId)}">
          <strong>${escapeHtml(actor?.display_name || actorId)}</strong>
        </article>
      `;
    })
    .join("");

  meetingPage.innerHTML = `
    <section class="meeting-scene-layout">
      <section class="meeting-scene">
        <img class="meeting-scene-bg" src="${MEETING_SCENE_ASSET}" alt="会议室">
        <div class="meeting-seats">
          ${participantHtml}
        </div>
      </section>

      <aside class="meeting-side">
        <section class="meeting-control-panel">
          <h2>会议控制</h2>
          <div class="meeting-timer">${formatMeetingTime(meetingRemainingSeconds)}</div>
          <button id="meeting-start-button" ${meeting.phase === "live" ? "disabled" : ""}>
            ${meeting.phase === "live" ? "会议进行中" : "开始会议"}
          </button>
        </section>

        <section class="meeting-chat-panel">
          <h2>会议记录</h2>
          <div id="meeting-transcript" class="meeting-transcript"></div>
        </section>

        <section class="meeting-input-panel">
          <input id="meeting-input" type="text" placeholder="你作为产品经理想说的话">
          <button id="meeting-send-button">发送</button>
        </section>
      </aside>
    </section>
  `;

  renderMeetingTranscript(state);

  const startButton = document.getElementById("meeting-start-button");
  startButton?.addEventListener("click", () => {
    startMeetingCountdown(state);
  });

  const meetingInput = document.getElementById("meeting-input");
  if (meetingInput) {
    meetingInput.value = meetingDraftText;
    meetingInput.addEventListener("input", (event) => {
      meetingDraftText = event.target.value;
    });
    meetingInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        submitMeetingMessage(state);
      }
    });
  }

  const sendButton = document.getElementById("meeting-send-button");
  sendButton?.addEventListener("click", () => {
    submitMeetingMessage(state);
  });
}

function buildMeetingTranscriptHtml(state) {
  const meeting = state.active_meeting;
  const actors = state.actors || [];
  const actorById = new Map(actors.map((actor) => [actor.actor_id, actor]));
  const transcript = meeting?.transcript || [];

  if (transcript.length === 0) {
    return `<p class="meeting-empty">会议刚开始，大家还没有发言。</p>`;
  }

  return transcript
    .slice(-3)
    .map((line) => {
      const speaker = line.speaker || actorById.get(line.actor_id)?.display_name || line.actor_id || "未知角色";
      const content = line.content || line.speech || "";
      const kind = line.kind || (line.actor_id === "user" ? "user" : "actor");

      return `
        <p class="meeting-line meeting-line-${escapeHtml(kind)}">
          <strong>${escapeHtml(speaker)}</strong>
          <span>${escapeHtml(content)}</span>
        </p>
      `;
    })
    .join("");
}

function renderMeetingTranscript(state) {
  const transcriptNode = document.getElementById("meeting-transcript");
  renderMeetingBubbles(state);
  if (!transcriptNode) return;

  transcriptNode.innerHTML = buildMeetingTranscriptHtml(state);
  transcriptNode.scrollTop = transcriptNode.scrollHeight;
}

function getLatestMeetingSpeechByActorId(state) {
  const meeting = state.active_meeting;
  const speechByActorId = new Map();

  for (const line of meeting?.transcript || []) {
    const actorId = String(line.actor_id || "");
    const kind = line.kind || (actorId === "user" ? "user" : "actor");
    const content = String(line.content || line.speech || "").trim();

    if (!actorId || actorId === "user" || kind === "user" || !content) {
      continue;
    }

    speechByActorId.set(actorId, content);
  }

  return speechByActorId;
}

function renderMeetingBubbles(state) {
  const speechByActorId = getLatestMeetingSpeechByActorId(state);

  document.querySelectorAll("[data-meeting-bubble-actor-id]").forEach((node) => {
    const actorId = node.dataset.meetingBubbleActorId || "";
    node.textContent = speechByActorId.get(actorId) || "";
  });
}

function formatMeetingTime(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const rest = String(safe % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

async function startMeetingCountdown(state) {
  const meeting = state.active_meeting;
  if (!meeting || meeting.phase === "live") return;

  const nextState = await startMeeting();
  if (!nextState?.active_meeting) return;

  const liveState = nextState;
  const liveMeeting = liveState.active_meeting;
  liveMeeting.phase = "live";
  meetingRemainingSeconds = Number(liveMeeting.duration_seconds || 120);

  if (meetingCountdownTimer) {
    clearInterval(meetingCountdownTimer);
  }

  if (meetingTickTimer) {
    clearInterval(meetingTickTimer);
  }

  meetingTickTimer = setInterval(() => {
    tickMeeting();
  }, 9000);

  meetingCountdownTimer = setInterval(() => {
    meetingRemainingSeconds = Math.max(0, meetingRemainingSeconds - 1);
    const timerNode = document.querySelector(".meeting-timer");
    if (timerNode) {
      timerNode.textContent = formatMeetingTime(meetingRemainingSeconds);
    }

    if (meetingRemainingSeconds <= 0 && meetingCountdownTimer) {
      clearInterval(meetingCountdownTimer);
      meetingCountdownTimer = null;
      if (meetingTickTimer) {
        clearInterval(meetingTickTimer);
        meetingTickTimer = null;
      }
      finishMeeting();
    }
  }, 1000);

  renderMeetingRoom(liveState);
}

function renderMeetingResult(state) {
  const meeting = state.active_meeting;
  if (!meeting) {
    meetingPage.innerHTML = "";
    return;
  }

  const result = meeting.result || {};
  const resultTitle = result.title || "会议结果";
  const resultSummary = result.summary || "会议已结束，正在整理结果。";
  const printText = `${resultTitle}\n\n${resultSummary}`;
  const printKey = `${meeting.meeting_id || ""}:${resultTitle}:${resultSummary}`;

  if (meetingResultPrintedKey !== printKey) {
    meetingResultPrintedKey = printKey;
    meetingResultVisibleChars = 0;
    if (meetingResultTimer) {
      clearInterval(meetingResultTimer);
      meetingResultTimer = null;
    }
    if (meetingResultReturnTimer) {
      clearTimeout(meetingResultReturnTimer);
      meetingResultReturnTimer = null;
    }
  }

  const visibleText = printText.slice(0, meetingResultVisibleChars);
  const finished = meetingResultVisibleChars >= printText.length;

  meetingPage.innerHTML = `
    <section class="meeting-result-page">
      <div class="meeting-result-paper">
        <div class="meeting-intro-kicker">${escapeHtml(meeting.time || meeting.clock || "")} · 会议结果</div>
        <pre id="meeting-result-text">${escapeHtml(visibleText)}</pre>
        <button id="meeting-close-button" ${finished ? "" : "disabled"}>返回主世界</button>
      </div>
    </section>
  `;

  if (!meetingResultTimer && !finished) {
    meetingResultTimer = setInterval(() => {
      meetingResultVisibleChars = Math.min(printText.length, meetingResultVisibleChars + 2);
      renderMeetingResult(state);

      if (meetingResultVisibleChars >= printText.length && meetingResultTimer) {
        clearInterval(meetingResultTimer);
        meetingResultTimer = null;
      }
    }, 70);
  }

  const closeButton = document.getElementById("meeting-close-button");
  closeButton?.addEventListener("click", () => {
    closeMeeting();
  });

  if (finished && !meetingResultReturnTimer) {
    meetingResultReturnTimer = setTimeout(() => {
      closeMeeting();
    }, 1800);
  }
}

function submitMeetingMessage(state) {
  const meeting = state.active_meeting;
  const message = meetingDraftText.trim();

  if (!meeting || !message) return;

  meetingDraftText = "";
  const input = document.getElementById("meeting-input");
  if (input) {
    input.value = "";
  }
  sendMeetingMessage(message);
}

function renderPantryPage(state) {
  const pantry = ensurePantryState(state);
  const actors = state.actors || [];
  const actorById = new Map(actors.map((actor) => [actor.actor_id, actor]));
  const participants = pantry.participants || pantry.actors?.map((actor) => actor.actor_id) || [];
  const speechByActorId = getLatestPantrySpeechByActorId(pantry);

  const actorHtml = participants
    .map((actorId) => {
      const actor = actorById.get(actorId) || pantry.actors?.find((item) => item.actor_id === actorId) || {};
      const seat = PANTRY_SEATS[actorId] || { left: 50, top: 68 };
      const image = PANTRY_ACTOR_ASSETS[actorId] || ACTOR_ASSETS[actorId]?.idleFront || "";
      const theme = ACTOR_THEMES[actorId] || { color: "#1f2933", bubble: "#ffffff" };
      const speech = speechByActorId.get(actorId) || "";

      return `
        <article
          class="pantry-seat actor-${escapeHtml(actorId)}"
          style="left:${seat.left}%; top:${seat.top}%; --actor-color:${theme.color}; --actor-bubble:${theme.bubble};"
        >
          <div class="pantry-seat-bubble" data-pantry-bubble-actor-id="${escapeHtml(actorId)}">${escapeHtml(speech)}</div>
          <img src="${escapeHtml(image)}" alt="${escapeHtml(actor.display_name || actor.actor_name || actorId)}">
          <strong>${escapeHtml(actor.display_name || actor.actor_name || actorId)}</strong>
        </article>
      `;
    })
    .join("");

  meetingPage.innerHTML = `
    <section class="pantry-scene-layout">
      <section class="pantry-scene">
        <img class="pantry-scene-bg" src="${PANTRY_SCENE_ASSET}" alt="茶水间">
        <div class="pantry-seats">
          ${actorHtml}
        </div>
      </section>

      <aside class="pantry-side">
        <section class="pantry-chat-panel">
          <h2>现场闲谈</h2>
          <div id="pantry-transcript" class="pantry-transcript"></div>
        </section>

        <section class="pantry-input-panel">
          <input id="pantry-input" type="text" placeholder="你作为产品经理想随口说点什么">
          <button id="pantry-send-button">插一句</button>
          <button id="pantry-leave-button" class="secondary-button">你们先聊，我走了</button>
        </section>
      </aside>
    </section>
  `;

  renderPantryTranscript({ ...state, active_pantry: pantry });
  startPantryAutoRound();

  const input = document.getElementById("pantry-input");
  if (input) {
    input.value = pantryDraftText;
    input.addEventListener("input", (event) => {
      pantryDraftText = event.target.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        submitPantryMessage();
      }
    });
  }

  document.getElementById("pantry-send-button")?.addEventListener("click", submitPantryMessage);
  document.getElementById("pantry-leave-button")?.addEventListener("click", () => {
    leavePantry();
  });
}

function submitPantryMessage() {
  const message = pantryDraftText.trim();
  if (!message) return;

  pantryDraftText = "";
  const input = document.getElementById("pantry-input");
  if (input) {
    input.value = "";
  }
  sendPantryMessage(message);
}

function startPantryAutoRound() {
  if (pantryRoundTimer) return;
  pantryRoundTimer = setInterval(() => {
    const isTyping = Boolean(String(pantryDraftText || "").trim());
    if (!isTyping) {
      tickPantry();
    }
  }, 5200);
}

function renderPantryTranscript(state) {
  const pantry = ensurePantryState(state);
  const transcriptNode = document.getElementById("pantry-transcript");
  renderPantryBubbles(pantry);
  if (!transcriptNode) return;

  const transcript = pantry.transcript || [];
  if (!transcript.length) {
    transcriptNode.innerHTML = `<p class="pantry-empty">大家刚凑过来，还没开始说话。</p>`;
    return;
  }

  transcriptNode.innerHTML = transcript
    .slice(-6)
    .map((line) => {
      const kind = line.kind || (line.actor_id === "user" ? "user" : "actor");
      return `
        <p class="pantry-line pantry-line-${escapeHtml(kind)}">
          <strong>${escapeHtml(line.speaker || line.actor_name || line.actor_id || "同事")}</strong>
          <span>${escapeHtml(line.content || line.speech || "")}</span>
        </p>
      `;
    })
    .join("");
}

function getLatestPantrySpeechByActorId(pantry) {
  const actorNameToId = new Map((pantry.actors || []).map((actor) => [actor.display_name || actor.actor_name, actor.actor_id]));
  const speechByActorId = new Map();

  for (const line of pantry.transcript || []) {
    const kind = line.kind || (line.actor_id === "user" ? "user" : "actor");
    const actorId = line.actor_id || actorNameToId.get(line.speaker);
    const content = String(line.content || line.speech || "").trim();
    if (!actorId || actorId === "user" || kind === "user" || !content) continue;
    speechByActorId.set(actorId, content);
  }

  return speechByActorId;
}

function renderPantryBubbles(pantry) {
  const speechByActorId = getLatestPantrySpeechByActorId(pantry);
  document.querySelectorAll("[data-pantry-bubble-actor-id]").forEach((node) => {
    const actorId = node.dataset.pantryBubbleActorId || "";
    node.textContent = speechByActorId.get(actorId) || "";
  });
}

function buildPantryFallbackLines(pantry, userMessage) {
  const participants = pantry.participants || ["xiongshichang", "xionglaoban", "xiongxingzheng", "xiongjishu"];
  const actorNames = new Map((pantry.actors || []).map((actor) => [actor.actor_id, actor.display_name || actor.actor_name || actor.actor_id]));
  const fallback = {
    xiongshichang: userMessage ? `你刚这句挺真实的，白天会上反而没人敢这么说。` : "我就觉得今天大家都太绷了，像是怕先说错话。",
    xionglaoban: userMessage ? `这句我听进去了，不是结论，但值得明天拿出来想想。` : "茶水间不用拍板，先把心里那点别扭说出来。",
    xiongxingzheng: userMessage ? `我担心的是，大家说能扛，可成本最后还是会落到账上。` : "说轻松点吧，但钱和人这两件事真不能装没看见。",
    xiongjishu: userMessage ? `这个角度有用，需求和情绪其实都得算进实现成本。` : "我白天没说，其实有些技术债再拖就会反咬我们。",
  };
  const start = (pantry.transcript || []).length % participants.length;
  const picked = [participants[start], participants[(start + 1) % participants.length]];

  return picked.map((actorId) => ({
    speaker: actorNames.get(actorId) || actorId,
    actor_id: actorId,
    kind: "actor",
    content: fallback[actorId] || "这事先别急着定性，聊开一点反而更清楚。",
  }));
}


function renderIncident(incident) {
  if (!incidentPanel) return;
  incidentPanel.hidden = true;
  incidentPanel.innerHTML = "";
  return;

  if (!incident) {
    incidentPanel.hidden = true;
    incidentPanel.innerHTML = "";
    return;
  }

  incidentPanel.hidden = false;
  incidentPanel.innerHTML = `
    <article class="incident-card">
      <div class="incident-kicker">${escapeHtml(incident.time || incident.clock || "")} · 固定事件</div>
      <h2>${escapeHtml(incident.title || "事件")}</h2>
      <p>${escapeHtml(incident.content || "")}</p>
    </article>
  `;
}

function renderIncidentOverlay(incident) {
  if (!incidentOverlay) return;

  if (
    !incident ||
    currentRoute() !== "world" ||
    onboardingActive ||
    (onboardingPage && !onboardingPage.hidden) ||
    lastState?.active_report?.visible
  ) {
    if (!incident) {
      hideIncidentOverlay(false);
    }
    return;
  }

  const key = incidentSeenStorageKey(incident);
  if (window.sessionStorage.getItem(key) === "1") return;
  if (!incidentOverlay.hidden && incidentOverlayKey === key) return;

  stopAutoStepTimer();
  incidentOverlayKey = key;
  incidentOverlay.hidden = false;
  incidentOverlay.innerHTML = `
    <article class="incident-overlay-card">
      <div class="incident-overlay-kicker">${escapeHtml(incident.time || incident.clock || "")} · 固定事件</div>
      <h2>${escapeHtml(incident.title || "公司发生了一件事")}</h2>
      <p>${escapeHtml(incident.content || "")}</p>
      <div class="incident-overlay-foot">10 秒后回到公司，大家会把这件事带进接下来的判断里。</div>
    </article>
  `;

  if (incidentOverlayTimer) {
    clearTimeout(incidentOverlayTimer);
  }

  incidentOverlayTimer = window.setTimeout(() => {
    hideIncidentOverlay(true);
    if (autoStepEnabled && isWorldStepAvailable()) {
      startAutoStepTimer();
    }
  }, INCIDENT_OVERLAY_MS);
}

function hideIncidentOverlay(markSeen = true) {
  if (!incidentOverlay) return;

  if (incidentOverlayTimer) {
    clearTimeout(incidentOverlayTimer);
    incidentOverlayTimer = null;
  }

  if (markSeen && incidentOverlayKey) {
    window.sessionStorage.setItem(incidentOverlayKey, "1");
  }

  incidentOverlay.hidden = true;
  incidentOverlay.innerHTML = "";
  incidentOverlayKey = "";
}

function renderActors(actors) {
  actorList.innerHTML = actors
    .map((actor) => {
      const memories = (actor.memory || []).slice(-2).reverse();
      const memoryHtml = memories.length
        ? memories.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : `<li>暂无</li>`;

      return `
        <article class="actor-card">
          <h3>${escapeHtml(actor.display_name)}</h3>
          <p>位置：${escapeHtml(actor.location)}</p>
          <p>压力：${actor.stress}</p>
          <p>精力：${actor.energy}</p>
          <p>任务：${escapeHtml(actor.current_task || "暂无")}</p>
          <p>意图：${escapeHtml(actor.intent || "暂无")}</p>
          <p>目标：${escapeHtml(actor.move_to || "暂无")}</p>
          <p>发言：${escapeHtml(actor.last_speech || "暂无")}</p>
          <div class="memory-block">
            <strong>最近记忆</strong>
            <ul>${memoryHtml}</ul>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMap(state) {
  const locations = state.map?.semantics?.locations || [];
  const actors = state.actors || [];

  if (locations.length === 0) {
    mapView.innerHTML = `<p class="empty-log">暂无地图数据</p>`;
    return;
  }

  mapView.innerHTML = locations
    .map((location) => {
      const actorsHere = actors.filter((actor) => actor.location === location.name);
      const actorBadges = actorsHere.length
        ? actorsHere.map((actor) => `<span class="map-actor">${escapeHtml(actor.display_name)}</span>`).join("")
        : `<span class="map-empty">无人</span>`;
      const contains = (location.contains || []).join("、");

      return `
        <article class="map-location">
          <header>
            <h3>${escapeHtml(location.name)}</h3>
            <span>${actorsHere.length} 人</span>
          </header>
          <p>${escapeHtml(location.function || "")}</p>
          <p class="map-items">物件：${escapeHtml(contains || "暂无")}</p>
          <div class="map-actors">${actorBadges}</div>
        </article>
      `;
    })
    .join("");
}

function renderFloorMapPoints(state) {
  const world = state.map?.world || {};
  const locations = state.map?.semantics?.locations || [];
  const actors = state.actors || [];
  const pixelWidth = Number(world.pixel_width || 0);
  const pixelHeight = Number(world.pixel_height || 0);

  if (!floorMapPoints || !pixelWidth || !pixelHeight) return;

  const locationByName = new Map(locations.map((location) => [location.name, location]));
  const actorsByLocation = new Map();
  const activeActorIds = new Set();

  for (const actor of actors) {
    const group = actorsByLocation.get(actor.location) || [];
    group.push(actor);
    actorsByLocation.set(actor.location, group);
  }

  for (const actor of actors) {
    const location = locationByName.get(actor.location);
    if (!location || location.anchor_x == null || location.anchor_y == null) {
      continue;
    }

    activeActorIds.add(actor.actor_id);

    const group = actorsByLocation.get(actor.location) || [];
    const index = group.findIndex((item) => item.actor_id === actor.actor_id);
    const formation = getActorFormationOffset(index, group.length);
    const left = (Number(location.anchor_x) / pixelWidth) * 100;
    const top = (Number(location.anchor_y) / pixelHeight) * 100;

    let node = floorMapPoints.querySelector(`[data-actor-id="${actor.actor_id}"]`);
    if (!node) {
      node = document.createElement("div");
      node.className = "floor-actor";
      node.dataset.actorId = actor.actor_id;
      node.innerHTML = `
        <div class="floor-actor-shadow"></div>
        <img class="floor-actor-image" alt="">
        <div class="floor-actor-label"></div>
      `;
      floorMapPoints.appendChild(node);
    }

    const image = node.querySelector(".floor-actor-image");
    const label = node.querySelector(".floor-actor-label");
    const asset = ACTOR_ASSETS[actor.actor_id] || {};
    const theme = ACTOR_THEMES[actor.actor_id] || { color: "#1f2933", bubble: "#ffffff" };

    if (image) {
      image.alt = actor.display_name;
    }

    if (label) {
      label.textContent = actor.display_name;
    }

    node.title = `${actor.display_name} · ${actor.location}`;
    const previousLeft = Number.parseFloat(node.dataset.left || "");
    const previousTop = Number.parseFloat(node.dataset.top || "");
    const hasPreviousPosition = Number.isFinite(previousLeft) && Number.isFinite(previousTop);
    const hasMoved =
      hasPreviousPosition &&
      (Math.abs(previousLeft - left) > 0.01 || Math.abs(previousTop - top) > 0.01);

    node.style.setProperty("--actor-offset-x", `${formation.x}px`);
    node.style.setProperty("--actor-offset-y", `${formation.y}px`);
    node.style.setProperty("--actor-color", theme.color);
    node.style.setProperty("--actor-bubble", theme.bubble);
    node.style.zIndex = String(10 + index);

    renderActorSpeechBubble({
      actor,
      left,
      top,
      index,
      total: group.length,
      theme,
    });

    if (hasMoved) {
      startActorWalkAnimation(
        node,
        actor,
        asset,
        { left: previousLeft, top: previousTop },
        { left, top }
      );
    } else {
      stopActorWalkAnimation(actor.actor_id);
      node.style.left = `${left}%`;
      node.style.top = `${top}%`;
      node.dataset.left = String(left);
      node.dataset.top = String(top);
      applyActorFrame(node, asset, "front", false);
    }
  }

  for (const node of Array.from(floorMapPoints.querySelectorAll(".floor-actor"))) {
    if (!activeActorIds.has(node.dataset.actorId)) {
      node.remove();
    }
  }

  for (const node of Array.from(floorMapPoints.querySelectorAll(".floor-speech"))) {
    if (!activeActorIds.has(node.dataset.speechActorId)) {
      node.remove();
    }
  }
}

function renderActorSpeechBubble({ actor, left, top, index, total, theme }) {
  const speechText = String(actor.last_speech || "").trim();
  let node = floorMapPoints.querySelector(`[data-speech-actor-id="${actor.actor_id}"]`);

  if (!speechText) {
    node?.remove();
    return;
  }

  if (!node) {
    node = document.createElement("div");
    node.className = "floor-speech";
    node.dataset.speechActorId = actor.actor_id;
    floorMapPoints.appendChild(node);
  }

  const formation = getSpeechFormationOffset(index, total, left);
  const speechPosition = getSpeechBubblePosition({
    left,
    top,
    offsetX: formation.x,
    offsetY: formation.y,
  });

  node.innerHTML = `
    <strong>${escapeHtml(actor.display_name)}</strong>
    <span>${escapeHtml(speechText)}</span>
  `;
  node.style.width = `${speechPosition.width}px`;
  node.style.left = `${speechPosition.left}px`;
  node.style.top = `${speechPosition.top}px`;
  node.style.setProperty("--actor-color", theme.color);
  node.style.setProperty("--actor-bubble", theme.bubble);
  node.style.zIndex = String(40 + index);
}

function getActorFormationOffset(index, total) {
  if (total <= 1) {
    return { x: 0, y: 0 };
  }

  const spacingX = 38;
  const spacingY = 10;
  const center = (total - 1) / 2;

  return {
    x: (index - center) * spacingX,
    y: (index % 2 === 0 ? -1 : 1) * spacingY,
  };
}

function getSpeechFormationOffset(index, total, anchorLeft) {
  const bubbleWidth = 315;
  const center = (total - 1) / 2;
  const row = index % 2;
  let edgeShift = 0;

  if (anchorLeft < 24) {
    edgeShift = 130;
  } else if (anchorLeft > 76) {
    edgeShift = -130;
  }

  return {
    x: edgeShift + (index - center) * bubbleWidth,
    y: -156 - row * 78,
  };
}

function getSpeechBubblePosition({ left, top, offsetX, offsetY }) {
  const mapWidth = floorMapPoints.clientWidth || 1;
  const mapHeight = floorMapPoints.clientHeight || 1;
  const margin = 12;
  const bubbleWidth = Math.min(360, Math.max(280, mapWidth * 0.3));
  const estimatedHeight = 108;
  const anchorX = (left / 100) * mapWidth;
  const anchorY = (top / 100) * mapHeight;
  const desiredLeft = anchorX + offsetX - bubbleWidth / 2;
  let desiredTop = anchorY + offsetY;

  if (desiredTop < margin) {
    desiredTop = anchorY + 70;
  }

  return {
    width: bubbleWidth,
    left: clampNumber(desiredLeft, margin, Math.max(margin, mapWidth - bubbleWidth - margin)),
    top: clampNumber(desiredTop, margin, Math.max(margin, mapHeight - estimatedHeight - margin)),
  };
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function startActorWalkAnimation(node, actor, asset, fromPosition, toPosition) {
  if (!asset.walkFront?.length) return;

  stopActorWalkAnimation(actor.actor_id);

  const deltaLeft = toPosition.left - fromPosition.left;
  const deltaTop = toPosition.top - fromPosition.top;
  const direction = getMoveDirection(deltaLeft, deltaTop);
  const startedAt = window.performance.now();

  node.classList.add("is-walking");

  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / ACTOR_MOVE_DURATION_MS);
    const easedProgress = easeInOut(progress);
    const currentLeft = fromPosition.left + deltaLeft * easedProgress;
    const currentTop = fromPosition.top + deltaTop * easedProgress;
    const frameIndex = Math.floor((now - startedAt) / ACTOR_FRAME_INTERVAL_MS);

    node.style.left = `${currentLeft}%`;
    node.style.top = `${currentTop}%`;
    applyActorFrame(node, asset, direction, true, frameIndex);

    if (progress < 1) {
      const animationFrameId = window.requestAnimationFrame(tick);
      actorAnimationTimers.set(actor.actor_id, { animationFrameId });
      return;
    }

    node.style.left = `${toPosition.left}%`;
    node.style.top = `${toPosition.top}%`;
    node.dataset.left = String(toPosition.left);
    node.dataset.top = String(toPosition.top);
    node.classList.remove("is-walking");
    applyActorFrame(node, asset, direction, false);
    actorAnimationTimers.delete(actor.actor_id);
  };

  const animationFrameId = window.requestAnimationFrame(tick);
  actorAnimationTimers.set(actor.actor_id, { animationFrameId });
}

function stopActorWalkAnimation(actorId) {
  const timers = actorAnimationTimers.get(actorId);
  if (!timers) return;

  if (timers.animationFrameId) {
    window.cancelAnimationFrame(timers.animationFrameId);
  }

  if (timers.intervalId) {
    window.clearInterval(timers.intervalId);
  }

  if (timers.timeoutId) {
    window.clearTimeout(timers.timeoutId);
  }

  actorAnimationTimers.delete(actorId);
}

function applyActorFrame(node, asset, direction, isWalking, frameIndex = 0) {
  const image = node.querySelector(".floor-actor-image");
  if (!image) return;

  const isBack = direction === "back";
  const isLeft = direction === "left";
  const frames = isBack ? asset.walkBack : asset.walkFront;
  const idle = isBack ? asset.idleBack || asset.idleFront || "" : asset.idleFront || "";

  image.src = isWalking && frames?.length ? frames[frameIndex % frames.length] : idle;
  image.style.transform = isLeft ? "scaleX(-1)" : "scaleX(1)";
}

function getMoveDirection(deltaLeft, deltaTop) {
  if (!Number.isFinite(deltaLeft) || !Number.isFinite(deltaTop)) {
    return "front";
  }

  if (Math.abs(deltaLeft) > Math.abs(deltaTop)) {
    return deltaLeft < 0 ? "left" : "right";
  }

  return deltaTop < 0 ? "back" : "front";
}

function easeInOut(progress) {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function renderInputHistory(records) {
  const latestRecords = records.slice(-8).reverse();

  if (latestRecords.length === 0) {
    inputHistory.innerHTML = `<p class="empty-log">暂无输入记录</p>`;
    return;
  }

  inputHistory.innerHTML = latestRecords
    .map((record) => {
      const reactionNames = (record.actor_reactions || [])
        .map((reaction) => reaction.display_name)
        .filter(Boolean)
        .join("、");
      const inputText = record.is_empty ? "（空输入）" : escapeHtml(record.raw_text);

      return `
        <article class="input-record">
          <header class="input-record-header">
            <strong>第 ${record.step} 步 · ${record.clock}</strong>
            <span>#${record.input_id}</span>
          </header>
          <p class="input-record-text">${inputText}</p>
          <p class="input-record-meta">触发角色：${escapeHtml(reactionNames || "无")}</p>
        </article>
      `;
    })
    .join("");
}

function renderLogs(logs) {
  const latestLogs = logs.slice(-5).reverse();

  if (latestLogs.length === 0) {
    logView.innerHTML = `<p class="empty-log">暂无日志</p>`;
    return;
  }

  logView.innerHTML = latestLogs
    .map((log) => {
      const reactions = log.actor_reactions || [];
      const reactionHtml = reactions
        .map((reaction) => {
          return `
            <div class="log-reaction">
              <h4>${escapeHtml(reaction.display_name)}</h4>
              <p><strong>移动：</strong>${escapeHtml(reaction.from_location || "未知")} → ${escapeHtml(reaction.to_location || reaction.move_to || "未知")}</p>
              <p><strong>任务：</strong>${escapeHtml(reaction.task || "暂无")}</p>
              <p><strong>意图：</strong>${escapeHtml(reaction.intent || "暂无")}</p>
              <p><strong>发言：</strong>${escapeHtml(reaction.speech || "暂无")}</p>
              <p class="log-meta">压力 ${reaction.stress} · 精力 ${reaction.energy}</p>
            </div>
          `;
        })
        .join("");

      const encounters = log.encounters || [];
      const encounterHtml = encounters.length
        ? `
          <div class="encounter-list">
            ${encounters.map(renderEncounter).join("")}
          </div>
        `
        : "";

      return `
        <article class="log-card">
          <header class="log-card-header">
            <strong>${escapeHtml(log.from_clock)} → ${escapeHtml(log.to_clock)}</strong>
            <span>第 ${log.step} 步</span>
          </header>
          <p class="log-affair">事务：${escapeHtml(log.affair || "无额外事务")}</p>
          <div class="log-reactions">
            ${reactionHtml}
          </div>
          ${encounterHtml}
        </article>
      `;
    })
    .join("");
}

function renderReport(report) {
  if (!reportSection || !reportView) return;

  if (!report || !report.visible) {
    reportSection.hidden = true;
    reportView.innerHTML = "";
    return;
  }

  stopAutoStepTimer();
  reportSection.hidden = false;

  const radarItems = Array.isArray(report.radar_items) ? report.radar_items : [];
  const evidence = Array.isArray(report.evidence) ? report.evidence.slice(0, 5) : [];

  reportView.innerHTML = `
    <article class="report-letter">
      <header class="report-letter-header">
        <div>
          <p class="report-meta">${escapeHtml(report.clock || report.time || "18:00")} · 熊起东方写给产品经理</p>
          <h2>${escapeHtml(report.letter_title || "今天辛苦了，产品经理")}</h2>
        </div>
        <button id="report-close-button" class="report-close-button" type="button">回到公司</button>
      </header>

      <div class="report-letter-grid">
        <section class="report-letter-body">
          <p class="report-salute">产品经理：</p>
          <p>${escapeHtml(report.letter_body || report.trait_summary || "")}</p>
          <p class="report-summary">${escapeHtml(report.trait_summary || "")}</p>
          ${
            evidence.length
              ? `
                <div class="report-evidence">
                  <strong>今天让我们记住你的几件事</strong>
                  ${evidence.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
                </div>
              `
              : ""
          }
          <p class="report-signature">熊起东方全体同事</p>
        </section>

        <aside class="report-radar-card">
          <h3>今天的工作倾向</h3>
          <div class="report-radar-wrap">
            ${buildRadarSvg(radarItems)}
          </div>
        </aside>
      </div>
    </article>
  `;

  document.getElementById("report-close-button")?.addEventListener("click", closeReport);
}

async function closeReport() {
  try {
    const response = await fetch(`${API_BASE}/api/report/close`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    navigateTo("world");
    renderState(data.state);
  } catch (error) {
    console.warn("close report failed", error);
    if (lastState?.active_report) {
      lastState.active_report.visible = false;
      navigateTo("world");
      renderState(lastState);
    }
  }
}

function buildRadarSvg(items) {
  const safeItems = Array.isArray(items) ? items.slice(0, 5) : [];
  if (safeItems.length < 3) {
    return `<div class="report-radar-empty">暂无足够数据</div>`;
  }

  const size = 220;
  const center = size / 2;
  const radius = 70;
  const angleStep = (Math.PI * 2) / safeItems.length;

  const pointAt = (index, ratio) => {
    const angle = -Math.PI / 2 + index * angleStep;
    return {
      x: center + Math.cos(angle) * radius * ratio,
      y: center + Math.sin(angle) * radius * ratio,
    };
  };

  const rings = [0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const points = safeItems
        .map((_, index) => {
          const point = pointAt(index, ratio);
          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        })
        .join(" ");
      return `<polygon class="report-radar-ring" points="${points}"></polygon>`;
    })
    .join("");

  const axes = safeItems
    .map((_, index) => {
      const point = pointAt(index, 1);
      return `<line class="report-radar-axis" x1="${center}" y1="${center}" x2="${point.x.toFixed(1)}" y2="${point.y.toFixed(1)}"></line>`;
    })
    .join("");

  const shapePoints = safeItems
    .map((item, index) => {
      const value = Number(item.value || 0);
      const ratio = Math.max(0.2, Math.min(0.95, value / 100));
      const point = pointAt(index, ratio);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");

  const labels = safeItems
    .map((item, index) => {
      const point = pointAt(index, 1.22);
      const value = Math.round(Number(item.value || 0));
      return `
        <text class="report-radar-label" x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}">${escapeHtml(item.label || item.code || "")}</text>
        <text class="report-radar-value" x="${point.x.toFixed(1)}" y="${(point.y + 15).toFixed(1)}">${value}</text>
      `;
    })
    .join("");

  return `
    <svg class="report-radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="大五人格雷达图">
      ${rings}
      ${axes}
      <polygon class="report-radar-shape" points="${shapePoints}"></polygon>
      ${labels}
    </svg>
  `;
}

function renderEncounter(encounter) {
  const dialogue = encounter.dialogue || [];
  const actorNameById = new Map(
    (encounter.actor_ids || []).map((actorId, index) => [
      actorId,
      (encounter.actor_names || encounter.display_names || [])[index] || actorId,
    ])
  );
  const dialogueHtml = dialogue.length
    ? `
      <div class="dialogue-lines">
        ${dialogue
          .map((line) => {
            const speakerName = actorNameById.get(line.actor_id) || line.actor_id || "未知角色";
            const targetName = actorNameById.get(line.to_actor_id) || "";
            const targetText = targetName ? ` <span>→ ${escapeHtml(targetName)}</span>` : "";

            return `
              <p class="dialogue-line">
                <strong>${escapeHtml(speakerName)}</strong>${targetText}：${escapeHtml(line.speech || "")}
              </p>
            `;
          })
          .join("")}
      </div>
    `
    : "";

  return `
    <article class="encounter-item">
      <strong>相遇：${escapeHtml(encounter.location || "未知地点")}</strong>
      <p>${escapeHtml(encounter.summary || "")}</p>
      ${dialogueHtml}
    </article>
  `;
}

stepButton.addEventListener("click", submitWorldInput);
autoStepButton?.addEventListener("click", toggleAutoStep);
resetButton.addEventListener("click", resetWorld);
musicButton?.addEventListener("click", toggleMusic);
authLoginTab?.addEventListener("click", () => setAuthMode("login"));
authRegisterTab?.addEventListener("click", () => setAuthMode("register"));
authForm?.addEventListener("submit", submitAuth);
logoutButton?.addEventListener("click", logoutPlayer);
authUsername?.addEventListener("focus", tryPlayBgm);
authPassword?.addEventListener("focus", tryPlayBgm);

affairInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitWorldInput();
  }
});
window.addEventListener("hashchange", () => {
  if (lastState) {
    renderState(lastState);
  }
});


setAuthMode("login");
updateMusicButton();
armBgmStartOnFirstGesture();
renderAuthShell();
bootstrapAuth();
