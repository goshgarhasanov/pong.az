// ════════════════════════════════════════════════════════════
//  Pong oyununun bütün məntiqi və canvas render-i
//  - Tam responsive: canvas-ın ölçüsünə uyğun proporsional rendering
//  - Heç bir letterbox yoxdur — bütün ekran istifadə olunur
//  - Top, raketlər, AI, qığılcımlar, ekran sarsıntısı
// ════════════════════════════════════════════════════════════

import { playPaddle, playWall, playScore, playWin } from "./sound.js";

// ───── Proporsional sabitlər ─────
// Canvas hündürlüyünə görə nisbətlər; faktiki piksel ölçüləri _resize-də hesablanır.
// Çubuqlar üfüqi (alt-üst), top şaquli yönlü hərəkət edir.
const PADDLE_W_RATIO      = 0.24;    // çubuğun uzunluğu (canvas_width × bu)
const PADDLE_H_RATIO      = 0.022;
const PADDLE_MARGIN_RATIO = 0.012;   // çubuqlar kənarın lap dibinə yapışır
const BALL_SIZE_RATIO     = 0.024;
const PADDLE_SPEED_RATIO  = 1.2;
const BALL_INIT_SPEED     = 0.45;
// Sürətin üst həddi YOXDUR — top sonsuza qədər artır, amma artım çox yavaşlayır.
// Diminishing returns: hər zərbədə inc = max(MIN, BASE - speedRatio × DAMPING)
const BALL_INC_BASE       = 1.050;   // başlanğıcda hər zərbə +5% (rahat hiss olunur)
const BALL_INC_MIN        = 1.015;   // yüksək sürətdə də hər zərbə +1.5% (heç vaxt sönmür)
const BALL_INC_DAMPING    = 0.015;   // sürətə görə zəifləmə
const SHAKE_DECAY = 0.86;

// ───── Yardımçı ─────
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function rand(min, max) { return Math.random() * (max - min) + min; }

// ───── Paddle (raket) — üfüqi çubuq, x boyunca hərəkət edir ─────
class Paddle {
  constructor(side, game) {
    // "left" → bottom çubuq (oyunçu); "right" → top çubuq (AI / 2-ci)
    this.side = side;
    this.game = game;
    this.vx = 0;
    this.color = side === "left" ? "#00FFFF" : "#FF00AA";
    this.resize();
  }

  resize() {
    const W = this.game.W, H = this.game.H;
    const lenRatio = this._lenOverride ?? PADDLE_W_RATIO;
    this.w = Math.max(60, W * lenRatio);
    this.h = Math.max(8, H * PADDLE_H_RATIO);
    const margin = Math.max(12, H * PADDLE_MARGIN_RATIO);
    this.y = this.side === "left" ? H - margin - this.h : margin;
    if (this.x === undefined) this.x = (W - this.w) / 2;
    this.x = clamp(this.x, 0, W - this.w);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.x = clamp(this.x, 0, this.game.W - this.w);
  }

  /** Toxunma → 1:1 izləmə. */
  snapTo(targetX) {
    const target = clamp(targetX - this.w / 2, 0, this.game.W - this.w);
    this.x = target;
    this.vx = 0;
  }

  setVelocity(direction) {
    // Klaviatura sürəti — game.options.paddleSpeed üzərindən idarə olunur.
    const speedRatio = this.game.options.paddleSpeed ?? PADDLE_SPEED_RATIO;
    this.vx = direction * speedRatio * this.game.W;
  }

  reset() {
    this.x = (this.game.W - this.w) / 2;
    this.vx = 0;
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
    roundRect(ctx, this.x + 2, this.y + 2, Math.min(20, this.w - 4), this.h - 4, 4);
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
    const initRatio = this._initOverride ?? BALL_INIT_SPEED;
    this.speed = initRatio * H;
    const angle = rand(-Math.PI / 5, Math.PI / 5);
    this.vy = direction * Math.cos(angle) * this.speed;
    this.vx = Math.sin(angle) * this.speed;
    this.trail = [];
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.trail.push({ x: this.x, y: this.y, life: 1 });
    if (this.trail.length > 18) this.trail.shift();
    for (const p of this.trail) p.life -= dt * 4;
  }

  /** Sol/sağ divara dəymə (yan divarlar). */
  bounceX() {
    this.vx = -this.vx;
    if (this.x < 0) this.x = 0;
    if (this.x + this.size > this.game.W) this.x = this.game.W - this.size;
  }

  /** Üfüqi çubuğa dəymə — bucağı çubuğun mərkəzinə nisbətən hesablanır. */
  bouncePaddle(paddle) {
    const ballCenter = this.x + this.size / 2;
    const paddleCenter = paddle.x + paddle.w / 2;
    const offset = (ballCenter - paddleCenter) / (paddle.w / 2); // [-1, 1]
    const bounceAngle = offset * (Math.PI / 3.4);

    // Diminishing returns — sürət artdıqca artım çox az olur, amma heç vaxt 0-a düşmür.
    const speedRatio = this.speed / this.game.H;
    const inc = Math.max(BALL_INC_MIN, BALL_INC_BASE - speedRatio * BALL_INC_DAMPING);
    this.speed = this.speed * inc;
    // "left" = bottom çubuq → top yuxarı qayıdır (vy mənfi)
    // "right" = top çubuq → top aşağı qayıdır (vy müsbət)
    const direction = paddle.side === "left" ? -1 : 1;
    this.vy = direction * Math.cos(bounceAngle) * this.speed;
    this.vx = Math.sin(bounceAngle) * this.speed;

    // Topu çubuqdan kənara çıxar (yapışmasın)
    if (paddle.side === "left") this.y = paddle.y - this.size - 1;       // bottom
    else this.y = paddle.y + paddle.h + 1;                                // top
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
    const cfg = {
      easy:        { reactSpeed: 0.06, jitterAmp: 80,  predict: false, errChance: 0.20 },
      medium:      { reactSpeed: 0.12, jitterAmp: 35,  predict: false, errChance: 0.06 },
      hard:        { reactSpeed: 0.22, jitterAmp: 12,  predict: true,  errChance: 0.02 },
      impossible:  { reactSpeed: 0.42, jitterAmp: 0,   predict: true,  errChance: 0.0  },
    }[this.difficulty] || {};

    this._jitterTimer -= dt;
    if (this._jitterTimer <= 0) {
      this._jitter = rand(-cfg.jitterAmp, cfg.jitterAmp);
      this._jitterTimer = rand(0.4, 1.2);
    }

    // AI top çubuq — hədəf X mövqeyi (top yuxarı doğru gəlirsə proqnoz)
    let targetX;
    if (cfg.predict && this.ball.vy < 0) {
      targetX = this._predictBallX();
    } else {
      targetX = this.ball.x + this.ball.size / 2;
    }
    targetX += this._jitter;

    if (Math.random() < cfg.errChance) {
      targetX = this.paddle.x + this.paddle.w / 2;
    }

    const W = this.paddle.game.W;
    const target = clamp(targetX - this.paddle.w / 2, 0, W - this.paddle.w);
    this.paddle.x += (target - this.paddle.x) * cfg.reactSpeed;
  }

  /** Topun haradan keçəcəyini divar əks-sədası ilə proqnozlaşdırır (X). */
  _predictBallX() {
    const W = this.paddle.game.W;
    let x = this.ball.x;
    let y = this.ball.y;
    let vx = this.ball.vx;
    let vy = this.ball.vy;
    const targetY = this.paddle.y + this.paddle.h;  // top çubuğun aşağı kənarı
    let safety = 200;
    // Top yuxarı uçur (vy < 0); paddle.y-yə çatana qədər
    while (vy < 0 && y > targetY && safety-- > 0) {
      const stepY = Math.max(-8, targetY - y);
      const t = stepY / vy;
      x += vx * t;
      y += vy * t;
      if (x < 0) { x = -x; vx = -vx; }
      if (x + this.ball.size > W) { x = (W - this.ball.size) - (x + this.ball.size - W); vx = -vx; }
    }
    return x + this.ball.size / 2;
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
    this.touchX = { left: null, right: null };  // X mövqe (üfüqi çubuq)
    this._touchAnchor = null;                    // hassasiyet>1 üçün relative anchor

    this._onScore = options.onScore || (() => {});
    this._onGameOver = options.onGameOver || (() => {});

    this._loop = this._loop.bind(this);
    window.addEventListener("resize", () => this._resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this._resize(), 100));
  }

  setOption(key, value) {
    this.options[key] = value;
    if (key === "difficulty") this.ai.setDifficulty(value);
    if (key === "paddleLen") {
      // Paddle-ı dərhal yenidən ölçülə (oyun ortasında)
      if (this.left)  { this.left._lenOverride = value; this.left.resize(); }
      if (this.right) { this.right._lenOverride = value; this.right.resize(); }
    }
    if (key === "ballSpeed" && this.ball) {
      this.ball._initOverride = value;
    }
    // paddleSpeed və sensitivity oyun döngüsündə birbaşa istifadə olunur
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

  // ───── Toxunma giriş — barmağın X mövqeyinə görə çubuq hərəkəti ─────
  // Hassasiyet (1.0 = barmaq mövqesi = çubuq, >1 = çubuq daha çevik) — relative drag.
  setTouchX(side, cssX) {
    const sens = this.options.sensitivity ?? 1.0;
    if (Math.abs(sens - 1.0) < 0.01) {
      // 1:1 — birbaşa snap (klassik)
      this.touchX[side] = clamp(cssX, 0, this.W);
      this._touchAnchor = null;
      return;
    }
    // >1 və ya <1 hassasiyet — relative drag rejimi
    if (!this._touchAnchor) this._touchAnchor = {};
    if (this._touchAnchor[side] === undefined || this.touchX[side] === null) {
      const paddle = side === "left" ? this.left : this.right;
      this._touchAnchor[side] = { fingerX: cssX, paddleX: paddle.x + paddle.w / 2 };
      this.touchX[side] = paddle.x + paddle.w / 2;
    }
    const anchor = this._touchAnchor[side];
    const delta = (cssX - anchor.fingerX) * sens;
    this.touchX[side] = clamp(anchor.paddleX + delta, 0, this.W);
  }
  // Geriyə uyğunluq üçün — köhnə main.js setTouchY çağırır; X kimi qəbul edirik
  setTouchY(side, cssX) { this.setTouchX(side, cssX); }

  clearTouch(side) {
    this.touchX[side] = null;
    if (this._touchAnchor) delete this._touchAnchor[side];
  }

  setInput(key, isDown) {
    this.input[key] = isDown;
  }

  _updatePaddles(dt) {
    // Bottom çubuq (left = oyunçu, ən aşağıda)
    if (this.touchX.left !== null) {
      this.left.snapTo(this.touchX.left);
    } else {
      let dir = 0;
      // input.up/down klaviatura mapping-i — sol/sağ kimi şərh olunur
      if (this.input.leftUp) dir -= 1;
      if (this.input.leftDown) dir += 1;
      if (this.options.mode !== "pvp") {
        if (this.input.up) dir -= 1;
        if (this.input.down) dir += 1;
      }
      this.left.setVelocity(dir);
      this.left.update(dt);
    }

    // Top çubuq (right = AI və ya 2-ci insan, ən yuxarıda)
    if (this.options.mode === "pvp") {
      if (this.touchX.right !== null) {
        this.right.snapTo(this.touchX.right);
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

    // Sol/sağ divar (yan divarlar)
    if (this.ball.x <= 0 || this.ball.x + this.ball.size >= W) {
      this.ball.bounceX();
      playWall();
      this._spark(this.ball.x < W / 2 ? 0 : W, this.ball.y + this.ball.size / 2, "#FFFFFF", 8);
      this.shake = Math.max(this.shake, 4);
    }

    // Üfüqi çubuq toqquşması
    const speedRel = this.ball.speed / this.H * 10;
    if (this._collidePaddle(this.left)) {           // bottom çubuq
      this.ball.bouncePaddle(this.left);
      playPaddle(speedRel);
      if (this.options.particles) this._spark(this.ball.x + this.ball.size / 2, this.ball.y, this.left.color, 24);
      if (this.options.shake) this.shake = Math.max(this.shake, 12);
      this.flash = 0.35;
    } else if (this._collidePaddle(this.right)) {   // top çubuq
      this.ball.bouncePaddle(this.right);
      playPaddle(speedRel);
      if (this.options.particles) this._spark(this.ball.x + this.ball.size / 2, this.ball.y + this.ball.size, this.right.color, 24);
      if (this.options.shake) this.shake = Math.max(this.shake, 12);
      this.flash = 0.35;
    }

    // Qol — top alt/üst kənardan keçirsə
    if (this.ball.y + this.ball.size < 0) {
      // Top yuxarıdan çıxıb → bottom (left) qol vurdu
      this._scored("left");
    } else if (this.ball.y > H) {
      // Top aşağıdan çıxıb → top (right) qol vurdu
      this._scored("right");
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

    // Mərkəzi üfüqi nöqtəli xətt (canvas hündürlüyünün ortasında)
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    const dotSize = Math.max(4, W * 0.008);
    const gap = Math.max(14, W * 0.03);
    for (let x = 10; x < W - 10; x += gap) {
      ctx.fillRect(x, H / 2 - dotSize / 2, dotSize * 0.6, dotSize);
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
