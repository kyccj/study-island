// icons.js — 물고기·곤충·화석 16×16 픽셀 그림을 코드로 그린다(외곽선·명암 자동).
(function (G) {
  'use strict';
  const N = 16, OUT = '#2b1f1a';
  const grid = () => Array.from({ length: N }, () => Array(N).fill(null));
  const put = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = c; };
  const ell = (g, cx, cy, rx, ry, c, test) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!test || test(x, y))) g[y][x] = c;
    }
  };
  const ring = (g, cx, cy, r, c, w = 0.6) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (Math.abs(d - r) < w && g[y][x]) g[y][x] = c; }
  };
  const rect = (g, x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(g, x, y, c); };
  const tri = (g, a, b, c, col) => {
    const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = [x + 0.5, y + 0.5], d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) g[y][x] = col;
    }
  };
  const line = (g, x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
    for (let i = 0; i <= n; i++) put(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (h, t) => { const [r, gg, b] = hex(h); const f = (v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)); return '#' + [f(r), f(gg), f(b)].map((v) => v.toString(16).padStart(2, '0')).join(''); };
  const where = (g, c, fn) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] === c && fn(x, y)) g[y][x] = null; };
  // 같은 색 픽셀에만 무늬 칠하기
  const paint = (g, onColor, fn, c) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] === onColor && fn(x, y)) g[y][x] = c; };

  // 명암: 위가 빈 픽셀은 밝게, 아래가 빈 픽셀은 어둡게
  function shade(g, keep) {
    const o = g.map((r) => r.slice());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = g[y][x]; if (!c || keep.has(c)) continue;
      if (y === 0 || !g[y - 1][x]) o[y][x] = mix(c, 0.28);
      else if (y === N - 1 || !g[y + 1][x]) o[y][x] = mix(c, -0.25);
    }
    return o;
  }
  function outline(g) {
    const o = g.map((r) => r.slice());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx])) o[y][x] = OUT;
    }
    return o;
  }

  const EYE = '#151018', WHITE = '#ffffff', SLAB = '#9c9282';
  // 무늬(물고기·곤충 공통): 몸색 픽셀에만
  function pattern(g, body, acc, kind) {
    if (kind === 'stripe') paint(g, body, (x, y) => y === 8 && x > 2 && x < 12, acc);
    if (kind === 'bars') paint(g, body, (x) => x === 6 || x === 9, acc);
    if (kind === 'spots') paint(g, body, (x, y) => (x * 3 + y * 5) % 7 === 0, acc);
    if (kind === 'belly') paint(g, body, (x, y) => y >= 10, acc);
    if (kind === 'waves') paint(g, body, (x, y) => y === 6 + (x % 3 === 0 ? 1 : 0) || y === 7 + (x % 3 === 1 ? 1 : 0) && y < 8, acc);
    if (kind === 'plates') paint(g, body, (x, y) => y === 7 && x % 2 === 0, acc);
    if (kind === 'dots') paint(g, body, (x, y) => (x * 5 + y * 3) % 9 === 0, acc);
    if (kind === 'edge') { const o = g.map((r) => r.slice()); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] === body && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !(g[y + dy] && g[y + dy][x + dx]))) o[y][x] = acc; o.forEach((r, i) => (g[i] = r)); }
    if (kind === 'shine') paint(g, body, (x, y) => (x + y) % 6 === 0 && y < 9, acc);
  }

  // ───────── 물고기 (왼쪽을 봄) ─────────
  function fish(shape, body, acc, pat) {
    const g = grid(), fin = mix(body, -0.2);
    const tail = (y0 = 8.5, h = 3.5) => tri(g, [12, y0], [15.8, y0 - h], [15.8, y0 + h], fin);
    if (shape === 'fish') { tail(); tri(g, [5.5, 6], [10.5, 6], [9, 3.2], fin); ell(g, 7.5, 8.5, 5.6, 3.3, body); }
    if (shape === 'slim') { tail(8.5, 3); tri(g, [6, 7], [10, 7], [9, 5], fin); ell(g, 7.5, 8.5, 6.2, 2.3, body); }
    if (shape === 'deep') { tail(8.5, 3.2); tri(g, [5, 5], [11, 5], [9, 2], fin); tri(g, [6, 12], [10, 12], [9, 14.5], fin); ell(g, 7.5, 8.5, 5.2, 4.3, body); }
    if (shape === 'long') { tail(8.5, 2.2); ell(g, 7.8, 8.5, 7, 1.8, body); }
    if (shape === 'eel') { ell(g, 8, 8.5, 7.8, 1.5, body); paint(g, body, (x, y) => y === 7 && x > 4, fin); }
    if (shape === 'flat') { ell(g, 8, 8.5, 7, 5, fin); ell(g, 8, 8.5, 5.8, 4, body); }
    if (shape === 'puffer') { tail(8.5, 2.5); ell(g, 7.5, 8.5, 5.2, 5.2, body); for (const [x, y] of [[3, 4], [7, 2], [11, 4], [2, 9], [12, 12], [7, 14]]) put(g, x, y, fin); }
    if (shape === 'shark') { tri(g, [12.5, 9], [15.8, 3.5], [14.5, 9], fin); tri(g, [12.5, 9], [15.8, 13.5], [14.5, 9], fin); tri(g, [6.5, 7], [10, 7], [9, 2], fin); ell(g, 7.2, 9, 6.8, 2.7, body); }
    if (shape === 'sunfish') { tri(g, [6.5, 5], [10, 5], [9, 0.5], fin); tri(g, [6.5, 12], [10, 12], [9, 15.8], fin); ell(g, 8, 8.5, 5.5, 5, body); paint(g, body, (x) => x >= 12, fin); }
    if (shape === 'squid') {
      for (let k = 0; k < 5; k++) line(g, 5 + k * 1.5, 10, 4.5 + k * 1.7, 15, mix(body, -0.1));
      tri(g, [8, 0.5], [3.5, 9], [12.5, 9], body); ell(g, 8, 8, 4.3, 3, body); put(g, 6, 9, EYE); put(g, 10, 9, EYE);
      paint(g, body, (x, y) => (x + y) % 4 === 0 && y < 8, acc); return finish(g, [EYE]);
    }
    if (shape === 'octo') {
      for (let k = 0; k < 5; k++) { line(g, 4 + k * 2, 9, 2.5 + k * 2.7, 14, body); put(g, 2.5 + k * 2.7, 15, body); }
      ell(g, 8, 6, 4.8, 4.8, body); put(g, 6, 7, EYE); put(g, 10, 7, EYE);
      paint(g, body, (x, y) => (x * 2 + y) % 5 === 0 && y < 6, acc); return finish(g, [EYE]);
    }
    pattern(g, body, acc, pat);
    if (pat === 'whisker') { line(g, 2, 9, 0, 11, acc); line(g, 2, 8, 0, 7, acc); }
    if (shape === 'flat') { put(g, 6, 6, EYE); put(g, 8, 5, EYE); }
    else { put(g, shape === 'shark' ? 3 : 4, shape === 'long' || shape === 'eel' ? 8 : 7, EYE); }
    return finish(g, [EYE]);
  }

  // ───────── 곤충 (위에서 봄) ─────────
  function bug(shape, body, acc, pat) {
    const g = grid(), dark = '#2a2420', leg = mix(body, -0.45);
    const legs = (y0, y1) => { for (const y of [y0, (y0 + y1) / 2, y1]) { line(g, 5, y, 2, y + 1.5, leg); line(g, 11, y, 14, y + 1.5, leg); } };
    if (shape === 'butterfly' || shape === 'moth') {
      if (shape === 'butterfly') {
        ell(g, 4.2, 5, 4, 3.4, body); ell(g, 11.8, 5, 4, 3.4, body); ell(g, 5.3, 11.4, 2.5, 2.9, body); ell(g, 10.7, 11.4, 2.5, 2.9, body);
        where(g, body, (x, y) => y === 8 && (x < 6 || x > 9)); // 위·아래 날개 사이 틈
        where(g, body, (x, y) => y >= 13 && (x < 4 || x > 11));
      }
      else { tri(g, [7.5, 4], [0.5, 3], [3, 12.5], body); tri(g, [8.5, 4], [15.5, 3], [13, 12.5], body); }
      pattern(g, body, acc, pat);
      rect(g, 7, 3, 2, 11, dark); line(g, 7, 3, 5, 0, dark); line(g, 8, 3, 10, 0, dark);
      return finish(g, [dark]);
    }
    if (shape === 'beetle' || shape === 'stag' || shape === 'rhino' || shape === 'firefly') {
      legs(6, 12);
      ell(g, 8, 9.5, shape === 'firefly' ? 3 : 4.2, shape === 'firefly' ? 4.5 : 5.2, body);
      pattern(g, body, acc, pat);
      paint(g, body, (x, y) => (x === 7 || x === 8) && y > 5 && y < 14 && x === 8, mix(body, -0.3));
      ell(g, 8, 4, 2.4, 1.8, mix(body, -0.25));
      if (shape === 'stag') { line(g, 7, 3, 5, 0, leg); line(g, 5, 0, 6.5, 1, leg); line(g, 9, 3, 11, 0, leg); line(g, 11, 0, 9.5, 1, leg); }
      if (shape === 'rhino') { line(g, 8, 3, 8, 0, leg); put(g, 7, 0, leg); put(g, 9, 0, leg); }
      if (shape === 'firefly') ell(g, 8, 13, 2.6, 2, acc);
      return finish(g, [acc, leg]);
    }
    if (shape === 'lady') { legs(6, 12); ell(g, 8, 9.5, 5, 5, body); line(g, 8, 6, 8, 14, EYE); for (const [x, y] of [[5, 8], [10, 8], [6, 11], [10, 12], [5, 12]]) put(g, x, y, EYE); ell(g, 8, 4, 2.6, 1.7, EYE); return finish(g, [EYE]); }
    if (shape === 'bee') { ell(g, 4.5, 6, 2.6, 2, '#e8f4ff'); ell(g, 11.5, 6, 2.6, 2, '#e8f4ff'); ell(g, 8, 9.5, 3.6, 4.6, body); paint(g, body, (x, y) => y % 3 === 0, acc); ell(g, 8, 4, 2.2, 1.7, acc); return finish(g, [acc, '#e8f4ff']); }
    if (shape === 'dragon') {
      const wing = acc;
      ell(g, 4, 5.5, 4, 1.3, wing); ell(g, 12, 5.5, 4, 1.3, wing); ell(g, 4.3, 8.3, 3.6, 1.2, wing); ell(g, 11.7, 8.3, 3.6, 1.2, wing);
      rect(g, 7, 3, 2, 13, body); ell(g, 8, 2.5, 2.3, 1.7, body); if (pat === 'stripe') paint(g, body, (x, y) => y % 2 === 0 && y > 4, acc === '#f0e040' ? '#f0e040' : mix(body, 0.4));
      return finish(g, [wing]);
    }
    if (shape === 'cicada') { tri(g, [7, 5], [1.5, 14], [7, 13.5], acc); tri(g, [9, 5], [14.5, 14], [9, 13.5], acc); ell(g, 8, 8, 3, 5, body); ell(g, 8, 3.5, 3.2, 1.7, mix(body, -0.2)); put(g, 5, 3, EYE); put(g, 11, 3, EYE); return finish(g, [acc, EYE]); }
    if (shape === 'hopper') {
      const L = pat === 'long' ? 1.4 : 1;
      line(g, 10, 9, 13, 4.5, leg); line(g, 13, 4.5, 15, 12, leg); line(g, 6, 10, 5, 13, leg); line(g, 8, 10, 8, 13, leg);
      ell(g, 8.5, 9, 6 * L > 7 ? 7 : 6 * L, 2.2, body); ell(g, 3, 8, 2.1, 2.1, mix(body, -0.1)); line(g, 2, 7, 0, 2, leg); put(g, 2, 8, EYE);
      pattern(g, body, acc, 'stripe'); return finish(g, [EYE, leg]);
    }
    if (shape === 'mantis') { line(g, 4, 9, 14, 11, body); line(g, 4, 10, 14, 12, body); tri(g, [1, 6], [5, 6], [3, 9], body); line(g, 5, 9, 3, 5, acc); line(g, 3, 5, 5, 11, acc); line(g, 9, 11, 8, 15, leg); line(g, 12, 12, 13, 15, leg); ell(g, 11, 9.5, 3.5, 1.8, mix(body, 0.15)); put(g, 2, 7, EYE); return finish(g, [EYE, leg]); }
    if (shape === 'ant') { legs(6, 9); ell(g, 8, 3, 1.9, 1.9, body); ell(g, 8, 7, 1.6, 2.1, body); ell(g, 8, 12, 2.9, 3.5, acc === '#5a3a2a' ? body : acc); line(g, 7, 2, 5, 0, body); line(g, 9, 2, 11, 0, body); return finish(g, []); }
    if (shape === 'spider') { for (const y of [5, 7, 9, 11]) { line(g, 6, 8, 1, y - 2, body); line(g, 10, 8, 15, y - 2, body); } ell(g, 8, 9.5, 3.8, 3.8, body); ell(g, 8, 5, 2.1, 1.8, body); paint(g, body, (x, y) => (x === 7 || x === 9) && y === 10, acc); return finish(g, []); }
    if (shape === 'snail') { rect(g, 1, 11, 14, 3, acc); line(g, 3, 11, 2, 7, acc); line(g, 4, 11, 4, 7, acc); ell(g, 9.5, 7.5, 4.8, 4.8, body); ring(g, 9.5, 7.5, 3, mix(body, -0.3)); ring(g, 9.5, 7.5, 1.4, mix(body, -0.3)); return finish(g, []); }
    if (shape === 'strider') { for (const [a, b] of [[0, 2], [16, 2], [0, 14], [16, 14], [1, 8], [15, 8]]) line(g, 8, 8, a, b, leg); ell(g, 8, 8, 1.3, 4, body); return finish(g, [leg]); }
    return finish(g, []);
  }

  // ───────── 화석 ─────────
  function fossil(shape, col) {
    const g = grid(), dk = mix(col, -0.35), slab = () => ell(g, 8, 8.5, 7.4, 6.8, SLAB);
    if (shape === 'ammonite') { ell(g, 8, 8, 6.5, 6.5, col); ring(g, 8, 8, 4.4, dk); ring(g, 8, 8, 2.3, dk); put(g, 8, 8, dk); for (let a = 0; a < 6.28; a += 0.7) put(g, 8 + Math.cos(a) * 5.6, 8 + Math.sin(a) * 5.6, dk); }
    if (shape === 'trilobite') { ell(g, 8, 8.5, 4.8, 6.8, col); paint(g, col, (x, y) => y % 2 === 0 && y > 4, dk); paint(g, dk, (x) => x === 7 || x === 8, col); ell(g, 8, 3, 4.8, 2, mix(col, 0.15)); put(g, 6, 3, dk); put(g, 10, 3, dk); }
    if (shape === 'fern') { slab(); line(g, 8, 14, 8, 3, dk); for (let y = 4; y < 14; y += 2) { line(g, 8, y, 5, y - 1.5, mix(col, -0.2)); line(g, 8, y, 11, y - 1.5, mix(col, -0.2)); } }
    if (shape === 'shell') { ell(g, 8, 11, 6.5, 6, col, (x, y) => y <= 11); for (let k = -3; k <= 3; k++) line(g, 8, 12, 8 + k * 2, 6 - Math.abs(k) * 0.3, dk); rect(g, 6, 11, 5, 3, mix(col, -0.15)); }
    if (shape === 'tooth') { rect(g, 4, 2, 8, 3, mix(col, -0.3)); tri(g, [3.5, 4.5], [12.5, 4.5], [8, 15], col); paint(g, col, (x, y) => (x === 4 || x === 11) && y > 5 && y % 2 === 0, dk); }
    if (shape === 'foot') { slab(); ell(g, 8, 10.5, 2.4, 2.4, dk); ell(g, 4.5, 6, 1.3, 2.4, dk); ell(g, 8, 4.8, 1.3, 2.6, dk); ell(g, 11.5, 6, 1.3, 2.4, dk); }
    if (shape === 'egg') { ell(g, 8, 8.5, 4.8, 6.4, col); line(g, 5, 8, 7, 10, dk); line(g, 7, 10, 9, 8, dk); line(g, 9, 8, 11, 10, dk); paint(g, col, (x, y) => (x * 7 + y * 3) % 11 === 0, mix(col, -0.15)); }
    if (shape === 'jelly') { slab(); ell(g, 8, 6.5, 4.3, 3, mix(col, -0.2), (x, y) => y <= 7); for (let k = 0; k < 4; k++) line(g, 5 + k * 2, 8, 4.5 + k * 2.3, 13, mix(col, -0.25)); }
    if (shape === 'amber') { ell(g, 8, 8.5, 5.8, 6.6, col); paint(g, col, (x, y) => x + y < 10, mix(col, 0.25)); ell(g, 8.5, 9, 1.4, 2, '#3a2010'); put(g, 7, 8, '#3a2010'); put(g, 10, 8, '#3a2010'); put(g, 5, 5, WHITE); }
    if (shape === 'tusk') { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 15, y + 0.5 - 15); if (d > 8 + (x / 16) * 2 && d < 12 && x < 15 && y < 15) g[y][x] = col; } paint(g, col, (x, y) => (x + y) % 5 === 0, mix(col, -0.12)); }
    if (shape === 'skull') { ell(g, 8, 7, 6, 5, col); rect(g, 4, 10, 8, 4, col); ell(g, 5.6, 7.2, 1.6, 1.6, dk); ell(g, 10.4, 7.2, 1.6, 1.6, dk); put(g, 8, 10, dk); for (let x = 5; x <= 10; x += 2) put(g, x, 13, dk); }
    if (shape === 'horn') { tri(g, [3, 15], [10, 15], [12.5, 0.5], col); paint(g, col, (x, y) => y >= 13, mix(col, -0.25)); paint(g, col, (x, y) => y % 3 === 0 && y < 13, mix(col, -0.1)); }
    if (shape === 'plate') { tri(g, [8, 0.5], [1.5, 10], [14.5, 10], col); tri(g, [1.5, 10], [14.5, 10], [8, 15.5], mix(col, -0.1)); line(g, 8, 2, 8, 14, dk); line(g, 4, 9, 8, 5, dk); line(g, 12, 9, 8, 5, dk); }
    if (shape === 'bone') { rect(g, 4, 6, 8, 4, col); for (const [x, y] of [[3.5, 6], [3.5, 10], [12.5, 6], [12.5, 10]]) ell(g, x, y, 2.2, 2.2, col); }
    if (shape === 'claw') { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 2, y + 0.5 - 14); if (d > 6 + (x / 16) * 4 && d < 11.5 - (x / 16) * 2 && x > 2 && y < 14) g[y][x] = col; } rect(g, 1, 11, 5, 4, mix(col, -0.2)); }
    if (shape === 'feather') { slab(); line(g, 4, 13, 12, 3, dk); for (let k = 1; k < 8; k++) { const x = 4 + k, y = 13 - k * 1.25; line(g, x, y, x - 2, y - 1, mix(col, -0.2)); line(g, x, y, x + 1, y + 2, mix(col, -0.2)); } }
    if (shape === 'wing') { tri(g, [2, 12], [14, 3], [12, 14], mix(col, 0.1)); line(g, 2, 12, 8, 6, dk); line(g, 8, 6, 14, 3, dk); line(g, 8, 6, 12, 14, dk); line(g, 8, 6, 15, 9, dk); }
    return finish(g, [dk, '#3a2010', WHITE]);
  }

  function finish(g, keepList) { return outline(shade(g, new Set([EYE, OUT, ...keepList]))); }

  // ───────── 캐시와 내보내기 ─────────
  const cache = {};
  function canvasFor(sp) {
    if (cache[sp.id]) return cache[sp.id];
    const [shape, a, b, pat] = sp.art;
    const g = sp.cat === 'fish' ? fish(shape, a, b, pat) : sp.cat === 'bug' ? bug(shape, a, b, pat) : fossil(shape, a);
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const x = c.getContext('2d');
    g.forEach((row, y) => row.forEach((col, xx) => { if (col) { x.fillStyle = col; x.fillRect(xx, y, 1, 1); } }));
    c._url = null;
    return (cache[sp.id] = c);
  }
  function url(sp) { const c = canvasFor(sp); return c._url || (c._url = c.toDataURL()); }
  G.Icons = { canvasFor, url, _grid: { fish, bug, fossil } };
})(window);
