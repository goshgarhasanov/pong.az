// ════════════════════════════════════════════════════════════
//  Pong oyununun bütün məntiqi və canvas render-i
//  - Tam responsive: canvas-ın ölçüsünə uyğun proporsional rendering
//  - Heç bir letterbox yoxdur — bütün ekran istifadə olunur
//  - Top, raketlər, AI, qığılcımlar, ekran sarsıntısı
// ════════════════════════════════════════════════════════════

import { playPaddle, playWall, playScore, playWin } from "./sound.js";

// ───── Proporsional sabitlər ─────
// Canvas hündürlüyünə görə nisbətlər; faktiki piksel ölçüləri _resize-də hesablanır.
const PADDLE_W_RATIO     = 0.018;   // canvas_width × bu
const PADDLE_H_RATIO     = 0.18;    // canvas_height × bu
const PADDLE_MARGIN_RATIO= 0.025;
const BALL_SIZE_RATIO    = 0.024;   // canvas_height × bu
const PADDLE_SPEED_RATIO = 1.0;     // canvas_height/saniyə
const BALL_INIT_SPEED    = 0.65;    // canvas_height/saniyə
const BALL_MAX_SPEED     = 1.85;    // canvas_height/saniyə
const BALL_SPEED_INC = 1.06;
const SHAKE_DECAY = 0.86;

// ───── Yardımçı ─────
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function rand(min, max) { return Math.random() * (max - min) + min; }

// ───── Paddle (raket) ─────
class Paddle {
  constructor(side, game) {
    this.side = side; // "left" | "right"
    this.game = game;
    this.vy = 0;
    this.color = side === "left" ? "#00FFFF" : "#FF00AA";
    this.resize();
  }

  /** Canvas ölçüsü dəyişdikdə proporsional yenilənir. */
  resize() {
    const W = this.game.W, H = this.game.H;
    this.w = Math.max(8, W * PADDLE_W_RATIO);
    this.h = Math.max(60, H * PADDLE_H_RATIO);
    const margin = Math.max(12, W * PADDLE_MARGIN_RATIO);
    this.x = this.side === "left" ? margin : W - margin - this.w;
    if (this.y === undefined) this.y = (H - this.h) / 2;
    this.y = clamp(this.y, 0, H - this.h);
  }

  update(dt) {
    this.y += this.vy * dt;
    this.y = clamp(this.y, 0, this.game.H - this.h);
  }

  /** Hədəfə doğru yumşaq hərəkət. */
  moveTo(targetY, dt, smooth = 0.18) {
    const target = clamp(targetY - this.h / 2, 0, this.game.H - this.h);
    this.y += (target - this.y) * smooth;
  }

  /** Birbaşa hədəf Y-yə yerləşdirir — toxunmaq üçün 1:1 izləmə. */
  snapTo(targetY) {
    const target = clamp(targetY - this.h / 2, 0, this.game.H - this.h);
    this.y = target;
    this.vy = 0;
  }

  setVelocity(direction) {
    this.vy = direction * PADDLE_SPEED_RATIO * this.game.H;
  }

  reset() {
    this.y = (this.game.H - this.h) / 2;
    this.vy = 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = this.color;
    roundRect(ctx, this.x, this.y, this.w, this.h, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    roundRect(ctx, this.x + 2, this.y + 2, this.w - 4, Math.min(20, this.h - 4), 4);
    ctx.fill();
    ctx.restore();
  }
}

// ───── Top ─────
class Ball {
  constructor(game) {
    this.game = game;
    this.trail = [];
    this.resize();
    this.reset();
  }

  resize() {
    this.size = Math.max(8, this.game.H * BALL_SIZE_RATIO);
  }

  reset(direction = Math.random() < 0.5 ? -1 : 1) {
    const W = this.game.W, H = this.game.H;
    this.x = W / 2 - this.size / 2;
    this.y = H / 2 - this.size / 2;
    this.speed = BALL_INIT_SPEED * H;
    const angle = rand(-Math.PI / 5, Math.PI / 5);
    this.vx = direction * Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.trail = [];
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.trail.push({ x: this.x, y: this.y, life: 1 });
    if (this.trail.length > 18) this.trail.shift();
    for (const p of this.trail) p.life -= dt * 4;
  }

  bounceY() {
    this.vy = -this.vy;
    if (this.y < 0) this.y = 0;
    if (this.y + this.size > this.game.H) this.y = this.game.H - this.size;
  }

  bouncePaddle(paddle) {
    const ballCenter = this.y + this.size / 2;
    const paddleCenter = paddle.y + paddle.h / 2;
    const offset = (ballCenter - paddleCenter) / (paddle.h / 2);
    const bounceAngle = offset * (Math.PI / 3.4);

    const maxSpeed = BALL_MAX_SPEED * this.game.H;
    this.speed = Math.min(maxSpeed, this.speed * BALL_SPEED_INC);
    const direction = paddle.side === "left" ? 1 : -1;
    this.vx = direction * Math.cos(bounceAngle) * this.speed;
    this.vy = Math.sin(bounceAngle) * this.speed;

    if (paddle.side === "left") this.x = paddle.x + paddle.w + 1;
    else this.x = paddle.x - this.size - 1;
  }

  draw(ctx, withTrail = true) {
    if (withTrail) {
      for (const p of this.trail) {
        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.life * 0.4;
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(p.x + this.size / 2, p.y + this.size / 2, this.size / 2 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.shadowColor = "#FFFFFF";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ───── Qığılcım hissəcikləri ─────
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(120, 380);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1;
    this.size = rand(2, 5);
    this.color = color;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.vy += 80 * dt; // cazibə
    this.life -= dt * 1.6;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(this.life, 0, 1);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

// ───── AI ─────
class AI {
  constructor(paddle, ball, difficulty = "medium") {
    this.paddle = paddle;
    this.ball = ball;
    this.difficulty = difficulty;
    this._jitter = 0;
    this._jitterTimer = 0;
  }

  setDifficulty(d) { this.difficulty = d; }

  update(dt) {
    // Çətinliyə görə reaksiya gecikməsi və hədəf dəqiqliyi.
    const cfg = {
      easy:        { reactSpeed: 0.06, jitterAmp: 80,  predict: false, errChance: 0.20 },
      medium:      { reactSpeed: 0.12, jitterAmp: 35,  predict: false, errChance: 0.06 },
      hard:        { reactSpeed: 0.22, jitterAmp: 12,  predict: true,  errChance: 0.02 },
      impossible:  { reactSpeed: 0.42, jitterAmp: 0,   predict: true,  errChance: 0.0  },
    }[this.difficulty] || {};

    // Jitter — vaxtaşırı hədəfi azacıq dəyişdirir
    this._jitterTimer -= dt;
    if (this._jitterTimer <= 0) {
      this._jitter = rand(-cfg.jitterAmp, cfg.jitterAmp);
      this._jitterTimer = rand(0.4, 1.2);
    }

    // Hədəf Y — top və ya proqnoz nöqtəsi
    let targetY;
    if (cfg.predict && this.ball.vx > 0) {
      targetY = this._predictBallY();
    } else {
      targetY = this.ball.y + this.ball.size / 2;
    }
    targetY += this._jitter;

    // Səhv etmə şansı (lap ortada qalır)
    if (Math.random() < cfg.errChance) {
      targetY = this.paddle.y + this.paddle.h / 2;
    }

    const H = this.paddle.game.H;
    const target = clamp(targetY - this.paddle.h / 2, 0, H - this.paddle.h);
    this.paddle.y += (target - this.paddle.y) * cfg.reactSpeed;
  }

  /** Topun haradan keçəcəyini divar əks-sədası ilə proqnozlaşdırır. */
  _predictBallY() {
    const H = this.paddle.game.H;
    let x = this.ball.x;
    let y = this.ball.y;
    let vx = this.ball.vx;
    let vy = this.ball.vy;
    const targetX = this.paddle.x;
    let safety = 200;
    while (vx > 0 && x < targetX && safety-- > 0) {
      const stepX = Math.min(8, targetX - x);
      const t = stepX / vx;
      x += vx * t;
      y += vy * t;
      if (y < 0) { y = -y; vy = -vy; }
      if (y + this.ball.size > H) { y = (H - this.ball.size) - (y + this.ball.size - H); vy = -vy; }
    }
    return y + this.ball.size / 2;
  }
}

// ───── Yardımçı: yuvarlaq düzbucaq ─────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ───── Game ─────
export class Game {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = {
      mode: "pvc",
      difficulty: "medium",
      winScore: 7,
      sound: true,
      particles: true,
      shake: true,
      trail: true,
      ...options,
    };

    // Logical W/H — _resize-də canvas ölçüsünə bərabər təyin olunur
    this.W = 1280;
    this.H = 720;
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.dpr = 1;

    // Əvvəl canvas ölçüsünü oxuyub W/H təyin edirik
    this._resize(/* skipPaddleResize */ true);

    this.left = new Paddle("left", this);
    this.right = new Paddle("right", this);
    this.ball = new Ball(this);
    this.ai = new AI(this.right, this.ball, this.options.difficulty);

    this.scoreLeft = 0;
    this.scoreRight = 0;
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.state = "menu";
    this.scoredTimer = 0;
    this.winner = null;
    this.lastTs = 0;

    this.input = { up: false, down: false, leftUp: false, leftDown: false };
    this.touchY = { left: null, right: null };

    this._onScore = options.onScore || (() => {});
    this._onGameOver = options.onGameOver || (() => {});

    this._loop = this._loop.bind(this);
    window.addEventListener("resize", () => this._resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this._resize(), 100));
  }

  setOption(key, value) {
    this.options[key] = value;
    if (key === "difficulty") this.ai.setDifficulty(value);
  }

  start() {
    this.state = "playing";
    this.scoreLeft = 0;
    this.scoreRight = 0;
    this.particles = [];
    this.left.reset();
    this.right.reset();
    this.ball.reset();
    this.lastTs = performance.now();
    if (!this._running) {
      this._running = true;
      requestAnimationFrame(this._loop);
    }
  }

  pause() {
    if (this.state === "playing") this.state = "paused";
  }

  resume() {
    if (this.state === "paused") {
      this.state = "playing";
      this.lastTs = performance.now();
    }
  }

  togglePause() {
    if (this.state === "playing") this.pause();
    else if (this.state === "paused") this.resume();
  }

  // ───── Resize — letterbox-suz, canvas tam ekran istifadə edir ─────
  _resize(skipPaddleResize = false) {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));

    // Logical W/H = CSS pixel ölçüsü (1:1 mapping, heç bir letterbox yoxdur)
    this.W = Math.max(320, rect.width);
    this.H = Math.max(240, rect.height);

    // Paddle/ball ölçülərini yenidən hesabla
    if (!skipPaddleResize) {
      if (this.left) this.left.resize();
      if (this.right) this.right.resize();
      if (this.ball) this.ball.resize();
    }
  }

  // ───── Toxunma giriş — y koordinatını CSS-dən logical-a çevirmək ─────
  setTouchY(side, cssY) {
    // Logical = CSS-ə bərabərdir, ona görə birbaşa istifadə
    this.touchY[side] = clamp(cssY, 0, this.H);
  }

  clearTouch(side) { this.touchY[side] = null; }

  // ───── Klaviatura input ─────
  setInput(key, isDown) {
    this.input[key] = isDown;
  }

  // ───── Update ─────
  _updatePaddles(dt) {
    // Sol raket — həmişə insan
    if (this.touchY.left !== null) {
      // Toxunma → 1:1 izləmə (smoothing yox)
      this.left.snapTo(this.touchY.left);
    } else {
      let dir = 0;
      if (this.input.leftUp) dir -= 1;
      if (this.input.leftDown) dir += 1;
      // Eyni zamanda Up/Down ümumi-də sol raketi idarə edir (PvP olmadıqda)
      if (this.options.mode !== "pvp") {
        if (this.input.up) dir -= 1;
        if (this.input.down) dir += 1;
      }
      this.left.setVelocity(dir);
      this.left.update(dt);
    }

    // Sağ raket — AI və ya 2-ci insan
    if (this.options.mode === "pvp") {
      if (this.touchY.right !== null) {
        // Toxunma → 1:1 izləmə (smoothing yox)
        this.right.snapTo(this.touchY.right);
      } else {
        let dir = 0;
        if (this.input.up) dir -= 1;
        if (this.input.down) dir += 1;
        this.right.setVelocity(dir);
        this.right.update(dt);
      }
    } else {
      this.ai.update(dt);
    }
  }

  _updateBall(dt) {
    this.ball.update(dt);
    const H = this.H, W = this.W;

    // Üst/alt divar
    if (this.ball.y <= 0 || this.ball.y + this.ball.size >= H) {
      this.ball.bounceY();
      playWall();
      this._spark(this.ball.x + this.ball.size / 2, this.ball.y < H / 2 ? 0 : H, "#FFFFFF", 8);
      this.shake = Math.max(this.shake, 4);
    }

    // Raket toqquşması — sürət canvas hündürlüyünə nisbətdə hesablanır
    const speedRel = this.ball.speed / this.H * 10;
    if (this._collidePaddle(this.left)) {
      this.ball.bouncePaddle(this.left);
      playPaddle(speedRel);
      if (this.options.particles) this._spark(this.ball.x, this.ball.y + this.ball.size / 2, this.left.color, 24);
      if (this.options.shake) this.shake = Math.max(this.shake, 12);
      this.flash = 0.35;
    } else if (this._collidePaddle(this.right)) {
      this.ball.bouncePaddle(this.right);
      playPaddle(speedRel);
      if (this.options.particles) this._spark(this.ball.x + this.ball.size, this.ball.y + this.ball.size / 2, this.right.color, 24);
      if (this.options.shake) this.shake = Math.max(this.shake, 12);
      this.flash = 0.35;
    }

    // Qol
    if (this.ball.x + this.ball.size < 0) {
      this._scored("right");
    } else if (this.ball.x > W) {
      this._scored("left");
    }
  }

  _collidePaddle(paddle) {
    return (
      this.ball.x < paddle.x + paddle.w &&
      this.ball.x + this.ball.size > paddle.x &&
      this.ball.y < paddle.y + paddle.h &&
      this.ball.y + this.ball.size > paddle.y
    );
  }

  _scored(who) {
    if (who === "left") this.scoreLeft += 1;
    else this.scoreRight += 1;
    playScore();
    this._onScore(who, this.scoreLeft, this.scoreRight);

    if (this.options.shake) this.shake = 18;
    this.flash = 0.6;

    // Oyun bitdi?
    if (this.scoreLeft >= this.options.winScore) {
      this.winner = "left";
      this.state = "gameover";
      playWin();
      this._onGameOver("left");
      return;
    }
    if (this.scoreRight >= this.options.winScore) {
      this.winner = "right";
      this.state = "gameover";
      playWin();
      this._onGameOver("right");
      return;
    }

    // Növbəti raund üçün topu sıfırla
    this.state = "scored";
    this.scoredTimer = 0.9;
    this.ball.reset(who === "left" ? 1 : -1);
  }

  _spark(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  // ───── Render — letterbox-suz, full-screen ─────
  _draw() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    // Yalnız sarsıntı offset-i tətbiq edirik (letterbox yoxdur)
    ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    // Mərkəzi nöqtəli xətt (canvas hündürlüyünə nisbətdə)
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    const dotSize = Math.max(4, H * 0.008);
    const gap = Math.max(14, H * 0.03);
    for (let y = 10; y < H - 10; y += gap) {
      ctx.fillRect(W / 2 - dotSize / 2, y, dotSize, dotSize * 0.6);
    }

    // Mərkəzi dairə
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.15, 0, Math.PI * 2);
    ctx.stroke();

    // Top
    if (this.state !== "gameover") {
      this.ball.draw(ctx, this.options.trail);
    }

    // Raketlər
    this.left.draw(ctx);
    this.right.draw(ctx);

    // Qığılcımlar
    for (const p of this.particles) p.draw(ctx);

    // Flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();

    this.shake *= SHAKE_DECAY;
    if (this.shake < 0.2) this.shake = 0;
    this.flash *= 0.86;
  }

  // ───── Loop ─────
  _loop(ts) {
    if (!this._running) return;
    let dt = (ts - this.lastTs) / 1000;
    if (dt > 0.05) dt = 0.05; // tab dayandığına qarşı qoruma
    this.lastTs = ts;

    if (this.state === "playing") {
      this._updatePaddles(dt);
      this._updateBall(dt);
    } else if (this.state === "scored") {
      this._updatePaddles(dt);
      this.scoredTimer -= dt;
      if (this.scoredTimer <= 0) this.state = "playing";
    }

    // Hissəcikləri yenilə (həmişə)
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.life > 0);

    this._draw();
    requestAnimationFrame(this._loop);
  }
}
