// Tətbiqin giriş nöqtəsi — UI bağlama, settings, oyun yaradılması.

import { Game } from "./game.js";
import { setSoundEnabled, playClick, playWin, playLose, resumeAudio } from "./sound.js";

// ───── Tənzimləmələr ─────
const STORAGE_KEY = "pong.az/settings/v1";

const DEFAULT_SETTINGS = {
  mode: "pvc",
  difficulty: "medium",
  winScore: 7,
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
  const keymap = {
    "ArrowUp": "up", "ArrowDown": "down",
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
      } else {
        state.game.togglePause();
        showToast(state.game.state === "paused" ? "Dayandırıldı" : "Davam edir");
      }
    }
    if (e.key === "Escape") {
      if (state.game?.state === "playing") {
        state.game.pause();
        showOverlay();
      }
    }
  });
  document.addEventListener("keyup", (e) => {
    if (keymap[e.key]) state.game?.setInput(keymap[e.key], false);
  });
}

// ───── Toxunma — bağlama ─────
function bindTouch() {
  function attach(el, side) {
    let active = false;
    const onMove = (clientY) => {
      const rect = dom.canvas.getBoundingClientRect();
      const cssY = clientY - rect.top;
      state.game?.setTouchY(side, cssY);
    };
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      active = true;
      resumeAudio();
      if (state.game?.state === "menu" || state.game?.state === "gameover" || !state.game) startGame();
      onMove(e.touches[0].clientY);
    }, { passive: false });
    el.addEventListener("touchmove", (e) => {
      if (!active) return;
      e.preventDefault();
      onMove(e.touches[0].clientY);
    }, { passive: false });
    el.addEventListener("touchend", () => {
      active = false;
      state.game?.clearTouch(side);
    });

    // Mouse drag (PvP simulyasiyası üçün masaüstü)
    let mouseDown = false;
    el.addEventListener("mousedown", (e) => {
      mouseDown = true;
      onMove(e.clientY);
    });
    window.addEventListener("mousemove", (e) => {
      if (mouseDown) onMove(e.clientY);
    });
    window.addEventListener("mouseup", () => {
      mouseDown = false;
      state.game?.clearTouch(side);
    });
  }
  attach(dom.touchLeft, "left");
  attach(dom.touchRight, "right");
}

// ───── Tənzimləmələr modal ─────
function fillForm() {
  const form = dom.modal.querySelector("form");
  form.elements.mode.value = state.settings.mode;
  form.elements.difficulty.value = state.settings.difficulty;
  form.elements.winScore.value = String(state.settings.winScore);
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
  dom.btnSettings.addEventListener("click", () => { playClick(); fillForm(); dom.modal.showModal(); });
  dom.btnOpenSet.addEventListener("click", () => { playClick(); fillForm(); dom.modal.showModal(); });
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.preventDefault(); dom.modal.close(); });
  });
  dom.modal.querySelector("form").addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "confirm") {
      e.preventDefault();
      readForm();
      dom.modal.close();
      showToast("Tənzimləmələr saxlanıldı");
      startGame();
    }
  });
  dom.modal.querySelector("[type=reset]").addEventListener("click", (e) => {
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

  dom.btnStart.addEventListener("click", () => { playClick(); startGame(); });
  dom.btnPause.addEventListener("click", () => {
    playClick();
    if (!state.game || state.game.state === "menu" || state.game.state === "gameover") {
      startGame();
    } else {
      state.game.togglePause();
      if (state.game.state === "paused") showOverlay(); else hideOverlay();
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
