# 4주차 학습 정리

## Day 1 — Next.js 기초, 라우팅, 렌더링

### 프레임워크 vs 라이브러리

코드 흐름의 주도권이 누구에게 있느냐의 차이다.

- **라이브러리 (React)**: 내가 필요할 때 가져다 쓴다. 흐름 제어는 내가 한다.
- **프레임워크 (Next.js)**: 정해진 규칙 안에서 작업한다. 흐름 제어는 프레임워크가 한다.

### Next.js 핵심 개념 4가지

1. **라우팅과 렌더링** — URL에 따라 어떤 페이지를 그릴지, 어떻게 그릴지
2. **데이터 패치** — 서버/외부 API에서 데이터를 가져오는 방법
3. **캐싱** — 반복 요청의 성능을 높이는 방법
4. **최적화** — 이미지, 메타데이터 등 UX 개선

### 라우팅

폴더 경로가 곧 URL 경로가 된다. 정해진 규칙에 맞게 폴더를 만들면 자동으로 라우팅된다.

- `layout.tsx`: 모든 하위 페이지에 적용되는 공통 레이아웃. 중첩 가능.
- `route.ts`: 특정 경로에 대한 HTTP Request Handler 정의.
- `<a>` 태그 대신 `<Link>` 태그 사용 → 필요한 컴포넌트만 교체하는 방식으로 최적화됨 (Prefetch 활용).

### 렌더링: CSR vs SSR

**React 기본값: CSR (클라이언트 사이드 렌더링)**

브라우저가 빈 HTML을 받은 후 JS가 동적으로 화면을 그린다.

- 한계: SEO 어려움, 초기 로딩 느림, JS 오류 시 렌더링 불가

**Next.js: SSR (서버 사이드 렌더링) 기본 제공**

서버에서 완성된 HTML을 만들어 브라우저에 전달한다.

- 한계: 페이지 전환 시 매번 서버에서 로드, 인터랙션 처리 어려움

**Next.js의 전략: SSR + CSR 장점 결합**

```
서버에서 완성된 HTML 전달 (SSR)
→ 브라우저에서 HTML 로드
→ Hydration 수행 (HTML에 JS를 입혀 인터랙션 활성화)
→ 이후 인터랙션은 클라이언트에서 처리 (CSR)
```

### 서버 컴포넌트 vs 클라이언트 컴포넌트

Next.js의 기본값은 **서버 컴포넌트**다.

| | 서버 컴포넌트 | 클라이언트 컴포넌트 |
|---|---|---|
| 선언 | 기본값 (아무것도 안 씀) | 파일 상단 `"use client"` |
| 실행 위치 | Next.js 서버 | 브라우저 |
| 브라우저에 전달 | HTML 결과물만 | JS 코드 번들 |
| useState, useEffect | ❌ | ✅ |
| onClick 등 이벤트 | ❌ | ✅ |

사용자 인터랙션(클릭, 입력)이 필요할 때만 클라이언트 컴포넌트로 지정한다.

---

## Day 2 — 데이터 패치, 서버 액션, 캐싱, 최적화

### Data Fetching

서버에서 fetch가 이루어지므로 브라우저 개발자 도구 네트워크 탭에서 확인 불가.

- 서버 작업이 끝날 때까지 클라이언트에 아무것도 전달되지 않는 문제
  - `loading.tsx`로 로딩 중 UI 표시
  - **Streaming**: HTML을 작은 조각(청크)으로 나눠 준비된 것부터 점진적으로 전송

**여러 fetch 동시 처리**

```js
// ❌ 순차 실행: 각 요청 시간의 합만큼 걸림
const a = await fetchA()
const b = await fetchB()

// ✅ 병렬 실행: 가장 오래 걸리는 요청 하나의 시간만큼만 걸림
const [a, b] = await Promise.all([fetchA(), fetchB()])
```

`Suspense` 컴포넌트로 각 fetch를 분리하면 먼저 완료된 데이터부터 화면에 렌더링된다.

**개발 방향성**: 클라이언트 컴포넌트가 불필요하게 늘어나면 UX 저하. 최대한 서버에서 로직을 처리한다.

### Server Actions

`"use server"` — 클라이언트 번들에 절대 포함되지 않는 서버 전용 함수.

서버/DB 상태가 변경되는 작업(POST, PUT, DELETE)을 서버에서 실행하기 위한 기능. API 라우트 핸들러 없이도 클라이언트에서 서버 로직을 호출할 수 있다.

```js
// form 태그의 action 속성으로 서버 액션 전달
<form action={serverAction}>
  <input name="title" />
  <button type="submit">제출</button>
</form>
// → FormData 형식으로 서버 액션에 데이터 전달
// → 작업 후 redirect()로 특정 경로 이동 가능
```

콘솔 로그가 브라우저가 아닌 서버 로그에 출력됨 → 캡슐화.

### 캐싱

Next.js 성능의 핵심. 캐싱 없이는 속도가 매우 저하된다.

| 캐시 종류 | 범위 | 유지 기간 |
|---|---|---|
| **Request Memoization** | 동일 렌더링 내 중복 fetch 제거 | 렌더링 종료까지 |
| **Data Cache** | 서버 전체 (다른 클라이언트도 공유) | 명시적 무효화 전까지 |
| **Full Route Cache** | 서버 컴포넌트 렌더링 결과 | 명시적 무효화 전까지 |
| **Router Cache** | Hydration 완료된 컴포넌트 | 세션 내 |

**Revalidation (캐시 무효화)**

- **Time-based**: 특정 시간마다 갱신
- **On-demand**: 특정 이벤트 발생 시 갱신

```js
// fetch 시 tag 설정
fetch(url, { next: { tags: ["todos"] } })

// 이후 해당 태그 캐시 무효화
revalidateTag("todos")
```

### 최적화 (Core Web Vitals)

검색 엔진 순위에 반영되는 웹 품질 지표.

- **LCP**: 주요 콘텐츠 로드 속도
- **INP**: 사용자 상호작용 응답 속도
- **CLS**: 예기치 않은 레이아웃 이동 여부

**Image 컴포넌트** (`<img>` 태그 확장)

- CLS 최적화: 이미지 크기를 미리 계산해 공간 확보 → 레이아웃 밀림 없음
- LCP 최적화: 이미지 품질 자동 조절로 로딩 속도 개선
- 외부 URL 이미지는 config에서 허용 설정 필요, `width`/`height` 필수 지정

**메타데이터**

- File-based: 정해진 파일명으로 파일 생성 시 자동 생성
- Config-based: 코드에서 직접 `export`하여 설정

---

## Day 3 — 서버/클라이언트 컴포넌트 심화, SQLAlchemy

### SSR 한계를 최소화하는 전략

정적인 부분은 서버 컴포넌트로 처리해 JS 번들을 줄이고, 동적인 부분만 클라이언트 컴포넌트로 교체한다.

```jsx
// 서버 컴포넌트: 데이터 fetch, API URL 숨김
export default async function Page() {
  const todos = await fetch(process.env.BACKEND_URL + "/todos")
  return <TodoList initialTodos={todos} />
}

// 클라이언트 컴포넌트: 인터랙션만 담당
"use client"
export default function TodoList({ initialTodos }) {
  const [todos, setTodos] = useState(initialTodos)
  return <ul>...</ul>
}
```

클라이언트 컴포넌트의 함수 자체는 `async/await` 불가. 내부에서 별도 비동기 함수를 호출해야 한다.

### SQLAlchemy

Python ORM — Python 코드로 SQL을 작성하는 도구.

프로젝트 규모가 커질수록 sqlite3 같은 직접 방식은 관리가 어려워진다.

| 구성요소 | 역할 |
|---|---|
| `engine` | 실제 DB 파일 연결 경로 설정 및 관리 |
| `SessionLocal` | DB 조회 및 DML 수행 세션 |
| `Base` | DB 테이블 연결 기본 틀 |
| `Model` | Base를 상속받은 엔티티 |

**트랜잭션**: 쪼갤 수 없는 논리적 작업 단위.

---

## Day 4 — CORS, Direct Fetch vs Route Handler

### Node.js와 Next.js

- **Node.js**: JS를 브라우저 밖에서 실행할 수 있게 해주는 런타임(실행 환경)
- **Next.js**: Node.js 위에서 돌아가는 React 프레임워크
- **npm**: Node Package Manager. 패키지(라이브러리)를 설치/관리하는 도구. Node.js 설치 시 자동으로 같이 설치됨.

```
Node.js  =  자동차 엔진
Next.js  =  그 엔진으로 만든 자동차
npm      =  부품 조달 앱스토어
```

`npm run dev`를 실행하는 순간 내 컴퓨터에 Next.js 서버(Node.js 프로세스)가 뜬다. 배포하면 Vercel 같은 외부 서버 컴퓨터에서 24시간 돌아간다.

### CORS

**브라우저가 자체적으로 탑재한 보안 장치**. 서버 정책이 아니다.

- **Origin = 프로토콜 + 호스트 + 포트**
- 브라우저가 현재 열고 있는 페이지의 Origin과, 요청 목적지의 Origin이 다르면 CORS 발동
- 내 컴퓨터 IP는 CORS와 무관. Origin은 "내가 현재 열고 있는 페이지 주소"다.
- **Node.js, Python, curl 등 브라우저가 아닌 코드는 CORS 검사를 하지 않는다.**

```
http://localhost:3000  →  http://localhost:8000  : 포트 달라 → 다른 Origin → CORS 발동
http://localhost:3000  →  http://localhost:3000/api  : 같은 Origin → CORS 없음
```

### Direct Fetch vs Route Handler

#### Direct Fetch (서버 컴포넌트에서 사용)

```
브라우저 ──HTML 요청──▶ Next.js 서버 ──fetch──▶ 외부 API (포트 8000)
브라우저 ◀──완성된 HTML── Next.js 서버 ◀──JSON──  외부 API
```

- 브라우저는 Next.js에만 요청. 외부 API 존재 자체를 모름.
- 서버↔서버 통신 → CORS 없음
- 외부 API URL이 브라우저 개발자 도구에 노출되지 않음
- 단, 인터랙션 후 재요청 불가 (서버 컴포넌트이므로)

#### Route Handler (클라이언트 컴포넌트에서 사용)

```
브라우저 ──/api/search──▶ Route Handler ──fetch──▶ 외부 API (포트 8000)
          같은 Origin      (Next.js 서버)   서버↔서버
          CORS 없음                         CORS 없음
```

- 브라우저는 같은 Origin인 `/api/search`에만 요청 → CORS 없음
- Route Handler 코드는 서버에만 존재 → 외부 API URL 브라우저에 노출 안 됨
- Route Handler가 반환하는 건 **컴포넌트가 아닌 JSON 데이터**. 브라우저가 JSON을 받아 `useState`를 업데이트하고 직접 리렌더링한다.
- 클라이언트 컴포넌트에서 사용 가능 → 인터랙션 후 재요청 가능

#### 클라이언트 컴포넌트에서 외부 API 직접 호출하면?

```js
"use client"
// ❌ 두 가지 문제 동시에 발생
const res = await fetch("http://external-api:8000/todos")
//                       ↑ 브라우저 소스 탭에 URL 노출
//                       ↑ 브라우저가 직접 다른 Origin 호출 → CORS 차단
```

#### 개발자 도구에서 보이는 것

서버 컴포넌트와 Route Handler의 코드는 브라우저에 내려오지 않는다.

| | 소스 탭 (JS 코드) | 네트워크 탭 |
|---|---|---|
| 서버 컴포넌트 | 코드 안 보임 | fetch 요청 안 보임 |
| Route Handler | 코드 안 보임 | /api/... 만 보임 |
| 클라이언트 컴포넌트 | 코드 보임 | fetch 요청 보임 |

#### 언제 무엇을 쓸까?

| 상황 | 선택 |
|---|---|
| 페이지 최초 진입 시 데이터 필요 | 서버 컴포넌트 + Direct Fetch |
| 검색, 필터 등 인터랙션 후 재요청 | 클라이언트 컴포넌트 + Route Handler |
| 외부 API URL을 숨겨야 함 | 서버 컴포넌트 또는 Route Handler |

---

## Day 5 — 배포

- **Vercel**: Next.js 공식 배포 플랫폼. Next.js 프로젝트를 가장 쉽게 배포할 수 있음.
- **Railway**: Python FastAPI 등 백엔드 서버 배포에 사용.
