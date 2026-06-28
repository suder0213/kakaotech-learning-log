# CORS와 Next.js 데이터 페칭 패턴 정리

## 1. CORS란?

CORS는 **브라우저가 자체적으로 탑재한 보안 장치**다.  
서버가 만든 규칙이 아니라, 브라우저가 요청을 보내기 전에 스스로 검사하는 것이다.

**Origin = 프로토콜 + 호스트 + 포트**

```
http://localhost:3000  ←→  http://localhost:8000   → 포트 달라서 다른 Origin
http://example.com     ←→  http://api.example.com  → 호스트 달라서 다른 Origin
```

브라우저가 현재 열고 있는 페이지의 Origin과, 요청을 보내는 목적지의 Origin이 다르면 CORS 정책이 발동한다.  
내 컴퓨터의 IP는 CORS와 무관하다. Origin은 "내가 현재 열고 있는 페이지의 주소"다.

**중요: CORS는 브라우저에만 있다.**  
Node.js, Python, curl 등 브라우저가 아닌 모든 코드는 CORS 검사를 하지 않는다.


## 2. Next.js 서버란?

Next.js 서버는 브라우저 안에 있는 게 아니라, **별도 컴퓨터에서 돌아가는 Node.js 프로세스**다.

```
[내 컴퓨터 - 브라우저]              [서버 컴퓨터]
                              ┌─────────────────────────┐
  브라우저                   │  Next.js (포트 3000)    │
  (페이지 요청) ────────────▶ │  외부 API (포트 8000)   │
                              └─────────────────────────┘
```

로컬 개발 시 `npm run dev`를 실행하는 순간, 내 컴퓨터에 Next.js 서버가 뜬다.  
`Ctrl+C`로 종료하면 서버도 꺼지고 `localhost:3000`도 접속이 안 된다.  
배포하면 Vercel 같은 외부 서버 컴퓨터에서 24시간 돌아가게 된다.


## 3. 서버 컴포넌트 vs 클라이언트 컴포넌트

| | 서버 컴포넌트 | 클라이언트 컴포넌트 |
|---|---|---|
| 실행 위치 | Next.js 서버 | 브라우저 |
| 브라우저에 내려오는 것 | HTML 결과물만 | JS 코드 번들 |
| 개발자 도구 소스 탭 | 코드 안 보임 | 코드 보임 |
| useState, onClick 등 | ❌ 사용 불가 | ✅ 사용 가능 |
| CORS 영향 | ❌ 받지 않음 | ✅ 받음 |
| 선언 방법 | 기본값 (아무것도 안 씀) | 파일 상단에 `"use client"` |

서버 컴포넌트는 서버에서 HTML을 만들고 끝난다. 브라우저를 거치지 않으므로 CORS를 신경 쓸 필요가 없고, JS 코드도 브라우저에 내려가지 않으므로 API URL이 노출되지 않는다.

클라이언트 컴포넌트는 JS 코드가 브라우저에 번들로 내려온다. 브라우저에서 실행되므로 CORS의 영향을 직접 받는다.

**실제로는 섞어서 쓴다.**  
데이터 fetch는 서버 컴포넌트에서, 인터랙션이 필요한 부분만 클라이언트 컴포넌트로 분리한다.

```jsx
// 서버 컴포넌트: 데이터 fetch
export default async function Page() {
  const todos = await fetch(process.env.BACKEND_URL + "/todos")
  return <TodoList initialTodos={todos} />  // 클라이언트 컴포넌트에 데이터 전달
}

// 클라이언트 컴포넌트: 인터랙션
"use client"
export default function TodoList({ initialTodos }) {
  const [todos, setTodos] = useState(initialTodos)
  return <ul>...</ul>
}
```


## 4. Direct Fetch vs Route Handler

### Direct Fetch

외부 API를 직접 호출하는 방식이다.

**서버 컴포넌트에서 사용할 때 (권장)**

```
브라우저 ──HTML 요청──▶ Next.js 서버 ──fetch──▶ 외부 API (포트 8000)
브라우저 ◀──완성된 HTML── Next.js 서버 ◀──JSON──  외부 API
```

- 브라우저는 Next.js에만 요청, 외부 API의 존재를 모름
- 서버↔서버 통신이라 CORS 없음
- 외부 API URL이 브라우저에 노출되지 않음
- 단, 인터랙션 후 재요청 불가 (서버 컴포넌트이므로)

**클라이언트 컴포넌트에서 사용할 때 (문제 발생)**

```
브라우저 ──fetch("http://외부API:8000")──▶ 외부 API
          ↑ 다른 Origin → CORS 차단
          ↑ URL이 JS 번들에 그대로 노출
```

- CORS 오류 발생 (외부 API에서 허용하지 않은 경우)
- 외부 API URL이 개발자 도구 소스 탭에 노출됨


### Route Handler

Next.js가 중간 프록시 역할을 하는 방식이다.

```
브라우저 ──/api/search──▶ Route Handler ──fetch──▶ 외부 API (포트 8000)
          같은 Origin      (Next.js 서버)  서버↔서버
          CORS 없음                        CORS 없음
```

```js
// app/api/search/route.js (서버에서만 실행, 브라우저에 안 내려감)
export async function GET(request) {
  const res = await fetch(process.env.BACKEND_URL + "/todos")
  //                      ↑ 이 URL은 브라우저에서 절대 보이지 않음
  return NextResponse.json(await res.json())
}
```

```jsx
// 클라이언트 컴포넌트
"use client"
const res = await fetch("/api/search")
//                      ↑ 브라우저가 아는 건 이게 전부
```

- 브라우저는 같은 Origin인 `/api/search`에만 요청 → CORS 없음
- Route Handler 코드는 서버에만 존재 → 외부 API URL 노출 안 됨
- 클라이언트 컴포넌트에서 사용 가능 → 인터랙션 후 재요청 가능
- Route Handler가 반환하는 건 컴포넌트가 아닌 JSON 데이터
- 브라우저가 JSON을 받아서 useState를 업데이트하고 직접 리렌더링


## 5. 한눈에 비교

| | 서버 컴포넌트 + Direct Fetch | 클라이언트 컴포넌트 + Direct Fetch | 클라이언트 컴포넌트 + Route Handler |
|---|:---:|:---:|:---:|
| CORS 문제 | ❌ 없음 | ⚠️ 외부 API 설정에 따라 다름 | ❌ 없음 |
| 외부 API URL 노출 | ❌ 안 됨 | ✅ 노출됨 | ❌ 안 됨 |
| 인터랙션 후 재요청 | ❌ 불가 | ✅ 가능 | ✅ 가능 |
| 코드 복잡도 | 낮음 | 낮음 | 높음 (파일 추가 필요) |


## 6. 언제 무엇을 쓸까?

- **페이지 최초 진입 시 데이터만 필요** → 서버 컴포넌트 + Direct Fetch
- **검색, 필터 등 인터랙션 후 재요청 필요** → 클라이언트 컴포넌트 + Route Handler
- **외부 API URL을 숨겨야 함** → 서버 컴포넌트 또는 Route Handler
- **클라이언트에서 외부 API 직접 호출** → CORS 허용 설정이 되어 있을 때만 가능, URL 노출 감수해야 함
