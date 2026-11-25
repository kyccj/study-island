// data.js — 물고기·곤충·화석 도감 목록. 화면과 무관(테스트 가능).
// m: 나오는 달 [시작,끝] 여러 구간(끝 포함, 12→2처럼 넘어가도 됨) / null=일 년 내내
// h: 나오는 시각 [시작,끝) (24시 기준, 넘어가도 됨) / null=하루 종일
// art: 그림 모양과 색 [모양, 몸색, 무늬색, 무늬]
(function (G) {
  'use strict';
  const F = (id, name, r, sell, hp, loc, m, h, art, size = 2) => ({ id, name, r, sell, hp, loc, m, h, art, size, cat: 'fish' });
  const B = (id, name, r, sell, loc, m, h, art) => ({ id, name, r, sell, hp: 0, loc, m, h, art, cat: 'bug' });
  const X = (id, name, r, sell, art) => ({ id, name, r, sell, hp: 0, loc: 'dig', m: null, h: null, art, cat: 'fossil' });

  const ALL = [[1, 12]], NIGHT = [19, 5], EVE = [16, 9], DAY = [6, 18];
  const FISH = [
    F('crucian', '붕어', 1, 40, 8, 'pond', null, null, ['fish', '#8a7a4a', '#c9b878', '']),
    F('minnow', '피라미', 1, 30, 6, 'pond', null, null, ['slim', '#9fb6c9', '#e86f6f', 'stripe'], 1),
    F('medaka', '송사리', 1, 25, 5, 'pond', null, null, ['slim', '#c9c2a0', '#ffffff', ''], 1),
    F('bluegill', '블루길', 1, 50, 8, 'pond', null, null, ['deep', '#5f8a7a', '#2c4c6c', 'bars']),
    F('loach', '미꾸라지', 2, 80, 10, 'pond', null, EVE, ['long', '#8a6a3a', '#4a3a20', 'spots']),
    F('carp', '잉어', 2, 120, 15, 'pond', null, null, ['fish', '#9a8a5a', '#e0b050', ''], 3),
    F('bitterling', '각시붕어', 2, 150, 10, 'pond', [[4, 10]], null, ['deep', '#b0c4d0', '#e070a0', 'belly'], 1),
    F('goldfish', '금붕어', 3, 250, 5, 'pond', null, null, ['deep', '#ff8a2a', '#ffffff', 'belly'], 1),
    F('catfish', '메기', 3, 300, 20, 'pond', [[5, 9]], EVE, ['long', '#5a5a4a', '#2a2a20', 'whisker'], 3),
    F('mandarin', '쏘가리', 3, 350, 18, 'pond', [[3, 11]], null, ['fish', '#c8a040', '#4a3a10', 'spots']),
    F('snakehead', '가물치', 3, 400, 25, 'pond', [[6, 9]], null, ['long', '#4a5a3a', '#1a2a10', 'spots'], 3),
    F('trout', '무지개송어', 3, 450, 22, 'pond', [[3, 5], [9, 11]], null, ['fish', '#a0b0b8', '#e8709a', 'stripe']),
    F('eel', '뱀장어', 4, 700, 30, 'pond', [[6, 9]], NIGHT, ['eel', '#4a4a3a', '#d0c080', ''], 3),
    F('goldcarp', '황금잉어', 5, 2000, 40, 'pond', null, [4, 9], ['fish', '#ffd23a', '#fff6a0', 'shine'], 4),
    F('sturgeon', '철갑상어', 5, 3000, 50, 'pond', [[9, 3]], null, ['shark', '#7a8a8a', '#d0d8d8', 'plates'], 4),
    F('mackerel', '고등어', 1, 60, 10, 'sea', null, null, ['slim', '#4a7aa0', '#1a3050', 'waves']),
    F('horse', '전갱이', 1, 50, 8, 'sea', null, null, ['fish', '#9ab0c0', '#e0e8f0', '']),
    F('goby', '망둥어', 1, 40, 6, 'sea', null, null, ['long', '#a08a6a', '#5a4a30', 'spots'], 1),
    F('rockfish', '우럭', 2, 150, 15, 'sea', null, null, ['deep', '#5a4a40', '#2a201a', 'spots']),
    F('flounder', '광어', 2, 200, 15, 'sea', null, null, ['flat', '#8a7a5a', '#5a4a30', 'spots'], 3),
    F('squid', '오징어', 2, 180, 15, 'sea', null, [18, 6], ['squid', '#f0c8b8', '#c87060', ''], 2),
    F('seabream', '참돔', 3, 400, 25, 'sea', null, null, ['deep', '#e87878', '#ffd0d0', 'belly'], 3),
    F('puffer', '복어', 3, 350, 5, 'sea', [[11, 2]], null, ['puffer', '#d8c070', '#4a4030', 'spots'], 2),
    F('octopus', '문어', 3, 300, 20, 'sea', [[6, 10]], null, ['octo', '#c85a4a', '#f0a090', ''], 3),
    F('hairtail', '갈치', 3, 450, 22, 'sea', [[7, 11]], NIGHT, ['eel', '#d8e0e8', '#ffffff', 'shine'], 3),
    F('yellowtail', '방어', 3, 500, 25, 'sea', [[11, 2]], null, ['slim', '#7a9ab0', '#e8d050', 'stripe'], 3),
    F('tuna', '참치', 4, 1200, 40, 'sea', null, null, ['shark', '#2a4a7a', '#c0d0e0', 'belly'], 4),
    F('sunfish', '개복치', 4, 1000, 30, 'sea', [[7, 9]], null, ['sunfish', '#a8b8c0', '#e0e8ec', ''], 4),
    F('shark', '상어', 5, 3000, 50, 'sea', [[6, 9]], [16, 4], ['shark', '#6a7a8a', '#e0e6ea', 'belly'], 4),
    F('coelacanth', '실러캔스', 5, 5000, 50, 'sea', null, null, ['fish', '#3a4a7a', '#d0d8f0', 'spots'], 4),
  ];
  const BUGS = [
    B('cabbage', '배추흰나비', 1, 30, 'flower', [[3, 10]], DAY, ['butterfly', '#f4f4ec', '#3a3a3a', 'dots']),
    B('sulphur', '노랑나비', 1, 40, 'flower', [[3, 10]], DAY, ['butterfly', '#f4e060', '#8a6a20', 'edge']),
    B('swallowtail', '호랑나비', 2, 150, 'flower', [[4, 9]], DAY, ['butterfly', '#f0d050', '#2a2a2a', 'stripe']),
    B('apollo', '모시나비', 2, 200, 'flower', [[5, 6]], DAY, ['butterfly', '#e8ecf0', '#8a9aa8', 'edge']),
    B('cetonia', '꽃무지', 2, 150, 'flower', [[5, 9]], DAY, ['beetle', '#4aa050', '#e0e0a0', 'dots']),
    B('bee', '꿀벌', 1, 50, 'flower', [[3, 10]], [8, 17], ['bee', '#f0c030', '#2a2010', '']),
    B('ladybug', '무당벌레', 1, 60, 'flower', [[3, 6], [9, 10]], DAY, ['lady', '#e03a2a', '#1a1a1a', '']),
    B('moth', '나방', 1, 50, 'meadow', ALL, NIGHT, ['moth', '#b0a080', '#6a5a40', 'dots']),
    B('wintermoth', '겨울자나방', 2, 180, 'meadow', [[11, 2]], [16, 24], ['moth', '#c8c0b0', '#8a8070', 'edge']),
    B('hopper', '메뚜기', 1, 50, 'meadow', [[7, 11]], null, ['hopper', '#7ab040', '#4a7020', '']),
    B('acrida', '방아깨비', 2, 120, 'meadow', [[8, 10]], DAY, ['hopper', '#9ac850', '#e0f0a0', 'long']),
    B('mantis', '사마귀', 2, 180, 'meadow', [[8, 11]], DAY, ['mantis', '#6ab040', '#3a7020', '']),
    B('cricket', '귀뚜라미', 1, 60, 'ground', [[8, 11]], [17, 4], ['hopper', '#4a3a2a', '#2a1a10', '']),
    B('ant', '개미', 1, 20, 'ground', ALL, null, ['ant', '#2a2a2a', '#5a3a2a', '']),
    B('spider', '거미', 1, 40, 'ground', ALL, null, ['spider', '#3a3a3a', '#e0c040', 'dots']),
    B('snail', '달팽이', 1, 50, 'ground', [[4, 10]], null, ['snail', '#c09060', '#e8d0b0', '']),
    B('redfly', '고추잠자리', 1, 60, 'meadow', [[8, 10]], DAY, ['dragon', '#e04030', '#f0f0ff', '']),
    B('skimmer', '밀잠자리', 2, 120, 'water', [[5, 9]], DAY, ['dragon', '#6a9ad0', '#f0f0ff', '']),
    B('bigdragon', '장수잠자리', 3, 400, 'water', [[6, 9]], DAY, ['dragon', '#3a3a2a', '#f0e040', 'stripe']),
    B('strider', '소금쟁이', 1, 60, 'water', [[4, 10]], null, ['strider', '#4a4a3a', '#8a8a7a', '']),
    B('diving', '물방개', 3, 500, 'water', [[5, 9]], null, ['beetle', '#2a3a2a', '#c0b040', 'edge']),
    B('firefly', '반딧불이', 3, 500, 'water', [[6, 7]], NIGHT, ['firefly', '#3a3020', '#f0ff70', '']),
    B('cicada', '참매미', 1, 80, 'tree', [[7, 9]], [8, 17], ['cicada', '#4a5a3a', '#c0d8d0', '']),
    B('rhino', '장수풍뎅이', 4, 1500, 'tree', [[7, 8]], [17, 8], ['rhino', '#5a3020', '#8a5030', '']),
    B('stag', '사슴벌레', 4, 1800, 'forest', [[6, 8]], [17, 8], ['stag', '#3a2a1a', '#6a4a2a', '']),
    B('jewel', '비단벌레', 4, 2000, 'forest', [[7, 8]], DAY, ['beetle', '#30b070', '#e04070', 'stripe']),
    B('swallow2', '제비나비', 3, 400, 'forest', [[5, 8]], DAY, ['butterfly', '#2a3a4a', '#40c0a0', 'edge']),
    B('bigstag', '왕사슴벌레', 5, 6000, 'forest', [[7, 8]], NIGHT, ['stag', '#1a1a1a', '#4a4a4a', 'shine']),
    B('morpho', '모르포나비', 5, 5000, 'forest', [[6, 9]], DAY, ['butterfly', '#3a7af0', '#a0e0ff', 'shine']),
    B('goldbeetle', '황금딱정벌레', 5, 8000, 'forest', ALL, null, ['beetle', '#f0c030', '#fff0a0', 'shine']),
  ];
  const FOSSILS = [
    X('ammonite', '암모나이트', 1, 150, ['ammonite', '#c0a070']),
    X('trilobite', '삼엽충', 1, 150, ['trilobite', '#8a8070']),
    X('fern', '고사리 화석', 1, 120, ['fern', '#a0a088']),
    X('shellfos', '조개 화석', 1, 120, ['shell', '#c8b890']),
    X('sharktooth', '상어 이빨', 2, 300, ['tooth', '#e8e0c8']),
    X('footprint', '공룡 발자국', 2, 300, ['foot', '#a09078']),
    X('dinoegg', '공룡알', 2, 350, ['egg', '#d8c8a0']),
    X('jelly', '해파리 화석', 2, 250, ['jelly', '#b0a898']),
    X('horseshoe', '투구게 화석', 2, 280, ['trilobite', '#9a8060']),
    X('amber', '호박 속 벌레', 3, 600, ['amber', '#f0a030']),
    X('mammoth', '매머드 상아', 3, 700, ['tusk', '#efe6d0']),
    X('sabre', '검치호 두개골', 3, 800, ['skull', '#e8dcc0']),
    X('trihorn', '트리케라톱스 뿔', 3, 700, ['horn', '#e0d4b8']),
    X('stegoplate', '스테고 골판', 3, 650, ['plate', '#c8b090']),
    X('brachio', '브라키오 다리뼈', 3, 700, ['bone', '#efe6d0']),
    X('raptor', '랩터 발톱', 3, 750, ['claw', '#e8dcc0']),
    X('archaeo', '시조새 깃털', 4, 1500, ['feather', '#b0a890']),
    X('ptera', '프테라노돈 날개', 4, 1600, ['wing', '#e0d4b8']),
    X('trex', '티라노 두개골', 4, 2000, ['skull', '#f4ecd8']),
    X('goldfossil', '황금 화석', 5, 6000, ['ammonite', '#ffd23a']),
  ];
  // 땅파기에서 나오는 광물(도감 외, 팔기용) — Ninja Adventure 아이콘 사용
  const ORES = {
    stone: { name: '돌멩이', sell: 10, icon: 'res-rock' },
    copper: { name: '구리 원석', sell: 60, icon: 'res-copper' },
    silver: { name: '은 원석', sell: 150, icon: 'res-silver' },
    gold: { name: '금 원석', sell: 400, icon: 'res-gold' },
    ruby: { name: '루비', sell: 600, icon: 'gem-red' },
    emerald: { name: '에메랄드', sell: 600, icon: 'gem-green' },
    amethyst: { name: '자수정', sell: 700, icon: 'gem-purple' },
    topaz: { name: '토파즈', sell: 800, icon: 'gem-yellow' },
  };

  const LIST = { fish: FISH, bug: BUGS, fossil: FOSSILS };
  const BY_ID = {}; for (const c of Object.keys(LIST)) for (const s of LIST[c]) BY_ID[s.id] = s;
  const CAT_NAME = { fish: '물고기', bug: '곤충', fossil: '화석' };
  const RARITY_W = [0, 50, 25, 14, 6, 2];
  const RARE_ONLY = { coelacanth: 0.4, goldfossil: 0.5, goldbeetle: 0.5 }; // 같은 별 안에서도 더 귀하게

  const inRange = (v, a, b) => (a <= b ? v >= a && v <= b : v >= a || v <= b);
  function available(sp, when) {
    const mo = when.getMonth() + 1, hr = when.getHours();
    if (sp.m && !sp.m.some(([a, b]) => inRange(mo, a, b))) return false;
    if (sp.h) { const [a, b] = sp.h; if (!(a < b ? hr >= a && hr < b : hr >= a || hr < b)) return false; }
    return true;
  }
  function pick(pool, rng = Math.random, luck = 0) {
    if (!pool.length) return null;
    const w = pool.map((s) => RARITY_W[s.r] * (s.r >= 3 ? 1 + luck : 1) * (RARE_ONLY[s.id] || 1));
    let x = rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  const fishPool = (loc, when) => FISH.filter((s) => s.loc === loc && available(s, when));
  const bugPool = (locs, when) => BUGS.filter((s) => locs.includes(s.loc) && available(s, when));
  const monthsText = (sp) => !sp.m ? '일 년 내내' : sp.m.map(([a, b]) => (a === b ? `${a}월` : `${a}~${b}월`)).join(', ');
  const hoursText = (sp) => !sp.h ? '하루 종일' : `${sp.h[0]}시~${sp.h[1] === 24 ? 24 : sp.h[1]}시`;
  const LOC_NAME = { pond: '연못', sea: '바다', flower: '꽃밭', meadow: '풀밭', ground: '땅 위', water: '물가', tree: '나무', forest: '숲', dig: '빛나는 땅' };

  G.Data = { FISH, BUGS, FOSSILS, ORES, LIST, BY_ID, CAT_NAME, LOC_NAME, available, pick, fishPool, bugPool, monthsText, hoursText, RARITY_W };
})(typeof window !== 'undefined' ? window : globalThis);
