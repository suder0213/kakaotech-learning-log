# Week 6 Learning Log — Supervisor + Nana/Kana 하위 agent 구조

대상 파일: `student_parts/week06_kanamate_decides_schedule.py`

## 1. 이번 주차의 핵심 과제

- 한 agent가 모든 걸 처리하던 구조를 **Supervisor + Nana(개인) + Kana(외부/그룹조율) 하위 agent**로 나누는 것.
- `find_common_available_slots`/`decide_final_slot`은 **Python이 최적 시간을 계산하지 않고, LLM(Kana)이 직접 busy_rows를 읽어 후보/최종 시간을 골라 tool argument로 넘기는** 구조. tool은 그걸 검증·기록만 함.

이 두 가지 설계가 이번 주차 전체를 관통하는 전제였고, 실제로 문제가 생긴 지점도 대부분 이 전제를 코드/prompt가 충분히 지키지 못해서였다.

---

## 2. 코드 리뷰로 찾아낸 버그

구현 자체는 다 해놨지만, AI 코드 리뷰를 받으며 실행 전에 아래 버그들을 미리 잡았다.

### `find_common_available_slots_dict`
- `collect_member_schedules.invoke(...)`가 **JSON 문자열**을 반환하는데, 파싱 없이 그대로 `busy_rows`에 넣고 있었음 → `json.loads(...)["rows"]`로 수정.
- `duration_minutes`/`workday_start`/`workday_end`/`limit`을 인자로 받아놓고 실제 검증 함수(`find_common_available_slots_payload`)에 전달을 안 하고 있었음 → 항상 기본값(60분/09:00~18:00/5개)으로만 검증되던 문제.
- `busy_rows or collect_member_schedules.invoke(...)`처럼 truthy 체크를 쓰고 있었는데, 가이드 계약은 "`busy_rows`가 **None**이면 수집"이었음 → `is None` 체크로 수정.

### `nana_agent` / `kana_agent`
- `global` 선언 없이 모듈 전역 변수(`_NANA_SUBAGENT`)에 대입하려고 해서, 호출 즉시 `UnboundLocalError`가 나는 구조였음.
- `tools=agent_tool_names("nana_agent")`처럼 **tool 이름 문자열 리스트**를 `create_agent(tools=...)`에 넘기고 있었음 — 실제 tool 객체가 아니라서 agent가 tool을 못 씀. `week04_tools()`/`kana_tools()`로 교체.
  - **실제로 재현해서 확인**: `create_agent(tools=["personal_create_schedule", ...])`를 호출하면 `ToolNode.__init__`에서 `AttributeError: 'function' object has no attribute 'name'`가 즉시 발생함. LangChain이 문자열을 `tool("이름")` **데코레이터 팩토리 호출**로 오인해서 생기는 에러였음. "조용히 tool 없이 동작"하는 게 아니라 **construction 시점에 바로 크래시**.
- `.invoke({"query": query})`로 호출하고 있었는데, `create_agent(...)`로 만든 agent는 `{"messages": [...]}` 형식을 받음 (`fixed/week_agent_registry.py:112`, `fixed/agent_runtime.py:127-136`에서 실제 쓰는 형식 확인) → `{"messages": [{"role": "user", "content": query}]}`로 수정.
- `json.dumps(...)`에 `ensure_ascii=False`가 빠져 있었음. 한글이 `\uXXXX`로 escape되면 tool 결과를 다시 읽는 LLM 입장에서 토큰도 더 들고 파싱 노이즈도 생길 수 있어서, 프로젝트 전체 컨벤션(다른 모든 `json_payload`/`json.dumps` 호출)에 맞춰 통일.
- `kana_agent`의 `final_slot_payload`가 항상 `None`으로 하드코딩돼 있어서, Kana가 실제로 `decide_final_slot`을 호출해 최종 시간을 확정해도 그 결과가 supervisor까지 절대 안 올라가던 버그 → 하위 trace를 훑어 `decide_final_slot`의 `tool_result` content를 끌어올리도록 수정.

### tool description 상수
- `FIND_COMMON_AVAILABLE_SLOTS_DESCRIPTION`/`DECIDE_FINAL_SLOT_DESCRIPTION`이 TODO 지시문 아래 남은 코드가 그대로 **placeholder 문자열**(빈 docstring 잔여물, 완전 빈 문자열)이 되어 있었음 — `@tool(description=...)`는 명시적으로 넘긴 값이 함수 docstring 대신 LLM에게 노출되므로, 이 상태로는 Kana가 두 tool을 언제/어떻게 써야 하는지 알 근거가 전혀 없었음. "이 tool은 계산을 대신 안 한다", "candidate_slots/final_slot의 필드 형식" 등 실제 계약을 설명하는 내용으로 채움.

---

## 3. 멘토 피드백 반영

### (1) 담당이 아닌 요청이 잘못 위임됐을 때 처리 규칙이 없었음
> "Nana의 담당 범위는 명확히 쓰셨는데, 담당이 아닌 요청이 들어왔을 때 어떻게 응답할지에 대한 규칙이 안 보입니다."

**설계 고민**: "Nana가 거절하면서 Kana를 지목하게 할까?"를 처음 생각했는데, 확장성을 고려하면 나쁜 선택이었음 — 나중에 하위 agent가 3개, 4개로 늘어나면 매번 서로의 존재를 알고 있어야 함. 그래서 방향을 바꿈:

- **하위 agent(Nana/Kana)**: 범위 밖 요청이 오면 시도하지 말고 **"요청 반려됨 / 사유: ..."** 형태로만 답한다. **다른 agent를 지칭하지 않는다.**
- **Supervisor**: 하위 agent 응답이 반려 신호면, 그 사유를 참고해 스스로 다시 판단해서 올바른 agent로 재위임하거나 직접 답변한다.

→ 하위 agent는 서로를 몰라도 되고, 라우팅 판단은 전체 지도를 가진 Supervisor에만 있으면 되는 구조. 실제 supervisor pattern(예: LangGraph의 multi-agent supervisor)에서도 "worker는 자기가 못하는 이유만 알리고, 최종 라우팅은 orchestrator가 한다"는 방식을 쓴다.

### (2) `list_shared_schedules` 역할 설명이 실제 구현과 반대였음
> "list_shared_schedules는 조회에 사용하는 tool 아닐까요? 공유 일정 확인해줘 같은 요청은 어떻게 처리할까요?"

원래 "list_shared_schedules는 수정/삭제에 사용, 현재 미사용"이라고 써놨는데, 실제로 `list_shared_schedules`는 **조회 전용(Read-only)** tool이었음. 의도는 "수정/삭제 tool을 쓰기 전에 schedule_id를 재확인하는 용도"였는데, Kana에게 실제 수정/삭제 tool(`create_shared_schedule`/`delete_shared_schedule`)이 없어서 "안 쓴다"고 적어버린 것 — 그 결과 "공유 일정 확인해줘"처럼 사람/기간이 특정되지 않은 요청을 처리할 tool이 없어지는 부작용이 생김.

**해결**: 두 조회 tool의 실제 계약 차이(필수 인자 유무)를 기준으로 역할을 재정의.
- `list_shared_schedules`: 전체 조회, 또는 특정 사람의 **기간 미지정** 조회.
- `extract_schedules_from_history`: 특정 사람의 **명확한 기간**이 있는 busy-time 조회 (`member_names`/`date_from`/`date_to` 전부 필수).

### (3) `find_common_available_slots_dict`에서 "나"가 payload에서 빠짐 (회귀)
> "원본 지시에 '내 일정도 근거이므로 member_names에는 나를 함께 포함합니다'라고 되어 있는데..."

리팩터링 과정에서 `find_common_available_slots_payload(member_names=normalized_member_names, ...)`처럼 `+ ["나"]`가 빠진 회귀가 있었음. `collect_member_schedules.invoke(...)` 쪽은 "나"가 없어도 내부적으로 항상 "나"의 일정을 합치므로 문제없지만, **응답의 `"members"` 필드**는 명시적으로 "나"를 더해줘야 했음 → 복구.

---

## 4. 실행 trace로만 드러난 문제 (코드 버그 아님, LLM/prompt 설계 문제)

버그를 다 고친 뒤 `./run.sh --week6`으로 실제 그룹 조율 요청을 넣어보며 trace를 확인하는 과정에서, **코드는 맞는데 Kana(LLM)가 의도대로 안 움직이는 사례**를 여러 번 발견했다.

1. **중복 호출**: 같은 `member_names`/`date_from`/`date_to`로 `extract_schedules_from_history`와 `collect_member_schedules`를 둘 다 호출 — 후자가 전자를 내부적으로 이미 포함하는데도. → prompt에 "collect_member_schedules가 이미 포함하니 같은 조건으로 extract_schedules_from_history를 따로 부르지 않는다"를 명시.
2. **busy_rows 누락**: `find_common_available_slots` 호출 시 `busy_rows`에서 "나"의 일정을 빼고 넘긴 사례 발견 (이번엔 우연히 "나"의 일정이 요청 기간 밖이라 결과에 영향 없었지만, 실제로 겹쳤다면 오답으로 이어질 뻔함). → candidate_slots/busy_rows의 정확한 정의(어느 busy row와도 안 겹치는 시간대)를 prompt에 명시.
3. **후보 생성 자체를 생략**: `candidate_slots`를 빈 배열로 제출하고, `decide_final_slot` 호출도 생략한 채 "공통 가능한 시간이 없다"고 답한 사례. Busy-time이 드문드문 있어서 빈 날짜가 훨씬 많았는데도 후보를 하나도 안 만들어봄. → prompt에 "전체 기간을 훑어 최소 2~3개 이상 실제로 후보를 찾아라", "후보가 없다고 판단해도 `decide_final_slot`을 반드시 호출해 `needs_agent_selection=true`로 결론을 기록하라"를 추가.

---

## 5. 이번 주차에서 얻은 설계 원칙

- **"LLM이 계산하는 tool"은 코드가 맞아도 안정적으로 동작하지 않는다.** description/prompt가 계약(무엇을 대신 안 해주는지, 무엇을 반드시 채워야 하는지)을 명시적으로 말하지 않으면, LLM은 계산을 생략하거나 tool에 떠넘기려 한다. 실행 trace를 직접 까보기 전엔 이런 문제를 코드 리뷰만으로 잡기 어려웠다.
- **tool 두 개가 비슷해 보이면, 진짜 역할 차이는 실제 구현(어느 테이블/저장소를 건드리는지, 어떤 인자가 필수인지)에서 나온다.** 이름이나 docstring만 보고 판단하면 오해가 생긴다 (`list_shared_schedules` 사례).
- **하위 agent가 늘어날 걸 감안하면, "누구에게 넘겨라"를 하위 agent가 알게 하지 말고 "나는 이걸 못한다 + 이유"만 표현하게 하고, 라우팅 판단은 전체를 아는 Supervisor에게 집중시키는 게 확장성이 좋다.**
- **버그 재현은 말로 설명하지 말고 직접 돌려서 확인하는 게 빠르다.** "문자열 리스트를 tools에 넘기면 어떻게 되냐"는 질문에 실제로 `create_agent`를 호출해봐서 정확한 에러 메시지와 원인(LangChain이 문자열을 `@tool("이름")` 데코레이터로 오인)까지 확인할 수 있었다.
