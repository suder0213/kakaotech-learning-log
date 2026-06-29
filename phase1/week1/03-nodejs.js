// Node.js란?
// 브라우저 밖에서 JavaScript를 실행할 수 있게 해주는 런타임.
// V8 엔진(Chrome과 동일) + 파일/네트워크/OS 접근 기능을 추가한 것.
//
// 실행: 터미널에서 → node 03-nodejs.js

// ── 1. 브라우저 JS와의 차이 ──────────────────────────────
// 브라우저: document, window, fetch 같은 Web API 있음
// Node.js : 그런 거 없음. 대신 fs(파일), http, path 같은 모듈이 있음.

// ── 2. 모듈 시스템 ────────────────────────────────────────
const os   = require('os');   // Node 내장 모듈: 운영체제 정보
const path = require('path'); // Node 내장 모듈: 파일 경로 처리

console.log('=== Node.js 환경 정보 ===');
console.log('Node 버전:', process.version);
console.log('OS 플랫폼:', os.platform());
console.log('현재 파일:', __filename);                 // 브라우저에는 없음
console.log('현재 디렉터리:', __dirname);              // 브라우저에는 없음
console.log('경로 조합:', path.join(__dirname, 'images', 'logo.png'));

// ── 3. 파일 읽기 (비동기) ────────────────────────────────
const fs = require('fs');

// fs.readFile은 Promise가 아닌 콜백 스타일이지만,
// fs/promises 를 쓰면 async/await 사용 가능
const fsP = require('fs').promises;

async function readSelf() {
  console.log('\n=== 이 파일 첫 줄 읽기 ===');
  try {
    const content = await fsP.readFile(__filename, 'utf-8');
    console.log(content.split('\n')[0]); // 첫 줄만 출력
  } catch (err) {
    console.error('읽기 실패:', err.message);
  }
}

// ── 4. 이벤트 루프 확인 ──────────────────────────────────
// Node.js도 브라우저처럼 싱글 스레드 + 이벤트 루프 구조
console.log('\n=== 실행 순서 ===');
console.log('1. 동기 코드');

setTimeout(() => console.log('3. setTimeout (비동기)'), 0);

Promise.resolve().then(() => console.log('2. Promise.then (마이크로태스크)'));

console.log('1-계속. 동기 코드');

// 출력 순서: 1 → 1-계속 → 2(마이크로태스크) → 3(매크로태스크)
// 이 순서가 브라우저 JS와 동일 — Node.js도 같은 이벤트 루프 원리

readSelf();
