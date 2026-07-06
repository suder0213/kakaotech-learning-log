# 2026.06.29 TIL

**학습 목표:** pre-course 학습로그를 돌아보고 이해가 부족했던 개념 완전 이해하기  
**방식:** 흥미가 생기는 것 몇 개를 골라 꼬리 질문으로 학습, 각 주제마다 실습 파일 제작

---

## 1. HTML `<label>` 과 `<input>`

**Q. 굳이 label을 써야 하나? for/id/name으로 더 복잡해지기만 하는 것 같음**

두 가지 이유가 있음

1. **접근성** — 스크린리더(시각장애인 보조 도구)가 input이 무엇인지 읽어줌. label 없으면 그냥 "편집 필드"라고만 읽힘
2. **클릭 영역 확장** — label 텍스트를 클릭해도 연결된 input이 포커스됨. 특히 모바일의 작은 체크박스/라디오버튼에서 유용

**Q. for/id를 엇갈리게 연결하면?**

브라우저는 오류 없이 `for` 값 기준으로만 연결함. 엇갈리면 "이름" 클릭 시 이메일 input이 포커스되는 등 혼란 발생. 에러나 경고가 없어서 개발자가 눈치채기 어려움

> 실습: `01-label-input.html`

---

## 2. Promise

**Q. Promise의 정확한 개념과 흐름**

"지금 당장 값이 없지만 나중에 성공하거나 실패할 작업"을 표현하는 객체.  
JS는 싱글 스레드라 서버 응답 같은 IO 작업을 기다리는 동안 다른 일을 먼저 처리해야 함. Promise는 그 "나중에 할 일"을 등록하는 비동기 처리 도구

**상태**

| 상태 | 의미 |
|------|------|
| pending | 아직 결과를 모름 (대기 중) |
| fulfilled | 성공 |
| rejected | 실패 |

한 번 fulfilled/rejected가 되면 상태가 다시 바뀌지 않음

**처리 방법**

- `.then(result => ...)` — `resolve(값)`에 넘긴 값이 result로 전달됨
- `.catch(err => ...)` — `reject(값)`에 넘긴 값이 err로 전달됨
- `async/await` — Promise를 동기 코드처럼 읽히게 쓰는 문법 (내부 동작 동일)

**Promise.all vs Promise.allSettled**

- `Promise.all` — 하나라도 실패하면 즉시 reject, 나머지 결과 버림
- `Promise.allSettled` — 실패해도 전부 기다리고 각 결과를 `{ status, value/reason }` 형태로 반환

**fetch와의 관계**

`fetch`는 내부적으로 `new Promise`를 반환하는 함수. 그래서 바로 `.then`을 붙일 수 있음

**이벤트 루프에서의 위치**

Promise `.then`은 마이크로태스크 큐, `setTimeout`은 매크로태스크 큐에 들어감.  
콜 스택이 비면 마이크로태스크 → 매크로태스크 순으로 처리되어 `setTimeout(..., 0)`이어도 Promise.then보다 늦게 실행됨

> 실습: `02-promise.html`

---

## 3. Node.js

**Q. Node.js란?**

JS는 원래 브라우저에서만 실행되도록 설계된 언어.  
Node.js는 Chrome의 V8 엔진을 브라우저 밖으로 꺼내 파일/네트워크/OS 등 서버 API를 추가한 JS 런타임 (2009, Ryan Dahl)

**런타임:** 코드(텍스트)를 읽고 실제로 실행해주는 환경

| | 브라우저 | Node.js |
|---|---|---|
| 공통 | V8 엔진, JS 문법, 이벤트 루프 | ← 동일 |
| 전용 API | document, window, fetch | fs, http, os, `__dirname` |

> 실습: `03-nodejs.js`

---

## 통합 실습

위 3가지 개념을 하나의 흐름으로 연결하는 Next.js 데모 제작 (`next-demo/`)

```
폼 입력 (label + input)
  → 제출 시 fetch 요청 (Promise / async-await)
  → Next.js API 라우트가 Node.js 서버에서 처리
  → 응답을 브라우저에 표시
```

---

## 추가로 알게 된 것

**`package.json`**  
프로젝트의 메타정보와 의존성을 정의하는 설정 파일.  
`dependencies`에 필요한 패키지 목록을 선언하면 `npm install`로 재현 가능

**`package-lock.json`**  
실제로 설치된 패키지의 정확한 버전을 기록한 잠금 파일.  
npm이 자동으로 관리하며, git에 같이 올려서 팀원 간 버전 불일치를 방지
