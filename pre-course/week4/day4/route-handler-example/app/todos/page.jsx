/**
 * [Route Handler - 클라이언트 컴포넌트]
 * 파일 위치: app/todos/page.jsx
 *
 * 흐름: 브라우저(이 컴포넌트) → /api/todos (Route Handler) → 외부 API
 *
 * "use client" 를 선언했으므로 이 컴포넌트는 브라우저에서 실행된다.
 * 사용자 입력(검색어)에 반응해서 데이터를 다시 가져올 수 있다.
 * → Direct Fetch(서버 컴포넌트)로는 불가능한 인터랙션이다.
 */

"use client";

import { useState } from "react";

export default function TodosPage() {
  const [search, setSearch] = useState("");
  const [todos, setTodos] = useState([]);

  // 검색 버튼 클릭 시 실행
  const handleSearch = async () => {

    // ✅ 외부 API가 아닌, 같은 Next.js 서버의 Route Handler를 호출한다.
    //    → Origin이 같으므로 CORS 정책이 적용되지 않는다.
    //    → 외부 API 주소가 브라우저 네트워크 탭에 노출되지 않는다.
    const res = await fetch(`/api/todos?search=${search}`);

    // axios를 쓰면 아래 .json() 없이 res.data 로 바로 접근 가능
    // fetch는 수동으로 파싱해야 한다
    const data = await res.json();

    setTodos(data);
  };

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="할 일 검색..."
      />
      {/* 버튼 클릭 → handleSearch → /api/todos → 외부 API */}
      <button onClick={handleSearch}>검색</button>

      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  );
}

/*
 * ─────────────────────────────────────────────
 * ✅ Route Handler 장점
 * ─────────────────────────────────────────────
 * 1. 클라이언트 컴포넌트에서 사용 가능
 *    → 검색, 필터, 페이지네이션 등 인터랙션 후 재요청 가능
 * 2. 외부 API URL을 서버 뒤에 숨길 수 있다 (프록시 역할)
 * 3. CORS 문제를 피할 수 있다
 *    → 브라우저는 같은 Origin의 Next.js 서버에만 요청하므로
 * 4. Route Handler 안에서 인증 토큰 검증, 로깅 등 공통 로직 추가 가능
 *
 * ❌ Route Handler 한계
 * ─────────────────────────────────────────────
 * 1. 코드가 늘어난다 (Route Handler 파일을 별도로 만들어야 함)
 * 2. 네트워크 홉이 하나 더 생긴다: 브라우저 → Next.js → 외부 API
 */
