// Tətbiqin giriş nöqtəsi — UI bağlama, settings, oyun yaradılması.

import { Game } from "./game.js";
import { setSoundEnabled, playClick, playWin, playLose, resumeAudio } from "./sound.js";

// ───── Tənzimləmələr ─────
const STORAGE_KEY = "pong.az/settings/v1";

const DEFAULT_SETTINGS = {
  mode: "pvc",
  difficulty: "medium",
  winScore: 7,
  paddleLen: 0.24,        // çubuq uzunluğu (canvas eninə nisbət)
  ballSpeed: 0.45,        // top başlanğıc sürəti (canvas hündürlüyünə nisbət)
  paddleSpeed: 1.2,       // klaviatura ilə çubuq sürəti
  sensitivity: 1.0,       // toxunma hassasiyeti (1.0 = barmaq=çubuq, >1 = daha çevik)
  sound: true,
  particles: true,
  shake: true,
  trail: true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ───── DOM ─────
const dom = {
  canvas:        document.getElementById("canvas"),
  overlay:       document.getElementById("overlay"),
  overlayTitle:  document.querySelector(".overlay__title"),
  overlaySub:    document.getElementById("overlay-sub"),
  overlayInner:  document.querySelector(".overlay__inner"),
  btnStart:      document.getElementById("btn-start"),
  btnOpenSet:    document.getElementById("btn-open-settings"),
  btnPause:      document.getElementById("btn-pause"),
  btnSound:      document.getElementById("btn-sound"),
  btnSettings:   document.getElementById("btn-settings"),
  modal:         document.getElementById("modal-settings"),
  scoreLeft:     document.getElementById("score-left"),
  scoreRight:    document.getElementById("score-right"),
  nameLeft:      document.getElementById("name-left"),
  nameRight:     document.getElementById("name-right"),
  toast:         document.getElementById("toast"),
  touchLeft:     document.getElementById("touch-left"),
  touchRight:    document.getElementById("touch-right"),
};

// ───── State ─────
const state = {
  settings: loadSettings(),
  game: null,
};

// ───── Toast ─────
let toastTimer = null;
function showToast(message, ms = 1800) {
  dom.toast.textContent = message;
  dom.toast.classList.add("toast--show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove("toast--show"), ms);
}

// ───── Oyun yaradılması ─────
function createGame() {
  const game = new Game(dom.canvas, {
    ...state.settings,
    onScore: (who, l, r) => {
      bumpScore(who);
      dom.scoreLeft.textContent = l;
      dom.scoreRight.textContent = r;
    },
    onGameOver: (winner) => onGameOver(winner),
  });
  return game;
}

function bumpScore(who) {
  const el = who === "left" ? dom.scoreLeft : dom.scoreRight;
  el.classList.remove("score__value--bump");
  void el.offsetWidth; // reflow
  el.classList.add("score__value--bump");
}

function onGameOver(winner) {
  const isPlayerWin = (winner === "left");
  if (isPlayerWin) playWin(); else playLose();

  const leftName = state.settings.mode === "pvp" ? "1-ci OYUNÇU" : "SƏN";
  const rightName = state.settings.mode === "pvp" ? "2-ci OYUNÇU" : "AI";
  const winnerName = winner === "left" ? leftName : rightName;
  const subText = state.settings.mode === "pvp"
    ? `${winnerName} qələbə qazandı!`
    : (isPlayerWin ? "Möhtəşəm qələbə!" : "AI bu dəfə üstün gəldi");

  dom.overlayTitle.textContent = winnerName + " QALİB";
  dom.overlaySub.textContent = subText;
  dom.btnStart.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg> YENİDƏN OYNA`;
  showOverlay();
}

// ───── Overlay ─────
function showOverlay() {
  dom.overlay.classList.remove("overlay--hidden");
}
function hideOverlay() {
  dom.overlay.classList.add("overlay--hidden");
}

/** Pauza overlay-i — oyun davam edir, lakin gözlədir. */
function showPauseOverlay() {
  dom.overlayTitle.textContent = "DAYANDIRILDI";
  dom.overlaySub.textContent = "Davam etmək üçün ↓";
  dom.btnStart.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg> DAVAM ET`;
  showOverlay();
}

function resumeFromPause() {
  if (state.game?.state === "paused") {
    state.game.resume();
    hideOverlay();
  }
}

function startGame() {
  resumeAudio();
  if (!state.game) state.game = createGame();
  // Hər başlanğıcda ən son tənzimləmələri tətbiq edirik
  Object.entries(state.settings).forEach(([k, v]) => state.game.setOption(k, v));
  state.game.start();
  dom.scoreLeft.textContent = "0";
  dom.scoreRight.textContent = "0";

  // Adlar
  dom.nameLeft.textContent = state.settings.mode === "pvp" ? "1-ci" : "SƏN";
  dom.nameRight.textContent = state.settings.mode === "pvp" ? "2-ci" : "AI";

  // Overlay başlığını başlanğıc vəziyyətinə qaytar
  dom.overlayTitle.innerHTML = `PONG<span class="overlay__title-dot">.</span>az`;
  dom.overlaySub.textContent = "NEON · DARK · ARCADE";
  dom.btnStart.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg> BAŞLA`;
  hideOverlay();
}

// ───── Klaviatura — bağlama ─────
function bindKeyboard() {
  // Üfüqi çubuq: sol/sağ hərəkət (klassik Up/Down da geri-uyğun saxlanılır)
  const keymap = {
    "ArrowLeft": "leftUp", "ArrowRight": "leftDown",
    "ArrowUp": "leftUp",   "ArrowDown": "leftDown",
    "a": "leftUp", "A": "leftUp",
    "d": "leftDown", "D": "leftDown",
    "w": "leftUp", "W": "leftUp",
    "s": "leftDown", "S": "leftDown",
  };
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (keymap[e.key]) {
      e.preventDefault();
      state.game?.setInput(keymap[e.key], true);
      return;
    }
    if (e.code === "Space" || e.key === "p" || e.key === "P") {
      e.preventDefault();
      if (state.game?.state === "menu" || state.game?.state === "gameover" || !state.game) {
        startGame();
      } else if (state.game.state === "paused") {
        resumeFromPause();
      } else {
        state.game.pause();
        showPauseOverlay();
      }
    }
    if (e.key === "Escape") {
      if (state.game?.state === "playing") {
        state.game.pause();
        showPauseOverlay();
      }
    }
  });
  document.addEventListener("keyup", (e) => {
    if (keymap[e.key]) state.game?.setInput(keymap[e.key], false);
  });
}

// ───── Toxunma — bağlama (multi-touch, gecikməsiz) ─────
//
// Çubuqlar üfüqi (alt-üst), barmağın X mövqeyinə görə hərəkət edir.
//  • PvC rejimi: istənilən nöqtəyə toxun → bottom çubuq (sən)
//  • PvP rejimi: ekranın aşağı yarısı → bottom, yuxarı yarısı → top
function bindTouch() {
  const activeTouches = new Map(); // identifier → "left" | "right"

  const sideForY = (clientY) => {
    if (state.settings.mode === "pvp") {
      const rect = dom.canvas.getBoundingClientRect();
      // Aşağı yarı = bottom çubuq ("left"), yuxarı yarı = top çubuq ("right")
      return clientY > rect.top + rect.height / 2 ? "left" : "right";
    }
    return "left";
  };

  const updatePaddle = (side, clientX) => {
    const rect = dom.canvas.getBoundingClientRect();
    const cssX = clientX - rect.left;
    state.game?.setTouchX(side, cssX);
  };

  const onTouchStart = (e) => {
    if (e.target.closest("button, .overlay__inner, dialog, .credit, .topbar")) return;
    e.preventDefault();
    resumeAudio();
    if (!state.game || state.game.state === "menu" || state.game.state === "gameover") {
      startGame();
    }
    for (const t of e.changedTouches) {
      const side = sideForY(t.clientY);
      activeTouches.set(t.identifier, side);
      updatePaddle(side, t.clientX);
    }
  };

  const onTouchMove = (e) => {
    if (activeTouches.size === 0) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const side = activeTouches.get(t.identifier);
      if (side) updatePaddle(side, t.clientX);
    }
  };

  const onTouchEnd = (e) => {
    for (const t of e.changedTouches) {
      const side = activeTouches.get(t.identifier);
      if (side) {
        activeTouches.delete(t.identifier);
        const stillActive = [...activeTouches.values()].includes(side);
        if (!stillActive) state.game?.clearTouch(side);
      }
    }
  };

  document.body.addEventListener("touchstart", onTouchStart, { passive: false });
  document.body.addEventListener("touchmove", onTouchMove, { passive: false });
  document.body.addEventListener("touchend", onTouchEnd, { passive: false });
  document.body.addEventListener("touchcancel", onTouchEnd, { passive: false });

  // Mouse drag — masaüstü
  let mouseDown = false;
  let mouseSide = null;
  document.body.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button, .overlay__inner, dialog, .credit, .topbar, input, select, label")) return;
    mouseDown = true;
    mouseSide = sideForY(e.clientY);
    updatePaddle(mouseSide, e.clientX);
  });
  window.addEventListener("mousemove", (e) => {
    if (mouseDown && mouseSide) updatePaddle(mouseSide, e.clientX);
  });
  window.addEventListener("mouseup", () => {
    if (mouseDown && mouseSide) state.game?.clearTouch(mouseSide);
    mouseDown = false;
    mouseSide = null;
  });
}

// ───── Tənzimləmələr modal ─────
function fillForm() {
  const form = dom.modal.querySelector("form");
  form.elements.mode.value = state.settings.mode;
  form.elements.difficulty.value = state.settings.difficulty;
  form.elements.winScore.value = String(state.settings.winScore);
  if (form.elements.paddleLen)   form.elements.paddleLen.value   = String(state.settings.paddleLen);
  if (form.elements.ballSpeed)   form.elements.ballSpeed.value   = String(state.settings.ballSpeed);
  if (form.elements.paddleSpeed) form.elements.paddleSpeed.value = String(state.settings.paddleSpeed);
  if (form.elements.sensitivity) form.elements.sensitivity.value = String(state.settings.sensitivity);
  form.elements.sound.checked = state.settings.sound;
  form.elements.particles.checked = state.settings.particles;
  form.elements.shake.checked = state.settings.shake;
  form.elements.trail.checked = state.settings.trail;
}

function readForm() {
  const form = dom.modal.querySelector("form");
  state.settings = {
    mode: form.elements.mode.value,
    difficulty: form.elements.difficulty.value,
    winScore: Number(form.elements.winScore.value),
    paddleLen:   form.elements.paddleLen   ? Number(form.elements.paddleLen.value)   : DEFAULT_SETTINGS.paddleLen,
    ballSpeed:   form.elements.ballSpeed   ? Number(form.elements.ballSpeed.value)   : DEFAULT_SETTINGS.ballSpeed,
    paddleSpeed: form.elements.paddleSpeed ? Number(form.elements.paddleSpeed.value) : DEFAULT_SETTINGS.paddleSpeed,
    sensitivity: form.elements.sensitivity ? Number(form.elements.sensitivity.value) : DEFAULT_SETTINGS.sensitivity,
    sound: form.elements.sound.checked,
    particles: form.elements.particles.checked,
    shake: form.elements.shake.checked,
    trail: form.elements.trail.checked,
  };
  saveSettings(state.settings);
  setSoundEnabled(state.settings.sound);
  if (state.game) {
    Object.entries(state.settings).forEach(([k, v]) => state.game.setOption(k, v));
  }
  updateSoundIcon();
}

function bindSettings() {
  fillForm();
  const open = () => { playClick(); fillForm(); dom.modal.showModal(); };
  dom.btnSettings.addEventListener("click", open);
  dom.btnOpenSet.addEventListener("click", open);

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.preventDefault(); dom.modal.close(); });
  });

  // Form daxilində istənilən dəyişiklik dərhal oyuna tətbiq olunur (live preview).
  const form = dom.modal.querySelector("form");
  form.addEventListener("change", () => readForm());
  form.addEventListener("input", () => readForm());

  // Modal bağlananda — əgər oyun pauza idisə, pause overlay-ini bərpa et.
  dom.modal.addEventListener("close", () => {
    if (state.game?.state === "paused") showPauseOverlay();
  });

  form.addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "confirm") {
      e.preventDefault();
      readForm();
      dom.modal.close();
      // Əgər oyun pauza idisə davam etdir, əks halda yeni oyun başlat.
      if (state.game?.state === "paused") {
        resumeFromPause();
      } else {
        startGame();
      }
    }
  });
  form.querySelector("[type=reset]").addEventListener("click", (e) => {
    e.preventDefault();
    state.settings = { ...DEFAULT_SETTINGS };
    saveSettings(state.settings);
    fillForm();
    setSoundEnabled(state.settings.sound);
    updateSoundIcon();
    showToast("Standart dəyərlər tətbiq olundu");
  });
}

function updateSoundIcon() {
  // Səs aktivdirsə hörümçək, deyilsə "muted"
  dom.btnSound.innerHTML = state.settings.sound
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>';
}

// ───── İlkin bağlama ─────
function init() {
  setSoundEnabled(state.settings.sound);
  updateSoundIcon();

  bindKeyboard();
  bindTouch();
  bindSettings();

  dom.btnStart.addEventListener("click", () => {
    playClick();
    // Pauza vəziyyətindədirsə → davam et, əks halda yenidən başla
    if (state.game?.state === "paused") {
      resumeFromPause();
    } else {
      startGame();
    }
  });
  dom.btnPause.addEventListener("click", () => {
    playClick();
    if (!state.game || state.game.state === "menu" || state.game.state === "gameover") {
      startGame();
      return;
    }
    if (state.game.state === "paused") {
      resumeFromPause();
    } else {
      state.game.pause();
      showPauseOverlay();
    }
  });
  dom.btnSound.addEventListener("click", () => {
    state.settings.sound = !state.settings.sound;
    setSoundEnabled(state.settings.sound);
    saveSettings(state.settings);
    updateSoundIcon();
    showToast(state.settings.sound ? "Səs aktivdir" : "Səs söndürüldü");
  });

  // Demo URL parametrləri (screenshot üçün)
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "settings") {
    setTimeout(() => dom.modal.showModal(), 250);
  } else if (params.get("demo") === "play") {
    setTimeout(() => startGame(), 250);
  } else if (params.get("demo") === "win") {
    setTimeout(() => {
      startGame();
      // Skoru saxta şəkildə doldururuq
      setTimeout(() => {
        state.game.scoreLeft = state.settings.winScore;
        state.game._scored("left");
      }, 500);
    }, 300);
  }
}

init();
