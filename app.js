// app.js — 화면. 규칙은 core.js(Core), 섬 그림은 island.js(Island).
(function () {
  'use strict';
  const C = window.Core;
  const KEY = 'studyRPG.v1';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ───────── 저장 ─────────
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v) {
        const d = C.defaultState();
        const st = { ...d, created: Date.now(), ...s, player: { ...d.player, ...s.player }, settings: { ...d.settings, ...s.settings } };
        const di = C.defaultIsland(), si = s.island || {};
        st.island = { ...di, ...si, dex: { ...di.dex, ...(si.dex || {}) }, bag: { ...di.bag, ...(si.bag || {}) } };
        st.items = { rest: 0, ...(s.items || {}) };
        delete st.player.level; delete st.player.xp; delete st.equip; delete st.owned;
        st.player.hp = Math.min(st.player.hp, C.maxHp(st));
        return st;
      }
    } catch (e) { /* 깨진 저장은 새로 시작 */ }
    return C.defaultState();
  }
  let S = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(S));
  // 테스트용: 주소 끝에 ?date=2026-11-29 를 붙이면 그 날짜로 동작
  const fakeDate = new URLSearchParams(location.search).get('date');
  const today = () => fakeDate || C.gameDate();
  // 잡초 기록 시작점: 처음이거나 3단계 이전 저장이면 오늘부터 깨끗한 섬
  if (!S.island.cleanFrom && !S.island.litter.length && !S.island.newLitter.length) S.island.cleanFrom = today();
  let tab = 'island';
  let overlay = null; // { kind:'vocab'|'timer', ... }

  // ───────── 알림 ─────────
  function toast(msgs) {
    if (!msgs || !msgs.length) return;
    const box = $('#toasts');
    for (const m of [].concat(msgs)) {
      const el = document.createElement('div');
      el.className = 'toast'; el.textContent = m;
      box.appendChild(el);
      setTimeout(() => el.classList.add('out'), 2600);
      setTimeout(() => el.remove(), 3100);
    }
  }
  function modal(title, lines, btn = '확인') {
    $('#modal').innerHTML = `<div class="modal-card"><h3>${esc(title)}</h3>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
      <button class="btn primary" data-act="closeModal">${esc(btn)}</button></div>`;
    $('#modal').hidden = false;
  }

  // 진행 → 저장 → 올클리어 확인 → 다시 그림
  function after(d, msgs = []) {
    msgs = msgs.concat(C.checkAllClear(S, d));
    save(); toast(msgs); render(); arrivals();
  }

  // ───────── 머리: 캐릭터 요약 ─────────
  function header() {
    const p = S.player, mx = C.maxHp(S);
    return `<div class="hud">
      <div class="hp-wrap"><img src="assets/heart.png" class="px hp-ic"><div class="bar hp"><i style="width:${Math.max(0, (p.hp / mx) * 100)}%"></i><em>${p.hp} / ${mx}</em></div></div>
      <div class="chip"><img src="assets/coin.png" class="px coin-ic">${p.coins}</div>
      <div class="chip">🔥${p.streak}</div></div>`;
  }

  // ───────── 오늘 탭 ─────────
  function todayView() {
    const d = today(), wd = C.weekday(d), r = C.dayRec(S, d);
    const qs = C.questsFor(d);
    const req = qs.filter((q) => q.required);
    const doneN = req.filter((q) => C.isComplete(q.id, r.q[q.id])).length;
    let html = `<div class="day-title"><h2>${d.slice(5).replace('-', '/')} (${C.WD[wd]})</h2>
      <span class="pill ${r.allClear ? 'ok' : ''}">${r.rest ? '휴식 중' : `${doneN}/${req.length} 완료`}</span></div>`;

    const since = S.lastBackup || S.created;
    if (Date.now() - since > 7 * 864e5) html += `<div class="banner">💾 ${S.lastBackup ? '백업한 지 일주일이 넘었어요.' : '아직 백업을 안 했어요.'} <button class="btn sm" data-act="exportBackup">지금 백업</button></div>`;

    const restOk = S.items.rest > 0 && S.lastRestWeek !== C.weekStart(d) && !r.rest && !r.allClear;
    if (restOk) html += `<button class="btn wide ghost" data-act="useRest">🛌 오늘 휴식권 쓰기 (남은 ${S.items.rest}장)</button>`;

    html += qs.map((q) => questCard(d, q, r)).join('');

    const due = C.dueWrong(S, d);
    if (due.length) html += wrongCard(d, due);

    const mk = C.makeupList(S, d);
    if (mk.length) {
      html += `<div class="card makeup"><h3>🩹 일요일 보충</h3><p class="muted">이번 주에 놓친 퀘스트를 하면 HP +10 환급, 보상 1.5배</p>
        ${mk.map((m) => `<div class="row"><span>${m.icon} ${C.WD[C.weekday(m.date)]} · ${esc(m.title)}</span>
          <button class="btn sm" data-act="makeup" data-date="${m.date}" data-id="${m.id}">보충</button></div>`).join('')}</div>`;
    }
    return html;
  }

  function questCard(d, q, r) {
    const rec = r.q[q.id] || {};
    const done = C.isComplete(q.id, rec);
    const GAIN = { vocab: '+30', toeicSet: '각 +20', toeicReview: '+15', lecture: '+30', gichul: '세트 +20', strength: '동작 +5', weight: '+5', church: '+15' };
    const head = `<div class="q-head"><span class="q-icon">${q.icon}</span><h3>${esc(q.title)}</h3>${done ? '<span class="check">✓</span>' : `<span class="gain">❤️ ${GAIN[q.id]}</span>`}</div>`;
    let body = '';
    switch (q.id) {
      case 'vocab': {
        const days = C.todayVocabDays(S);
        const sess = rec.session;
        const sample = S.vocab.cards.some((c) => c.sample);
        body = done
          ? `<p class="muted">정답률 ${Math.round(rec.acc * 100)}% · ${rec.n}단어</p>`
          : `<p class="muted">Day ${days.join(' · ')} + 복습${sample ? ' · <b>예시 단어</b> (설정에서 단어장 넣기)' : ''}</p>
             <button class="btn primary" data-act="openVocab">${sess ? `이어서 하기 (남은 ${sess.queue.length})` : '시작'}</button>`;
        break;
      }
      case 'toeicSet':
        body = ['rc', 'lc'].map((k) => rec[k]
          ? `<div class="row"><span>${k.toUpperCase()} ✓</span><span class="muted">${rec[k].score != null ? `${rec[k].score}/100` : ''}</span></div>`
          : `<div class="row"><span>${k.toUpperCase()}</span><input type="number" inputmode="numeric" min="0" max="100" placeholder="맞은 수" id="score-${k}">
             <button class="btn sm" data-act="toeicPart" data-k="${k}">완료</button></div>`).join('');
        break;
      case 'toeicReview':
        body = done ? '' : `<button class="btn primary" data-act="simpleDone" data-id="toeicReview">오답 정리 완료</button>`;
        break;
      case 'lecture': {
        const n = S.lecture.next;
        body = done
          ? `<p class="muted">${esc(rec.name)} · 집중 깨짐 ${rec.breaks}회</p>`
          : `<p class="muted">다음: <b>${C.lectureName(n)}</b> · ${S.settings.lectureMin}분 · 노트북으로 듣고 폰은 잠가 두기</p>
             <button class="btn primary" data-act="openTimer">집중 타이머 시작</button>`;
        break;
      }
      case 'gichul': {
        const sets = rec.sets || 0;
        body = `<div class="sets">${[1, 2, 3].map((i) => `<span class="set ${i <= sets ? 'on' : ''}">${i}세트${i === 1 ? ' (필수)' : ''}</span>`).join('')}</div>`;
        if (sets < 3) body += gichulForm(q.subject, 'gichulSet');
        else body += `<p class="muted">🏆 1년치 정복!</p>`;
        break;
      }
      case 'strength': {
        const st = S.strength, items = st.mode === 'gym' ? st.gym.map((n) => ({ name: n, reps: '10회' })) : st.home;
        const prog = rec.items || {};
        body = `<div class="seg"><button class="${st.mode === 'home' ? 'on' : ''}" data-act="strengthMode" data-m="home">집</button>
          <button class="${st.mode === 'gym' ? 'on' : ''}" data-act="strengthMode" data-m="gym">헬스장</button></div>
          ${items.map((it) => {
            const n = prog[it.name] || 0;
            return `<div class="row"><span>${esc(it.name)} <small class="muted">${esc(it.reps)}×3</small></span>
              <span class="dots">${[1, 2, 3].map((i) => `<button class="dot ${i <= n ? 'on' : ''}" data-act="strengthSet" data-name="${esc(it.name)}" ${n >= 3 ? 'disabled' : ''}>${i}</button>`).join('')}</span></div>`;
          }).join('')}`;
        break;
      }
      case 'weight':
        body = done ? `<p class="muted">${rec.kg} kg</p>`
          : `<div class="row"><input type="number" step="0.1" inputmode="decimal" placeholder="kg" id="kg"><button class="btn sm" data-act="weight">기록</button></div>`;
        break;
      case 'church':
        body = done ? `<p class="muted">HP +${C.CHURCH_HP} 받았어요</p>`
          : `<p class="muted">안 가도 벌칙 없음</p><button class="btn" data-act="church">교회 다녀왔어요 (HP +${C.CHURCH_HP})</button>`;
        break;
    }
    return `<div class="card ${done ? 'done' : ''}">${head}${body}</div>`;
  }

  function gichulForm(subject, act, extra = '') {
    const { yearFrom, yearTo } = S.settings;
    const done = S.gichul.done[subject] || {};
    let next = null;
    for (let y = yearTo; y >= yearFrom && !next; y--) for (let k = 1; k <= 3; k++) if (!done[`${y}-${k}`]) { next = [y, k]; break; }
    next = next || [yearTo, 1];
    const years = []; for (let y = yearTo; y >= yearFrom; y--) years.push(y);
    return `<div class="form">
      <div class="row"><select id="g-year">${years.map((y) => `<option ${y === next[0] ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select id="g-round">${[1, 2, 3].map((k) => `<option value="${k}" ${k === next[1] ? 'selected' : ''}>${k}회</option>`).join('')}</select></div>
      <input id="g-wrong" placeholder="틀린 문제 번호 (예: 3, 7, 15) — 없으면 비우기" inputmode="text">
      <button class="btn primary" data-act="${act}" data-subject="${esc(subject)}" ${extra}>20문제 세트 완료</button></div>`;
  }

  function wrongCard(d, due) {
    return `<div class="card"><div class="q-head"><span class="q-icon">🎯</span><h3>기출 오답 다시 풀기 (${due.length})</h3></div>
      <p class="muted">종이로 다시 풀고 맞았는지 체크. 1→3→7일 뒤에 다시 나오고, 세 번 맞히면 정복.</p>
      ${due.map((w) => `<div class="row"><span>${esc(w.subject)} ${w.year}-${w.round}회 <b>${w.num}번</b> <small class="muted">${w.stage + 1}/3</small></span>
        <span><button class="btn sm ok" data-act="wrongRes" data-id="${w.id}" data-ok="1">맞음</button>
        <button class="btn sm bad" data-act="wrongRes" data-id="${w.id}" data-ok="0">틀림</button></span></div>`).join('')}</div>`;
  }

  // ───────── 가방 탭 ─────────
  function bagView() {
    const I = S.island;
    const fruits = Object.entries(C.FRUITS);
    let html = `<div class="card"><h3>🍒 과일</h3><p class="muted">먹으면 HP, 팔면 코인</p><div class="grid">`;
    const have = fruits.filter(([k]) => I.fruit[k] > 0);
    html += have.length ? have.map(([k, f]) => `<div class="slot">
        <img src="assets/fruit-${k}.png" class="px icon"><b class="cnt">${I.fruit[k]}</b>
        <div class="slot-name">${f.name}</div>
        <div class="slot-btns"><button class="btn xs" data-act="eat" data-k="${k}">먹기 +${f.hp}❤️</button>
        <button class="btn xs gold" data-act="sell" data-k="${k}">팔기 ${f.sell}</button></div></div>`).join('')
      : '<p class="muted">아직 과일이 없어요. 과수원에 씨앗을 심어 보세요!</p>';
    html += `</div>${have.length ? '<button class="btn wide gold" data-act="sellAll">과일 전부 팔기</button>' : ''}</div>`;
    html += `<div class="card"><h3>🌱 씨앗</h3><div class="grid">${fruits.map(([k, f]) => `<div class="slot ${I.seeds[k] ? '' : 'dim'}">
        <img src="assets/fruit-${k}.png" class="px icon"><b class="cnt">${I.seeds[k] || 0}</b><div class="slot-name">${f.name} 씨앗</div></div>`).join('')}</div></div>`;
    const sec = (title, cat, list, eat) => {
      const have = Object.entries(I.bag[cat] || {}).filter(([, n]) => n > 0);
      if (!have.length) return '';
      return `<div class="card"><h3>${title}</h3><div class="grid">${have.map(([id, n]) => {
        const sp = cat === 'ore' ? D.ORES[id] : cat === 'mush' ? D.MUSH[id] : D.BY_ID[id];
        const img = cat === 'ore' ? `assets/${sp.icon}.png` : cat === 'mush' ? `assets/a/mush_${id}.png` : iconOf(sp);
        return `<div class="slot ${cat !== 'ore' ? 'r' + sp.r : ''}"><img src="${img}" class="px icon"><b class="cnt">${n}</b><div class="slot-name">${esc(sp.name)}</div>
          <div class="slot-btns">${eat ? `<button class="btn xs" data-act="eatFish" data-id="${id}">먹기 +${sp.hp}❤️</button>` : ''}
          <button class="btn xs gold" data-act="sellItem" data-cat="${cat}" data-id="${id}">팔기 ${sp.sell}</button></div></div>`;
      }).join('')}</div><button class="btn wide gold" data-act="sellCat" data-cat="${cat}">전부 팔기</button></div>`;
    };
    html += sec('🐟 물고기', 'fish', D.FISH, true) + sec('🦋 곤충', 'bug', D.BUGS) + sec('🦴 화석', 'fossil', D.FOSSILS) + sec('🍄 버섯', 'mush') + sec('💎 광물', 'ore');
    if (!['fish', 'bug', 'fossil', 'ore', 'mush'].some((c) => Object.keys(I.bag[c] || {}).length)) html += `<div class="card"><p class="muted">연못에서 낚시, 꽃밭에서 곤충 잡기, 반짝이는 땅 파기로 채워 보세요!</p></div>`;
    return html;
  }

  // ───────── 기록 탭 ─────────
  function statsView() {
    const d = today();
    let html = '';
    // 최근 14일
    const cells = [];
    for (let i = 13; i >= 0; i--) {
      const x = C.addDays(d, -i), r = S.days[x];
      const cls = !r ? '' : r.rest ? 'rest' : r.allClear ? 'ok' : (r.missed || []).length ? 'bad' : '';
      cells.push(`<div class="cal ${cls}"><small>${C.WD[C.weekday(x)]}</small>${+x.slice(8)}</div>`);
    }
    html += `<div class="card"><h3>최근 2주</h3><div class="cals">${cells.join('')}</div>
      <p class="muted"><span class="lg-ok">■</span> 올클리어 <span class="lg-bad">■</span> 놓친 날 <span class="lg-rest">■</span> 휴식</p></div>`;

    const cards = S.vocab.cards, box = [0, 0, 0, 0, 0, 0];
    cards.forEach((c) => box[c.box]++);
    html += `<div class="card"><h3>📖 영단어</h3><p>${cards.length}단어 · 다음 Day ${C.todayVocabDays(S).join('·')}</p>
      <div class="boxes">${['새 단어', '1일', '3일', '7일', '14일', '30일'].map((l, i) => `<div><b>${box[i]}</b><small>${l}</small></div>`).join('')}</div></div>`;

    const ln = Math.min(S.lecture.next - 1, 30);
    html += `<div class="card"><h3>🎧 토익 강의</h3><div class="bar xp"><i style="width:${(ln / 30) * 100}%"></i><em>${ln}/30강</em></div>
      <p class="muted">RC ${Math.min(ln, 15)}/15 · LC ${Math.max(0, ln - 15)}/15</p></div>`;

    const recs = S.toeic.records.slice(-8).reverse();
    html += `<div class="card"><h3>📝 토익 세트 (맞은 수/100)</h3>${recs.length ? recs.map((r) => `<div class="row"><span>${r.date}</span><span>${r.part.toUpperCase()} ${r.score ?? '-'}</span></div>`).join('') : '<p class="muted">아직 기록 없음</p>'}</div>`;

    const { yearFrom, yearTo } = S.settings;
    const ws = S.gichul.wrong, active = ws.filter((w) => !w.done).length;
    html += `<div class="card"><h3>⚡ 전기기사 기출 진도</h3><p class="muted">남은 오답 ${active} · 정복 ${ws.length - active}</p>`;
    for (const sub of C.SUBJECTS) {
      const done = S.gichul.done[sub] || {};
      let rows = '';
      for (let y = yearTo; y >= yearFrom; y--) rows += `<div class="yr"><small>${String(y).slice(2)}</small>${[1, 2, 3].map((k) => `<i class="${done[`${y}-${k}`] ? 'on' : ''}"></i>`).join('')}</div>`;
      const n = Object.keys(done).length;
      html += `<h4>${esc(sub)} <small class="muted">${n}세트</small></h4><div class="years">${rows}</div>`;
    }
    html += `</div>`;

    html += `<div class="card"><h3>⚖️ 몸무게</h3>${weightChart()}</div>`;
    return html;
  }

  function weightChart() {
    const w = S.weights.slice(-20);
    if (w.length < 2) return w.length ? `<p>${w[0].date} · ${w[0].kg} kg</p>` : '<p class="muted">월요일마다 기록하면 여기에 그래프가 생겨요</p>';
    const kg = w.map((x) => x.kg), lo = Math.min(...kg) - 0.5, hi = Math.max(...kg) + 0.5;
    const W = 300, H = 120, X = (i) => 10 + (i * (W - 20)) / (w.length - 1), Y = (v) => H - 15 - ((v - lo) / (hi - lo)) * (H - 30);
    const pts = w.map((x, i) => `${X(i)},${Y(x.kg)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>
      ${w.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.kg)}" r="3" fill="var(--accent)"/>`).join('')}
      <text x="${X(0)}" y="${H - 2}" class="ax">${w[0].date.slice(5)}</text><text x="${X(w.length - 1)}" y="${H - 2}" text-anchor="end" class="ax">${w[w.length - 1].date.slice(5)}</text>
      <text x="${X(w.length - 1)}" y="${Y(kg[kg.length - 1]) - 8}" text-anchor="end" class="ax">${kg[kg.length - 1]}kg</text></svg>`;
  }

  // ───────── 설정 탭 ─────────
  function settingsView() {
    const st = S.strength, s = S.settings;
    return `<div class="card"><h3>📖 단어장 넣기</h3>
      <p class="muted">한 줄에 한 단어. <code>Day 3</code> 줄이 Day를 바꿔요.<br><code>implement - 시행하다, 실행하다</code> (하이픈, 탭, 콜론 모두 됨)</p>
      <textarea id="vocab-in" rows="7" placeholder="Day 1&#10;implement - 시행하다, 실행하다&#10;postpone - 연기하다, 미루다"></textarea>
      <div class="row"><button class="btn" data-act="vocabAdd">추가</button><button class="btn bad" data-act="vocabReplace">전체 교체</button></div>
      <p class="muted">지금 ${S.vocab.cards.length}단어 · Day 1~${C.maxVocabDay(S)}</p></div>

      <div class="card"><h3>🎧 강의</h3>
      <div class="row"><span>집중 시간(분)</span><input type="number" id="lec-min" value="${s.lectureMin}" min="1" max="180"></div>
      <div class="row"><span>다음 강의 번호 (1~15 RC, 16~30 LC)</span><input type="number" id="lec-next" value="${S.lecture.next}" min="1" max="31"></div>
      <button class="btn" data-act="saveLecture">저장</button></div>

      <div class="card"><h3>💪 근력 루틴</h3>
      <p class="muted">헬스장 기구 (한 줄에 하나, 10회×3세트)</p><textarea id="gym" rows="4">${esc(st.gym.join('\n'))}</textarea>
      <p class="muted">집 루틴 (<code>이름 | 횟수</code>)</p><textarea id="home" rows="4">${esc(st.home.map((h) => `${h.name} | ${h.reps}`).join('\n'))}</textarea>
      <button class="btn" data-act="saveStrength">저장</button></div>

      <div class="card"><h3>⚡ 기출 연도 범위</h3>
      <div class="row"><input type="number" id="y-from" value="${s.yearFrom}"><span>~</span><input type="number" id="y-to" value="${s.yearTo}"></div>
      <button class="btn" data-act="saveYears">저장</button></div>

      <div class="card"><h3>💾 백업</h3>
      <p class="muted">기록은 이 폰의 크롬 안에만 있어요. 크롬 데이터를 지우면 사라지니 주 1회 백업 파일을 받아 두세요.
      ${S.lastBackup ? `마지막 백업 ${new Date(S.lastBackup).toLocaleDateString('ko-KR')}` : '아직 백업 안 함'}</p>
      <div class="row"><button class="btn primary" data-act="exportBackup">백업 파일 받기</button>
      <label class="btn">복원<input type="file" id="restore" accept=".json,application/json" hidden></label></div></div>

      <div class="card"><h3>⚠️ 초기화</h3><button class="btn bad" data-act="reset">모든 기록 지우기</button></div>`;
  }

  // ───────── 영단어 퀴즈 화면 ─────────
  // 입력창은 한 번만 만들고 계속 재사용한다(폰 키보드가 닫히지 않게).
  function vocabShell() {
    return `<div class="ov-top"><button class="btn sm ghost" data-act="closeOverlay">✕ 잠깐 쉬기</button>
      <span class="muted" id="vprog"></span></div>
      <div class="bar xp"><i id="vbar"></i></div>
      <div class="word"><small class="muted" id="vday"></small><h1 id="vword"></h1></div>
      <input id="vans" class="big-in" placeholder="한글 뜻" autocomplete="off" autocapitalize="off" lang="ko" enterkeyhint="done">
      <div id="vres" class="vres"></div>
      <div class="row"><button class="btn ghost" data-act="vocabSkip" data-keep id="vskip">모르겠음</button>
      <button class="btn primary" data-act="vocabGo" data-keep id="vgo">확인</button></div>`;
  }
  function updateVocab() {
    const o = overlay, sess = o.sess;
    const card = S.vocab.cards.find((c) => c.id === sess.queue[0]);
    const solved = Object.keys(sess.first).length - sess.queue.filter((id) => id in sess.first).length;
    $('#vprog').textContent = `${solved}/${sess.total}${o.makeup ? ' · 보충' : ''}`;
    $('#vbar').style.width = `${(solved / sess.total) * 100}%`;
    $('#vday').textContent = `Day ${card.day}`;
    $('#vword').textContent = card.en;
    const res = $('#vres');
    if (o.result) {
      res.className = 'vres ' + (o.result.ok ? 'ok' : 'bad');
      res.innerHTML = `<b>${o.result.ok ? '⭕ 정답' : '❌ 나중에 다시 나와요'}</b><p class="key">${esc(card.ko)}</p>`;
      $('#vgo').textContent = '다음 (Enter)'; $('#vskip').hidden = true;
    } else {
      res.className = 'vres'; res.innerHTML = '';
      $('#vgo').textContent = '확인'; $('#vskip').hidden = false;
    }
  }

  function openVocab(makeup) {
    const d = today();
    let sess;
    if (makeup) sess = C.buildVocabSession(S, d, true);
    else {
      const rec = C.qRec(S, d, 'vocab');
      rec.session = rec.session || C.buildVocabSession(S, d);
      sess = rec.session;
    }
    if (!sess.queue.length) { toast('외울 단어가 없어요. 설정에서 단어장을 넣어 주세요.'); return; }
    overlay = { kind: 'vocab', sess, makeup, result: null };
    save(); render();
  }

  function vocabAnswer(skip) {
    const o = overlay, sess = o.sess;
    const card = S.vocab.cards.find((c) => c.id === sess.queue[0]);
    const ans = skip ? '' : ($('#vans').value || '').trim();
    if (!skip && !ans) return;
    const ok = !skip && C.gradeMeaning(ans, card.ko);
    o.result = { ok, ans };
    o.pendingOk = ok;
    updateVocab();
  }
  function vocabNext() {
    const o = overlay, sess = o.sess, d = today();
    const finished = C.answerVocab(sess, sess.queue[0], o.pendingOk);
    o.result = null;
    if (!finished) { save(); $('#vans').value = ''; updateVocab(); return; }
    const res = C.finishVocab(S, sess, d);
    const base = C.R.vocab * res.mult;
    let msgs;
    if (o.makeup) msgs = C.completeMakeup(S, o.makeup.date, 'vocab', base, '영단어');
    else {
      const rec = C.qRec(S, d, 'vocab');
      Object.assign(rec, { done: true, acc: res.acc, n: res.n }); delete rec.session;
      msgs = C.reward(S, base, `영단어 (처음에 맞힌 비율 ${Math.round(res.acc * 100)}%)`);
    }
    overlay = null;
    after(d, msgs);
  }

  // ───────── 강의 집중 타이머 ─────────
  let wakeLock = null, tickHandle = null;
  async function lockScreen() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* 지원 안 하면 그냥 둠 */ } }
  function startTicking() {
    clearInterval(tickHandle);
    tickHandle = setInterval(() => {
      const t = S.timer;
      if (!t || !t.running) return;
      C.timerTick(t, Date.now());
      if (t.elapsed >= t.target) return finishTimer();
      const el = $('#t-left');
      if (el) el.textContent = fmt(t.target - t.elapsed);
      if (Math.floor(t.elapsed / 1000) % 10 === 0) save();
    }, 1000);
  }
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  function openTimer(makeup) {
    if (!S.timer) {
      overlay = { kind: 'timer', makeup };
    } else overlay = { kind: 'timer', makeup: S.timer.makeup };
    render();
  }
  function startTimer() {
    const now = Date.now();
    S.timer = { running: true, elapsed: 0, lastTick: now, hiddenAt: null, breaks: 0, failed: false,
      target: S.settings.lectureMin * 60e3, lecture: S.lecture.next, makeup: overlay.makeup || null };
    save(); lockScreen(); startTicking(); render();
  }
  function finishTimer() {
    const t = S.timer, d = today();
    clearInterval(tickHandle);
    const mult = C.focusMult(t.breaks), name = C.lectureName(t.lecture);
    const base = C.R.lecture * mult;
    S.lecture.next = Math.min(31, t.lecture + 1);
    let msgs;
    if (t.makeup) msgs = C.completeMakeup(S, t.makeup.date, 'lecture', base, name);
    else {
      Object.assign(C.qRec(S, d, 'lecture'), { done: true, breaks: t.breaks, name });
      msgs = C.reward(S, base, `${name} · 집중 깨짐 ${t.breaks}회${mult > 1 ? ' (완벽 집중 ×1.2)' : mult < 1 ? ' (×0.5)' : ''}`);
    }
    S.timer = null; overlay = null;
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    after(d, msgs);
  }
  function timerOverlay() {
    const t = S.timer;
    const top = `<div class="ov-top"><span class="muted">🎧 집중 타이머${overlay.makeup ? ' · 보충' : ''}</span></div>`;
    if (!t) {
      return `${top}<div class="word"><h1>${C.lectureName(S.lecture.next)}</h1><p class="muted">${S.settings.lectureMin}분</p></div>
        <div class="card"><h3>시작 전에 앱 고정을 켜세요</h3>
        <p>① 설정 → 보안 및 개인정보 보호 → 기타 보안 설정 → <b>앱 고정</b> 켜기<br>
        ② 최근 앱 버튼 → 이 앱 아이콘 누르기 → <b>이 앱 고정</b></p>
        <p class="muted">앱을 떠나면 타이머가 멈추고 '집중 깨짐'이 1회 기록돼요. 1분 넘게 나가 있으면 실패예요.<br>
        깨짐 0회 ×1.2 · 1~2회 ×1 · 3회 이상 ×0.5</p></div>
        <button class="btn primary wide" data-act="startTimer">시작</button>
        <button class="btn ghost wide" data-act="closeOverlay">닫기</button>`;
    }
    if (t.failed) {
      return `${top}<div class="word"><h1>😵 실패</h1><p>1분 넘게 앱을 떠나 있었어요.</p></div>
        <button class="btn primary wide" data-act="retryTimer">처음부터 다시</button>
        <button class="btn ghost wide" data-act="quitTimer">그만두기</button>`;
    }
    return `${top}<div class="word"><small class="muted">${C.lectureName(t.lecture)}</small><h1 class="clock" id="t-left">${fmt(t.target - t.elapsed)}</h1>
      <p>집중 깨짐 <b>${t.breaks}</b>회</p></div>
      <p class="muted center">화면을 켜 둔 채로 두세요. 다 끝나면 자동으로 보상이 들어와요.</p>
      <button class="btn ghost wide" data-act="quitTimer">포기하기</button>`;
  }

  document.addEventListener('visibilitychange', () => {
    const t = S.timer, now = Date.now();
    if (!t || !t.running) return;
    if (document.hidden) { C.timerHide(t, now); save(); return; }
    const r = C.timerShow(t, now);
    save();
    if (r === 'fail') { clearInterval(tickHandle); overlay = { kind: 'timer', makeup: t.makeup }; render(); }
    else if (r === 'break') { lockScreen(); toast(`⚠️ 집중 깨짐 ${t.breaks}회`); render(); }
  });

  // ───────── 동작 ─────────
  const val = (id) => ($('#' + id) || {}).value;
  const A = {
    closeModal: () => { $('#modal').hidden = true; },
    closeOverlay: () => { overlay = null; render(); },
    openVocab: () => openVocab(null),
    vocabGo: () => (overlay.result ? vocabNext() : vocabAnswer(false)),
    vocabSkip: () => vocabAnswer(true),
    vocabNext,
    openTimer: () => openTimer(null),
    startTimer,
    retryTimer: () => { const mk = S.timer && S.timer.makeup; S.timer = null; overlay = { kind: 'timer', makeup: mk }; startTimer(); },
    quitTimer: () => { if (!confirm('타이머를 그만둘까요? 이번 세션은 보상이 없어요.')) return; clearInterval(tickHandle); S.timer = null; overlay = null; save(); render(); },

    toeicPart: (ds) => {
      const d = today(), rec = C.qRec(S, d, 'toeicSet'), raw = val('score-' + ds.k);
      const score = raw === '' || raw == null ? null : Math.max(0, Math.min(100, +raw));
      rec[ds.k] = { score };
      S.toeic.records.push({ date: d, part: ds.k, score });
      after(d, C.reward(S, C.R.toeicPart, `토익 ${ds.k.toUpperCase()}${score != null ? ` ${score}/100` : ''}`));
    },
    simpleDone: (ds) => {
      const d = today(); C.qRec(S, d, ds.id).done = true;
      after(d, C.reward(S, C.R.toeicReview, '토익 오답 정리'));
    },
    gichulSet: (ds) => {
      const d = today(), rec = C.qRec(S, d, 'gichul'), sub = ds.subject;
      const y = +val('g-year'), k = +val('g-round');
      const nums = (val('g-wrong') || '').split(/[\s,]+/).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 20);
      (S.gichul.done[sub] = S.gichul.done[sub] || {})[`${y}-${k}`] = true;
      C.addWrong(S, d, sub, y, k, [...new Set(nums)]);
      rec.sets = (rec.sets || 0) + 1;
      const msgs = C.reward(S, C.R.gichulSet, `${sub} ${y}년 ${k}회${nums.length ? ` · 오답 ${nums.length}개 등록` : ''}`);
      if (rec.sets === 3) msgs.push(...C.reward(S, C.R.gichulYear, '🏆 1년치 정복 보너스'));
      after(d, msgs);
    },
    strengthMode: (ds) => { S.strength.mode = ds.m; save(); render(); },
    strengthSet: (ds) => {
      const d = today(), rec = C.qRec(S, d, 'strength'); rec.items = rec.items || {};
      const n = (rec.items[ds.name] || 0) + 1; rec.items[ds.name] = Math.min(3, n);
      after(d, n === 3 ? C.reward(S, C.R.strengthItem, ds.name) : []);
    },
    weight: () => {
      const kg = parseFloat(val('kg')); if (!(kg > 20 && kg < 300)) return toast('몸무게를 확인해 주세요');
      const d = today(); Object.assign(C.qRec(S, d, 'weight'), { done: true, kg });
      S.weights = S.weights.filter((w) => w.date !== d).concat({ date: d, kg });
      after(d, C.reward(S, C.R.weight, `몸무게 ${kg}kg`));
    },
    church: () => { const d = today(); C.qRec(S, d, 'church').done = true; C.heal(S, C.CHURCH_HP); after(d, [`⛪ HP +${C.CHURCH_HP}`]); },
    wrongRes: (ds) => {
      const d = today(), w = S.gichul.wrong.find((x) => x.id === ds.id); if (!w) return;
      const r = C.resolveWrong(w, d, ds.ok === '1');
      const msgs = r === 'reset' ? [`${w.num}번은 내일 다시 나와요`] : C.reward(S, C.R.wrongItem, r === 'graduated' ? `${w.num}번 정복! 🎯` : `${w.num}번 맞음`);
      after(d, msgs);
    },
    makeup: (ds) => {
      const mk = { date: ds.date };
      const titleOf = C.questsFor(ds.date).find((q) => q.id === ds.id);
      if (ds.id === 'vocab') return openVocab(mk);
      if (ds.id === 'lecture') return openTimer(mk);
      const base = { toeicSet: C.R.toeicPart, toeicReview: C.R.toeicReview, gichul: C.R.gichulSet, strength: C.R.strengthItem * 3, weight: C.R.weight }[ds.id];
      if (!confirm(`${C.WD[C.weekday(ds.date)]}요일 '${titleOf.title}'를 지금 했나요?`)) return;
      after(today(), C.completeMakeup(S, ds.date, ds.id, base, titleOf.title));
    },
    useRest: () => {
      if (!confirm('오늘 휴식권을 쓸까요? 오늘은 벌칙이 없어요. (이번 주엔 더 못 써요)')) return;
      const d = today(); C.dayRec(S, d).rest = true; S.items.rest--; S.lastRestWeek = C.weekStart(d); save(); render(); toast('🛌 오늘은 푹 쉬세요');
    },
    eat: (ds) => { const r = C.eat(S, ds.k); if (r.err) return toast(r.err); save(); render(); toast(`😋 ${C.FRUITS[ds.k].name} 냠! ❤️ +${r.got}`); },
    sell: (ds) => { const r = C.sell(S, ds.k, 1); if (r.err) return toast(r.err); save(); render(); toast(`🪙 +${r.coins}`); },
    sellAll: () => { let c = 0; for (const k of Object.keys(C.FRUITS)) { const r = C.sell(S, k, 999); if (r.ok) c += r.coins; } save(); render(); toast(`🪙 +${c} 코인!`); },
    plant: (ds) => islandAct('plant', +ds.i, ds.k),
    water: (ds) => islandAct('water', +ds.i),
    harvest: (ds) => islandAct('harvest', +ds.i),
    closeSheet: () => closeSheet(),
    waterAll: () => { const r = C.waterAll(S, today()); if (r.err) return toast(r.err); save(); C.PLOTS && S.island.trees.forEach((t, i) => { if (t) window.Island.splash(i); }); window.Island.floatText(`❤️-${r.cost} · 나무 ${r.n}그루`, '#8ad8ff'); closeSheet(); renderHud(); },
    shopTab: (ds) => { shopTab = ds.k; shopSheet(); },
    closetTab: (ds) => { closetTab = ds.k; closetSheet(); },
    buyTool: (ds) => { const r = C.buyTool(S, ds.k); if (r.err) return toast(r.err); save(); renderHud(); shopSheet();
      showCard(`<div class="ribbon gold">NEW TOOL!</div><div class="rays r${r.tier + 2}"><img class="px big-icon" src="assets/a/tool_${ds.k}${r.tier}.png"></div><h2>${C.TIER_NAME[r.tier]} ${C.TOOLS[ds.k]}!</h2><p class="muted">${C.TOOL_INFO[ds.k][r.tier]}</p>`, `rare${r.tier + 2}`); afterCatch(); },
    buySeed: (ds) => { const r = C.buySeed(S, ds.k, +ds.p); if (r.err) return toast(r.err); save(); renderHud(); shopSheet(); toast(`🌱 ${C.FRUITS[ds.k].name} 씨앗을 샀어요`); },
    buyClothes: (ds) => { const r = C.buyClothes(S, ds.s, ds.id); if (r.err) return toast(r.err); save(); renderHud(); shopSheet();
      if (confirm(`${r.it.name}! 지금 입어 볼까요?`)) { C.wear(S, ds.s, ds.id); save(); window.Island.redress(); } },
    wear: (ds) => { const r = C.wear(S, ds.s, ds.id || null); if (r.err) return toast(r.err); save(); window.Island.redress(); closetSheet(); },
    zoom: (ds) => { const n = window.Island.zoomStep(+ds.d); S.settings.zoom = n; save(); toast(`🔍 가로 ${n}칸 보기`); },
    cardOk: () => { cardQueue.shift(); if (cardQueue.length) nextCard(); else { $('#modal').hidden = true; render(); } },
    dexCat: (ds) => { dexCat = ds.k; render(); },
    dexInfo: (ds) => dexInfo(ds.id),
    eatFish: (ds) => { const r = C.eatFish(S, ds.id); if (r.err) return toast(r.err); save(); render(); toast(`😋 냠! ❤️ +${r.got}`); },
    sellItem: (ds) => { const r = C.sellItem(S, ds.cat, ds.id, 1); if (r.err) return toast(r.err); save(); render(); toast(`🪙 +${r.coins}`); },
    sellCat: (ds) => { if (!confirm('이 칸을 전부 팔까요? (도감 기록은 남아요)')) return; let c = 0; for (const id of Object.keys(S.island.bag[ds.cat])) { const r = C.sellItem(S, ds.cat, id, 999); if (r.ok) c += r.coins; } save(); render(); toast(`🪙 +${c} 코인!`); },
    vocabAdd: () => importVocab(false),
    vocabReplace: () => { if (confirm('기존 단어와 학습 기록을 지우고 새로 넣을까요?')) importVocab(true); },
    saveLecture: () => { S.settings.lectureMin = Math.max(1, +val('lec-min') || 60); S.lecture.next = Math.max(1, Math.min(31, +val('lec-next') || 1)); save(); toast('저장했어요'); render(); },
    saveStrength: () => {
      S.strength.gym = val('gym').split('\n').map((x) => x.trim()).filter(Boolean);
      S.strength.home = val('home').split('\n').map((x) => x.trim()).filter(Boolean).map((l) => { const [n, r] = l.split('|').map((x) => x.trim()); return { name: n, reps: r || '' }; });
      save(); toast('저장했어요'); render();
    },
    saveYears: () => { const a = +val('y-from'), b = +val('y-to'); if (a > 1990 && b >= a) { S.settings.yearFrom = a; S.settings.yearTo = b; save(); toast('저장했어요'); render(); } },
    exportBackup: () => {
      S.lastBackup = Date.now(); save();
      const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `공부RPG-백업-${today()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000); render();
    },
    reset: () => { if (confirm('정말 모든 기록을 지울까요? 되돌릴 수 없어요.') && confirm('한 번 더 확인: 전부 지웁니다.')) { localStorage.removeItem(KEY); location.reload(); } },
    tab: (ds) => { tab = ds.t; render(); window.scrollTo(0, 0); },
  };

  function importVocab(replace) {
    const rows = C.parseVocab(val('vocab-in') || '');
    if (!rows.length) return toast('읽을 수 있는 줄이 없어요. 형식을 확인해 주세요.');
    let cards = replace ? [] : S.vocab.cards.filter((c) => !c.sample);
    const seen = new Set(cards.map((c) => `${c.day}|${c.en}`));
    let added = 0;
    for (const r of rows) {
      const k = `${r.day}|${r.en}`; if (seen.has(k)) continue; seen.add(k);
      cards.push({ id: 'v' + Date.now().toString(36) + added, day: r.day, en: r.en, ko: r.ko, box: 0, due: null }); added++;
    }
    S.vocab.cards = cards;
    if (replace || S.vocab.pointer > C.maxVocabDay(S)) S.vocab.pointer = 1;
    const rec = S.days[today()] && S.days[today()].q.vocab; if (rec) delete rec.session;
    save(); toast(`${added}단어 추가 · 전체 ${cards.length}`); render();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const f = A[el.dataset.act]; if (f) f(el.dataset, el);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !overlay || overlay.kind !== 'vocab') return;
    e.preventDefault();
    if (overlay.result) vocabNext(); else vocabAnswer(false);
  });
  // 버튼을 눌러도 입력창 포커스(=키보드)를 유지
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-keep]')) e.preventDefault(); });
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'restore') return;
    const f = e.target.files[0]; if (!f) return;
    f.text().then((txt) => {
      const s = JSON.parse(txt);
      if (!s || !s.v || !s.player) throw new Error('형식');
      if (!confirm(`백업으로 복원할까요? (코인 ${s.player.coins}) 지금 기록은 덮어써져요.`)) return;
      localStorage.setItem(KEY, txt); location.reload();
    }).catch(() => toast('백업 파일을 읽을 수 없어요'));
  });

  // ───────── 섬: 탭한 물건에 대한 행동 시트 ─────────
  function openSheet(html) { const sh = $('#sheet'); sh.innerHTML = `<div class="sheet-card">${html}</div>`; sh.hidden = false; }
  function closeSheet() { $('#sheet').hidden = true; sheetFor = null; }
  let sheetFor = null;
  const STAGE_NAME = { sprout: '새싹', sapling: '묘목', young: '어린 나무', tree: '다 자란 나무', blossom: '꽃 핀 나무', fruit: '열매 주렁주렁!' };
  function plotSheet(i) {
    sheetFor = i;
    const t = S.island.trees[i], d = today();
    if (!t) {
      const seeds = Object.entries(C.FRUITS).filter(([k]) => S.island.seeds[k] > 0);
      return openSheet(`<h3>🌱 빈 자리</h3><p class="muted">씨앗을 골라 심어요 · ❤️ -${C.COST.plant}</p>
        <div class="grid">${seeds.length ? seeds.map(([k, f]) => `<button class="slot btnlike" data-act="plant" data-i="${i}" data-k="${k}">
          <img src="assets/fruit-${k}.png" class="px icon"><b class="cnt">${S.island.seeds[k]}</b><div class="slot-name">${f.name}</div></button>`).join('')
          : '<p class="muted">씨앗이 없어요. 상점에서 사거나, 낚시·땅파기 럭키로 얻어요.</p>'}</div>
        <button class="btn ghost wide" data-act="closeSheet">닫기</button>`);
    }
    const st = C.treeStage(t), f = C.FRUITS[t.kind];
    const left = C.GROW_DAYS - t.g;
    const info = st === 'fruit' ? '다 익었어요! 수확하세요' : `열매까지 물 주기 ${left}번 더 (하루 한 번)`;
    const watered = t.watered === d;
    openSheet(`<div class="sheet-head"><img src="assets/fruit-${t.kind}.png" class="px icon"><div><h3>${f.name}나무 · ${STAGE_NAME[st]}</h3><p class="muted">${info}</p></div></div>
      <div class="growbar">${[0, 1, 2].map((k) => `<i class="${k < t.g ? 'on' : ''}"></i>`).join('')}</div>
      ${st === 'fruit' ? `<button class="btn primary wide big" data-act="harvest" data-i="${i}">🧺 수확하기 (×${3})</button>`
        : `<button class="btn primary wide big" data-act="water" data-i="${i}" ${watered ? 'disabled' : ''}>${watered ? '💧 오늘 물 줬어요 · 내일 자라요' : `💧 물 주기 · ❤️ -${C.cost(S, 'water')}`}</button>`}
      ${C.tier(S, 'can') >= 3 ? `<button class="btn wide" data-act="waterAll">✨ 금 물뿌리개: 모든 나무에 물 주기 · ❤️ -3</button>` : ''}
      <p class="muted small">공부 퀘스트를 놓친 날엔 물을 줘도 자라지 않아요.</p>
      <button class="btn ghost wide" data-act="closeSheet">닫기</button>`);
  }
  function islandAct(kind, i, arg) {
    const d = today();
    const r = kind === 'plant' ? C.plant(S, i, arg, d) : kind === 'water' ? C.water(S, i, d) : C.harvest(S, i);
    if (r.err) { toast(r.err); return; }
    save();
    if (kind === 'plant') { window.Island.dust(i); window.Island.floatText(`❤️-${r.cost}`, '#ff8a8a'); }
    if (kind === 'water') { window.Island.splash(i); window.Island.floatText(`❤️-${r.cost}`, '#ff8a8a'); }
    if (kind === 'harvest') {
      window.Island.pop(i, r.kind, r.n);
      window.Island.floatText(`+${r.n} ${C.FRUITS[r.kind].name}`, '#ffe066');
      if (r.first) setTimeout(() => modal('📖 도감 등록!', [`${C.FRUITS[r.kind].name}를 처음 수확했어요!`]), 700);
    }
    closeSheet(); renderHud();
  }
  function onIslandTap(obj) {
    if (obj.type === 'plot') return plotSheet(obj.i);
    if (obj.type === 'house') return closetSheet();
    if (obj.type === 'shop') return shopSheet();
    if (obj.type === 'museum') { tab = 'dex'; render(); return; }
    if (obj.type === 'villager') return talkSheet(obj.id);
  }

  // ───────── 상점·옷장 ─────────
  let shopTab = 'tool', closetTab = 'top';
  const clothIcon = (slot, id) => `assets/a/${slot}_${id}.png`;
  const SLOT_NAME = { top: '상의', bottom: '하의', hat: '모자' };
  function shopSheet() {
    const d = today(), sh = C.shopToday(d), coins = S.player.coins;
    const tabs = [['tool', '🛠️ 도구'], ['seed', '🌱 씨앗'], ['cloth', '👕 옷']];
    let body = '';
    if (shopTab === 'tool') {
      body = Object.entries(C.TOOLS).map(([k, name]) => {
        const t = C.tier(S, k), nx = t + 1;
        return `<div class="shop-row"><img src="assets/a/tool_${k}${t}.png" class="px icon"><div class="grow"><b>${C.TIER_NAME[t]} ${name}</b><p class="muted small">${C.TOOL_INFO[k][t]}</p>
          ${nx <= 3 ? `<p class="small">→ <b>${C.TIER_NAME[nx]} ${name}</b>: ${C.TOOL_INFO[k][nx]}</p>` : '<p class="small gold-t">최고 등급!</p>'}</div>
          ${nx <= 3 ? `<button class="btn primary" data-act="buyTool" data-k="${k}" ${coins < C.TOOL_PRICE[nx] ? 'disabled' : ''}>${COIN}${C.TOOL_PRICE[nx]}</button>` : ''}</div>`;
      }).join('');
    } else if (shopTab === 'seed') {
      body = `<p class="muted small">오늘의 씨앗 (매일 바뀌어요)</p>` + sh.seeds.map(({ kind, price }) => `<div class="shop-row"><img src="assets/fruit-${kind}.png" class="px icon"><div class="grow"><b>${C.FRUITS[kind].name} 씨앗</b><p class="muted small">가진 씨앗 ${S.island.seeds[kind] || 0}개</p></div>
        <button class="btn primary" data-act="buySeed" data-k="${kind}" data-p="${price}" ${coins < price ? 'disabled' : ''}>${COIN}${price}</button></div>`).join('');
    } else {
      const items = [...sh.top.map((x) => ['top', x]), ...sh.bottom.map((x) => ['bottom', x]), ...sh.hat.map((x) => ['hat', x])];
      body = `<p class="muted small">오늘의 옷 (매일 바뀌어요) · 산 옷은 집에서 갈아입어요</p>` + items.map(([sl, it]) => {
        const own = C.owns(S, sl, it.id);
        return `<div class="shop-row"><img src="${clothIcon(sl, it.id)}" class="px icon"><div class="grow"><b>${esc(it.name)}</b><p class="muted small">${SLOT_NAME[sl]}</p></div>
          ${own ? '<span class="muted small">가지고 있음</span>' : `<button class="btn primary" data-act="buyClothes" data-s="${sl}" data-id="${it.id}" ${coins < it.price ? 'disabled' : ''}>${COIN}${it.price}</button>`}</div>`;
      }).join('');
    }
    openSheet(`<div class="row"><h3>🏪 상점</h3><span class="chip">${COIN}${coins}</span></div>
      <div class="seg">${tabs.map(([k, l]) => `<button class="${shopTab === k ? 'on' : ''}" data-act="shopTab" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="shop-list">${body}</div><p class="muted small">팔기는 가방 탭에서 해요.</p><button class="btn ghost wide" data-act="closeSheet">닫기</button>`);
  }
  function closetSheet() {
    const w = C.wardrobe(S), o = S.island.outfit;
    const tabs = [['top', '👕 상의'], ['bottom', '🩳 하의'], ['hat', '🎩 모자']];
    const list = C.CLOTHES[closetTab].filter((it) => w[closetTab].includes(it.id));
    const cells = (closetTab === 'hat' ? [`<button class="slot btnlike ${!o.hat ? 'on' : ''}" data-act="wear" data-s="hat" data-id=""><div class="icon none">✕</div><div class="slot-name">벗기</div></button>`] : [])
      .concat(list.map((it) => `<button class="slot btnlike ${o[closetTab] === it.id ? 'on' : ''}" data-act="wear" data-s="${closetTab}" data-id="${it.id}"><img src="${clothIcon(closetTab, it.id)}" class="px icon"><div class="slot-name">${esc(it.name)}</div></button>`));
    openSheet(`<h3>🏠 우리 집 · 옷장</h3><p class="muted small">상점에서 산 옷, 낚시 럭키로 얻은 옷을 입어요. 집 꾸미기는 나중에 열려요.</p>
      <div class="seg">${tabs.map(([k, l]) => `<button class="${closetTab === k ? 'on' : ''}" data-act="closetTab" data-k="${k}">${l}<small>${w[k].length}/${C.CLOTHES[k].length}</small></button>`).join('')}</div>
      <div class="grid g4">${cells.join('')}</div><button class="btn ghost wide" data-act="closeSheet">닫기</button>`);
  }

  // ───────── 주민 ─────────
  const vIcon = (id) => `assets/a/vface_${id}.png`;
  const LINES = {
    toto: ['나무들이 오늘도 쑥쑥 크고 있어! 너도 공부로 쑥쑥 크자 🌱', '물 주는 건 나한테 맡겨. 대신 단어는 네가 외워야 해!', '꽃이 피려면 매일 조금씩! 공부도 똑같대.'],
    mongsil: ['섬이 반짝반짝하니까 기분 좋다~ 음메!', '잡초는 내가 뽑을게. 너는 오답 노트 정리해 줘!', '깨끗한 섬, 깨끗한 책상! 오늘도 화이팅이야.'],
    coco: ['숲에서 도토리 주웠어! 너는 오늘 점수 주웠어?', '바쁘다 바빠! 근데 너만큼은 아니지, 공부하는 사람!', '열심히 모으면 언젠가 꽉 차! 도감도, 실력도!'],
    lulu: ['별이 그러는데… 오늘 너한테 좋은 일이 생긴대 ✨', '행운은 준비된 사람한테 온대. 기출 한 세트 어때?', '밤하늘처럼 차분하게. 집중하면 금방이야.'],
    kongi: ['삐약! 나도 매일 조금씩 자라고 있어!', '씨앗은 작아도 언젠가 나무가 된대. 너처럼!'],
    bori: ['멍! 오늘도 배달 왔어! 연속 기록 지키는 거 멋있어!', '산책 갈래? …공부 끝나고! 약속!'],
    maru: ['대나무는 하루에 엄청 자란대. 꾸준함 최고야~', '천천히 해도 괜찮아. 멈추지만 않으면 돼.'],
    byeolha: ['한 달을 해냈구나. 너는 진짜 반짝이는 사람이야.', '보석은 오래 눌려야 생긴대. 지금이 그때야.'],
    pado: ['오늘 물살 좋다~ 너도 문제 술술 풀리길!', '낚시도 공부도 기다림이 반이야.'],
    gaegul: ['개굴! 곤충은 다리가 6개, 너는 집중력이 6배!', '관찰이 중요해. 틀린 문제를 잘 관찰해 봐!'],
    bueong: ['부엉… 옛것을 알아야 새것을 안다네. 기출이 그렇지.', '오답은 화석 같은 거야. 잘 파 보면 보물이 나와.'],
    pengi: ['Good job! 오늘 단어는 몇 개 외웠어?', 'Practice makes perfect! 강의 하나 같이 들을까?'],
    gomdol: ['기출을 캐고 또 캐면 금맥이 나온다구!', '힘들면 꿀 한 숟가락… 아니 과일 하나 먹고 해!'],
    nana: ['음냐… 이 섬 공기 좋다. 여기 살고 싶을지도…', '쉬는 것도 공부야. 근데 너무 많이는 말고!'],
    mungchi: ['볼에 코인 가득! 너도 머리에 지식 가득!', '쪼르르~ 바쁘다 바빠! 같이 힘내자!'],
    podeun: ['이 섬 색감 너무 예쁘다~ 옷 하나 지어 줄까?', '한 땀 한 땀, 공부도 한 문제 한 문제!'],
    bomi: ['토토 언니 따라왔어! 나무 돌보는 거 좋아해.', '가시는 있어도 마음은 말랑해. 너도 힘내!'],
  };
  // 조건을 채운 주민이 있으면 이사 카드
  function arrivals() {
    const nv = C.checkArrivals(S); if (!nv.length) return;
    save(); window.Island.syncVillagers && window.Island.syncVillagers();
    for (const v of nv) showCard(`<div class="ribbon gold">새 주민!</div><div class="rays r4"><img class="px big-icon" src="${vIcon(v.id)}"></div>
      <h2>${v.name}(${v.kind})가 이사 왔어요!</h2><p class="muted">🔑 ${esc(v.how)} 달성</p><p>${esc(v.role)}</p>`, 'rare4');
  }
  function talkSheet(id) {
    const v = C.V_BY[id], d = today(), r = C.talk(S, id, d);
    if (r.err) return;
    const left = C.questsFor(d).filter((q) => q.required && !C.isComplete(q.id, (S.days[d] && S.days[d].q[q.id]))).map((q) => q.title);
    const pool = LINES[id] || LINES.toto, base = pool[(Math.floor(Date.now() / 864e5) + id.length) % pool.length];
    const study = left.length ? `오늘 남은 퀘스트는 <b>${left.length}개</b>야. ${esc(left[0])}부터 해 볼까?` : '오늘 퀘스트 다 했구나! 정말 대단해 🎉';
    const gift = r.again ? '<p class="muted small">오늘은 벌써 이야기했어요. 내일 또 와요!</p>'
      : `<p class="gift">🎁 선물: ${COIN}${r.coins}${r.big ? ` + 친해진 기념 ${COIN}${r.big}!` : ''}</p>`;
    save(); renderHud();
    const visit = r.moved ? `<p class="gift">🏡 ${v.name}가 섬에 이사 오기로 했어요! 앞으로 ${esc(v.role)}</p>`
      : r.visit != null ? `<p class="muted small">🏕️ 떠돌이 손님 · 다른 날 말 걸기 ${r.visit}/3 (채우면 이사 와요)</p>` : '';
    if (id === 'toto' || r.moved) setTimeout(arrivals, 400);
    if (r.moved) setTimeout(() => window.Island.syncVillagers && window.Island.syncVillagers(), 50);
    openSheet(`<div class="talk"><img src="${vIcon(id)}" class="px face"><div><h3>${v.name} <small class="muted">${v.kind}</small></h3>
      <p class="bubble">${base}<br>${study}</p></div></div>${gift}
      ${visit}<p class="muted small">❤️ 친밀도 ${r.friend}${r.visit == null ? ` · ${esc(v.role)}` : ''}</p><button class="btn primary wide" data-act="closeSheet">고마워!</button>`);
  }

  // ───────── 잡았을 때 카드 ─────────
  const D = window.Data;
  const STARS = (r) => '★'.repeat(r) + '<span class="off">' + '★'.repeat(5 - r) + '</span>';
  const iconOf = (sp) => window.Icons.url(sp);
  // 받침에 따라 을/를
  const eul = (w) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '을' : '를'; };
  const COIN = '<img src="assets/coin.png" class="px ic-coin">';
  let cardQueue = [];
  function showCard(html, cls = '') {
    cardQueue.push({ html, cls });
    if (cardQueue.length === 1) nextCard();
  }
  function nextCard() {
    const c = cardQueue[0]; if (!c) return;
    $('#modal').innerHTML = `<div class="catch-card ${c.cls}">${c.html}<button class="btn primary wide" data-act="cardOk">좋아!</button></div>`;
    $('#modal').hidden = false;
  }
  function catchCard(sp, first, verb) {
    const info = sp.cat === 'fossil' ? `팔면 ${COIN}${sp.sell}` : sp.cat === 'fish' ? `${D.LOC_NAME[sp.loc]} · ${D.hoursText(sp)}<br>팔면 ${COIN}${sp.sell} · 먹으면 ❤️+${sp.hp}` : `${D.LOC_NAME[sp.loc]} · ${D.hoursText(sp)}<br>팔면 ${COIN}${sp.sell}`;
    showCard(`${first ? '<div class="ribbon">NEW! 도감 등록</div>' : ''}
      <div class="rays r${sp.r}"><img class="px big-icon" src="${iconOf(sp)}"></div>
      <div class="stars">${STARS(sp.r)}</div>
      <h2>${esc(sp.name)}${eul(sp.name)} ${verb}</h2><p class="muted">${info}</p>`, `rare${sp.r}`);
    if (navigator.vibrate) navigator.vibrate(sp.r >= 4 ? [60, 40, 120] : 40);
  }
  function luckyCard(r) {
    const icon = r.what === 'seed' ? `assets/fruit-${r.kind}.png` : r.what === 'coins' ? 'assets/moneybag.png' : r.what === 'clothes' ? clothIcon(r.slot, r.id) : 'assets/chest.png';
    if (r.what === 'clothes') window.Island.redress();
    showCard(`<div class="ribbon gold">LUCKY!</div><div class="rays r4"><img class="px big-icon" src="${icon}"></div><h2>${esc(r.text)}</h2><p class="muted">운이 좋았어요!</p>`, 'rare4');
  }
  function afterCatch() {
    const st = C.checkStars(S, today());
    save(); renderHud(); setTimeout(arrivals, 10);
    if (st) {
      const opened = { 2: '🏖️ 해변이 열렸어요! 바다낚시를 할 수 있어요.', 3: '🌲 숲이 열렸어요! 희귀한 곤충이 살아요.', 4: '⛰️ 동굴 구역은 곧 열려요.', 5: '🏔️ 섬 꼭대기는 곧 열려요.' }[st];
      const nv = C.VILLAGERS.find((v) => v.star === st);
      showCard(`<div class="ribbon gold">섬 별점 UP!</div><div class="big-star">${'★'.repeat(st)}</div><h2>섬이 ★${st}이 되었어요!</h2><p>${opened}</p>
        ${nv ? `<div class="talk"><img src="${vIcon(nv.id)}" class="px face"><div><b>${nv.name}(${nv.kind})가 이사 왔어요!</b><p class="muted small">${nv.role}</p></div></div>` : ''}`, 'rare5');
      window.Island.syncVillagers && window.Island.syncVillagers();
    }
  }
  const islandHooks = {
    state: () => S, today, save, onTap: onIslandTap, toast,
    isDug: (k) => (S.island.dug[today()] || []).includes(k),
    isPicked: (k) => ((S.island.picked || {})[today()] || []).includes(k),
    pickMush: (k, x, y) => {
      const r = C.pickMush(S, today(), k); if (r.err) return;
      save(); renderHud();
      if (r.m.r >= 3) showCard(`<div class="rays r${r.m.r}"><img class="px big-icon" src="assets/a/mush_${r.id}.png"></div><div class="stars">${STARS(r.m.r)}</div><h2>${r.m.name}${eul(r.m.name)} 땄다!</h2><p class="muted">팔면 ${COIN}${r.m.sell}</p>`, `rare${r.m.r}`);
      else window.Island.floatText(`🍄 ${r.m.name} +1`, '#ffe0f0', [x, y - 10]);
    },
    tryFish: (loc, start) => { const c = C.cost(S, 'fish'); if (S.player.hp < c) return toast(`HP가 부족해요 (필요 ${c}). 공부하면 HP가 들어와요!`); start(); },
    cast: (loc) => {
      const c = C.cost(S, 'fish'), r = C.castLine(S, loc, new Date());
      if (r.err) { toast(r.err); return r; }
      save(); renderHud(); window.Island.floatText(`❤️-${c}`, '#ff8a8a'); return r;
    },
    land: (cast) => {
      const r = C.landFish(S, cast, today());
      if (r.type === 'lucky') luckyCard(r); else catchCard(r.sp, r.first, '낚았다!');
      afterCatch();
    },
    netSwing: (sp) => {
      const c = C.cost(S, 'net');
      if (S.player.hp < c) { toast(`HP가 부족해요 (필요 ${c})`); return { err: 'hp' }; }
      const r = C.swingNet(S, sp, today());
      window.Island.floatText(`❤️-${c}`, '#ff8a8a');
      save(); renderHud();
      if (!r.miss && !r.err) { catchCard(sp, r.first, '잡았다!'); afterCatch(); }
      return r;
    },
    dig: (k, x, y) => {
      const c = C.cost(S, 'dig'), r = C.dig(S, today(), k);
      if (r.err) { toast(r.err); return; }
      window.Island.floatText(`❤️-${c}`, '#ff8a8a', [x, y - 8]); window.Island.sparkle(x, y);
      if (r.type === 'catch') catchCard(r.sp, r.first, '발견했다!');
      else if (r.type === 'ore') { const o = D.ORES[r.id]; showCard(`<div class="rays r${r.id === 'stone' ? 1 : 3}"><img class="px big-icon" src="assets/${o.icon}.png"></div><h2>${o.name}${eul(o.name)} 캤다!</h2><p class="muted">팔면 ${COIN}${o.sell}</p>`, r.id === 'stone' ? '' : 'rare3'); }
      else luckyCard(r);
      afterCatch();
    },
    clearLitter: (idx, x, y) => {
      const r = C.clearLitter(S, idx, today()); if (r.err) return;
      window.Island.sparkle(x, y, 10);
      window.Island.floatText(r.kind === 'can' ? '쓰레기 치웠어요!' : '잡초 뽑았어요!', '#d8ffd0', [x, y - 10]);
      if (!S.island.litter.length) toast('✨ 섬이 깨끗해졌어요! 7일 동안 유지하면 ★3 조건 달성');
      save(); afterCatch();
    },
  };

  // ───────── 도감 탭 ─────────
  let dexCat = 'fish';
  function dexView() {
    const I = S.island, total = C.dexCount(S), st = I.stars || 1, next = C.STAR_RULES[st + 1];
    let html = `<div class="card star-card"><div class="row"><h3>🏝️ 섬 별점 <span class="gold-t">${'★'.repeat(st)}</span><span class="off">${'★'.repeat(5 - st)}</span></h3><b>${total}종</b></div>
      ${next ? `<p class="muted">다음 ★${st + 1}: ${esc(next.text)}</p><div class="bar xp"><i style="width:${Math.min(100, (total / next.dex) * 100)}%"></i><em>도감 ${total}/${next.dex}</em></div>
      ${st + 1 === 3 ? `<p class="small">🌿 깨끗한 섬 ${Math.min(7, C.cleanDays(S, today()))}/7일${(I.litter || []).length ? ` · 지금 잡초·쓰레기 ${I.litter.length}개` : ''}</p>` : ''}
      ${st + 1 === 4 ? `<p class="small">🛠️ 금 도구 ${Object.keys(C.TOOLS).some((t) => C.tier(S, t) >= 3) ? '있음 ✓' : '없음 (상점)'}</p>` : ''}` : '<p>최고 별점이에요!</p>'}
</div>`;
    const here = C.villagersHere(S).map((v) => v.id), vis = S.island.visitor;
    html += `<div class="card"><div class="row"><h3>🏡 주민 ${here.length}/${C.VILLAGERS.length}</h3>${vis ? `<small class="muted">🏕️ ${C.V_BY[vis.id].name} 방문 중</small>` : ''}</div>
      <div class="vgrid">${C.VILLAGERS.map((v) => here.includes(v.id) ? `<div class="vcell"><img src="${vIcon(v.id)}" class="px"><small>${v.name}</small></div>`
        : `<div class="vcell off"><img src="${vIcon(v.id)}" class="px silhouette"><small>${esc(v.how)}</small></div>`).join('')}</div></div>`;
    const cats = [['fish', '🐟 물고기', D.FISH], ['bug', '🦋 곤충', D.BUGS], ['fossil', '🦴 화석', D.FOSSILS], ['fruit', '🍒 과일', null]];
    html += `<div class="seg dexseg">${cats.map(([k, l, list]) => `<button class="${dexCat === k ? 'on' : ''}" data-act="dexCat" data-k="${k}">${l}<small>${Object.keys(I.dex[k] || {}).length}/${list ? list.length : 6}</small></button>`).join('')}</div>`;
    const when = new Date();
    if (dexCat === 'fruit') {
      html += `<div class="grid g4">${Object.entries(C.FRUITS).map(([k, f]) => I.dex.fruit[k]
        ? `<div class="slot"><img src="assets/fruit-${k}.png" class="px icon"><div class="slot-name">${f.name}</div></div>`
        : `<div class="slot dim"><img src="assets/fruit-${k}.png" class="px icon silhouette"><div class="slot-name">???</div></div>`).join('')}</div>`;
      return html;
    }
    const list = cats.find((c) => c[0] === dexCat)[2];
    html += `<p class="muted center">반짝이는 칸은 <b>지금 잡을 수 있는데 아직 못 잡은</b> 거예요</p><div class="grid g4">`;
    html += list.map((sp) => {
      const got = I.dex[sp.cat][sp.id];
      const zoneOk = !(sp.loc === 'sea' && (I.stars || 1) < 2) && !(sp.loc === 'forest' && (I.stars || 1) < 3);
      const now = !got && sp.cat !== 'fossil' && zoneOk && D.available(sp, when);
      return got
        ? `<button class="slot r${sp.r}" data-act="dexInfo" data-id="${sp.id}"><img src="${iconOf(sp)}" class="px icon"><div class="slot-name">${esc(sp.name)}</div><div class="mini-stars">${'★'.repeat(sp.r)}</div></button>`
        : `<button class="slot dim ${now ? 'now' : ''}" data-act="dexInfo" data-id="${sp.id}"><img src="${iconOf(sp)}" class="px icon silhouette"><div class="slot-name">${now ? '지금!' : '???'}</div></button>`;
    }).join('') + '</div>';
    return html;
  }
  function dexInfo(id) {
    const sp = D.BY_ID[id], got = S.island.dex[sp.cat][id];
    const where = sp.cat === 'fossil' ? '빛나는 땅을 파면 나와요' : `${D.LOC_NAME[sp.loc]} · ${D.monthsText(sp)} · ${D.hoursText(sp)}`;
    modal(got ? `${sp.name} ${'★'.repeat(sp.r)}` : '??? ' + '★'.repeat(sp.r), got
      ? [where, `지금까지 ${got.n}마리(개) · 처음 ${got.first}`, `팔면 🪙${sp.sell}${sp.hp ? ` · 먹으면 ❤️+${sp.hp}` : ''}`]
      : [`힌트: ${where}`]);
  }

  // ───────── 그리기 ─────────
  function renderHud() { $('#ihud').innerHTML = header() + `<div class="zoom"><button data-act="zoom" data-d="-1" aria-label="확대">＋</button><button data-act="zoom" data-d="1" aria-label="축소">－</button></div>`; if (tab !== 'island') $('#app').querySelector('.hud') && ($('#app').querySelector('.hud').outerHTML = header()); }
  function render() {
    const app = $('#app'), isl = $('#island');
    if (overlay) {
      isl.hidden = true; window.Island.stop(); $('#tabs').hidden = true;
      app.hidden = false; app.className = 'ov';
      if (overlay.kind === 'vocab') {
        if (!$('#vans')) app.innerHTML = vocabShell();
        updateVocab(); $('#vans').focus();
      } else app.innerHTML = timerOverlay();
      return;
    }
    $('#tabs').hidden = false;
    $('#tabs').innerHTML = [['island', '🏝️', '섬'], ['today', '📚', '공부'], ['bag', '🎒', '가방'], ['dex', '📖', '도감'], ['settings', '⚙️', '기록·설정']]
      .map(([t, i, l]) => `<button class="${tab === t ? 'on' : ''}" data-act="tab" data-t="${t}"><span>${i}</span>${l}</button>`).join('');
    if (tab === 'island') {
      app.hidden = true; isl.hidden = false; app.innerHTML = '';
      renderHud(); window.Island.start();
      if (sheetFor != null && !$('#sheet').hidden) plotSheet(sheetFor);
      return;
    }
    window.Island.stop(); isl.hidden = true; closeSheet();
    app.hidden = false; app.className = '';
    const views = { today: todayView, bag: bagView, dex: dexView, stats: statsView, settings: () => statsView() + settingsView() };
    app.innerHTML = `${header()}<main>${views[tab]()}</main>`;
  }

  // ───────── 시작 ─────────
  function boot() {
    const msgs = C.settle(S, today()).concat(C.villagerHelp(S, today()));
    // 앱이 꺼진 사이에 타이머가 돌던 경우: 꺼진 시점부터 나가 있던 걸로 본다
    if (S.timer && S.timer.running) {
      if (!S.timer.hiddenAt) S.timer.hiddenAt = S.timer.lastTick;
      const r = C.timerShow(S.timer, Date.now());
      overlay = { kind: 'timer', makeup: S.timer.makeup };
      if (r !== 'fail') { lockScreen(); startTicking(); }
    }
    window.Island.init($('#cv'), islandHooks);
    save(); render();
    if (msgs.length) modal('📜 섬 소식', msgs);
    arrivals();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // 새벽 4시를 넘기면 새로 정산
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); const m = C.settle(S, today()).concat(C.villagerHelp(S, today())); save(); render(); if (m.length) modal('📜 섬 소식', m); } }, 60e3);
  boot();
})();
