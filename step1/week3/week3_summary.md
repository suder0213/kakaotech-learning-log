# Week 3 학습 요약

## Day1 — Agent / Harness 개념

- "클로드가 자동으로 개발을 한다"는 개념(`/schedule` 스킬)을 처음 접함
- 지금까지 공부한 개념 정리: Agentic AI / Harness / Tools / Agent / MCP / FastAPI / DB / Next.js / AWS / RDS / S3 / Skills
- 활용 아이디어 브레인스토밍: GitHub PR 분석, 뉴스 크롤링 요약, 주간 리포트 자동화

## Day2 — 개발 환경 전환 + Claude Code `/schedule` 학습

- **VS Code 확장 → CLI 전환**: Claude Code의 핵심 기능(스킬, 서브에이전트, MCP, 훅)은 CLI가 기준이며, 자동화 연동이 더 자유로움을 이해하고 전환
- **`/schedule` (Routine)**: 프롬프트+저장소+커넥터 설정을 클라우드에 저장해 cron/API/GitHub 웹훅으로 자동 실행하는 기능. `/loop`(로컬)와 달리 컴퓨터가 꺼져 있어도 동작. 승인 프롬프트 없이 자동 실행되므로 권한 범위 설정이 중요
- **LangChain 구조화 출력**: dataclass/Pydantic으로 tool 입력을 검증하는 이유(LLM 함수 호출 시 컨텍스트 낭비 없이 입력 형식을 명확히 하기 위함) 학습, tool_call trace 확인의 중요성
- **Transformer 구조 복습**: Attention(특징 추출) + MLP(패턴 학습), temperature/top-K 샘플링, MoE 구조
- **하네스(Harness) 개념**: 정립된 용어라기보다 Agent 제어 방법론 전반을 가리키는 말. LangGraph(수동 제어) → Claude Code(tool call 기반 Sub-Agent, 컨텍스트 초과 시 md로 인계) 흐름 이해

## Day3 — Week3 메인/추가 과제 구현 (SQLite 영속화)

- `week03_build_nanas_logbook.py`에 저장/조회/수정/삭제 tool 전부 구현 완료 (`save_structured_request`, `list_saved_requests`, `get_saved_request`, `personal_list_saved_schedules`, `personal_update/delete_saved_schedules` 등)
- 프롬프트를 Week1→Week2→Week3 순서로 누적하면서, 이전 주차 규칙과 충돌하는 부분(조회/수정 방식)은 해당 섹션에 직접 override 문구를 명시해야 안전하다는 교훈 정리
- Python/JSON/Pydantic 트러블슈팅 다수 정리: `json.dumps` vs `dump`, `@tool`로 감싼 함수는 `.invoke()`로만 호출 가능, `args_schema` 검증 후 필드가 개별 인자로 풀려서 전달되는 구조, pydantic `model_validate`의 부모→자식 인스턴스 제한, `dict.get(key, default)`은 키가 없을 때만 기본값 적용됨, `*` 단독 파라미터(keyword-only 구분자) 등
- 남은 작업으로 `extract_schedule_request` 계열 스텁 구현을 다음 과제로 남김

## Day4 — 코드 감사 및 개선 계획

- **`json` 라이브러리 정리**: JSON은 텍스트 포맷이며 dict와는 다른 층위의 개념임을 재확인. `dumps/loads`(문자열)와 `dump/load`(파일)의 차이, `ensure_ascii=False` 옵션 정리
- **tool description 전수 조사**: Week3에 노출되는 tool 10개를 전부 확인한 결과, 함수 docstring이 있으면 `args_schema` 클래스 docstring은 항상 무시되고, 필드별 `Field(description=...)` 없이는 파라미터 설명이 LLM에 전달되지 않음을 확인. 6개 args_schema 클래스의 클래스 docstring이 전부 죽어있었음
- **구현 리뷰 TODO 작성**: `[삭제]` 프롬프트에 Week1 override 누락(삭제해도 재부팅 시 되살아날 위험), todo/reminder는 저장은 되지만 조회·수정·삭제 경로가 사실상 없음, `filters` 응답이 원본 파라미터를 반환하는 문제 등 우선순위별로 정리
- **수정 계획**: Field description을 전면 작성할지, 컨텍스트 소모와의 트레이드오프를 고려해 결정 필요. `extract_schedule_request`는 baseline 참조해 구현 예정

## Day5 — 영속화 흐름 정리 + 모델/도메인 지식

- **"요청 → 처리 → 결과 → 저장" 흐름 문서화**: 사용자 자연어 입력이 `StructuredRequest`(Week2, 1차 구조화) → `SaveStructuredRequestInput`(Week3, 저장 스키마 재검증) → `AppSQLiteStore.save_structured_request()`의 실제 INSERT까지 이어지는 전체 경로를 추적
- DB 저장 구조: `structured_requests`(원본 감사 로그) + `schedules`/`todos`/`reminders`(kind별 정규화 테이블)가 `request_id` 외래키로 연결됨. "객체 포함"이 아니라 "참조"라는 점을 실제 DB row로 확인
- **도메인 지식의 중요성 강조**: AI 설계 시 "~되게 구현해줘" 식이 아니라 pydantic/type/tool 규칙까지 상세히 설계해야 함. structured output이 필요한 이유(tool 호출 시 키 누락/오류 값 방지)
- Few-shot이 프롬프트 중 가장 강력한 지시 방식이라는 점, vocab/커스텀 토큰/멀티모달(같은 벡터 공간 표현) 개념 학습
