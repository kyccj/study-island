// island.js — 섬 화면: 타일 지도, 탭해서 걷기, 과일나무, 낚시, 곤충, 땅파기, 효과.
// 그림은 assets/a (Codex로 만든 오리지널 파스텔 픽셀아트), 바닥은 코드로 그린다. 게임 규칙 판정은 hooks로 app.js에 맡긴다.
(function (G) {
  'use strict';
  const T = 16, W = 24, H = 36;

  // ───────── 그림 불러오기 ─────────
  const IMG = {};
  const SPR = ['sprout', 'sapling', 'young', 'tree', 'blossom', 'forest', 'pine', 'palm', 'bush', 'mushroom', 'flower_pink', 'flower_yellow', 'flower_white', 'flower_lilac',
    'tuft', 'stone', 'shell', 'starfish', 'weeds', 'can', 'sign', 'fence', 'post', 'lily', 'dig', 'house', 'shop', 'museum', 'player'];
  const SRC = Object.fromEntries(SPR.map((n) => [n, 'a/' + n]));
  for (const k of ['cherry', 'orange', 'lemon', 'pear', 'banana', 'grapes']) SRC[k] = 'a/fruit_' + k;
  const ready = Promise.all(Object.entries(SRC).map(([k, f]) => new Promise((res) => {
    const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = `assets/${f}.png`; IMG[k] = im;
  })));
  // 그림 하나를 가운데 아래(cx, by) 기준으로 그린다. 그림 2화소 = 세계 1단위
  const spr = (n, cx, by, flip) => { const im = IMG[n]; if (!im || !im.width) return; const w = im.width / 2, h = im.height / 2;
    if (flip) { ctx.save(); ctx.translate(Math.round(cx * 2) / 2, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, by - h, w, h); ctx.restore(); }
    else ctx.drawImage(im, Math.round((cx - w / 2) * 2) / 2, Math.round((by - h) * 2) / 2, w, h); };

  // ───────── 섬 배치 (타일 좌표) ─────────
  const GRASS = { x0: 1, y0: 1, x1: 22, y1: 27 };
  const SAND = { x0: 1, y0: 24, x1: 22, y1: 33 };
  const POND = { x0: 15, y0: 3, x1: 20, y1: 8 };
  const HOUSE = { x: 2, y: 2, w: 4, h: 3, stand: [3, 5] };
  const SHOP = { x: 8, y: 2, w: 3, h: 3, stand: [9, 5] };
  const MUSEUM = { x: 11, y: 2, w: 3, h: 3, stand: [12, 5] };
  const PLOTS = [[4, 13], [8, 13], [12, 13], [4, 18], [8, 18], [12, 18]];
  const FOREST_R = { x0: 15, y0: 12, x1: 21, y1: 23 };
  const FOREST = [[17, 14], [20, 14], [16, 18], [19, 18], [21, 22], [17, 22]];
  const BEACH_Y = 28; // 이 줄부터 해변(★2)
  const FLOWERS = ['flower_pink', 'flower_yellow', 'flower_white', 'flower_lilac'];
  const BEACH_DECO = [[3, 30, 'shell'], [8, 32, 'starfish'], [14, 29, 'shell'], [19, 31, 'starfish'], [11, 33, 'shell']];
  const PALMS = [[1, 29], [22, 31], [1, 33]];

  // ───────── 바닥 (코드로 그리는 파스텔 픽셀 바닥, 1칸 = 32 화소) ─────────
  const D = 2; // 바닥·그림 화소 밀도: 세계 1단위에 2화소
  const PAL = {
    grass: [174, 211, 140], grassL: [190, 222, 152], grassD: [146, 192, 112], rim: [125, 172, 96], line: [104, 146, 84],
    sand: [253, 227, 189], sandD: [240, 207, 160], cliff: [239, 184, 149], cliffD: [214, 150, 118], cliffL: [248, 204, 172], out: [155, 112, 107],
    stone: [214, 205, 196], stoneD: [176, 164, 156], pond: [120, 209, 196], pondD: [96, 190, 180], pondL: [168, 230, 220],
  };
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t) => t * t * (3 - 2 * t);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
  }
  // 둥근 사각형까지의 거리(안쪽은 음수), 단위는 화소
  function sdRect(px, py, R, rad) {
    const x0 = R.x0 * T * D, y0 = R.y0 * T * D, x1 = (R.x1 + 1) * T * D, y1 = (R.y1 + 1) * T * D;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2 - rad, hy = (y1 - y0) / 2 - rad;
    const qx = Math.abs(px - cx) - hx, qy = Math.abs(py - cy) - hy;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
  }
  const CLIFF = 22; // 잔디섬 아래 절벽 높이(화소)
  let groundCv = null;
  function buildGround() {
    const gw = W * T * D, gh = H * T * D, c = document.createElement('canvas'); c.width = gw; c.height = gh;
    const g = c.getContext('2d'), img = g.createImageData(gw, gh), a = img.data;
    const put = (i, col) => { a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; a[i + 3] = 255; };
    const gBot = (GRASS.y1 + 1) * T * D;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = (y * gw + x) * 4, wob = (vnoise(x / 22, y / 22) - 0.5) * 7;
      const dg = sdRect(x, y, GRASS, 26) + wob, ds = sdRect(x, y, SAND, 30) + wob * 0.8, dp = sdRect(x, y, POND, 18) + (vnoise(x / 9 + 50, y / 9) - 0.5) * 4;
      // 절벽: 잔디섬 바로 아래 띠
      const dCliff = sdRect(x, y - CLIFF, GRASS, 26) + (vnoise(x / 22, (y - CLIFF) / 22) - 0.5) * 7;
      if (dg <= 0) {
        if (dp <= -7) { // 연못 물
          const sh = dp > -12 ? PAL.pondD : (hash(x >> 2, y >> 1) < 0.02 ? PAL.pondL : PAL.pond); put(i, sh);
        } else if (dp <= 0) { // 연못 돌 테두리
          const st = hash((x + 3) >> 3, (y + 1) >> 3); put(i, dp > -1.2 || dp < -6 ? PAL.out : st < 0.5 ? PAL.stone : PAL.stoneD);
        } else if (dg > -1.6) put(i, PAL.line);
        else if (dg > -4) put(i, PAL.rim);
        else {
          const n = vnoise(x / 40, y / 40), hh = hash(x >> 1, y >> 1);
          let col = n > 0.62 ? PAL.grassL : PAL.grass;
          // 풀잎 무늬: 작은 V
          const tx = x % 28, ty = y % 26, cell = hash(Math.floor(x / 28), Math.floor(y / 26));
          if (cell < 0.45) { const ox = 6 + Math.floor(cell * 30) % 14, oy = 8 + Math.floor(cell * 70) % 10, dx = tx - ox, dy = ty - oy; if (dy >= 0 && dy < 4 && (Math.abs(dx) === 3 - dy || (dx === 0 && dy >= 1))) col = PAL.grassD; }
          else if (hh < 0.006) col = PAL.grassD;
          put(i, col);
        }
      } else if (dCliff <= 0 && y >= gBot - 40) { // 절벽 면
        const v = vnoise(x / 6, 3); let col = PAL.cliff;
        if (dCliff > -1.6) col = PAL.out; else if (dCliff > -4) col = PAL.cliffD;
        else if ((x + Math.floor(v * 8)) % 18 < 2) col = PAL.cliffD; else if (y % 11 === 0 && hash(x >> 3, y) < 0.5) col = PAL.cliffL;
        put(i, col);
      } else if (ds <= 0) {
        put(i, ds > -1.6 ? PAL.sandD : hash(x, y) < 0.012 ? PAL.sandD : PAL.sand);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  // 바다: 매 프레임 물결 무늬
  function drawSea(x0, y0, x1, y1, time) {
    ctx.fillStyle = '#80d2c0'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let y = Math.floor(y0 / 12) * 12; y < y1; y += 12) for (let x = Math.floor(x0 / 24) * 24; x < x1; x += 24) {
      const h = hash(x / 24, y / 12); if (h > 0.45) continue;
      const ox = (h * 97) % 18 + Math.sin(time * 0.8 + h * 20) * 2;
      ctx.fillRect(x + ox, y + 4, 6, 1); ctx.fillRect(x + ox + 1.5, y + 3.5, 3, 0.5);
    }
  }
  // 모래사장 둘레 파도 거품
  function drawFoam(time) {
    const R = SAND, x0 = R.x0 * T, y0 = R.y0 * T, x1 = (R.x1 + 1) * T, y1 = (R.y1 + 1) * T, k = 1 + Math.sin(time * 1.4) * 0.8;
    ctx.strokeStyle = 'rgba(248,254,242,.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(x0 - 1 - k, y0 - 1 - k, x1 - x0 + 2 + 2 * k, y1 - y0 + 2 + 2 * k, 16 + k); ctx.stroke();
    ctx.strokeStyle = 'rgba(248,254,242,.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(x0 - 4 - k * 1.6, y0 - 4 - k * 1.6, x1 - x0 + 8 + 3.2 * k, y1 - y0 + 8 + 3.2 * k, 19 + k); ctx.stroke();
  }

  // ───────── 옷 입히기: 상의·하의는 물들이고, 모자는 머리 위에 얹는다 ─────────
  const HEAD = 16; // 모자 자리(그림 화소)
  let dressed = null, dressKey = '', headInfo = null;
  const hatImg = {};
  function redress() { dressKey = ''; }
  function rgb2h(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, d = (mx - mn) / 255; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; return [(h * 60 + 360) % 360, s, l]; }
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  function dressSheet(S) {
    const o = S.island.outfit || {}, k = JSON.stringify(o) + (o.hat && hatImg[o.hat] && hatImg[o.hat].width ? 1 : 0);
    if (dressed && k === dressKey) return dressed;
    const src = IMG.player; if (!src || !src.width) return null;
    const fw = src.width / 3, fh = src.height / 5, c = document.createElement('canvas'); c.width = src.width; c.height = (fh + HEAD) * 5;
    const g = c.getContext('2d');
    for (let r = 0; r < 5; r++) g.drawImage(src, 0, r * fh, src.width, fh, 0, r * (fh + HEAD) + HEAD, src.width, fh);
    const top = G.Core.TOPS.find((t) => t.id === o.top), bot = G.Core.BOTTOMS.find((t) => t.id === o.bottom);
    const im = g.getImageData(0, 0, c.width, c.height), a = im.data;
    if (!headInfo) { // 칸마다 머리 꼭대기와 가운데
      headInfo = [];
      for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) {
        let ty = -1, sx = 0, n = 0;
        for (let y = 0; y < fh && ty < 0; y++) for (let x = 0; x < fw; x++) if (a[((r * (fh + HEAD) + HEAD + y) * c.width + col * fw + x) * 4 + 3]) { ty = y; break; }
        for (let y = ty; y < ty + 12; y++) for (let x = 0; x < fw; x++) if (a[((r * (fh + HEAD) + HEAD + y) * c.width + col * fw + x) * 4 + 3]) { sx += x; n++; }
        headInfo.push({ top: ty, cx: n ? sx / n : fw / 2 });
      }
    }
    if ((top && top.id !== 'basic') || (bot && bot.id !== 'basic')) {
      const tc = top && hex(top.c), bc = bot && hex(bot.c);
      for (let i = 0; i < a.length; i += 4) {
        if (!a[i + 3]) continue;
        const [h, s2, l] = rgb2h(a[i], a[i + 1], a[i + 2]);
        let t = null, base = 0.74;
        if (tc && top.id !== 'basic' && h >= 34 && h <= 65 && s2 > 0.45) t = tc;
        else if (bc && bot.id !== 'basic' && h >= 70 && h <= 170 && s2 > 0.2) { t = bc; base = 0.5; }
        if (!t) continue;
        const kk = Math.min(1.15, l / base); a[i] = Math.min(255, t[0] * kk); a[i + 1] = Math.min(255, t[1] * kk); a[i + 2] = Math.min(255, t[2] * kk);
      }
      g.putImageData(im, 0, 0);
    }
    if (o.hat) {
      if (!hatImg[o.hat]) { hatImg[o.hat] = new Image(); hatImg[o.hat].onload = () => { dressKey = ''; }; hatImg[o.hat].src = `assets/a/hatw_${o.hat}.png`; }
      const hi = hatImg[o.hat];
      if (hi.width) for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) {
        const info = headInfo[r * 3 + col], view = r === 1 ? 2 : r === 2 || r === 3 ? 1 : 0, flip = r === 3;
        const bx = col * fw + info.cx, by = r * (fh + HEAD) + HEAD + info.top + 11;
        g.save(); g.translate(Math.round(bx), 0); if (flip) g.scale(-1, 1);
        g.drawImage(hi, view * 40, 0, 40, 40, -20, by - 40, 40, 40); g.restore();
      }
    }
    dressed = c; dressKey = k; return c;
  }

  // ───────── 주민: 집 근처를 천천히 돌아다닌다 ─────────
  const V_HOME = { toto: [8, 16], mongsil: [11, 24], coco: [18, 17], lulu: [14, 9], kongi: [5, 10], bori: [10, 8], maru: [6, 22], byeolha: [13, 15],
    pado: [15, 10], gaegul: [20, 10], bueong: [4, 25], pengi: [12, 11], gomdol: [18, 25], nana: [9, 26], mungchi: [3, 14], podeun: [15, 25], bomi: [7, 12] };
  const villIds = (S) => G.Core.villagersHere(S).map((v) => v.id).concat(S.island.visitor ? [S.island.visitor.id] : []);
  let vill = [];
  const vImg = {};
  function syncVillagers() {
    const S = hooks.state(), here = villIds(S);
    vill = vill.filter((v) => here.includes(v.id));
    for (const id of here) if (!vill.some((v) => v.id === id)) {
      const [hx, hy] = V_HOME[id] || [10, 18]; vill.push({ id, x: hx * T + 8, y: hy * T + 14, tx: null, ty: null, wait: Math.random() * 3, dir: 0, anim: 0 });
      if (!vImg[id]) { vImg[id] = new Image(); vImg[id].src = `assets/a/vill_${id}.png`; }
    }
  }
  function updateVillagers(dt) {
    for (const v of vill) {
      if (v.talk > 0) { v.talk -= dt; continue; }
      if (v.tx == null) {
        v.wait -= dt; if (v.wait > 0) continue;
        const [hx, hy] = V_HOME[v.id] || [10, 18];
        for (let k = 0; k < 10; k++) { const x = hx + Math.round((Math.random() - 0.5) * 6), y = hy + Math.round((Math.random() - 0.5) * 4); if (walkable(x, y)) { v.tx = x * T + 8; v.ty = y * T + 14; break; } }
        if (v.tx == null) v.wait = 1;
        continue;
      }
      const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy), sp = 18 * dt;
      v.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : dy > 0 ? 0 : 1; v.anim += dt * 6;
      if (d <= sp) { v.x = v.tx; v.y = v.ty; v.tx = null; v.wait = 2 + Math.random() * 4; v.dir = 0; }
      else { v.x += (dx / d) * sp; v.y += (dy / d) * sp; }
    }
  }
  function drawVillager(v, time, S) {
    const im = vImg[v.id]; if (!im || !im.width) return;
    const fw = im.width / 3, fh = im.height, view = v.dir === 1 ? 2 : v.dir >= 2 ? 1 : 0, walking = v.tx != null;
    const bob = walking && Math.floor(v.anim) % 2 ? -0.6 : Math.sin(time * 2 + v.id.length) * 0.25;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(v.x, v.y, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(Math.round(v.x * 2) / 2, 0); if (v.dir === 3) ctx.scale(-1, 1);
    ctx.drawImage(im, view * fw, 0, fw, fh, -fw / 4, v.y + 0.5 - fh / 2 + bob, fw / 2, fh / 2); ctx.restore();
    const talked = (S.island.talked || {})[v.id] === hooks.today();
    if (!talked) { // 말풍선
      const bx = v.x + 7, by = v.y - fh / 2 - 2 + Math.sin(time * 3) * 0.8;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#8a5a35'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.roundRect(bx - 5, by - 4, 10, 7, 2.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8a5a35'; for (let k = -1; k <= 1; k++) ctx.fillRect(bx + k * 2.6 - 0.6, by - 1, 1.2, 1.2);
    }
  }

  // ───────── 잡초·쓰레기 ─────────
  function placeLitter(S) {
    const I = S.island; if (!I.newLitter || !I.newLitter.length) return;
    I.litter = I.litter || [];
    const used = new Set(I.litter.map((l) => key(l.x, l.y))); deco.forEach((d) => used.add(key(d.x, d.y)));
    const cand = [];
    for (let y = 6; y <= 31; y++) for (let x = 2; x <= 21; x++) if (walkable(x, y) && !used.has(key(x, y)) && !PLOTS.some(([px, py]) => Math.abs(px - x) <= 1 && y >= py - 1 && y <= py + 1)) cand.push([x, y]);
    for (const k of I.newLitter) { if (!cand.length) break; const [x, y] = cand.splice(Math.floor(Math.random() * cand.length), 1)[0]; I.litter.push({ k, x, y }); }
    I.newLitter = []; hooks.save();
  }

  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const DECO_KINDS = ['flower_pink', 'flower_yellow', 'flower_white', 'flower_lilac', 'tuft', 'tuft', 'tuft', 'bush', 'mushroom', 'stone'];
  const deco = [];

  // ───────── 걸을 수 있는 칸 ─────────
  const inRect = (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const key = (x, y) => x + ',' + y;
  let blocked = new Set(), stars = 1;
  function buildBlocked(S) {
    stars = S.island.stars || 1;
    blocked = new Set();
    for (let x = POND.x0; x <= POND.x1; x++) for (let y = POND.y0; y <= POND.y1; y++) blocked.add(key(x, y));
    for (const b of [HOUSE, SHOP, MUSEUM]) for (let x = b.x; x < b.x + b.w; x++) for (let y = b.y; y < b.y + b.h; y++) blocked.add(key(x, y));
    PLOTS.forEach(([x, y], i) => { const t = S.island.trees[i]; if (t && (t.mature || t.g >= 1)) blocked.add(key(x, y)); });
    FOREST.forEach(([x, y]) => blocked.add(key(x, y)));
  }
  const zoneOpen = (x, y) => !(y >= BEACH_Y && stars < 2) && !(inRect(x, y, FOREST_R) && stars < 3);
  const walkable = (x, y) => x >= 2 && x <= 21 && y >= 2 && y <= 32 && !blocked.has(key(x, y)) && zoneOpen(x, y);
  function path(sx, sy, tx, ty) {
    if (!walkable(tx, ty)) return null;
    const prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) {
        const out = []; let k = key(x, y);
        while (k) { const [a, b] = k.split(',').map(Number); out.unshift([a, b]); k = prev.get(k); }
        return out.slice(1);
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (!prev.has(k) && walkable(nx, ny)) { prev.set(k, key(x, y)); q.push([nx, ny]); }
      }
    }
    return null;
  }
  const ptile = () => [Math.round(P.x / T), Math.round(P.y / T)];
  // 목표 칸 옆에서 플레이어와 가장 가까운 걸을 수 있는 칸
  function besideTile(tx, ty) {
    const [px, py] = ptile(); let best = null, bd = 1e9;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = tx + dx, y = ty + dy; if (!walkable(x, y)) continue;
      const d = Math.abs(x - px) + Math.abs(y - py); if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  const faceTo = (wx, wy) => { const dx = wx - (P.x + 8), dy = wy - (P.y + 8); P.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1); };

  // ───────── 상태 ─────────
  let cv, ctx, hooks, scale = 4, cam = { x: 0, y: 0 }, running = false, t0 = 0, now = 0;
  const ZOOMS = [10, 13, 16, 20, 24]; // 가로로 보이는 칸 수
  let zoomTiles = 16;
  const P = { x: 9 * T, y: 7 * T, dir: 0, path: [], onArrive: null, anim: 0, act: 0, sneak: false, chase: null };
  const fx = [];

  function init(canvas, h) {
    cv = canvas; ctx = cv.getContext('2d'); hooks = h;
    const taken = new Set();
    PLOTS.forEach(([x, y]) => { for (let a = -1; a <= 1; a++) for (let b = -2; b <= 1; b++) taken.add(key(x + a, y + b)); });
    FOREST.forEach(([x, y]) => { for (let a = -1; a <= 1; a++) for (let b = -2; b <= 0; b++) taken.add(key(x + a, y + b)); });
    for (let i = 0; i < 60; i++) {
      const x = 2 + Math.floor(rnd() * 20), y = 2 + Math.floor(rnd() * 30), k = key(x, y);
      if (taken.has(k) || inRect(x, y, POND) || y <= 6 || y >= 26 || (y >= POND.y0 - 1 && y <= POND.y1 + 1 && x >= POND.x0 - 1 && x <= POND.x1 + 1)) continue;
      taken.add(k); deco.push({ x, y, k: DECO_KINDS[Math.floor(rnd() * DECO_KINDS.length)] });
    }
    // 꽃이 적으면 나비가 못 오니 꽃밭을 조금 보장
    for (const [x, y, k] of [[3, 9, 0], [5, 9, 3], [14, 10, 1], [10, 22, 2], [6, 24, 0], [13, 24, 3]]) deco.push({ x, y, k: FLOWERS[k] });
    const st = hooks.state();
    if (st.island.pos) { P.x = st.island.pos[0] * T; P.y = st.island.pos[1] * T; }
    if (st.settings && st.settings.zoom) zoomTiles = st.settings.zoom;
    cv.addEventListener('pointerup', onTap);
    window.addEventListener('resize', resize);
    resize();
  }
  function resize() {
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    scale = Math.max(1, Math.round(cv.width / (zoomTiles * T)));
  }
  function setZoom(n) { zoomTiles = n; resize(); }
  function zoomStep(d) {
    let i = ZOOMS.indexOf(zoomTiles); if (i < 0) i = 2;
    i = Math.max(0, Math.min(ZOOMS.length - 1, i + d));
    setZoom(ZOOMS[i]); return ZOOMS[i];
  }
  // 갈 수 없는 칸에 서 있으면(잠긴 구역·새 건물 자리) 가장 가까운 빈칸으로 옮긴다
  function unstick() {
    const [sx, sy] = ptile();
    if (walkable(sx, sy)) return;
    const seen = new Set([key(sx, sy)]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (walkable(x, y)) { P.x = x * T; P.y = y * T; P.path = []; P.onArrive = null; return; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k)) continue; seen.add(k); q.push([nx, ny]);
      }
    }
  }

  // ───────── 오늘의 빛나는 땅 ─────────
  let spotsDate = null, spots = [];
  function digSpots(date) {
    const ex = G.Core.extraDigSpots(hooks.state());
    if (spotsDate === date + stars + ex) return spots;
    let h = 0; for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
    let s = h || 1; const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    const cand = [];
    for (let y = 6; y <= 32; y++) for (let x = 2; x <= 21; x++) {
      if (!walkable(x, y) || (x >= 3 && x <= 13 && y >= 10 && y <= 19) || deco.some((d) => d.x === x && d.y === y)) continue;
      cand.push([x, y]);
    }
    spots = [];
    const n = 4 + (stars >= 2 ? 1 : 0) + (stars >= 3 ? 1 : 0) + G.Core.extraDigSpots(hooks.state()); // 화석이 100종이라 하루 4~6곳, 부엉이 있으면 +1
    while (spots.length < n && cand.length) { const i = Math.floor(r() * cand.length); spots.push(cand.splice(i, 1)[0]); }
    spotsDate = date + stars + ex;
    return spots;
  }

  // ───────── 곤충 ─────────
  const FLY = new Set(['butterfly', 'moth', 'dragon', 'bee', 'firefly']);
  const STILL = new Set(['cicada', 'rhino', 'stag', 'beetle', 'lady']);
  let bugs = [], bugTimer = 0;
  function bugSpots(sp, S) {
    const out = [];
    const grass = () => { for (let i = 0; i < 40; i++) { const x = 2 + Math.floor(Math.random() * 20), y = 6 + Math.floor(Math.random() * 26); if (walkable(x, y) && !inRect(x, y, FOREST_R)) return [x * T + 8, y * T + 10]; } return null; };
    if (sp.loc === 'flower') deco.filter((d) => FLOWERS.includes(d.k) && zoneOpen(d.x, d.y)).forEach((d) => out.push([d.x * T + 8, d.y * T + 4]));
    if (sp.loc === 'meadow' || sp.loc === 'ground') { const g = grass(); if (g) out.push(g); }
    if (sp.loc === 'water') for (let x = POND.x0 - 1; x <= POND.x1 + 1; x++) for (const y of [POND.y0 - 1, POND.y1 + 1]) if (walkable(x, y)) out.push([x * T + 8, y * T + (y < POND.y0 ? 14 : 2)]);
    if (sp.loc === 'tree') {
      PLOTS.forEach(([x, y], i) => { const st = G.Core.treeStage(S.island.trees[i]); if (['tree', 'blossom', 'fruit', 'young'].includes(st)) out.push([x * T + 8, y * T - 2]); });
      if (stars >= 3) FOREST.forEach(([x, y]) => out.push([x * T + 8, y * T - 2]));
    }
    if (sp.loc === 'forest' && stars >= 3) FOREST.forEach(([x, y]) => out.push([x * T + 8 + (Math.random() - 0.5) * 24, y * T + 8]));
    return out;
  }
  function spawnBugs(S, force) {
    const when = new Date();
    const locs = ['flower', 'meadow', 'ground', 'water', 'tree'].concat(stars >= 3 ? ['forest'] : []);
    const pool = G.Data.bugPool(locs, when);
    const max = Math.min(5, 2 + Math.floor(pool.length / 3));
    let tries = 0;
    while (bugs.filter((b) => !b.gone).length < max && tries++ < 12) {
      const sp = G.Data.pick(pool); if (!sp) return;
      const places = bugSpots(sp, S); if (!places.length) continue;
      const [x, y] = places[Math.floor(Math.random() * places.length)];
      const shape = sp.art[0];
      bugs.push({ sp, x, y, hx: x, hy: y, ph: Math.random() * 6, mode: FLY.has(shape) ? 'fly' : STILL.has(shape) ? 'still' : 'crawl', gone: false, t: 0 });
      if (!force) break; // 평소엔 하나씩 천천히 나타남
    }
  }
  function updateBugs(dt) {
    for (const b of bugs) {
      b.t += dt;
      if (b.gone) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy -= 30 * dt; continue; }
      if (b.mode === 'fly') { b.x = b.hx + Math.sin(b.t * 0.9 + b.ph) * 14; b.y = b.hy - 6 + Math.sin(b.t * 1.7 + b.ph) * 6; }
      if (b.mode === 'crawl') { if (Math.floor(b.t * 0.6 + b.ph) % 3 === 0) { b.x += Math.cos(b.ph + b.t * 0.3) * 6 * dt; b.y += Math.sin(b.ph + b.t * 0.2) * 3 * dt; } }
    }
    bugs = bugs.filter((b) => !(b.gone && b.t > b.goneAt + 1.5));
  }
  function bugFlee(b) { b.gone = true; b.goneAt = b.t; b.vx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 40); b.vy = -50; }

  // ───────── 낚시 ─────────
  let fishing = null;
  function startFishing(loc, bx, by) {
    const cast = hooks.cast(loc);
    if (!cast || cast.err) return;
    faceTo(bx, by);
    fishing = { loc, cast, phase: 'fly', t: 0, bx, by, sx: P.x + 8, sy: P.y + 2, nib: 1 + Math.floor(Math.random() * 3), wait: 1.2 + Math.random() * 2.5, shadowA: Math.random() * 6.28 };
    P.act = 0.3; P.actKind = 0;
  }
  function fishingTap() {
    const f = fishing; if (!f) return;
    if (f.phase === 'bite') {
      fishing = null; P.act = 0.4; P.actKind = 0;
      for (let k = 0; k < 16; k++) fx.push({ k: 'drop', x: f.bx + (Math.random() - 0.5) * 14, y: f.by - Math.random() * 10, vy: -40 + Math.random() * 30, t: 0, life: 0.6 });
      hooks.land(f.cast);
    } else if (f.phase === 'approach' || f.phase === 'nibble') {
      fishing = null; floatText('너무 빨랐어요! 도망갔어요', '#ffd0d0');
    } else { fishing = null; floatText('아무것도 안 걸렸어요', '#e0e0e0'); }
  }
  function updateFishing(dt) {
    const f = fishing; if (!f) return;
    f.t += dt;
    if (f.phase === 'fly' && f.t > 0.45) { f.phase = 'wait'; f.t = 0; addRipple(f.bx, f.by); }
    else if (f.phase === 'wait' && f.t > f.wait) { f.phase = 'approach'; f.t = 0; }
    else if (f.phase === 'approach' && f.t > 1.6) { f.phase = 'nibble'; f.t = 0; f.dip = 0; }
    else if (f.phase === 'nibble') {
      const gap = 0.85;
      if (f.t > gap) { f.t = 0; f.nib--; if (f.nib <= 0) { f.phase = 'bite'; f.t = 0; addRipple(f.bx, f.by); addRipple(f.bx, f.by); if (navigator.vibrate) navigator.vibrate(80); } else { addRipple(f.bx, f.by); floatText('톡', '#ffffff', [f.bx, f.by - 6]); } }
    } else if (f.phase === 'bite' && f.t > 0.75) { fishing = null; floatText('놓쳤어요…', '#d0d8ff'); }
  }
  const addRipple = (x, y) => fx.push({ k: 'ring', x, y, color: '#ffffff', t: 0, life: 0.6 });
  function drawFishing(time) {
    const f = fishing; if (!f) return;
    let bx = f.bx, by = f.by;
    if (f.phase === 'fly') { const k = Math.min(1, f.t / 0.45); bx = f.sx + (f.bx - f.sx) * k; by = f.sy + (f.by - f.sy) * k - Math.sin(k * Math.PI) * 18; }
    if (f.phase === 'approach' || f.phase === 'nibble' || f.phase === 'bite') {
      const k = f.phase === 'approach' ? f.t / 1.6 : 1, r = 26 * (1 - k) + 4;
      const sx = f.bx + Math.cos(f.shadowA) * r, sy = f.by + 4 + Math.sin(f.shadowA) * r * 0.5;
      const sz = 2 + f.cast.size * 1.6;
      ctx.fillStyle = 'rgba(20,40,60,.45)'; ctx.beginPath(); ctx.ellipse(sx, sy, sz, sz * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    let dip = 0;
    if (f.phase === 'nibble' && f.t < 0.15) dip = 1.5;
    if (f.phase === 'bite') dip = 4;
    // 줄과 찌
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.5; ctx.beginPath();
    const hx = P.x + 8 + 8, hy = P.y - 5;
    ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + bx) / 2, Math.min(hy, by) - 10, bx, by + dip); ctx.stroke();
    if (f.phase !== 'bite') { ctx.fillStyle = '#ff4d4d'; ctx.fillRect(bx - 1.5, by - 2 + dip, 3, 2); ctx.fillStyle = '#fff'; ctx.fillRect(bx - 1.5, by + dip, 3, 1.5); }
    if (f.phase === 'bite') { ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#7a1010'; ctx.strokeText('!', P.x + 8, P.y - 12); ctx.fillStyle = '#ffde3a'; ctx.fillText('!', P.x + 8, P.y - 12); }
  }

  // ───────── 입력 ─────────
  function objectAt(wx, wy) {
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    for (const b of bugs) if (!b.gone && Math.hypot(b.x - wx, b.y - wy) < 11) return { type: 'bug', bug: b };
    for (const v of vill) if (Math.abs(v.x - wx) < 8 && wy < v.y + 2 && wy > v.y - 24) return { type: 'villager', v };
    const lit = hooks.state().island.litter || [];
    for (let i = 0; i < lit.length; i++) if (lit[i].x === tx && lit[i].y === ty) return { type: 'litter', idx: i, x: tx, y: ty };
    for (const [x, y] of digSpots(hooks.today())) if (tx === x && ty === y && !hooks.isDug(key(x, y))) return { type: 'dig', x, y };
    for (let i = 0; i < PLOTS.length; i++) {
      const [x, y] = PLOTS[i];
      // 누르는 범위는 나무 크기만큼만: 빈자리·새싹은 그 칸, 어린 나무는 위로 한 칸, 다 큰 나무는 잎까지
      const st = G.Core.treeStage(hooks.state().island.trees[i]);
      const hit = ['empty', 'sprout', 'sapling'].includes(st) ? tx === x && ty === y : st === 'young' ? tx === x && ty >= y - 1 && ty <= y : tx >= x - 1 && tx <= x + 1 && ty >= y - 2 && ty <= y;
      if (hit) return { type: 'plot', i, stand: [x, y + 1], face: 1 };
    }
    for (const [b, type] of [[HOUSE, 'house'], [SHOP, 'shop'], [MUSEUM, 'museum']]) if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return { type, stand: b.stand, face: 1 };
    if (inRect(tx, ty, POND)) return { type: 'pond' };
    if (ty >= 33 || tx < 1 || tx > 22 || ty < 1) return { type: 'sea' };
    if (ty >= BEACH_Y && stars < 2) return { type: 'locked', need: 2 };
    if (inRect(tx, ty, FOREST_R) && stars < 3) return { type: 'locked', need: 3 };
    return null;
  }
  function nearestPondEdge(tx, ty) {
    let best = null, bd = 1e9; const [px, py] = ptile();
    for (let x = POND.x0 - 1; x <= POND.x1 + 1; x++) for (let y = POND.y0 - 1; y <= POND.y1 + 1; y++) {
      if (!walkable(x, y)) continue;
      const d = Math.abs(x - tx) + Math.abs(y - ty) + 0.1 * (Math.abs(x - px) + Math.abs(y - py)); if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  function onTap(e) {
    if (!running) return;
    const r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
    tapWorld(((e.clientX - r.left) * dpr) / scale + cam.x, ((e.clientY - r.top) * dpr) / scale + cam.y);
  }
  function walkThen(tgt, fn, chase) {
    const [px, py] = ptile();
    const p = path(px, py, tgt[0], tgt[1]);
    if (!p) return false;
    P.path = p.map(([x, y]) => [x * T, y * T]); P.onArrive = fn; P.chase = chase || null; P.sneak = false;
    if (!p.length && fn) { P.onArrive = null; fn(); }
    return true;
  }
  function tapWorld(wx, wy) {
    if (fishing) { fishingTap(); return; }
    if (P.act > 0) return;
    const obj = objectAt(wx, wy);
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (obj && obj.type === 'locked') { hooks.toast(obj.need === 2 ? '🏖️ 섬 별점 ★2가 되면 해변이 열려요' : '🌲 섬 별점 ★3이 되면 숲이 열려요'); return; }
    if (obj && obj.type === 'bug') {
      const b = obj.bug, bt = [Math.round((b.x - 8) / T), Math.round((b.y - 8) / T)];
      const st = walkable(bt[0], bt[1]) && Math.hypot(bt[0] * T + 8 - b.x, bt[1] * T + 8 - b.y) < 14 ? bt : besideTile(bt[0], bt[1]) || bt;
      addRing(b.x, b.y, '#ffe680');
      if (!walkThen(st, () => swing(b), b)) hooks.toast('거기엔 갈 수 없어요');
      return;
    }
    if (obj && obj.type === 'villager') {
      const v = obj.v; v.talk = 6; v.tx = null;
      const vt = [Math.round((v.x - 8) / T), Math.round((v.y - 14) / T)], st = besideTile(vt[0], vt[1]) || vt;
      addRing(v.x, v.y - 4, '#ffd6f0');
      walkThen(st, () => { faceTo(v.x, v.y - 6); v.dir = P.y + 8 > v.y - 6 ? 0 : 1; v.talk = 4; hooks.onTap({ type: 'villager', id: v.id }); });
      return;
    }
    if (obj && obj.type === 'litter') {
      const it = hooks.state().island.litter[obj.idx];
      const st = walkable(obj.x, obj.y) ? besideTile(obj.x, obj.y) || [obj.x, obj.y] : besideTile(obj.x, obj.y); if (!st) return;
      addRing(obj.x * T + 8, obj.y * T + 8, '#c8ffb0');
      walkThen(st, () => { faceTo(obj.x * T + 8, obj.y * T + 8); P.act = 0.4; P.actKind = 2; dustAt(obj.x * T + 8, obj.y * T + 12);
        const i = hooks.state().island.litter.indexOf(it); if (i >= 0) hooks.clearLitter(i, obj.x * T + 8, obj.y * T + 8); });
      return;
    }
    if (obj && obj.type === 'dig') {
      const st = besideTile(obj.x, obj.y); if (!st) return;
      addRing(obj.x * T + 8, obj.y * T + 8, '#ffe680');
      walkThen(st, () => { faceTo(obj.x * T + 8, obj.y * T + 8); P.act = 0.6; P.actKind = 2; dustAt(obj.x * T + 8, obj.y * T + 10); setTimeout(() => hooks.dig(key(obj.x, obj.y), obj.x * T + 8, obj.y * T + 8), 350); });
      return;
    }
    if (obj && obj.type === 'pond') {
      const st = nearestPondEdge(tx, ty); if (!st) return;
      walkThen(st, () => {
        const cx = Math.min(POND.x1 - 0.5, Math.max(POND.x0 + 1.5, st[0] + 0.5 + Math.sign((POND.x0 + POND.x1 + 1) / 2 - st[0] - 0.5) * 2));
        const cy = Math.min(POND.y1 - 0.5, Math.max(POND.y0 + 1.5, st[1] + 0.5 + Math.sign((POND.y0 + POND.y1 + 1) / 2 - st[1] - 0.5) * 2));
        hooks.tryFish('pond', () => startFishing('pond', cx * T, cy * T));
      });
      return;
    }
    if (obj && obj.type === 'sea') {
      if (stars < 2) { hooks.toast('🌊 섬 별점 ★2가 되면 해변에서 바다낚시를 할 수 있어요'); return; }
      const x = Math.max(2, Math.min(21, tx));
      walkThen([x, 32], () => hooks.tryFish('sea', () => startFishing('sea', x * T + 8, 34.6 * T)));
      return;
    }
    if (obj && obj.stand) { addRing(wx, wy, '#ffffff'); walkThen(obj.stand, () => { P.dir = obj.face; hooks.onTap(obj); }); return; }
    if (!walkThen([tx, ty], null)) addRing(wx, wy, '#ff6b6b'); else addRing(wx, wy, '#ffffff');
  }
  function swing(b) {
    if (b.gone) return;
    faceTo(b.x, b.y); P.act = 0.4; P.actKind = 1;
    fx.push({ k: 'swing', x: P.x + 8, y: P.y + 6, dir: P.dir, t: 0, life: 0.3 });
    const r = hooks.netSwing(b.sp);
    if (!r || r.err) return;
    if (r.miss) { bugFlee(b); floatText('휙… 놓쳤어요', '#e0e0e0'); return; }
    b.gone = true; b.goneAt = b.t; b.vx = 0; b.vy = 0; b.y = -999;
  }

  // ───────── 효과 ─────────
  const addRing = (x, y, color) => fx.push({ k: 'ring', x, y, color, t: 0, life: 0.4 });
  function floatText(text, color = '#fff', at) { const [x, y] = at || [P.x + 8, P.y - 12]; fx.push({ k: 'text', text, color, x, y, t: 0, life: 1.4 }); }
  function splash(i) { const [x, y] = PLOTS[i]; for (let n = 0; n < 18; n++) fx.push({ k: 'drop', x: x * T + 8 + (Math.random() - 0.5) * 22, y: (y - 1) * T - Math.random() * 14, vy: 40 + Math.random() * 50, t: 0, life: 0.5 + Math.random() * 0.3 }); }
  function pop(i, kind, n) {
    const [x, y] = PLOTS[i];
    for (let k = 0; k < n; k++) fx.push({ k: 'fruit', kind, x: x * T + 8 + (k - 1) * 9, y: (y - 1) * T, vx: (k - 1) * 18, vy: -70 - k * 10, t: 0, life: 1.1 });
    sparkle(x * T + 8, (y - 1) * T);
  }
  function sparkle(x, y, n = 14) { for (let k = 0; k < n; k++) fx.push({ k: 'spark', x, y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.8) * 120, t: 0, life: 0.7 }); }
  const dust = (i) => { const [x, y] = PLOTS[i]; dustAt(x * T + 8, y * T + 12); };
  function dustAt(x, y) { for (let k = 0; k < 12; k++) fx.push({ k: 'dust', x: x + (Math.random() - 0.5) * 14, y, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, t: 0, life: 0.6 }); }

  // ───────── 그리기 ─────────
  function drawTree(i, t, time, today) {
    const [x, y] = PLOTS[i], bx = x * T, by = y * T;
    ctx.fillStyle = t && t.watered === today ? 'rgba(120,78,50,.55)' : 'rgba(190,140,90,.45)';
    ctx.beginPath(); ctx.ellipse(bx + 8, by + 12, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    const st = G.Core.treeStage(t);
    const sway = Math.sin(time * 1.6 + i) * 0.6;
    if (st === 'empty') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([2, 2]); ctx.strokeRect(bx + 1, by + 3, 14, 12); ctx.setLineDash([]); return; }
    const foot = by + 15;
    if (st === 'sprout') spr('sprout', bx + 8, foot);
    else if (st === 'sapling') spr('sapling', bx + 8, foot);
    else if (st === 'young') spr('young', bx + 8 + sway * 0.5, foot);
    else {
      spr(st === 'blossom' ? 'blossom' : 'tree', bx + 8 + sway, foot);
      if (st === 'fruit') {
        const cy = foot - 23;
        [[-9, -5], [6, -9], [9, 3], [-3, 4]].forEach(([dx, dy], k) => ctx.drawImage(IMG[t.kind], bx + 8 + dx + sway - 5, cy + dy + Math.sin(time * 3 + k) * 0.7 - 5, 10, 10));
        if (Math.floor(time * 2 + i) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(bx + 14, cy - 12, 1, 3); ctx.fillRect(bx + 13, cy - 11, 3, 1); }
      }
    }
    if (t && t.watered !== today && st !== 'fruit') {
      const b = Math.sin(time * 4) * 1.5, top = st === 'sprout' ? 6 : st === 'sapling' ? 12 : st === 'young' ? 22 : 38;
      ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.arc(bx + 8, by - top + b, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 5.5, by - top - 1 + b); ctx.lineTo(bx + 8, by - top - 6 + b); ctx.lineTo(bx + 10.5, by - top - 1 + b); ctx.fill();
    }
  }
  // 섬에서 보이는 곤충 크기(세계 단위). 실제 크기 차이를 살리되 징그럽지 않게 작게
  const BUG_SIZE = { ant: 6, ladybug: 7, firefly: 7, bee: 8, strider: 8, cricket: 8, spider: 8, snail: 8, diving: 8, hopper: 9, acrida: 10, cetonia: 9, jewel: 9, goldbeetle: 9,
    cabbage: 10, sulphur: 10, apollo: 11, moth: 10, wintermoth: 9, redfly: 11, skimmer: 11, bigdragon: 12, mantis: 11, cicada: 10, swallowtail: 12, swallow2: 12, morpho: 12,
    rhino: 12, stag: 11, bigstag: 13 };
  function drawBug(b, time, night) {
    if (b.y < -100) return;
    const c = G.Icons.canvasFor(b.sp); const s = c instanceof HTMLImageElement ? (BUG_SIZE[b.sp.id] || b.sp.px || 10) : 11;
    ctx.globalAlpha = b.gone ? Math.max(0, 1 - (b.t - b.goneAt) / 1.2) : 1;
    if (b.mode === 'fly' && !b.gone) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(b.x, b.hy + 6, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill(); }
    if (b.sp.art[0] === 'firefly' && night) { const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 10); g.addColorStop(0, 'rgba(240,255,120,.7)'); g.addColorStop(1, 'rgba(240,255,120,0)'); ctx.fillStyle = g; ctx.fillRect(b.x - 10, b.y - 10, 20, 20); }
    const flap = b.mode === 'fly' ? 0.55 + 0.45 * Math.abs(Math.sin(time * 14 + b.ph)) : 1;
    const hop = b.mode === 'crawl' && Math.floor(b.t * 2 + b.ph) % 4 === 0 ? -1 : 0;
    ctx.imageSmoothingEnabled = true; // 작게 줄인 아이콘이 깨지지 않게
    ctx.drawImage(c, b.x - (s * flap) / 2, b.y - s / 2 + hop, s * flap, s);
    ctx.imageSmoothingEnabled = false;
    // 희귀한 곤충은 반짝
    if (b.sp.r >= 4 && Math.floor(time * 3 + b.ph) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(b.x + 4, b.y - 6, 1, 3); ctx.fillRect(b.x + 3, b.y - 5, 3, 1); }
    ctx.globalAlpha = 1;
  }
  function fence(x0, y0, x1, y1) {
    if (y0 === y1) { const fw = IMG.fence.width / 2 || 24; for (let x = x0; x < x1; x += fw - 1) spr('fence', x + fw / 2, y0 + 10); }
    else for (let y = y0; y <= y1; y += 9) spr('post', x0 + 1, y + 10);
  }
  function sign(x, y, text) {
    spr('sign', x, y + 10);
    ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#5c3a28'; ctx.fillText(text, x, y - 1);
  }
  function frame(ts) {
    if (!running) return;
    const time = ts / 1000, dt = Math.min(0.05, (ts - (t0 || ts)) / 1000); t0 = ts; now = time;
    const S = hooks.state(), today = hooks.today();
    buildBlocked(S);
    placeLitter(S);
    if (vill.length !== villIds(S).length) syncVillagers();
    if (!P.path.length) unstick();
    const hr = new Date().getHours() + new Date().getMinutes() / 60;
    const night = hr >= 20 || hr < 5 ? 0.38 : hr >= 18 ? (hr - 18) / 2 * 0.38 : hr < 7 ? (7 - hr) / 2 * 0.38 : 0;

    // 이동 (곤충에 가까워지면 살금살금, 그동안 도망 판정)
    if (P.act > 0) P.act -= dt;
    if (P.path.length) {
      const ch = P.chase;
      if (ch && ch.gone) { P.path = []; P.onArrive = null; P.chase = null; }
      else {
        if (ch) {
          const d = Math.hypot(ch.x - (P.x + 8), ch.y - (P.y + 8));
          P.sneak = d < 52;
          ch.fleeT = (ch.fleeT || 0) + dt;
          if (P.sneak && ch.fleeT > 0.25) { ch.fleeT = 0; if (Math.random() < G.Core.fleeChance(S, ch.sp.r)) { bugFlee(ch); floatText('앗, 날아가 버렸어요!', '#e0e0e0'); } }
        }
        const [tx, ty] = P.path[0], dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy), sp = (P.sneak ? 34 : 90) * dt;
        if (Math.abs(dx) > Math.abs(dy)) P.dir = dx > 0 ? 3 : 2; else if (dy) P.dir = dy > 0 ? 0 : 1;
        if (d <= sp) { P.x = tx; P.y = ty; P.path.shift(); if (!P.path.length) { S.island.pos = [tx / T, ty / T]; hooks.save(); P.sneak = false; const f = P.onArrive; P.onArrive = null; P.chase = null; if (f) f(); } }
        else { P.x += (dx / d) * sp; P.y += (dy / d) * sp; }
        P.anim += dt * (P.sneak ? 4 : 8);
      }
    } else P.anim = 0;
    bugTimer -= dt; if (bugTimer <= 0) { spawnBugs(S, bugs.length === 0); bugTimer = 10 + Math.random() * 8; }
    updateBugs(dt); updateFishing(dt); updateVillagers(dt);

    const vw = cv.width / scale, vh = cv.height / scale;
    cam.x = vw >= W * T ? (W * T - vw) / 2 : Math.max(0, Math.min(W * T - vw, P.x + 8 - vw / 2));
    cam.y = vh >= H * T ? (H * T - vh) / 2 : Math.max(-8, Math.min(H * T - vh, P.y + 8 - vh / 2));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#6fd0e6'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, scale, -Math.round(cam.x * scale), -Math.round(cam.y * scale));

    const wx0 = Math.floor(cam.x / T) - 1, wy0 = Math.floor(cam.y / T) - 1, wx1 = Math.ceil((cam.x + vw) / T) + 1, wy1 = Math.ceil((cam.y + vh) / T) + 1;
    drawSea(wx0 * T, wy0 * T, wx1 * T, wy1 * T, time);
    drawFoam(time);
    if (!groundCv) groundCv = buildGround();
    ctx.drawImage(groundCv, 0, 0, W * T, H * T);
    // 연못 반짝임
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    for (const [x, y, p] of [[16.2, 4.5, 0], [18.6, 6.2, 2], [17.1, 7.6, 4]]) { const k = (Math.sin(time * 1.5 + p) + 1) / 2; ctx.fillRect(x * T, y * T, 3 + k * 3, 0.6); }

    // 빛나는 땅
    for (const [x, y] of digSpots(today)) {
      const k = key(x, y), cx = x * T + 8, cy = y * T + 9;
      if (hooks.isDug(k)) { ctx.fillStyle = 'rgba(60,35,15,.7)'; ctx.beginPath(); ctx.ellipse(cx, cy, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill(); continue; }
      const p = 0.5 + 0.5 * Math.sin(time * 3 + x);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9); g.addColorStop(0, `rgba(255,240,150,${0.55 + p * 0.3})`); g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 10, cy - 10, 20, 20);
      spr('dig', cx, cy + 5);
      if (Math.floor(time * 2 + x) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(cx + 4, cy - 6, 1, 3); ctx.fillRect(cx + 3, cy - 5, 3, 1); }
    }

    const items = [];
    for (const [x, y] of [[16.3, 6.4], [19.2, 4.6], [17.6, 8.3]]) spr('lily', x * T, y * T + Math.sin(time + x) * 0.4);
    deco.forEach((d) => items.push({ y: d.y * T + 12, draw: () => spr(d.k, d.x * T + 8, d.y * T + 14) }));
    vill.forEach((v) => items.push({ y: v.y, draw: () => drawVillager(v, time, S) }));
    (S.island.litter || []).forEach((l) => items.push({ y: l.y * T + 12, draw: () => spr(l.k === 'can' ? 'can' : 'weeds', l.x * T + 8, l.y * T + 14) }));
    BEACH_DECO.forEach(([x, y, k]) => items.push({ y: y * T + 10, draw: () => spr(k, x * T + 8, y * T + 12) }));
    PALMS.forEach(([x, y], k) => items.push({ y: y * T + 14, draw: () => spr('palm', x * T + 8 + Math.sin(time * 1.1 + k) * 0.4, y * T + 15) }));
    for (const [b, n] of [[HOUSE, 'house'], [SHOP, 'shop'], [MUSEUM, 'museum']]) items.push({ y: (b.y + b.h) * T, draw: () => spr(n, (b.x + b.w / 2) * T, (b.y + b.h) * T + 2) });
    FOREST.forEach(([x, y], k) => items.push({ y: y * T + 15, draw: () => spr(k % 2 ? 'pine' : 'forest', x * T + 8 + Math.sin(time * 1.3 + k) * 0.5, y * T + 15) }));
    PLOTS.forEach(([, y], i) => items.push({ y: y * T + 15, draw: () => drawTree(i, S.island.trees[i], time, today) }));
    bugs.forEach((b) => items.push({ y: b.mode === 'fly' ? b.hy + 8 : b.y + 4, draw: () => drawBug(b, time, night > 0.2) }));
    items.push({ y: P.y + 15.5, draw: () => {
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(P.x + 8, P.y + 15, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
      // 그림 칸: 줄 0 아래 1 위 2 왼쪽 3 오른쪽 4 행동(낚시·잠자리채·삽), 칸 0 서기 1·2 걷기
      const pose = fishing ? [4, 0] : P.act > 0 ? [4, P.actKind || 0] : P.path.length ? [P.dir, [1, 0, 2, 0][Math.floor(P.anim) % 4]] : [P.dir, 0];
      const sheet = dressSheet(S) || IMG.player;
      const pw = sheet.width / 3, ph = sheet.height / 5, bob = P.path.length && Math.floor(P.anim) % 2 ? -0.5 : 0;
      ctx.drawImage(sheet, pose[1] * pw, pose[0] * ph, pw, ph, Math.round((P.x + 8 - pw / 4) * 2) / 2, P.y + 15.5 - ph / 2 + bob, pw / 2, ph / 2); // 그림마다 발끝이 칸 맨 아래
      if (P.sneak) { ctx.font = '6px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('살금…', P.x + 8, P.y - 10); }
    } });
    items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());

    // 잠긴 구역
    if (stars < 2) { fence(2 * T, (BEACH_Y - 1) * T + 8, 22 * T, (BEACH_Y - 1) * T + 8); sign(11 * T, (BEACH_Y - 1) * T + 6, '★2 해변'); }
    if (stars < 3) { fence(FOREST_R.x0 * T - 2, FOREST_R.y0 * T, FOREST_R.x0 * T - 2, (FOREST_R.y1 + 1) * T); fence(FOREST_R.x0 * T - 2, FOREST_R.y0 * T - 6, 22 * T, FOREST_R.y0 * T - 6); sign((FOREST_R.x0 + 1) * T, FOREST_R.y0 * T + 4, '★3 숲'); }

    drawFishing(time);

    ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center';
    const top = (b, n) => (b.y + b.h) * T + 2 - IMG[n].height / 2 - 1;
    label('우리 집', (HOUSE.x + 2) * T, top(HOUSE, 'house'));
    label('상점', (SHOP.x + 1.5) * T, top(SHOP, 'shop'));
    label('박물관', (MUSEUM.x + 1.5) * T, top(MUSEUM, 'museum'));
    label('과수원', 8 * T + 8, 10 * T + 4);
    label('연못', (POND.x0 + 3) * T, POND.y0 * T - 2);

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt; if (f.t > f.life) { fx.splice(i, 1); continue; }
      const a = 1 - f.t / f.life;
      if (f.k === 'ring') { ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(f.x, f.y, 3 + f.t * 20, 1.5 + f.t * 10, 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (f.k === 'text') { ctx.globalAlpha = Math.min(1, a * 2); ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.7)'; const yy = f.y - f.t * 16; ctx.strokeText(f.text, f.x, yy); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, yy); }
      else if (f.k === 'drop') { f.y += f.vy * dt; f.vy += 120 * dt; ctx.globalAlpha = a; ctx.fillStyle = '#7fdcff'; ctx.fillRect(f.x, f.y, 1, 2); }
      else if (f.k === 'fruit') { f.vy += 260 * dt; f.x += f.vx * dt; f.y += f.vy * dt; ctx.globalAlpha = Math.min(1, a * 3); ctx.drawImage(IMG[f.kind], f.x - 6, f.y - 6, 12, 12); }
      else if (f.k === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; ctx.globalAlpha = a; ctx.fillStyle = Math.random() < 0.5 ? '#fff6a8' : '#ffffff'; ctx.fillRect(f.x, f.y, 1, 1); }
      else if (f.k === 'dust') { f.x += f.vx * dt; f.y += f.vy * dt; ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#c8a070'; ctx.fillRect(f.x, f.y, 2, 2); }
      else if (f.k === 'swing') { ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; const ang = { 0: Math.PI / 2, 1: -Math.PI / 2, 2: Math.PI, 3: 0 }[f.dir]; ctx.beginPath(); ctx.arc(f.x, f.y, 11, ang - 1 + f.t * 6, ang - 0.2 + f.t * 6); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (night > 0) { ctx.fillStyle = `rgba(20,24,70,${night})`; ctx.fillRect(0, 0, cv.width, cv.height); }
    if (hr >= 16.5 && hr < 19) { ctx.fillStyle = 'rgba(255,140,60,.10)'; ctx.fillRect(0, 0, cv.width, cv.height); }
    // 반딧불이는 밤 어둠 위에도 빛나게
    if (night > 0.2) for (const b of bugs) if (b.sp.art[0] === 'firefly' && !b.gone) { const sx = (b.x - cam.x) * scale, sy = (b.y - cam.y) * scale; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 8 * scale); g.addColorStop(0, 'rgba(240,255,120,.5)'); g.addColorStop(1, 'rgba(240,255,120,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 8 * scale, sy - 8 * scale, 16 * scale, 16 * scale); }
    if (fishing && fishing.phase !== 'bite' && fishing.t < 3 && fishing.phase === 'wait') {
      ctx.font = `bold ${5 * scale}px sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = scale; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText('찌가 쑥 들어가면 탭!', cv.width / 2, cv.height * 0.18); ctx.fillStyle = '#fff'; ctx.fillText('찌가 쑥 들어가면 탭!', cv.width / 2, cv.height * 0.18);
    }
    requestAnimationFrame(frame);
  }
  function label(text, x, y) { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,30,20,.75)'; ctx.strokeText(text, x, y); ctx.fillStyle = '#fff8e6'; ctx.fillText(text, x, y); }

  function start() { if (running) return; running = true; resize(); t0 = 0; ready.then(() => requestAnimationFrame(frame)); }
  function stop() { running = false; fishing = null; }

  G.Island = { init, start, stop, tapWorld, redress, syncVillagers, zoomStep, ZOOMS, floatText, splash, pop, dust, sparkle, resize, PLOTS, IMG, ready, player: P,
    _debug: { vill: () => vill, bugs: () => bugs, fishing: () => fishing, spots: () => spots, spawn: (sp, x, y) => bugs.push({ sp, x, y, hx: x, hy: y, ph: 0, mode: FLY.has(sp.art[0]) ? 'fly' : STILL.has(sp.art[0]) ? 'still' : 'crawl', gone: false, t: 0 }) } };
})(window);
