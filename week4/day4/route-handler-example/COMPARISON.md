# Direct Fetch vs Route Handler

## 요청 흐름 비교

```
[Direct Fetch - 서버 컴포넌트]
브라우저 ──HTML 요청──▶ Next.js 서버 ──fetch──▶ 외부 API (FastAPI 등)
브라우저 ◀──완성된 HTML── Next.js 서버 ◀──JSON──  외부 API
(브라우저는 외부 API의 존재조차 모름)

[Route Handler - 클라이언트 컴포넌트]
브라우저 ──/api/todos──▶ Route Handler ──fetch──▶ 외부 API
브라우저 ◀──JSON────────  Route Handler ◀──JSON──  외부 API
(브라우저는 /api/todos 만 알고, 외부 API 주소는 모름)
```

## 언제 무엇을 쓸까?

| 상황                               | Direct Fetch | Route Handler |
|------------------------------------|:------------:|:-------------:|
| 페이지 최초 진입 시 데이터 필요     | ✅           | △ (가능하지만 과함) |
| 버튼/검색어 등 인터랙션 후 재요청   | ❌           | ✅            |
| 외부 API URL을 숨겨야 함            | ✅           | ✅            |
| CORS 이슈가 있는 외부 API           | ✅ (서버↔서버) | ✅ (프록시)   |
| 인증 토큰, 로깅 등 공통 미들웨어    | △           | ✅            |
