# 공부 섬

혼자 쓰는 갤럭시용 웹앱(PWA). 토익·전기기사·근력 퀘스트로 HP를 모으고, 그 HP로 섬에서 과일을 키우고 낚시·채집을 한다.

- `core.js` 게임 규칙 (화면과 무관, `node test/core.test.js`로 테스트)
- `app.js` 화면 · `island.js` 섬(캔버스) · `style.css`
- `assets/` 그림 (CC0, 출처는 assets/CREDITS.md)
- `sw.js`, `manifest.webmanifest` 오프라인·홈 화면 설치

로컬 실행: `python3 -m http.server 8765` 후 http://localhost:8765
테스트용 날짜 바꾸기: 주소 끝에 `?date=2026-11-29`

데이터는 폰 크롬 localStorage에만 저장. 책·기출 자료는 저장소에 넣지 않는다(저작권).
