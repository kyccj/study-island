// island.js — 섬 화면: 타일 지도, 탭해서 걷기, 과일나무, 낚시, 곤충, 땅파기, 효과.
// 바탕 그림은 Ninja Adventure(CC0). 게임 규칙 판정은 hooks로 app.js에 맡긴다.
(function (G) {
  'use strict';
  const T = 16, W = 24, H = 36;

  // ───────── 그림 불러오기 ─────────
  const IMG = {};
  const SRC = { field: 'field', water: 'water', nature: 'nature', house: 'house', player: 'player', ripple: 'ripple',
    cherry: 'fruit-cherry', orange: 'fruit-orange', lemon: 'fruit-lemon', pear: 'fruit-pear', banana: 'fruit-banana', grapes: 'fruit-grapes' };
  const ready = Promise.all(Object.entries(SRC).map(([k, f]) => new Promise((res) => {
    const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = `assets/${f}.png`; IMG[k] = im;
  })));
  const tile = (ctx, sheet, c, r, x, y, w = 1, h = 1) => ctx.drawImage(IMG[sheet], c * T, r * T, w * T, h * T, x, y, w * T, h * T);

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
  const FLOWERS = [[0, 11], [1, 11], [3, 11], [6, 11]];

  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const DECO_KINDS = [[0, 11], [1, 11], [3, 11], [6, 11], [3, 10], [4, 10], [5, 10], [0, 10], [2, 10]];
  const deco = [];
  const grassVar = {};

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
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grassVar[key(x, y)] = rnd() < 0.18 ? [[3, 3], [4, 3], [3, 4], [4, 4]][Math.floor(rnd() * 4)] : null;
    const taken = new Set();
    PLOTS.forEach(([x, y]) => { for (let a = -1; a <= 1; a++) for (let b = -2; b <= 1; b++) taken.add(key(x + a, y + b)); });
    FOREST.forEach(([x, y]) => { for (let a = -1; a <= 1; a++) for (let b = -2; b <= 0; b++) taken.add(key(x + a, y + b)); });
    for (let i = 0; i < 60; i++) {
      const x = 2 + Math.floor(rnd() * 20), y = 2 + Math.floor(rnd() * 30), k = key(x, y);
      if (taken.has(k) || inRect(x, y, POND) || y <= 6 || y >= 26) continue;
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
    if (spotsDate === date + stars) return spots;
    let h = 0; for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
    let s = h || 1; const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    const cand = [];
    for (let y = 6; y <= 32; y++) for (let x = 2; x <= 21; x++) {
      if (!walkable(x, y) || (x >= 3 && x <= 13 && y >= 10 && y <= 19) || deco.some((d) => d.x === x && d.y === y)) continue;
      cand.push([x, y]);
    }
    spots = [];
    const n = 3 + (stars >= 2 ? 1 : 0) + (stars >= 3 ? 1 : 0);
    while (spots.length < n && cand.length) { const i = Math.floor(r() * cand.length); spots.push(cand.splice(i, 1)[0]); }
    spotsDate = date + stars;
    return spots;
  }

  // ───────── 곤충 ─────────
  const FLY = new Set(['butterfly', 'moth', 'dragon', 'bee', 'firefly']);
  const STILL = new Set(['cicada', 'rhino', 'stag', 'beetle', 'lady']);
  let bugs = [], bugTimer = 0;
  function bugSpots(sp, S) {
    const out = [];
    const grass = () => { for (let i = 0; i < 40; i++) { const x = 2 + Math.floor(Math.random() * 20), y = 6 + Math.floor(Math.random() * 26); if (walkable(x, y) && !inRect(x, y, FOREST_R)) return [x * T + 8, y * T + 10]; } return null; };
    if (sp.loc === 'flower') deco.filter((d) => FLOWERS.some((f) => f[0] === d.k[0] && f[1] === d.k[1]) && zoneOpen(d.x, d.y)).forEach((d) => out.push([d.x * T + 8, d.y * T + 4]));
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
    P.act = 0.3;
  }
  function fishingTap() {
    const f = fishing; if (!f) return;
    if (f.phase === 'bite') {
      fishing = null; P.act = 0.4;
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
    const hx = P.x + (P.dir === 2 ? 1 : P.dir === 3 ? 15 : 8), hy = P.y + 2;
    ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + bx) / 2, Math.min(hy, by) - 10, bx, by + dip); ctx.stroke();
    if (f.phase !== 'bite') { ctx.fillStyle = '#ff4d4d'; ctx.fillRect(bx - 1.5, by - 2 + dip, 3, 2); ctx.fillStyle = '#fff'; ctx.fillRect(bx - 1.5, by + dip, 3, 1.5); }
    if (f.phase === 'bite') { ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#7a1010'; ctx.strokeText('!', P.x + 8, P.y - 6); ctx.fillStyle = '#ffde3a'; ctx.fillText('!', P.x + 8, P.y - 6); }
  }

  // ───────── 입력 ─────────
  function objectAt(wx, wy) {
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    for (const b of bugs) if (!b.gone && Math.hypot(b.x - wx, b.y - wy) < 11) return { type: 'bug', bug: b };
    for (const [x, y] of digSpots(hooks.today())) if (tx === x && ty === y && !hooks.isDug(key(x, y))) return { type: 'dig', x, y };
    for (let i = 0; i < PLOTS.length; i++) {
      const [x, y] = PLOTS[i];
      if (tx >= x - 1 && tx <= x + 1 && ty >= y - 2 && ty <= y) return { type: 'plot', i, stand: [x, y + 1], face: 1 };
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
    if (obj && obj.type === 'dig') {
      const st = besideTile(obj.x, obj.y); if (!st) return;
      addRing(obj.x * T + 8, obj.y * T + 8, '#ffe680');
      walkThen(st, () => { faceTo(obj.x * T + 8, obj.y * T + 8); P.act = 0.5; dustAt(obj.x * T + 8, obj.y * T + 10); setTimeout(() => hooks.dig(key(obj.x, obj.y), obj.x * T + 8, obj.y * T + 8), 350); });
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
    faceTo(b.x, b.y); P.act = 0.4;
    fx.push({ k: 'swing', x: P.x + 8, y: P.y + 6, dir: P.dir, t: 0, life: 0.3 });
    const r = hooks.netSwing(b.sp);
    if (!r || r.err) return;
    if (r.miss) { bugFlee(b); floatText('휙… 놓쳤어요', '#e0e0e0'); return; }
    b.gone = true; b.goneAt = b.t; b.vx = 0; b.vy = 0; b.y = -999;
  }

  // ───────── 효과 ─────────
  const addRing = (x, y, color) => fx.push({ k: 'ring', x, y, color, t: 0, life: 0.4 });
  function floatText(text, color = '#fff', at) { const [x, y] = at || [P.x + 8, P.y - 6]; fx.push({ k: 'text', text, color, x, y, t: 0, life: 1.4 }); }
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
  function nine(sheet, c0, r0, R, varFn) {
    for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) {
      const cx = x === R.x0 ? 0 : x === R.x1 ? 2 : 1, cy = y === R.y0 ? 0 : y === R.y1 ? 2 : 1;
      let c = c0 + cx, r = r0 + cy;
      if (cx === 1 && cy === 1 && varFn) { const v = varFn(x, y); if (v) { c = v[0]; r = v[1]; } }
      tile(ctx, sheet, c, r, x * T, y * T);
    }
  }
  function drawTree(i, t, time, today) {
    const [x, y] = PLOTS[i], bx = x * T, by = y * T;
    ctx.fillStyle = t && t.watered === today ? 'rgba(70,40,20,.55)' : 'rgba(120,80,40,.35)';
    ctx.beginPath(); ctx.ellipse(bx + 8, by + 12, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    const st = G.Core.treeStage(t);
    const sway = Math.sin(time * 1.6 + i) * 0.6;
    if (st === 'empty') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([2, 2]); ctx.strokeRect(bx + 1, by + 3, 14, 12); ctx.setLineDash([]); return; }
    if (st === 'sprout') tile(ctx, 'nature', 2, 11, bx, by);
    else if (st === 'sapling') tile(ctx, 'nature', 1, 10, bx, by - 2);
    else if (st === 'young') tile(ctx, 'nature', 6, 8, bx - 8 + sway, by - T, 2, 2);
    else {
      const [c, r] = st === 'blossom' ? [0, 18] : [3, 18];
      tile(ctx, 'nature', c, r, bx - T + sway, by - 2 * T, 3, 3);
      if (st === 'fruit') {
        [[-9, -22], [5, -26], [10, -14], [-4, -12]].forEach(([dx, dy], k) => ctx.drawImage(IMG[t.kind], bx + 8 + dx + sway - 5, by + dy + Math.sin(time * 3 + k) * 0.7 - 5, 10, 10));
        if (Math.floor(time * 2 + i) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(bx + 12, by - 30, 1, 3); ctx.fillRect(bx + 11, by - 29, 3, 1); }
      }
    }
    if (t && t.watered !== today && st !== 'fruit') {
      const b = Math.sin(time * 4) * 1.5, top = st === 'sprout' || st === 'sapling' ? 8 : 36;
      ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.arc(bx + 8, by - top + b, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 5.5, by - top - 1 + b); ctx.lineTo(bx + 8, by - top - 6 + b); ctx.lineTo(bx + 10.5, by - top - 1 + b); ctx.fill();
    }
  }
  function drawBug(b, time, night) {
    if (b.y < -100) return;
    const c = G.Icons.canvasFor(b.sp); const s = 11;
    ctx.globalAlpha = b.gone ? Math.max(0, 1 - (b.t - b.goneAt) / 1.2) : 1;
    if (b.mode === 'fly' && !b.gone) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(b.x, b.hy + 6, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill(); }
    if (b.sp.art[0] === 'firefly' && night) { const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 10); g.addColorStop(0, 'rgba(240,255,120,.7)'); g.addColorStop(1, 'rgba(240,255,120,0)'); ctx.fillStyle = g; ctx.fillRect(b.x - 10, b.y - 10, 20, 20); }
    const flap = b.mode === 'fly' ? 0.55 + 0.45 * Math.abs(Math.sin(time * 14 + b.ph)) : 1;
    const hop = b.mode === 'crawl' && Math.floor(b.t * 2 + b.ph) % 4 === 0 ? -1 : 0;
    ctx.drawImage(c, b.x - (s * flap) / 2, b.y - s / 2 + hop, s * flap, s);
    // 희귀한 곤충은 반짝
    if (b.sp.r >= 4 && Math.floor(time * 3 + b.ph) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(b.x + 4, b.y - 6, 1, 3); ctx.fillRect(b.x + 3, b.y - 5, 3, 1); }
    ctx.globalAlpha = 1;
  }
  function fence(x0, y0, x1, y1) {
    ctx.fillStyle = '#8a5a35';
    if (y0 === y1) { ctx.fillRect(x0, y0 + 3, x1 - x0, 1.5); ctx.fillRect(x0, y0 + 7, x1 - x0, 1.5); for (let x = x0; x <= x1; x += T) { ctx.fillStyle = '#6b4226'; ctx.fillRect(x, y0, 2, 11); ctx.fillStyle = '#8a5a35'; } }
    else { ctx.fillRect(x0 + 0.5, y0, 1.5, y1 - y0); for (let y = y0; y <= y1; y += T) { ctx.fillStyle = '#6b4226'; ctx.fillRect(x0, y, 2.5, 6); ctx.fillStyle = '#8a5a35'; } }
  }
  function sign(x, y, text) {
    ctx.fillStyle = '#6b4226'; ctx.fillRect(x - 1, y, 2, 8);
    ctx.fillStyle = '#c89a62'; ctx.fillRect(x - 9, y - 7, 18, 9); ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 1; ctx.strokeRect(x - 9, y - 7, 18, 9);
    ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#4a2a10'; ctx.fillText(text, x, y);
  }
  function frame(ts) {
    if (!running) return;
    const time = ts / 1000, dt = Math.min(0.05, (ts - (t0 || ts)) / 1000); t0 = ts; now = time;
    const S = hooks.state(), today = hooks.today();
    buildBlocked(S);
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
          if (P.sneak && ch.fleeT > 0.25) { ch.fleeT = 0; if (Math.random() < G.Core.FLEE[ch.sp.r]) { bugFlee(ch); floatText('앗, 날아가 버렸어요!', '#e0e0e0'); } }
        }
        const [tx, ty] = P.path[0], dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy), sp = (P.sneak ? 34 : 90) * dt;
        if (Math.abs(dx) > Math.abs(dy)) P.dir = dx > 0 ? 3 : 2; else if (dy) P.dir = dy > 0 ? 0 : 1;
        if (d <= sp) { P.x = tx; P.y = ty; P.path.shift(); if (!P.path.length) { S.island.pos = [tx / T, ty / T]; hooks.save(); P.sneak = false; const f = P.onArrive; P.onArrive = null; P.chase = null; if (f) f(); } }
        else { P.x += (dx / d) * sp; P.y += (dy / d) * sp; }
        P.anim += dt * (P.sneak ? 4 : 8);
      }
    } else P.anim = 0;
    bugTimer -= dt; if (bugTimer <= 0) { spawnBugs(S, bugs.length === 0); bugTimer = 10 + Math.random() * 8; }
    updateBugs(dt); updateFishing(dt);

    const vw = cv.width / scale, vh = cv.height / scale;
    cam.x = vw >= W * T ? (W * T - vw) / 2 : Math.max(0, Math.min(W * T - vw, P.x + 8 - vw / 2));
    cam.y = vh >= H * T ? (H * T - vh) / 2 : Math.max(-8, Math.min(H * T - vh, P.y + 8 - vh / 2));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#6fd0e6'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, scale, -Math.round(cam.x * scale), -Math.round(cam.y * scale));

    const wx0 = Math.floor(cam.x / T) - 1, wy0 = Math.floor(cam.y / T) - 1, wx1 = Math.ceil((cam.x + vw) / T) + 1, wy1 = Math.ceil((cam.y + vh) / T) + 1;
    for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) tile(ctx, 'water', 1, 7, x * T, y * T);
    const rf = Math.floor(time * 4) % 4;
    for (const [x, y] of [[0, 4], [23, 9], [0, 17], [23, 22], [3, 34], [12, 35], [19, 34], [23, 30], [0, 28]]) ctx.drawImage(IMG.ripple, ((rf + x) % 4) * T, 0, T, T, x * T, y * T, T, T);
    nine('field', 0, 0, SAND, (x, y) => ((x * 7 + y * 3) % 9 === 0 ? [3, 0] : null));
    nine('field', 0, 3, GRASS, (x, y) => grassVar[key(x, y)]);
    nine('water', 0, 6, POND);
    for (const [x, y] of [[16, 5], [19, 7]]) ctx.drawImage(IMG.ripple, ((rf + x) % 4) * T, 0, T, T, x * T, y * T, T, T);

    // 빛나는 땅
    for (const [x, y] of digSpots(today)) {
      const k = key(x, y), cx = x * T + 8, cy = y * T + 9;
      if (hooks.isDug(k)) { ctx.fillStyle = 'rgba(60,35,15,.7)'; ctx.beginPath(); ctx.ellipse(cx, cy, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill(); continue; }
      const p = 0.5 + 0.5 * Math.sin(time * 3 + x);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9); g.addColorStop(0, `rgba(255,240,150,${0.55 + p * 0.3})`); g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 10, cy - 10, 20, 20);
      ctx.strokeStyle = 'rgba(90,60,30,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 3, cy - 2); ctx.lineTo(cx + 3, cy + 2); ctx.moveTo(cx + 3, cy - 2); ctx.lineTo(cx - 3, cy + 2); ctx.stroke();
      if (Math.floor(time * 2 + x) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(cx + 4, cy - 6, 1, 3); ctx.fillRect(cx + 3, cy - 5, 3, 1); }
    }

    const items = [];
    deco.forEach((d) => items.push({ y: d.y * T, draw: () => tile(ctx, 'nature', d.k[0], d.k[1], d.x * T, d.y * T) }));
    items.push({ y: (HOUSE.y + HOUSE.h) * T, draw: () => tile(ctx, 'house', 0, 0, HOUSE.x * T, HOUSE.y * T, 4, 3) });
    items.push({ y: (SHOP.y + SHOP.h) * T, draw: () => tile(ctx, 'house', 16, 0, SHOP.x * T, SHOP.y * T, 3, 3) });
    items.push({ y: (MUSEUM.y + MUSEUM.h) * T, draw: () => tile(ctx, 'house', 23, 0, MUSEUM.x * T, MUSEUM.y * T, 3, 3) });
    FOREST.forEach(([x, y], k) => items.push({ y: y * T + 15, draw: () => tile(ctx, 'nature', 3, 18, x * T - T + Math.sin(time * 1.3 + k) * 0.5, y * T - 2 * T, 3, 3) }));
    PLOTS.forEach(([, y], i) => items.push({ y: y * T + 15, draw: () => drawTree(i, S.island.trees[i], time, today) }));
    bugs.forEach((b) => items.push({ y: b.mode === 'fly' ? b.hy + 8 : b.y + 4, draw: () => drawBug(b, time, night > 0.2) }));
    items.push({ y: P.y + 15.5, draw: () => {
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(P.x + 8, P.y + 15, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
      const row = P.act > 0 ? 4 : P.path.length ? Math.floor(P.anim) % 4 : 0;
      ctx.drawImage(IMG.player, P.dir * T, row * T, T, T, Math.round(P.x), Math.round(P.y) - 2, T, T);
      if (P.sneak) { ctx.font = '6px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('살금…', P.x + 8, P.y - 4); }
    } });
    items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());

    // 잠긴 구역
    if (stars < 2) { fence(2 * T, (BEACH_Y - 1) * T + 8, 22 * T, (BEACH_Y - 1) * T + 8); sign(11 * T, (BEACH_Y - 1) * T + 6, '★2 해변'); }
    if (stars < 3) { fence(FOREST_R.x0 * T - 2, FOREST_R.y0 * T, FOREST_R.x0 * T - 2, (FOREST_R.y1 + 1) * T); fence(FOREST_R.x0 * T - 2, FOREST_R.y0 * T - 6, 22 * T, FOREST_R.y0 * T - 6); sign((FOREST_R.x0 + 1) * T, FOREST_R.y0 * T + 4, '★3 숲'); }

    drawFishing(time);

    ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center';
    label('우리 집', (HOUSE.x + 2) * T, HOUSE.y * T - 2);
    label('상점', (SHOP.x + 1.5) * T, SHOP.y * T - 2);
    label('박물관', (MUSEUM.x + 1.5) * T, MUSEUM.y * T - 2);
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

  G.Island = { init, start, stop, tapWorld, zoomStep, ZOOMS, floatText, splash, pop, dust, sparkle, resize, PLOTS, IMG, ready, player: P,
    _debug: { bugs: () => bugs, fishing: () => fishing, spots: () => spots, spawn: (sp, x, y) => bugs.push({ sp, x, y, hx: x, hy: y, ph: 0, mode: FLY.has(sp.art[0]) ? 'fly' : STILL.has(sp.art[0]) ? 'still' : 'crawl', gone: false, t: 0 }) } };
})(window);
