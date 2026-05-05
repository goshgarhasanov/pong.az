<div align="center">

# 🕹️ Pong.az

### Klassik Pong oyununun **neon dark** versiyası — qığılcımlar, ekran sarsıntısı və alpha-beta proqnozlu AI rəqibi ilə

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)]()
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)]()
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)]()
[![Lisenziya: MIT](https://img.shields.io/badge/lisenziya-MIT-A8A8C0)](LICENSE)
[![No build](https://img.shields.io/badge/build-yox%20%E2%80%94%20saf%20vanilla-84CC16)]()

### 🎮 [Canlı demo: goshgarhasanov.github.io/pong.az](https://goshgarhasanov.github.io/pong.az/)

</div>

---

## ✨ Niyə Pong.az?

- 🇦🇿 **Tam Azərbaycan dilində** interfeys — tərcümə deyil, doğmadır.
- ⚡ **Saf vanilla** — heç bir framework, heç bir build sistemi, heç bir asılılıq.
- 🎯 **Alpha-beta proqnozlu AI** — top hələ uçarkən AI hara düşəcəyini hesablayır.
- ✨ **Qığılcım hissəcikləri** — top raketə dəydikdə neon partlayış.
- 🌀 **Ekran sarsıntısı** — hər güclü zərbədə yumşaq screen-shake.
- 🌈 **Top izi** — topun arxasında parlaq kuyruk effekti.
- 🔊 **Web Audio səslər** — heç bir audio fayl yox; hər səs kodda generasiya olunur.
- 📺 **CRT scanline** + **vignette** — retro arcade atmosferi.
- 📱 **Tam responsiv** — masaüstündə klaviatura, mobildə toxunmaq və sürükləmək.
- 💾 **localStorage** — tənzimləmələr saxlanılır.

---

## 🎮 İdarəetmə

### Masaüstü (klaviatura)

| Düymə | Hərəkət |
|---|---|
| `W` / `S` və ya `↑` / `↓` | Raketi yuxarı / aşağı hərəkət etdir |
| `Space` | Oyunu başlat və ya dayandır |
| `P` | Dayandır |
| `Esc` | Menyuya qayıt |

### Mobil (toxunma)

- **Sol yarısı** ekranın → sol raket
- **Sağ yarısı** ekranın → sağ raket (yalnız 2 nəfər rejimində)
- Barmağı yuxarı-aşağı sürüklə, raket təqib edəcək

---

## 🚀 İşə salmaq

### Birbaşa brauzerdə (canlı demo)

👉 **https://goshgarhasanov.github.io/pong.az/**

### Lokal olaraq

ES modul-larını işlətmək üçün local HTTP server lazımdır (file:// işləməz):

```bash
git clone https://github.com/goshgarhasanov/pong.az.git
cd pong.az
python -m http.server 8000
# Brauzerdə: http://localhost:8000/
```

---

## 🤖 AI çətinlikləri

| Səviyyə | Davranış |
|---|---|
| **Asan** | Topu sadəcə izləyir, çox jitter, 20% səhv etmə şansı |
| **Orta** | Yumşaq izləmə, 6% səhv, mərkəzdən kənarlaşır |
| **Çətin** | **Topun trayektoriyasını proqnozlaşdırır**, divar əks-sədasını da hesablayır |
| **Mümkünsüz** | Tam proqnoz, sürətli reaksiya, demək olar ki, qaçılmaz |

### AI texniki detalları

- Çətinlikdən asılı olaraq fərqli **reaksiya sürəti** (lerp faktoru)
- Random **jitter** — AI insan kimi kiçik səhvlər edir
- "Hard" və "Impossible" rejimlərində **trajectory prediction** — top divara dəyə-dəyə hesablanır
- Çətinlik səviyyəsinə görə **rastgələ səhv etmə şansı**

---

## 📁 Layihə strukturu

```
pong.az/
├── index.html              ← UI markup
├── manifest.webmanifest    ← PWA manifesti
├── styles/
│   └── style.css           ← Tək CSS faylı (722 sətir)
├── scripts/
│   ├── main.js             ← Tətbiq giriş nöqtəsi, UI bağlamaları
│   ├── game.js             ← Oyun engine: Canvas render, fizika, AI
│   └── sound.js            ← Web Audio səslər
├── assets/
│   └── icons/favicon.svg
└── README.md
```

---

## 🎨 Dizayn

| Element | Dəyər |
|---|---|
| Sol raket (X) | Neon Cyan `#00FFFF` |
| Sağ raket (O) | Neon Pink `#FF00AA` |
| Top | Pure White `#FFFFFF` |
| Arxa fon | True Black `#000000` |
| Display şrifti | **Orbitron** (game-feel) |
| UI şrifti | Inter |
| Skor şrifti | JetBrains Mono |

### Vizual effektlər

- **CRT scanline** overlay (8% opacity, mix-blend-mode: overlay)
- **Vignette** — kənarlarda yumşaq qaranlıqlaşma
- **Glow** — bütün neon elementlərdə box-shadow ilə işıqlandırma
- **Bar pulse** — brand bar-larında 2.4s ease-in-out ürək döyüntüsü

---

## ⚙ Tənzimləmələr

Hamısı `localStorage`-də saxlanılır:

- **Rejim**: SƏN vs AI / İKİ NƏFƏR
- **AI çətinliyi**: Asan / Orta / Çətin / Mümkünsüz
- **Qələbə üçün xal**: 5 / 7 / 11 / 21
- **Effektlər**: Səs / Qığılcımlar / Sarsıntı / Top izi (hər biri ayrı toggle)

---

## 🛠 Texniki xüsusiyyətlər

- **Saf vanilla JS** — ES modulları (`import` / `export`)
- **HTML5 Canvas 2D** — dəqiq render, dynamic letterbox
- **Logical resolution 1280×720** — istənilən ekran ölçüsünə uyğunlaşır
- **DPR-aware** rendering — Retina ekranlarda iti
- **`requestAnimationFrame`** ilə smooth 60 FPS oyun döngüsü
- **Web Audio API** ilə sintez olunmuş səslər (oscillator, sweep, ADSR)
- **Touch + Mouse + Keyboard** — universal giriş
- **`<dialog>`** native modal
- **CSS `:has()`** — yeni-nəsil custom radio/checkbox stilizasiyası

---

## 🌟 Xüsusi vurğu

- Hər topun raketə dəyməsində **bucağı raketin mərkəzinə nisbətən** hesablanır (klassik Pong qaydası)
- Top sürəti hər zərbə ilə **6% artır** (1300 px/s-də cap olunur)
- AI proqnozu divar əks-sədalarını da hesab edir — top zigzag etsə də AI bilir hara düşəcək

---

## 📜 Lisenziya

[MIT](LICENSE) © 2026 Goshgar Hasanzadeh

---

<div align="center">

**Developed by** [**Goshgar Hasanzadeh**](https://github.com/goshgarhasanov)

</div>
