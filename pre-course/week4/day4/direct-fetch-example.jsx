/**
 * [직접 페치 - Direct Fetch]
 *
 * 흐름: 브라우저 → Next.js 서버 컴포넌트 → 외부 API (Python FastAPI 등)
 *
 * 핵심: 이 컴포넌트는 서버에서만 실행된다.
 *       브라우저는 HTML 결과물만 받을 뿐, 외부 API 주소를 알 수 없다.
 */

// "use client" 가 없으면 기본값은 Server Component
// → fetch가 브라우저가 아닌 Next.js 서버에서 실행됨
export default async function DirectFetchPage() {

  // ✅ 서버에서 직접 외부 API를 호출한다.
  //    브라우저 네트워크 탭에는 이 요청이 보이지 않는다.
  //    .env.local 의 BACKEND_URL 은 NEXT_PUBLIC 없이 선언 → 서버 전용 비밀값
  const res = await fetch(`${process.env.BACKEND_URL}/api/todos`);

  // fetch 실패 시 Next.js 에러 바운더리로 전파
  if (!res.ok) {
    throw new Error("외부 API 호출 실패");
  }

  // axios와 달리 fetch는 수동으로 .json()을 호출해야 파싱된다
  const todos = await res.json();

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}

/*
 * ─────────────────────────────────────────────
 * ✅ Direct Fetch 장점
 * ─────────────────────────────────────────────
 * 1. 코드가 짧다 (중간 계층 없음)
 * 2. 외부 API URL이 클라이언트에 노출되지 않는다
 * 3. 페이지 진입 시 데이터를 서버에서 미리 가져오므로
 *    사용자는 빈 화면 없이 완성된 HTML을 받는다 (SSR)
 *
 * ❌ Direct Fetch 한계
 * ─────────────────────────────────────────────
 * 1. 서버 컴포넌트에서만 사용 가능
 *    → 버튼 클릭, 검색어 입력 등 사용자 인터랙션 후 재요청 불가
 * 2. CORS 정책과 무관하다 (서버↔서버 통신이므로)
 *    → CORS는 브라우저↔서버 간에만 적용된다는 점을 기억할 것
 */
