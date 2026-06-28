/**
 * [Route Handler - Next.js API 라우트]
 * 파일 위치: app/api/todos/route.js
 *
 * 흐름: 브라우저 → Next.js Route Handler → 외부 API (Python FastAPI 등)
 *
 * 핵심: 브라우저는 외부 API가 아닌 Next.js 서버(/api/todos)에만 요청한다.
 *       Next.js 서버가 중간에서 외부 API를 대신 호출해준다.
 *       → 이 중간 서버를 "프록시(Proxy)" 라고 부른다.
 */

import { NextResponse } from "next/server";

// GET /api/todos 요청을 처리하는 핸들러
export async function GET(request) {

  // URL에서 쿼리 파라미터를 꺼낸다
  // 예: /api/todos?search=밥먹기  →  search = "밥먹기"
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";

  // ✅ 여기서 외부 API를 호출한다.
  //    BACKEND_URL 은 NEXT_PUBLIC 없이 선언된 서버 전용 환경변수
  //    → 브라우저는 이 URL을 절대 알 수 없다 (CORS 이슈도 없다)
  const res = await fetch(
    `${process.env.BACKEND_URL}/api/todos?search=${search}`
  );

  if (!res.ok) {
    // 외부 API 오류를 그대로 클라이언트에 전달
    return NextResponse.json(
      { error: "외부 API 호출 실패" },
      { status: res.status }
    );
  }

  const todos = await res.json();

  // 클라이언트(브라우저)에게 JSON으로 응답
  return NextResponse.json(todos);
}
