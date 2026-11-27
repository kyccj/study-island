require('../data.js');
require('../core.js');
const D = globalThis.Data;
const C = globalThis.Core, assert = require('assert');
let fails = 0;
const t = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (e) { fails++; console.log('FAIL', name, '\n   ', e.message); } };

// 채점
const yes = [['시행하다', '시행하다, 실행하다'], ['실행', '시행하다, 실행하다'], ['시행함', '시행하다, 실행하다'],
  ['포괄적', '포괄적인, 종합적인'], ['종합적인', '포괄적인, 종합적인'], ['미루기', '연기하다, 미루다'],
  ['상환', '변제하다, 상환하다'], ['의무', '의무적인, 필수의'], ['필수', '의무적인, 필수의'], ['그다음의', '그 다음의, 이후의'],
  ['연기하다', '(일정을) 연기하다'], ['평가', '평가하다'], ['시행 하다', '시행하다'], ['실행하댜', '시행하다, 실행하다']];
const no = [['취소하다', '연기하다, 미루다'], ['사과', '포괄적인, 종합적인'], ['가', '나'], ['', '시행하다'], ['하다', '시행하다']];
t('채점: 의미 통하는 답은 정답', () => yes.forEach(([a, k]) => assert.ok(C.gradeMeaning(a, k), `${a} / ${k}`)));
t('채점: 다른 뜻은 오답', () => no.forEach(([a, k]) => assert.ok(!C.gradeMeaning(a, k), `${a} / ${k}`)));

// 붙여넣기
t('단어장 파싱', () => {
  const r = C.parseVocab('Day 1\nabandon - 버리다, 포기하다\nabsorb\t흡수하다\n#2\nacquire : 얻다\n\n잡음줄');
  assert.deepStrictEqual(r.map((x) => [x.day, x.en, x.ko]), [[1, 'abandon', '버리다, 포기하다'], [1, 'absorb', '흡수하다'], [2, 'acquire', '얻다']]);
});

// 날짜: 새벽 4시 경계
t('새벽 3시는 전날', () => assert.strictEqual(C.gameDate(new Date(2026, 10, 25, 3, 59).getTime()), '2026-11-24'));
t('새벽 4시는 당일', () => assert.strictEqual(C.gameDate(new Date(2026, 10, 25, 4, 0).getTime()), '2026-11-25'));

// 일정 (2026-11-23 월)
t('월요일 퀘스트', () => assert.deepStrictEqual(C.questsFor('2026-11-23').map((q) => q.id), ['vocab', 'toeicSet', 'gichul', 'strength', 'weight']));
t('화요일 퀘스트', () => assert.deepStrictEqual(C.questsFor('2026-11-24').map((q) => q.id), ['vocab', 'toeicReview', 'lecture', 'strength']));
t('일요일 퀘스트', () => assert.deepStrictEqual(C.questsFor('2026-11-29').map((q) => q.id), ['vocab', 'strength', 'church']));
t('목요일 과목', () => assert.strictEqual(C.questsFor('2026-11-26').find((q) => q.id === 'gichul').subject, '전기기기'));

// 정산
t('첫 실행은 벌칙 없음', () => { const S = C.defaultState(); assert.deepStrictEqual(C.settle(S, '2026-11-25'), []); assert.strictEqual(S.player.hp, 100); });
t('하루 다 놓치면 퀘스트 수×10 감소', () => {
  const S = C.defaultState(); S.lastSettled = '2026-11-22';
  C.settle(S, '2026-11-24'); // 월요일 5개 놓침
  assert.strictEqual(S.player.hp, 50); assert.deepStrictEqual(S.days['2026-11-23'].missed.length, 5);
});
t('HP는 0 아래로 안 내려감', () => {
  const S = C.defaultState(); S.lastSettled = '2026-11-22'; S.player.hp = 30;
  C.settle(S, '2026-11-24'); assert.strictEqual(S.player.hp, 0);
});
t('휴식권 쓴 날은 벌칙 없음', () => {
  const S = C.defaultState(); S.lastSettled = '2026-11-22'; C.dayRec(S, '2026-11-23').rest = true;
  C.settle(S, '2026-11-24'); assert.strictEqual(S.player.hp, 100);
});
t('근력은 한 동작만 해도 완료, 토익은 RC만 해도 완료', () => {
  assert.ok(C.isComplete('strength', { items: { 푸시업: 3, 스쿼트: 1 } }));
  assert.ok(!C.isComplete('strength', { items: { 푸시업: 2 } }));
  assert.ok(C.isComplete('toeicSet', { rc: { score: 80 } }));
});
t('올클리어는 한 번만 HP+5·스트릭+1', () => {
  const S = C.defaultState(); S.player.hp = 90; const d = '2026-11-24';
  ['vocab', 'toeicReview', 'lecture'].forEach((id) => (C.qRec(S, d, id).done = true));
  assert.deepStrictEqual(C.checkAllClear(S, d), []);
  C.qRec(S, d, 'strength').items = { 푸시업: 3 };
  assert.ok(C.checkAllClear(S, d).length); assert.deepStrictEqual(C.checkAllClear(S, d), []);
  assert.deepStrictEqual([S.player.hp, S.player.streak], [95, 1]);
});

// 보충
t('일요일 보충 목록과 환급', () => {
  const S = C.defaultState(); S.lastSettled = '2026-11-22';
  C.settle(S, '2026-11-29'); // 월~토 정산
  const list = C.makeupList(S, '2026-11-29');
  assert.ok(list.length > 0 && list.every((x) => x.date >= '2026-11-23'));
  S.player.hp = 20; C.completeMakeup(S, list[0].date, list[0].id, C.R.weight, 'x');
  assert.strictEqual(S.player.hp, 20 + 10 + 8); // 환급 10 + 5×1.5 assert.strictEqual(C.makeupList(S, '2026-11-29').length, list.length - 1);
  assert.deepStrictEqual(C.makeupList(S, '2026-11-28'), []); // 토요일엔 없음
});

// 단어 세션
t('단어 세션: 틀린 건 다시 나오고, 끝나면 Day 2개 전진', () => {
  const S = C.defaultState(); const d = '2026-11-25';
  const s = C.buildVocabSession(S, d); assert.strictEqual(s.total, 6);
  const firstId = s.queue[0];
  C.answerVocab(s, firstId, false); assert.strictEqual(s.queue[s.queue.length - 1], firstId);
  let done = false; while (!done) done = C.answerVocab(s, s.queue[0], true);
  const r = C.finishVocab(S, s, d);
  assert.strictEqual(r.right, 5); assert.strictEqual(S.vocab.pointer, 1); // Day가 2개뿐이라 한 바퀴
  const wrong = S.vocab.cards.find((c) => c.id === firstId); assert.deepStrictEqual([wrong.box, wrong.due], [1, '2026-11-26']);
});
t('단어 Day 30 순환', () => {
  const S = C.defaultState(); S.vocab.cards = Array.from({ length: 30 }, (_, i) => ({ id: 'c' + i, day: i + 1, en: 'w' + i, ko: '뜻', box: 0, due: null }));
  S.vocab.pointer = 29; assert.deepStrictEqual(C.todayVocabDays(S), [29, 30]);
  const s = C.buildVocabSession(S, '2026-11-25'); s.queue.slice().forEach((id) => C.answerVocab(s, id, true));
  C.finishVocab(S, s, '2026-11-25'); assert.strictEqual(S.vocab.pointer, 1);
});

// 타이머
t('타이머: 짧게 나갔다 오면 깨짐 1회, 1분 넘으면 실패', () => {
  const tm = { running: true, elapsed: 0, lastTick: 0, hiddenAt: null, breaks: 0 };
  C.timerTick(tm, 10e3); C.timerHide(tm, 20e3); assert.strictEqual(tm.elapsed, 20e3);
  assert.strictEqual(C.timerShow(tm, 50e3), 'break'); C.timerTick(tm, 60e3); assert.strictEqual(tm.elapsed, 30e3); // 나가 있던 시간은 안 셈
  C.timerHide(tm, 70e3); assert.strictEqual(C.timerShow(tm, 140e3), 'fail'); assert.ok(tm.failed);
});

// 기출 오답
t('오답: 1→3→7일, 틀리면 처음으로, 세 번 맞으면 졸업', () => {
  const S = C.defaultState(); C.addWrong(S, '2026-11-23', '전기자기학', 2020, 1, [3]);
  const w = S.gichul.wrong[0]; assert.strictEqual(w.due, '2026-11-24');
  assert.strictEqual(C.dueWrong(S, '2026-11-23').length, 0); assert.strictEqual(C.dueWrong(S, '2026-11-24').length, 1);
  C.resolveWrong(w, '2026-11-24', true); assert.strictEqual(w.due, '2026-11-27');
  C.resolveWrong(w, '2026-11-27', false); assert.deepStrictEqual([w.stage, w.due], [0, '2026-11-28']);
  C.resolveWrong(w, '2026-11-28', true); C.resolveWrong(w, '2026-12-01', true);
  assert.strictEqual(C.resolveWrong(w, '2026-12-08', true), 'graduated');
});

// 섬
t('HP 보상은 최대치에서 멈춤', () => {
  const S = C.defaultState(); S.player.hp = 140;
  C.reward(S, 30, 'x'); assert.strictEqual(S.player.hp, C.BASE_MAX_HP);
});
t('과일나무: 심고 3일 물 주면 열매, 수확 후 다시 3일', () => {
  const S = C.defaultState(); S.player.hp = 100;
  assert.ok(C.plant(S, 0, 'cherry', '2026-11-23').ok); assert.strictEqual(S.player.hp, 92);
  assert.ok(C.plant(S, 0, 'orange', '2026-11-23').err);
  const days = ['2026-11-23', '2026-11-24', '2026-11-25'];
  const stages = [];
  for (const d of days) { assert.ok(C.water(S, 0, d).ok); assert.ok(C.water(S, 0, d).err); C.growTrees(S, d, false); stages.push(C.treeStage(S.island.trees[0])); }
  assert.deepStrictEqual(stages, ['sapling', 'young', 'fruit']);
  const h = C.harvest(S, 0); assert.ok(h.ok && h.first); assert.strictEqual(S.island.fruit.cherry, 3);
  assert.strictEqual(C.treeStage(S.island.trees[0]), 'tree');
  C.water(S, 0, '2026-11-26'); C.growTrees(S, '2026-11-26', false); C.water(S, 0, '2026-11-27'); C.growTrees(S, '2026-11-27', false);
  assert.strictEqual(C.treeStage(S.island.trees[0]), 'blossom');
});
t('물 안 준 날, 퀘스트 놓친 날은 안 자람', () => {
  const S = C.defaultState(); C.plant(S, 1, 'pear', '2026-11-23');
  C.growTrees(S, '2026-11-23', false); assert.strictEqual(S.island.trees[1].g, 0);
  C.water(S, 1, '2026-11-24'); C.growTrees(S, '2026-11-24', true); assert.strictEqual(S.island.trees[1].g, 0);
});
t('정산할 때 나무도 자람', () => {
  const S = C.defaultState(); S.lastSettled = '2026-11-23'; C.plant(S, 2, 'lemon', '2026-11-24'); C.water(S, 2, '2026-11-24');
  ['vocab', 'toeicReview', 'lecture'].forEach((id) => (C.qRec(S, '2026-11-24', id).done = true)); C.qRec(S, '2026-11-24', 'strength').items = { a: 3 };
  C.settle(S, '2026-11-25'); assert.strictEqual(S.island.trees[2].g, 1);
});
t('HP 부족하면 행동 못 함, 먹기·팔기', () => {
  const S = C.defaultState(); S.player.hp = 5;
  assert.ok(C.plant(S, 0, 'cherry', '2026-11-23').err.includes('HP'));
  S.island.fruit.grapes = 2;
  assert.strictEqual(C.eat(S, 'grapes').got, 20); assert.strictEqual(S.player.hp, 25);
  assert.strictEqual(C.sell(S, 'grapes', 5).coins, 70); assert.strictEqual(S.island.fruit.grapes, 0);
});
// 2단계: 낚시·곤충·화석
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
t('도감 300종(각 100), 이름·id 중복 없음', () => {
  assert.deepStrictEqual([D.FISH.length, D.BUGS.length, D.FOSSILS.length], [100, 100, 100]);
  assert.strictEqual(new Set([...D.FISH, ...D.BUGS, ...D.FOSSILS].map((x) => x.name)).size, 300);
  assert.strictEqual(new Set([...D.FISH, ...D.BUGS, ...D.FOSSILS].map((x) => x.id)).size, 300);
});
t('출현 시간: 밤 물고기·겨울 물고기', () => {
  const eel = D.BY_ID.eel, puffer = D.BY_ID.puffer;
  assert.ok(D.available(eel, new Date(2026, 6, 1, 22))); assert.ok(!D.available(eel, new Date(2026, 6, 1, 12)));
  assert.ok(D.available(eel, new Date(2026, 6, 1, 3))); assert.ok(!D.available(eel, new Date(2026, 0, 1, 22)));
  assert.ok(D.available(puffer, new Date(2026, 0, 5, 12))); assert.ok(D.available(puffer, new Date(2026, 11, 5, 12))); assert.ok(!D.available(puffer, new Date(2026, 5, 5, 12)));
});
t('낚시: HP 5 쓰고, 잡으면 가방·도감', () => {
  const S = C.defaultState(); S.player.hp = 50;
  const c = C.castLine(S, 'pond', new Date(2026, 10, 25, 14), seq(0.5, 0.01));
  assert.ok(c.ok && c.sp && c.sp.loc === 'pond'); assert.strictEqual(S.player.hp, 45);
  const r = C.landFish(S, c, '2026-11-25'); assert.ok(r.first);
  assert.strictEqual(S.island.bag.fish[c.sp.id], 1); assert.ok(!C.landFish(S, c, '2026-11-25').first);
  S.player.hp = 2; assert.ok(C.castLine(S, 'pond', new Date()).err);
});
t('곤충: 빗나가면 아무것도 없음, 맞으면 잡힘', () => {
  const S = C.defaultState(); const sp = D.BY_ID.morpho;
  assert.ok(C.swingNet(S, sp, 'd', () => 0.99).miss);
  assert.ok(C.swingNet(S, sp, 'd', () => 0.1).first); assert.strictEqual(S.player.hp, 94);
});
t('땅파기: 같은 자리 하루 한 번, 화석/광물/럭키', () => {
  const S = C.defaultState();
  const a = C.dig(S, '2026-11-25', '5,5', seq(0.1, 0.0)); assert.strictEqual(a.type, 'catch'); assert.strictEqual(a.sp.cat, 'fossil');
  assert.ok(C.dig(S, '2026-11-25', '5,5').err);
  const b = C.dig(S, '2026-11-25', '6,6', seq(0.7, 0.1)); assert.deepStrictEqual([b.type, b.id], ['ore', 'stone']);
  const l = C.dig(S, '2026-11-25', '7,7', seq(0.95, 0.95)); assert.strictEqual(l.type, 'lucky');
});
t('팔기·물고기 먹기', () => {
  const S = C.defaultState(); S.player.hp = 10; S.island.bag.fish.tuna = 2; S.island.bag.ore.gold = 1;
  assert.strictEqual(C.eatFish(S, 'tuna').got, 40); assert.strictEqual(C.sellItem(S, 'fish', 'tuna', 5).coins, 1200);
  assert.strictEqual(C.sellItem(S, 'ore', 'gold').coins, 400); assert.strictEqual(S.player.coins, 1600);
  assert.deepStrictEqual(S.island.bag.fish, {});
});
t('섬 별점: 도감 15종 + 나무 3그루면 ★2', () => {
  const S = C.defaultState();
  D.FISH.slice(0, 15).forEach((f) => C.addCatch(S, f, 'd'));
  assert.strictEqual(C.checkStars(S), null);
  S.island.trees[0] = S.island.trees[1] = S.island.trees[2] = { kind: 'cherry', g: 0 };
  assert.strictEqual(C.checkStars(S), 2); assert.strictEqual(C.checkStars(S), null);
});
t('도구: 등급마다 HP가 덜 들고, 금 도구가 있으면 ★4 조건', () => {
  const S = C.defaultState(); S.player.coins = 10000;
  assert.strictEqual(C.cost(S, 'dig'), 8);
  assert.ok(C.buyTool(S, 'shovel').ok); assert.strictEqual(C.cost(S, 'dig'), 6); assert.strictEqual(S.player.coins, 8500);
  assert.ok(C.buyTool(S, 'shovel').ok); assert.strictEqual(C.cost(S, 'dig'), 5);
  assert.ok(C.buyTool(S, 'shovel').err);
  assert.ok(C.STAR_RULES[4].ok(S)); assert.ok(!C.STAR_RULES[4].ok(C.defaultState()));
});
t('옷: 사고 입기, 없는 옷은 못 입음, 상점은 날짜마다 같음', () => {
  const S = C.defaultState(); S.player.coins = 1000;
  assert.ok(C.wear(S, 'hat', 'straw').err);
  assert.ok(C.buyClothes(S, 'hat', 'straw').ok); assert.ok(C.wear(S, 'hat', 'straw').ok); assert.strictEqual(S.island.outfit.hat, 'straw');
  assert.deepStrictEqual(C.shopToday('2026-11-27'), C.shopToday('2026-11-27'));
  assert.strictEqual(C.shopToday('2026-11-27').seeds.length, 2);
});
t('잡초: 놓친 날 생기고, 다 치우면 7일 뒤 ★3 조건', () => {
  const S = C.defaultState(); S.island.cleanFrom = '2026-11-01';
  assert.strictEqual(C.cleanDays(S, '2026-11-10'), 9);
  C.addLitter(S, 2, '2026-11-10'); assert.strictEqual(S.island.newLitter.length, 5); assert.strictEqual(C.cleanDays(S, '2026-11-20'), 0);
  S.island.litter = S.island.newLitter.map((k, i) => ({ k, x: i, y: 1 })); S.island.newLitter = [];
  while (S.island.litter.length) C.clearLitter(S, 0, '2026-11-11');
  assert.strictEqual(S.island.cleanFrom, '2026-11-11'); assert.strictEqual(C.cleanDays(S, '2026-11-18'), 7);
});
t('금 물뿌리개: 한 번에 모든 나무', () => {
  const S = C.defaultState(); S.island.tools.can = 3; S.player.hp = 50;
  S.island.trees[0] = { kind: 'cherry', g: 0 }; S.island.trees[2] = { kind: 'pear', g: 1 };
  const r = C.waterAll(S, 'd'); assert.strictEqual(r.n, 2); assert.strictEqual(S.player.hp, 47);
});
t('주민: 별점만큼 이사, 하루 한 번 도움·말 걸기', () => {
  const S = C.defaultState();
  assert.strictEqual(C.villagersHere(S).length, 0);
  S.island.stars = 3; assert.deepStrictEqual(C.checkArrivals(S).map((v) => v.id), ['toto', 'mongsil']);
  assert.deepStrictEqual(C.villagersHere(S).map((v) => v.id), ['toto', 'mongsil']);
  S.island.trees[0] = { kind: 'cherry', g: 0 }; S.island.trees[1] = { kind: 'pear', g: 1 }; S.island.trees[2] = { kind: 'lemon', g: 2 };
  S.island.litter = [{ k: 'weeds', x: 1, y: 1 }]; S.island.newLitter = ['can'];
  const m = C.villagerHelp(S, '2026-11-28');
  assert.strictEqual(S.island.trees.filter((t) => t && t.watered === '2026-11-28').length, 2);
  assert.strictEqual(S.island.litter.length + S.island.newLitter.length, 0); assert.ok(m.length >= 2);
  assert.deepStrictEqual(C.villagerHelp(S, '2026-11-28'), []);
  const c0 = S.player.coins, r = C.talk(S, 'toto', '2026-11-28', () => 0);
  assert.strictEqual(S.player.coins, c0 + 20); assert.ok(C.talk(S, 'toto', '2026-11-28').again); assert.ok(C.talk(S, 'coco', '2026-11-28').err);
  void r;
});
t('주민: 연속 공부·도감·떠돌이 손님 경로', () => {
  const S = C.defaultState();
  S.player.bestStreak = 7; assert.deepStrictEqual(C.checkArrivals(S).map((v) => v.id), ['kongi', 'bori']);
  S.player.bestStreak = 1; assert.deepStrictEqual(C.checkArrivals(S), []); assert.ok(C.villagersHere(S).length === 2); // 한 번 오면 머문다
  D.FOSSILS.slice(0, 25).forEach((f) => C.addCatch(S, f, 'd')); assert.deepStrictEqual(C.checkArrivals(S).map((v) => v.id), ['bueong']);
  assert.strictEqual(C.extraDigSpots(S), 1);
  C.villagerHelp(S, '2026-12-01', () => 0.1); assert.ok(S.island.visitor);
  const id = S.island.visitor.id;
  C.talk(S, id, '2026-12-01'); C.talk(S, id, '2026-12-01'); C.talk(S, id, '2026-12-02');
  assert.ok(!C.villagersHere(S).some((v) => v.id === id));
  const r = C.talk(S, id, '2026-12-03'); assert.ok(r.moved); assert.ok(C.villagersHere(S).some((v) => v.id === id)); assert.strictEqual(S.island.visitor, null);
});
console.log(fails ? `\n${fails}개 실패` : '\n전부 통과');
process.exit(fails ? 1 : 0);
