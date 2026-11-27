// core.js — 화면과 무관한 게임 규칙. 브라우저와 node 테스트 양쪽에서 돌아간다.
(function (G) {
  'use strict';

  // ───────── 날짜: 하루는 새벽 4시에 바뀐다 ─────────
  const DAY_SHIFT_H = 4;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const gameDate = (ts = Date.now()) => ymd(new Date(ts - DAY_SHIFT_H * 3600e3));
  const weekday = (s) => parseYmd(s).getDay(); // 0=일
  const weekStart = (s) => addDays(s, -((weekday(s) + 6) % 7)); // 월요일
  const WD = ['일', '월', '화', '수', '목', '금', '토'];

  // ───────── HP(=행동력) 보상 ─────────
  // 공부하면 HP가 들어오고, 섬에서 행동할 때 HP를 쓴다.
  const R = {
    vocab: 30,          // 처음에 맞힌 비율로 50~100%
    strengthItem: 5,
    toeicPart: 20,
    toeicReview: 15,
    lecture: 30,        // 집중 깨짐 횟수로 ×1.2 / ×1 / ×0.5
    gichulSet: 20,
    gichulYear: 20,     // 하루 3세트 = 1년치 정복 보너스
    wrongItem: 3,
    weight: 5,
  };
  const MISS_HP = 10, ALLCLEAR_HP = 5, CHURCH_HP = 15, MAKEUP_HP = 10, MAKEUP_MULT = 1.5;
  const STREAK_BONUS = 50; // 7일 연속마다 코인
  const BASE_MAX_HP = 150;
  const maxHp = (S) => BASE_MAX_HP + ((S.island && S.island.maxHpBonus) || 0);

  // ───────── 퀘스트 일정 ─────────
  const SUBJECT_BY_WD = { 1: '전기자기학', 3: '전력공학', 4: '전기기기', 5: '회로이론 및 제어공학' };
  const SUBJECTS = ['전기자기학', '전력공학', '전기기기', '회로이론 및 제어공학'];

  function questsFor(date) {
    const wd = weekday(date);
    const q = [{ id: 'vocab', title: '영단어', icon: '📖', required: true }];
    if ([1, 3, 5].includes(wd)) q.push({ id: 'toeicSet', title: '토익 RC+LC 세트', icon: '📝', required: true });
    if ([2, 4, 6].includes(wd)) {
      q.push({ id: 'toeicReview', title: '토익 오답 정리', icon: '🔁', required: true });
      q.push({ id: 'lecture', title: '토익 강의 (집중 타이머)', icon: '🎧', required: true });
    }
    if (SUBJECT_BY_WD[wd]) q.push({ id: 'gichul', title: `전기기사 기출 · ${SUBJECT_BY_WD[wd]}`, icon: '⚡', required: true, subject: SUBJECT_BY_WD[wd] });
    q.push({ id: 'strength', title: '근력 운동', icon: '💪', required: true });
    if (wd === 1) q.push({ id: 'weight', title: '몸무게 기록', icon: '⚖️', required: true });
    if (wd === 0) q.push({ id: 'church', title: '교회', icon: '⛪', required: false });
    return q;
  }

  function isComplete(id, r) {
    r = r || {};
    switch (id) {
      case 'vocab': case 'toeicReview': case 'lecture': case 'weight': case 'church': return !!r.done;
      case 'toeicSet': return !!(r.rc || r.lc);
      case 'gichul': return (r.sets || 0) >= 1;
      case 'strength': return Object.values(r.items || {}).some((sets) => sets >= 3);
      default: return false;
    }
  }

  // ───────── 상태 ─────────
  const SAMPLE = [
    [1, 'implement', '시행하다, 실행하다'], [1, 'comprehensive', '포괄적인, 종합적인'],
    [1, 'postpone', '연기하다, 미루다'], [2, 'reimburse', '변제하다, 상환하다'],
    [2, 'mandatory', '의무적인, 필수의'], [2, 'subsequent', '그 다음의, 이후의'],
  ];
  function defaultState() {
    return {
      v: 1,
      created: Date.now(),
      player: { hp: 100, coins: 0, streak: 0, bestStreak: 0 },
      items: { rest: 0 },
      island: defaultIsland(),
      lastSettled: null,
      lastRestWeek: null,
      days: {},
      vocab: { cards: SAMPLE.map(([day, en, ko], i) => ({ id: 's' + i, day, en, ko, box: 0, due: null, sample: true })), pointer: 1 },
      lecture: { next: 1 },
      toeic: { records: [] },
      gichul: { done: {}, wrong: [] },
      strength: {
        mode: 'home',
        gym: ['레그프레스', '랫풀다운', '체스트프레스', '숄더프레스'],
        home: [{ name: '푸시업', reps: '15회' }, { name: '스쿼트', reps: '20회' }, { name: '플랭크', reps: '45초' }, { name: '런지', reps: '12회' }],
      },
      weights: [],
      timer: null,
      settings: { lectureMin: 60, yearFrom: 2013, yearTo: 2022 },
      notices: [],
      lastBackup: null,
    };
  }
  const dayRec = (S, d) => (S.days[d] = S.days[d] || { q: {}, missed: [], madeUp: [] });
  const qRec = (S, d, id) => { const r = dayRec(S, d); return (r.q[id] = r.q[id] || {}); };

  // ───────── HP와 벌칙 ─────────
  function heal(S, n) { const before = S.player.hp; S.player.hp = Math.min(maxHp(S), S.player.hp + n); return S.player.hp - before; }
  function reward(S, hp, why, mult = 1) {
    const want = Math.round(hp * mult), got = heal(S, want);
    return [got < want ? `❤️ +${got} HP — ${why} (HP 가득!)` : `❤️ +${got} HP — ${why}`];
  }
  function damage(S, n) { S.player.hp = Math.max(0, S.player.hp - n); }

  // 퀘스트 진행 뒤 부르면, 그날 필수 퀘스트를 다 끝냈을 때 한 번만 HP +5와 스트릭을 준다.
  function checkAllClear(S, d) {
    const r = dayRec(S, d);
    if (r.allClear) return [];
    const req = questsFor(d).filter((q) => q.required);
    if (!req.every((q) => isComplete(q.id, r.q[q.id]))) return [];
    r.allClear = true;
    heal(S, ALLCLEAR_HP);
    S.player.streak++; S.player.bestStreak = Math.max(S.player.bestStreak, S.player.streak);
    const out = [`✨ 오늘 퀘스트 올클리어! HP +${ALLCLEAR_HP} · 연속 ${S.player.streak}일`];
    if (S.player.streak % 7 === 0) { S.player.coins += STREAK_BONUS; out.push(`🔥 ${S.player.streak}일 연속 보너스 +${STREAK_BONUS} 코인`); }
    return out;
  }

  // 앱을 열 때 지난날을 소급 정산한다.
  function settle(S, today = gameDate()) {
    const out = [];
    if (!S.lastSettled) { S.lastSettled = addDays(today, -1); return out; }
    let d = addDays(S.lastSettled, 1);
    let guard = 0;
    while (d < today && guard++ < 120) {
      const r = dayRec(S, d);
      if (r.rest) {
        out.push(`${d}(${WD[weekday(d)]}) 휴식권 사용 — 벌칙 없음`);
      } else {
        const missed = questsFor(d).filter((q) => q.required && !isComplete(q.id, r.q[q.id]));
        r.missed = missed.map((q) => q.id);
        if (missed.length) {
          const loss = MISS_HP * missed.length;
          out.push(`${d}(${WD[weekday(d)]}) 놓친 퀘스트 ${missed.length}개: ${missed.map((q) => q.title).join(', ')} → HP -${loss}, 나무가 하루 쉬었어요`);
          S.player.streak = 0;
          damage(S, loss);
          addLitter(S, missed.length, d);
        }
      }
      growTrees(S, d, !r.rest && (r.missed || []).length > 0);
      S.lastSettled = d;
      d = addDays(d, 1);
    }
    return out;
  }

  // 일요일 보충: 그 주 월~토에 놓친 것 중 아직 보충 안 한 것
  function makeupList(S, today) {
    if (weekday(today) !== 0) return [];
    const out = [];
    for (let d = weekStart(today); d < today; d = addDays(d, 1)) {
      const r = S.days[d];
      if (!r) continue;
      for (const id of r.missed || []) {
        if ((r.madeUp || []).includes(id)) continue;
        const q = questsFor(d).find((x) => x.id === id);
        if (q) out.push({ date: d, ...q });
      }
    }
    return out;
  }
  function completeMakeup(S, date, id, base, why) {
    const r = dayRec(S, date);
    r.madeUp = r.madeUp || [];
    if (r.madeUp.includes(id)) return [];
    r.madeUp.push(id);
    heal(S, MAKEUP_HP);
    return [`🩹 보충 완료: HP +${MAKEUP_HP} 환급`, ...reward(S, base, `보충 · ${why}`, MAKEUP_MULT)];
  }

  // ───────── 영단어 ─────────
  const BOX_DAYS = [0, 1, 3, 7, 14, 30];
  const maxVocabDay = (S) => Math.max(1, ...S.vocab.cards.map((c) => c.day));
  function todayVocabDays(S) {
    const m = maxVocabDay(S), p = S.vocab.pointer;
    const second = p + 1 > m ? 1 : p + 1;
    return second === p ? [p] : [p, second];
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // 오늘 분량: 오늘의 Day 2개 전부 + 다른 Day에서 복습할 때가 된 단어(최대 30)
  function buildVocabSession(S, date, review = false) {
    const days = todayVocabDays(S);
    let ids;
    if (review) { // 보충용: 외운 적 있는 단어 중 30개
      ids = shuffle(S.vocab.cards.filter((c) => c.box > 0)).slice(0, 30).map((c) => c.id);
      if (!ids.length) ids = shuffle(S.vocab.cards).slice(0, 30).map((c) => c.id);
    } else {
      const main = S.vocab.cards.filter((c) => days.includes(c.day));
      const due = S.vocab.cards.filter((c) => !days.includes(c.day) && c.due && c.due <= date).slice(0, 30);
      ids = shuffle(main.concat(due)).map((c) => c.id);
    }
    return { queue: ids, first: {}, total: ids.length, days: review ? [] : days };
  }
  // 한 문제 답하기. 틀리면 그 단어를 뒤로 다시 넣는다. 끝나면 true.
  function answerVocab(sess, id, ok) {
    if (!(id in sess.first)) sess.first[id] = ok;
    sess.queue.shift();
    if (!ok) sess.queue.push(id);
    return sess.queue.length === 0;
  }
  function finishVocab(S, sess, date) {
    const ids = Object.keys(sess.first);
    let right = 0;
    for (const c of S.vocab.cards) {
      if (!(c.id in sess.first)) continue;
      if (sess.first[c.id]) { right++; c.box = Math.min(5, c.box + 1); } else c.box = 1;
      c.due = addDays(date, BOX_DAYS[c.box]);
    }
    const acc = ids.length ? right / ids.length : 1;
    if (sess.days.length) {
      const m = maxVocabDay(S);
      S.vocab.pointer = ((S.vocab.pointer - 1 + sess.days.length) % m) + 1;
    }
    return { acc, right, n: ids.length, mult: 0.5 + 0.5 * acc };
  }

  // ───────── 한글 뜻 채점(규칙 기반) ─────────
  const SUFFIX = ['시키다', '스러운', '스럽다', '적으로', '하다', '하는', '하게', '하기', '했다', '되다', '되는', '이다', '으로', '적인',
    '한', '함', '해', '된', '됨', '적', '의', '을', '를', '이', '가', '은', '는', '에', '로', '다', '기', '게', '히', '인'];
  const clean = (s) => s.replace(/\(.*?\)|\[.*?\]|<.*?>/g, '').replace(/[~∼\s.,·'"!?…\-]/g, '').toLowerCase();
  function stem(s) { for (const x of SUFFIX) if (s.length > x.length && s.endsWith(x)) return s.slice(0, -x.length); return s; }
  function lev(a, b) {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function close(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const L = Math.min(a.length, b.length);
    const tol = L >= 6 ? 2 : L >= 3 ? 1 : 0;
    if (lev(a, b) <= tol) return true;
    const [s, l] = a.length <= b.length ? [a, b] : [b, a];
    return s.length >= 2 && !SUFFIX.includes(s) && l.includes(s) && s.length / l.length > 0.5;
  }
  const parts = (s) => s.split(/[,;\/·]|또는/).map(clean).filter(Boolean);
  function gradeMeaning(answer, key) {
    const A = parts(answer), K = parts(key);
    for (const a of A) for (const k of K) {
      const av = [a, stem(a)], kv = [k, stem(k)];
      if (av.some((x) => kv.some((y) => close(x, y)))) return true;
    }
    return false;
  }

  // 단어장 붙여넣기 파싱: "Day 3" 또는 "#3" 줄이 Day를 바꾸고, "word - 뜻" 줄이 카드 하나
  function parseVocab(text) {
    let day = 1; const out = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const dm = line.match(/^(?:#|day\s*)(\d+)\s*$/i);
      if (dm) { day = +dm[1]; continue; }
      const m = line.match(/^(.+?)\s*(?:\t|\s-\s|\s:\s|=)\s*(.+)$/);
      if (m) out.push({ day, en: m[1].trim(), ko: m[2].trim() });
    }
    return out;
  }

  // ───────── 강의 집중 타이머 ─────────
  const lectureName = (n) => (n > 30 ? '전 강의 완료 · 자유 복습' : n <= 15 ? `RC ${n}강` : `LC ${n - 15}강`);
  const BREAK_LIMIT_MS = 60e3;
  function timerTick(t, now) {
    if (!t || !t.running || t.hiddenAt) return;
    t.elapsed += Math.max(0, now - t.lastTick);
    t.lastTick = now;
  }
  function timerHide(t, now) { if (t && t.running && !t.hiddenAt) { timerTick(t, now); t.hiddenAt = now; } }
  // 돌아왔을 때: 1분 넘게 나가 있었으면 실패
  function timerShow(t, now) {
    if (!t || !t.running || !t.hiddenAt) return null;
    const gap = now - t.hiddenAt;
    t.hiddenAt = null; t.lastTick = now; t.breaks++;
    if (gap > BREAK_LIMIT_MS) { t.running = false; t.failed = true; return 'fail'; }
    return 'break';
  }
  const focusMult = (breaks) => (breaks === 0 ? 1.2 : breaks < 3 ? 1 : 0.5);

  // ───────── 기출 오답 간격 반복 ─────────
  const WRONG_DAYS = [1, 3, 7];
  function addWrong(S, date, subject, year, round, nums) {
    for (const num of nums) {
      S.gichul.wrong.push({ id: `${subject}-${year}-${round}-${num}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        subject, year, round, num, stage: 0, due: addDays(date, WRONG_DAYS[0]), done: false });
    }
  }
  const dueWrong = (S, date) => S.gichul.wrong.filter((w) => !w.done && w.due <= date);
  function resolveWrong(w, date, ok) {
    if (ok) {
      w.stage++;
      if (w.stage >= WRONG_DAYS.length) { w.done = true; w.due = null; return 'graduated'; }
      w.due = addDays(date, WRONG_DAYS[w.stage]);
    } else { w.stage = 0; w.due = addDays(date, WRONG_DAYS[0]); }
    return ok ? 'next' : 'reset';
  }

  // ───────── 섬: 과일나무 ─────────
  const FRUITS = {
    cherry: { name: '체리', sell: 30, hp: 10 },
    orange: { name: '오렌지', sell: 40, hp: 12 },
    lemon: { name: '레몬', sell: 45, hp: 12 },
    pear: { name: '배', sell: 50, hp: 15 },
    banana: { name: '바나나', sell: 60, hp: 18 },
    grapes: { name: '포도', sell: 70, hp: 20 },
  };
  const COST = { plant: 8, water: 3, fish: 5, dig: 8, net: 3 }; // 나무 도구 기준
  // ───────── 도구(나무→구리→금)·옷 ─────────
  const TOOLS = { rod: '낚싯대', shovel: '삽', can: '물뿌리개', net: '잠자리채' };
  const TIER_NAME = ['', '나무', '구리', '금'], TOOL_PRICE = [0, 0, 1500, 6000];
  const TOOL_OF = { fish: 'rod', dig: 'shovel', water: 'can', net: 'net' };
  const TIER_COST = { water: [0, 3, 2, 1], fish: [0, 5, 4, 3], dig: [0, 8, 6, 5], net: [0, 3, 2, 2] };
  const tier = (S, tool) => (S.island.tools && S.island.tools[tool]) || 1;
  const cost = (S, act) => (TIER_COST[act] ? TIER_COST[act][tier(S, TOOL_OF[act])] : COST[act]);
  const TOOL_INFO = {
    rod: ['', '기본 낚싯대', 'HP 4 · 희귀한 물고기가 조금 더 잘 물어요', 'HP 3 · 희귀한 물고기가 훨씬 잘 물어요'],
    shovel: ['', '기본 삽', 'HP 6 · 화석이 더 잘 나와요', 'HP 5 · 화석이 훨씬 잘 나와요'],
    can: ['', '기본 물뿌리개', 'HP 2로 물 주기', 'HP 3으로 모든 나무에 한 번에 물 주기'],
    net: ['', '기본 잠자리채', 'HP 2 · 잘 안 놓치고 덜 도망가요', 'HP 2 · 거의 안 놓치고 훨씬 덜 도망가요'],
  };
  function buyTool(S, tool) {
    const I = S.island; I.tools = I.tools || { rod: 1, shovel: 1, can: 1, net: 1 };
    const t = tier(S, tool); if (t >= 3) return { err: '이미 금 도구예요' };
    const price = TOOL_PRICE[t + 1]; if (S.player.coins < price) return { err: `코인이 부족해요 (필요 ${price})` };
    S.player.coins -= price; I.tools[tool] = t + 1; return { ok: true, tier: t + 1 };
  }
  // 옷: 상의·하의는 색(캐릭터 그림을 물들임), 모자는 그림
  const TOPS = [
    { id: 'basic', name: '노랑 티셔츠', c: '#f4d35e', price: 0 }, { id: 'strawberry', name: '딸기우유 티셔츠', c: '#f6a5c0', price: 300 },
    { id: 'mint', name: '민트 티셔츠', c: '#9fe0c9', price: 300 }, { id: 'sky', name: '하늘 티셔츠', c: '#9cc9f5', price: 300 },
    { id: 'lavender', name: '라벤더 티셔츠', c: '#c3a9ef', price: 400 }, { id: 'tomato', name: '토마토 티셔츠', c: '#f27c64', price: 400 },
    { id: 'cream', name: '크림 티셔츠', c: '#f6efd9', price: 350 }, { id: 'forest', name: '숲속 티셔츠', c: '#6fae6a', price: 450 },
    { id: 'navy', name: '밤하늘 티셔츠', c: '#4f5f9a', price: 500 }, { id: 'peach', name: '복숭아 티셔츠', c: '#ffc59a', price: 350 },
    { id: 'gold', name: '반짝 황금 티셔츠', c: '#ffd23a', price: 3000 },
  ];
  const BOTTOMS = [
    { id: 'basic', name: '초록 반바지', c: '#7cb36b', price: 0 }, { id: 'denim', name: '청 반바지', c: '#6b8fc7', price: 300 },
    { id: 'brown', name: '코코아 반바지', c: '#9b6a4f', price: 300 }, { id: 'pink', name: '분홍 반바지', c: '#f2a2bd', price: 350 },
    { id: 'white', name: '흰 반바지', c: '#f1ece2', price: 300 }, { id: 'black', name: '검정 반바지', c: '#4a4448', price: 400 },
    { id: 'yellow', name: '바나나 반바지', c: '#f2d56b', price: 350 },
  ];
  const HATS = [
    { id: 'straw', name: '밀짚모자', price: 500 }, { id: 'beanie', name: '노랑 비니', price: 400 }, { id: 'cap', name: '하늘 야구모자', price: 400 },
    { id: 'flower', name: '꽃 화관', price: 800 }, { id: 'beret', name: '빨간 베레모', price: 600 }, { id: 'wizard', name: '마법사 모자', price: 1500 },
    { id: 'crown', name: '작은 왕관', price: 5000 }, { id: 'cat', name: '고양이 귀 머리띠', price: 900 }, { id: 'bow', name: '분홍 리본', price: 600 },
    { id: 'frog', name: '개구리 모자', price: 1200 },
  ];
  // 원피스: 입으면 상의·하의 위에 덮어 그린다. 잠수복을 입으면 바다에서 헤엄칠 수 있다(★2 해변 이후)
  const DRESSES = [
    { id: 'white', name: '하얀 원피스', price: 800 }, { id: 'flower', name: '꽃무늬 원피스', price: 1200 },
    { id: 'gingham', name: '체크 원피스', price: 1000 }, { id: 'sailor', name: '세일러 원피스', price: 1500 },
    { id: 'overall', name: '멜빵 원피스', price: 900 }, { id: 'frill', name: '분홍 프릴 원피스', price: 1300 },
    { id: 'star', name: '별빛 드레스', price: 4000 }, { id: 'lemon', name: '레몬 원피스', price: 900 },
    { id: 'wetsuit', name: '잠수복', price: 2000, swim: true },
  ];
  const CLOTHES = { top: TOPS, bottom: BOTTOMS, hat: HATS, dress: DRESSES };
  const canSwim = (S) => (S.island.stars || 1) >= 2 && (S.island.outfit || {}).dress === 'wetsuit';
  function wardrobe(S) {
    const I = S.island;
    I.wardrobe = I.wardrobe || { top: ['basic'], bottom: ['basic'], hat: [] };
    I.wardrobe.dress = I.wardrobe.dress || [];
    I.outfit = I.outfit || { top: 'basic', bottom: 'basic', hat: null };
    if (!('dress' in I.outfit)) I.outfit.dress = null;
    return I.wardrobe;
  }
  const owns = (S, slot, id) => wardrobe(S)[slot].includes(id);
  function wear(S, slot, id) { wardrobe(S); if (id && !owns(S, slot, id)) return { err: '없는 옷이에요' }; S.island.outfit[slot] = id; return { ok: true }; }
  // 오늘의 상점(날짜로 정해짐): 씨앗 2, 상의 2, 하의 1, 모자 1
  function shopToday(date) {
    let h = 7; for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
    const r = () => ((h = (h * 48271) % 2147483647) / 2147483647);
    const pickN = (arr, n) => { const a = arr.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };
    const kinds = Object.keys(FRUITS);
    return {
      seeds: pickN(kinds, 2).map((k) => ({ kind: k, price: FRUITS[k].sell * 4 })),
      top: pickN(TOPS.filter((x) => x.price), 2), bottom: pickN(BOTTOMS.filter((x) => x.price), 1), hat: pickN(HATS, 1), dress: pickN(DRESSES.filter((x) => !x.swim), 1),
    };
  }
  function buySeed(S, kind, price) {
    if (S.player.coins < price) return { err: `코인이 부족해요 (필요 ${price})` };
    S.player.coins -= price; S.island.seeds[kind] = (S.island.seeds[kind] || 0) + 1; return { ok: true };
  }
  function buyClothes(S, slot, id) {
    const it = CLOTHES[slot].find((x) => x.id === id); if (!it) return { err: '없는 옷' };
    if (owns(S, slot, id)) return { err: '이미 있어요' };
    if (S.player.coins < it.price) return { err: `코인이 부족해요 (필요 ${it.price})` };
    S.player.coins -= it.price; wardrobe(S)[slot].push(id); return { ok: true, it };
  }
  // ───────── 잡초·쓰레기: 놓친 날 생기고, 7일 깨끗하면 ★3 조건 ─────────
  function addLitter(S, missedCount, date) {
    const I = S.island; I.litter = I.litter || []; I.newLitter = I.newLitter || [];
    const n = Math.min(6, missedCount * 2) + (missedCount >= 2 ? 1 : 0);
    for (let k = 0; k < n && I.litter.length + I.newLitter.length < 20; k++) I.newLitter.push(k === n - 1 && missedCount >= 2 ? 'can' : 'weeds');
    if (n) I.cleanFrom = null;
    void date;
  }
  function clearLitter(S, idx, date) {
    const I = S.island; if (!I.litter || !I.litter[idx]) return { err: '없어요' };
    const it = I.litter.splice(idx, 1)[0];
    if (!I.litter.length && !(I.newLitter || []).length) I.cleanFrom = date;
    return { ok: true, kind: it.k };
  }
  const cleanDays = (S, today) => { const I = S.island; if ((I.litter || []).length || (I.newLitter || []).length || !I.cleanFrom) return 0; return Math.round((parseYmd(today) - parseYmd(I.cleanFrom)) / 864e5); };
  const PLOTS = 6, FRUIT_PER_HARVEST = 3, GROW_DAYS = 3;
  function defaultIsland() {
    return {
      trees: Array(PLOTS).fill(null),
      seeds: { cherry: 1, orange: 1, lemon: 1, pear: 1, banana: 1, grapes: 1 },
      fruit: {},
      maxHpBonus: 0,
      dex: { fruit: {}, fish: {}, bug: {}, fossil: {} },
      bag: { fish: {}, bug: {}, fossil: {}, ore: {}, mush: {}, sea: {} },
      dug: {},
      stars: 1,
      pos: null,
      tools: { rod: 1, shovel: 1, can: 1, net: 1 },
      wardrobe: { top: ['basic'], bottom: ['basic'], hat: [] },
      outfit: { top: 'basic', bottom: 'basic', hat: null },
      litter: [], newLitter: [], cleanFrom: null,
    };
  }
  // 나무 상태: g=0..3 (물 준 날 수). 처음엔 새싹→묘목→작은나무→(3) 다 자라며 첫 열매.
  // 다 자란 나무(mature)는 수확 후 g=0으로 돌아가 다시 3일 키우면 열매.
  const treeStage = (t) => !t ? 'empty' : t.mature ? (t.g >= GROW_DAYS ? 'fruit' : t.g === GROW_DAYS - 1 ? 'blossom' : 'tree') : ['sprout', 'sapling', 'young'][t.g];
  function needHp(S, n) { if (S.player.hp < n) return `HP가 부족해요 (필요 ${n}). 공부 탭에서 퀘스트를 깨면 HP가 들어와요!`; return null; }
  function plant(S, plot, kind, date) {
    const I = S.island;
    if (I.trees[plot]) return { err: '이미 나무가 있어요' };
    if (!(I.seeds[kind] > 0)) return { err: '씨앗이 없어요' };
    const e = needHp(S, COST.plant); if (e) return { err: e };
    S.player.hp -= COST.plant; I.seeds[kind]--;
    I.trees[plot] = { kind, g: 0, mature: false, watered: null, planted: date };
    return { ok: true, cost: COST.plant };
  }
  function water(S, plot, date) {
    const t = S.island.trees[plot];
    if (!t) return { err: '심은 게 없어요' };
    if (t.watered === date) return { err: '오늘은 이미 물을 줬어요' };
    if (treeStage(t) === 'fruit') return { err: '열매가 다 익었어요. 수확하세요!' };
    const c = cost(S, 'water'), e = needHp(S, c); if (e) return { err: e };
    S.player.hp -= c; t.watered = date;
    return { ok: true, cost: c };
  }
  // 금 물뿌리개: 한 번에 모든 나무
  function waterAll(S, date) {
    const ts = S.island.trees.filter((t) => t && t.watered !== date && treeStage(t) !== 'fruit');
    if (!ts.length) return { err: '물 줄 나무가 없어요' };
    const c = 3, e = needHp(S, c); if (e) return { err: e };
    S.player.hp -= c; ts.forEach((t) => { t.watered = date; });
    return { ok: true, cost: c, n: ts.length };
  }
  function harvest(S, plot) {
    const I = S.island, t = I.trees[plot];
    if (treeStage(t) !== 'fruit') return { err: '아직 안 익었어요' };
    I.fruit[t.kind] = (I.fruit[t.kind] || 0) + FRUIT_PER_HARVEST;
    const first = !I.dex.fruit[t.kind];
    I.dex.fruit[t.kind] = (I.dex.fruit[t.kind] || 0) + FRUIT_PER_HARVEST;
    t.mature = true; t.g = 0; t.watered = null;
    return { ok: true, kind: t.kind, n: FRUIT_PER_HARVEST, first };
  }
  // 하루가 지날 때: 그날 물을 받았고 퀘스트를 놓치지 않았으면 하루 자란다.
  function growTrees(S, d, missedDay) {
    for (const t of S.island.trees) {
      if (!t || t.watered !== d || missedDay) continue;
      if (t.g < GROW_DAYS) t.g++;
      if (!t.mature && t.g >= GROW_DAYS) t.mature = true; // 첫 열매
    }
  }
  function eat(S, kind) {
    const I = S.island; if (!(I.fruit[kind] > 0)) return { err: '없어요' };
    if (S.player.hp >= maxHp(S)) return { err: 'HP가 이미 가득해요' };
    I.fruit[kind]--; const got = heal(S, FRUITS[kind].hp);
    return { ok: true, got };
  }
  function sell(S, kind, n = 1) {
    const I = S.island; n = Math.min(n, I.fruit[kind] || 0); if (n <= 0) return { err: '없어요' };
    I.fruit[kind] -= n; const c = n * FRUITS[kind].sell; S.player.coins += c;
    return { ok: true, coins: c, n };
  }

  // ───────── 섬: 낚시·곤충·땅파기·도감 ─────────
  const D = () => G.Data;
  // 잡은 것 기록: 가방 +1, 도감에 처음이면 first=true
  function addCatch(S, sp, date) {
    const I = S.island, dex = I.dex[sp.cat];
    const first = !dex[sp.id];
    dex[sp.id] = dex[sp.id] || { n: 0, first: date };
    dex[sp.id].n++;
    I.bag[sp.cat][sp.id] = (I.bag[sp.cat][sp.id] || 0) + 1;
    return { first };
  }
  function spend(S, n) { const e = needHp(S, n); if (e) return e; S.player.hp -= n; return null; }
  // 럭키: 씨앗 / 코인 주머니 / 보물상자
  function lucky(S, rng = Math.random) {
    const x = rng();
    if (x < 0.55) { const k = Object.keys(FRUITS)[Math.floor(rng() * 6)]; S.island.seeds[k] = (S.island.seeds[k] || 0) + 1; return { what: 'seed', kind: k, text: `${FRUITS[k].name} 씨앗` }; }
    if (x >= 0.8 && x < 0.9) {
      const slots = ['top', 'bottom', 'hat'], pool = [];
      for (const sl of slots.concat('dress')) for (const it of CLOTHES[sl]) if (it.price && !['crown', 'gold', 'star', 'wetsuit'].includes(it.id) && !owns(S, sl, it.id)) pool.push([sl, it]);
      if (pool.length) { const [sl, it] = pool[Math.floor(rng() * pool.length)]; wardrobe(S)[sl].push(it.id); return { what: 'clothes', slot: sl, id: it.id, text: `${it.name}!` }; }
    }
    if (x < 0.9) { const c = 100 + Math.floor(rng() * 5) * 50; S.player.coins += c; return { what: 'coins', coins: c, text: `코인 주머니 (+${c})` }; }
    const c = 1000; S.player.coins += c; const k = Object.keys(FRUITS)[Math.floor(rng() * 6)]; S.island.seeds[k] = (S.island.seeds[k] || 0) + 2;
    return { what: 'chest', coins: c, kind: k, text: `보물상자! 코인 +${c}, ${FRUITS[k].name} 씨앗 2개` };
  }
  function digResult(S, date, rng = Math.random) {
    const x = rng();
    if (x < [0, 0.6, 0.68, 0.75][tier(S, 'shovel')]) { const sp = D().pick(D().FOSSILS, rng, hasV(S, 'lulu') ? 0.3 : 0); return { type: 'catch', sp, ...addCatch(S, sp, date) }; }
    if (x < 0.92) {
      const y = rng(), id = y < 0.35 ? 'stone' : y < 0.65 ? 'copper' : y < 0.82 ? 'silver' : y < 0.92 ? 'gold' : ['ruby', 'emerald', 'amethyst', 'topaz'][Math.floor(rng() * 4)];
      S.island.bag.ore[id] = (S.island.bag.ore[id] || 0) + 1; return { type: 'ore', id };
    }
    return { type: 'lucky', ...lucky(S, rng) };
  }
  function dig(S, date, spotKey, rng) {
    const I = S.island; I.dug[date] = I.dug[date] || [];
    if (I.dug[date].includes(spotKey)) return { err: '이미 판 곳이에요' };
    const e = spend(S, cost(S, 'dig')); if (e) return { err: e };
    I.dug[date].push(spotKey);
    for (const k of Object.keys(I.dug)) if (k < addDays(date, -3)) delete I.dug[k];
    return { ok: true, ...digResult(S, date, rng) };
  }
  // 낚시: 던질 때 HP를 쓰고 무엇이 물지 정해 둔다(그림자 크기로 힌트).
  function castLine(S, loc, when, rng = Math.random) {
    const e = spend(S, cost(S, 'fish')); if (e) return { err: e };
    if (rng() < luckyChance(S)) return { ok: true, lucky: true, size: 2 };
    const sp = D().pick(D().fishPool(loc, when), rng, luckBonus(S));
    return { ok: true, sp, size: sp ? sp.size : 1 };
  }
  function landFish(S, cast, date) {
    if (cast.lucky) return { type: 'lucky', ...lucky(S) };
    return { type: 'catch', sp: cast.sp, ...addCatch(S, cast.sp, date) };
  }
  // 버섯 따기: HP 없이, 하루에 그 자리 한 번
  function pickMush(S, date, spotKey, when = new Date(), rng = Math.random) {
    const I = S.island; I.picked = I.picked || {}; I.picked[date] = I.picked[date] || [];
    if (I.picked[date].includes(spotKey)) return { err: '이미 땄어요' };
    I.picked[date].push(spotKey);
    for (const k of Object.keys(I.picked)) if (k < addDays(date, -3)) delete I.picked[k];
    const pool = Object.entries(D().MUSH).filter(([, m]) => D().available({ m: m.m, h: null }, when)).map(([id, m]) => ({ id, ...m }));
    const m = D().pick(pool, rng, luckBonus(S));
    I.bag.mush = I.bag.mush || {}; I.bag.mush[m.id] = (I.bag.mush[m.id] || 0) + 1;
    return { ok: true, id: m.id, m };
  }
  // 잠수: 거품이 오르는 곳에서 HP 5. 바닷고기(도감) 55%, 바다 보물 42%, 럭키 3%
  const DIVE_HP = 5;
  function dive(S, date, spotKey, when = new Date(), rng = Math.random) {
    if (!canSwim(S)) return { err: '잠수복을 입어야 해요' };
    const I = S.island; I.dove = I.dove || {}; I.dove[date] = I.dove[date] || [];
    if (I.dove[date].includes(spotKey)) return { err: '이미 잠수한 곳이에요' };
    const e = spend(S, DIVE_HP); if (e) return { err: e };
    I.dove[date].push(spotKey);
    for (const k of Object.keys(I.dove)) if (k < addDays(date, -3)) delete I.dove[k];
    const x = rng();
    if (x < 0.55) { const sp = D().pick(D().fishPool('sea', when), rng, luckBonus(S)); if (sp) return { ok: true, type: 'catch', sp, ...addCatch(S, sp, date) }; }
    if (x < 0.97) {
      const pool = Object.entries(D().SEALOOT).map(([id, m]) => ({ id, ...m })), m = D().pick(pool, rng, luckBonus(S));
      I.bag.sea = I.bag.sea || {}; I.bag.sea[m.id] = (I.bag.sea[m.id] || 0) + 1; return { ok: true, type: 'sea', id: m.id, m };
    }
    return { ok: true, type: 'lucky', ...lucky(S, rng) };
  }
  // 곤충: 다가갈 때 도망칠 확률은 희귀할수록 높고, 휘두를 때 HP를 쓴다.
  const NET_HIT = [0, 0.9, 0.8, 0.65, 0.5, 0.4];
  const FLEE = [0, 0.02, 0.04, 0.07, 0.1, 0.13]; // 다가가는 동안 0.25초마다
  function swingNet(S, sp, date, rng = Math.random) {
    const e = spend(S, cost(S, 'net')); if (e) return { err: e };
    if (rng() > Math.min(0.97, NET_HIT[sp.r] + [0, 0, 0.08, 0.15][tier(S, 'net')])) return { ok: true, miss: true };
    return { ok: true, type: 'catch', sp, ...addCatch(S, sp, date) };
  }
  const luckBonus = (S) => [0, 0, 0.2, 0.5][tier(S, 'rod')] + (hasV(S, 'lulu') ? 0.3 : 0);
  const luckyChance = (S) => (hasV(S, 'lulu') ? 0.08 : 0.05);
  const fleeChance = (S, r) => FLEE[r] * [1, 1, 0.8, 0.6][tier(S, 'net')];
  function sellItem(S, cat, id, n = 1) {
    const bag = S.island.bag[cat]; n = Math.min(n, bag[id] || 0); if (n <= 0) return { err: '없어요' };
    const price = cat === 'ore' ? D().ORES[id].sell : cat === 'mush' ? D().MUSH[id].sell : cat === 'sea' ? D().SEALOOT[id].sell : D().BY_ID[id].sell;
    bag[id] -= n; if (!bag[id]) delete bag[id];
    S.player.coins += price * n; return { ok: true, coins: price * n };
  }
  function eatFish(S, id) {
    const bag = S.island.bag.fish; if (!(bag[id] > 0)) return { err: '없어요' };
    if (S.player.hp >= maxHp(S)) return { err: 'HP가 이미 가득해요' };
    bag[id]--; if (!bag[id]) delete bag[id];
    return { ok: true, got: heal(S, D().BY_ID[id].hp) };
  }
  // ───────── 주민: 여러 경로로 찾아와 눌러앉는다 ─────────
  const gichulSets = (S) => Object.values(S.gichul.done || {}).reduce((a, o) => a + Object.keys(o).length, 0);
  const dexN = (S, c) => Object.keys(S.island.dex[c] || {}).length;
  const VILLAGERS = [
    { id: 'toto', name: '토토', kind: '토끼 정원사', role: '매일 아침 물 안 준 나무 2그루에 물을 줘요', how: '섬 별점 ★2', star: 2, ok: (S) => (S.island.stars || 1) >= 2 },
    { id: 'mongsil', name: '몽실', kind: '양 청소부', role: '매일 잡초·쓰레기를 2개까지 치워요', how: '섬 별점 ★3', star: 3, ok: (S) => (S.island.stars || 1) >= 3 },
    { id: 'coco', name: '코코', kind: '다람쥐 채집가', role: '매일 과일·씨앗·코인 중 하나를 주워 와요', how: '섬 별점 ★4', star: 4, ok: (S) => (S.island.stars || 1) >= 4 },
    { id: 'lulu', name: '루루', kind: '별빛 고양이', role: '희귀한 걸 낚고 캘 확률이 오르고 럭키가 더 자주 나와요', how: '섬 별점 ★5', star: 5, ok: (S) => (S.island.stars || 1) >= 5 },
    { id: 'kongi', name: '콩이', kind: '병아리', role: '매일 씨앗 1개를 가져와요', how: '올클리어 3일 연속', ok: (S) => S.player.bestStreak >= 3 },
    { id: 'bori', name: '보리', kind: '강아지 배달부', role: '매일 코인 80개를 가져와요', how: '올클리어 7일 연속', ok: (S) => S.player.bestStreak >= 7 },
    { id: 'maru', name: '마루', kind: '판다', role: '매일 과일 2개를 나눠 줘요', how: '올클리어 14일 연속', ok: (S) => S.player.bestStreak >= 14 },
    { id: 'byeolha', name: '별하', kind: '여우', role: '매일 보석 1개를 찾아와요', how: '올클리어 30일 연속', ok: (S) => S.player.bestStreak >= 30 },
    { id: 'pado', name: '파도', kind: '수달 낚시꾼', role: '매일 물고기 1마리를 나눠 줘요(가방으로)', how: '물고기 도감 25종', ok: (S) => dexN(S, 'fish') >= 25 },
    { id: 'gaegul', name: '개굴', kind: '개구리 곤충 박사', role: '매일 곤충 1마리를 나눠 줘요(가방으로)', how: '곤충 도감 25종', ok: (S) => dexN(S, 'bug') >= 25 },
    { id: 'bueong', name: '부엉', kind: '부엉이 고고학자', role: '빛나는 땅이 하루 1곳 더 생겨요', how: '화석 도감 25종', ok: (S) => dexN(S, 'fossil') >= 25 },
    { id: 'pengi', name: '펭이', kind: '펭귄 영어 선생님', role: '매일 코인 100개를 장학금으로 줘요', how: 'RC 강의 15강 완주', ok: (S) => (S.lecture.next || 1) > 15 },
    { id: 'gomdol', name: '곰돌', kind: '곰 광부', role: '매일 광석 1개를 캐 와요', how: '기출 20세트', ok: (S) => gichulSets(S) >= 20 },
    { id: 'nana', name: '나나', kind: '코알라 캠퍼', role: '매일 과일 1개와 씨앗 1개를 줘요', how: '떠돌이 손님 (3일 말 걸기)', visitor: true },
    { id: 'mungchi', name: '뭉치', kind: '햄스터', role: '매일 코인을 모아 와요(가끔 듬뿍)', how: '떠돌이 손님 (3일 말 걸기)', visitor: true },
    { id: 'podeun', name: '포근', kind: '알파카 재단사', role: '가끔 옷을 지어 줘요', how: '떠돌이 손님 (3일 말 걸기)', visitor: true },
    { id: 'bomi', name: '봄이', kind: '고슴도치 정원사', role: '토토를 도와 나무 1그루에 더 물을 줘요', how: '토토와 친밀도 10', ok: (S) => ((S.island.friend || {}).toto || 0) >= 10 },
  ];
  const V_BY = Object.fromEntries(VILLAGERS.map((v) => [v.id, v]));
  const residents = (S) => (S.island.residents = S.island.residents || []);
  const villagersHere = (S) => residents(S).map((id) => V_BY[id]).filter(Boolean);
  const hasV = (S, id) => residents(S).includes(id);
  // 조건을 채운 주민을 이사시키고, 새로 온 주민 목록을 돌려준다
  function checkArrivals(S) {
    const R = residents(S), out = [];
    for (const v of VILLAGERS) if (!v.visitor && !R.includes(v.id) && v.ok(S)) { R.push(v.id); out.push(v); }
    return out;
  }
  const extraDigSpots = (S) => (hasV(S, 'bueong') ? 1 : 0);
  // 하루 한 번(앱을 연 날) 주민 도움과 떠돌이 손님
  function villagerHelp(S, date, rng = Math.random) {
    const I = S.island; if (I.helpDate === date) return [];
    I.helpDate = date; const out = [];
    const kinds = Object.keys(FRUITS), rk = () => kinds[Math.floor(rng() * kinds.length)];
    const water = (n, who) => {
      const ts = I.trees.filter((t) => t && t.watered !== date && treeStage(t) !== 'fruit').slice(0, n);
      ts.forEach((t) => { t.watered = date; }); if (ts.length) out.push(`${who}가 나무 ${ts.length}그루에 물을 줬어요`);
    };
    if (hasV(S, 'toto')) water(2, '🐰 토토');
    if (hasV(S, 'bomi')) water(1, '🦔 봄이');
    if (hasV(S, 'mongsil')) {
      let n = 0;
      while (n < 2 && (I.newLitter || []).length) { I.newLitter.pop(); n++; }
      while (n < 2 && (I.litter || []).length) { I.litter.pop(); n++; }
      if (n && !(I.litter || []).length && !(I.newLitter || []).length) I.cleanFrom = I.cleanFrom || date;
      if (n) out.push(`🐑 몽실이 잡초·쓰레기 ${n}개를 치웠어요`);
    }
    if (hasV(S, 'coco')) {
      const x = rng(), k = rk();
      if (x < 0.5) { I.fruit[k] = (I.fruit[k] || 0) + 2; out.push(`🐿️ 코코가 ${FRUITS[k].name} 2개를 주워 왔어요`); }
      else if (x < 0.8) { I.seeds[k] = (I.seeds[k] || 0) + 1; out.push(`🐿️ 코코가 ${FRUITS[k].name} 씨앗을 주워 왔어요`); }
      else { S.player.coins += 150; out.push('🐿️ 코코가 코인 150개를 주워 왔어요'); }
    }
    const coin = (n, msg) => { S.player.coins += n; out.push(msg); };
    if (hasV(S, 'kongi')) { const k = rk(); I.seeds[k] = (I.seeds[k] || 0) + 1; out.push(`🐥 콩이가 ${FRUITS[k].name} 씨앗을 가져왔어요`); }
    if (hasV(S, 'bori')) coin(80, '🐶 보리가 코인 80개를 배달했어요');
    if (hasV(S, 'maru')) { const k = rk(); I.fruit[k] = (I.fruit[k] || 0) + 2; out.push(`🐼 마루가 ${FRUITS[k].name} 2개를 나눠 줬어요`); }
    if (hasV(S, 'byeolha')) { const g = ['ruby', 'emerald', 'amethyst', 'topaz'][Math.floor(rng() * 4)]; I.bag.ore[g] = (I.bag.ore[g] || 0) + 1; out.push(`🦊 별하가 ${D().ORES[g].name}를 찾아왔어요`); }
    if (hasV(S, 'pado')) { const pool = D().FISH.filter((f) => f.r <= 3 && f.loc === 'pond'); const f = pool[Math.floor(rng() * pool.length)]; I.bag.fish[f.id] = (I.bag.fish[f.id] || 0) + 1; out.push(`🦦 파도가 ${f.name}를 나눠 줬어요 (가방)`); }
    if (hasV(S, 'gaegul')) { const pool = D().BUGS.filter((b) => b.r <= 3); const b = pool[Math.floor(rng() * pool.length)]; I.bag.bug[b.id] = (I.bag.bug[b.id] || 0) + 1; out.push(`🐸 개굴이 ${b.name}를 나눠 줬어요 (가방)`); }
    if (hasV(S, 'pengi')) coin(100, '🐧 펭이가 장학금 100코인을 줬어요');
    if (hasV(S, 'gomdol')) { const y = rng(), o = y < 0.5 ? 'copper' : y < 0.85 ? 'silver' : 'gold'; I.bag.ore[o] = (I.bag.ore[o] || 0) + 1; out.push(`🐻 곰돌이 ${D().ORES[o].name}을 캐 왔어요`); }
    if (hasV(S, 'nana')) { const k = rk(), k2 = rk(); I.fruit[k] = (I.fruit[k] || 0) + 1; I.seeds[k2] = (I.seeds[k2] || 0) + 1; out.push(`🐨 나나가 ${FRUITS[k].name}와 ${FRUITS[k2].name} 씨앗을 줬어요`); }
    if (hasV(S, 'mungchi')) { const c = rng() < 0.15 ? 300 : 50; coin(c, `🐹 뭉치가 코인 ${c}개를 모아 왔어요`); }
    if (hasV(S, 'podeun') && rng() < 0.2) {
      const pool = []; for (const sl of ['top', 'bottom', 'hat']) for (const it of CLOTHES[sl]) if (it.price && it.id !== 'crown' && it.id !== 'gold' && !owns(S, sl, it.id)) pool.push([sl, it]);
      if (pool.length) { const [sl, it] = pool[Math.floor(rng() * pool.length)]; wardrobe(S)[sl].push(it.id); out.push(`🦙 포근이 ${it.name}을(를) 지어 줬어요! 집 옷장을 보세요`); }
    }
    // 떠돌이 손님: 3일 안에 다른 날 세 번 말 걸면 눌러앉고, 5일 지나면 떠난다
    const vis = I.visitor;
    if (vis && (parseYmd(date) - parseYmd(vis.from)) / 864e5 >= 5) { out.push(`🏕️ ${V_BY[vis.id].name}가 섬을 떠났어요. 언젠가 또 올지도 몰라요`); I.visitor = null; }
    if (!I.visitor) {
      const left = VILLAGERS.filter((v) => v.visitor && !hasV(S, v.id));
      if (left.length && rng() < 0.35) { const v = left[Math.floor(rng() * left.length)]; I.visitor = { id: v.id, from: date, talks: [] }; out.push(`🏕️ ${v.name}(${v.kind})가 섬에 놀러 왔어요! 다른 날 세 번 말을 걸면 이사 올지도 몰라요`); }
    }
    return out;
  }
  // 말 걸기: 주민마다 하루 한 번 작은 선물, 친해지면 큰 선물
  const FRIEND_GIFT = { 5: 300, 15: 800, 30: 2000 };
  function talk(S, id, date, rng = Math.random) {
    const I = S.island; I.talked = I.talked || {}; I.friend = I.friend || {};
    const vis = I.visitor && I.visitor.id === id ? I.visitor : null;
    if (!hasV(S, id) && !vis) return { err: '아직 없는 주민' };
    if (I.talked[id] === date) return { ok: true, again: true, friend: I.friend[id] || 0, visit: vis ? vis.talks.length : null };
    I.talked[id] = date; I.friend[id] = (I.friend[id] || 0) + 1;
    const coins = 20 + Math.floor(rng() * 5) * 10; S.player.coins += coins;
    const big = vis ? 0 : FRIEND_GIFT[I.friend[id]] || 0; S.player.coins += big;
    let moved = false;
    if (vis) { if (!vis.talks.includes(date)) vis.talks.push(date); if (vis.talks.length >= 3) { residents(S).push(id); I.visitor = null; moved = true; } }
    return { ok: true, coins, big, friend: I.friend[id], visit: vis ? vis.talks.length : null, moved };
  }

  // 섬 별점
  const dexCount = (S) => ['fruit', 'fish', 'bug', 'fossil'].reduce((a, c) => a + Object.keys(S.island.dex[c] || {}).length, 0);
  const STAR_RULES = [
    null, null,
    { dex: 15, text: '도감 15종 + 과일나무 3그루', ok: (S) => S.island.trees.filter(Boolean).length >= 3 },
    { dex: 50, text: '도감 50종 + 잡초·쓰레기 없는 섬 7일', ok: (S, today) => cleanDays(S, today) >= 7 },
    { dex: 110, text: '도감 110종 + 금 도구 1개', ok: (S) => Object.keys(TOOLS).some((t) => tier(S, t) >= 3) },
    { dex: 200, text: '도감 200종', ok: () => true },
  ];
  function computeStars(S, today = gameDate()) {
    let st = 1;
    for (let k = 2; k <= 5; k++) { const r = STAR_RULES[k]; if (dexCount(S) >= r.dex && r.ok(S, today)) st = k; else break; }
    return st;
  }
  // 별점이 올랐으면 새 별점을 돌려준다
  function checkStars(S, today) {
    const st = computeStars(S, today);
    if (st > (S.island.stars || 1)) { S.island.stars = st; return st; }
    return null;
  }

  G.Core = {
    DAY_SHIFT_H, ymd, parseYmd, addDays, gameDate, weekday, weekStart, WD,
    R, maxHp, MISS_HP, CHURCH_HP, BASE_MAX_HP,
    TOOLS, TIER_NAME, TOOL_PRICE, TOOL_INFO, tier, cost, buyTool, waterAll, fleeChance, TOPS, BOTTOMS, HATS, CLOTHES, wardrobe, owns, wear, shopToday, buySeed, buyClothes,
    addLitter, clearLitter, cleanDays, VILLAGERS, V_BY, villagersHere, villagerHelp, talk, FRIEND_GIFT, checkArrivals, extraDigSpots,
    addCatch, lucky, dig, pickMush, dive, DIVE_HP, canSwim, DRESSES, digResult, castLine, landFish, swingNet, FLEE, NET_HIT, sellItem, eatFish, dexCount, STAR_RULES, computeStars, checkStars,
    FRUITS, COST, PLOTS, GROW_DAYS, defaultIsland, treeStage, plant, water, harvest, growTrees, eat, sell, heal,
    SUBJECTS, SUBJECT_BY_WD, questsFor, isComplete, defaultState, dayRec, qRec,
    reward, damage, checkAllClear, settle, makeupList, completeMakeup,
    todayVocabDays, buildVocabSession, answerVocab, finishVocab, gradeMeaning, parseVocab, maxVocabDay,
    lectureName, timerTick, timerHide, timerShow, focusMult, BREAK_LIMIT_MS,
    addWrong, dueWrong, resolveWrong,
  };
})(typeof window !== 'undefined' ? window : globalThis);
