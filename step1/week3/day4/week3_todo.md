# Week 3 (`student_parts/week03_build_nanas_logbook.py`) 구현 리뷰 — TODO

`student_parts_baseline/` (정답/기준 구현)과 대조하고, `fixed/app_store.py`의 실제 테이블 구조를 따라가면서 찾은 문제점 정리.
"동작은 하지만 흐름이 이상한 것" / "죽어있는 프롬프트·tool" / "이미 적어둔 교훈이 코드에는 반영 안 된 것" 위주로 뽑았다.

---

## 🔴 우선순위 높음 — 실제로 잘못된 동작을 만들 수 있음

### 1. `[삭제]` 프롬프트에 Week1 override가 빠짐 → 삭제해도 재부팅하면 되살아날 수 있음
- `week03_tools()` (`week03_build_nanas_logbook.py:590-605`)는 `week01_tools()`에서 **`personal_create_schedule`만** Week3 버전으로 교체한다. `personal_list_schedules`, `personal_delete_schedule`(둘 다 Week1 임시 메모리용)은 그대로 tool 목록에 남아있다.
- `WEEK03_TOOL_CALL_PROMPT`의 `[조회]`/`[수정]` 섹션은 "Week 1의 ~~ 대신 <반드시> 이걸 써라"를 **명시**하는데, `[삭제]` 섹션(`week03_build_nanas_logbook.py:56-58`)만 이 override 문구가 없다.
- 이미 `WEEK3_NOTES.md` §3.12에 "충돌 당사자 섹션에 직접 명시하는 게 안전하다"는 교훈을 스스로 적어놨는데, `[삭제]` 섹션에는 이 교훈이 적용이 안 된 상태.
- **위험한 시나리오**: LLM이 `personal_delete_schedule`(Week1)을 호출 → `PERSONAL_SCHEDULES`(임시 메모리)에서는 지워지고 `ok=True/deleted=True` 응답 → 그런데 SQLite에 저장된 원본은 그대로 남아있음 → 새 대화/재시작 후 "분명히 지웠던 일정"이 다시 보임.
- **TODO**: `[삭제]` 섹션에도 "Week 1의 personal_delete_schedule 대신 personal_delete_saved_schedules를 반드시 사용한다" 문구 추가. 근본적으로는 프롬프트 텍스트에만 의존하지 말고, `week03_tools()`에서 `personal_list_schedules`/`personal_delete_schedule`도 함께 걷어내거나 Week3 버전으로 교체하는 게 더 안전.

### 2. todo/reminder는 저장은 되는데 **조회할 방법이 실질적으로 없음**
- `AppSQLiteStore.save_structured_request`의 docstring(`fixed/app_store.py:281-289`)에 따르면 저장 위치가 kind별로 다르다: `personal_schedule`/`group_schedule` → `schedules` 테이블, `todo` → `todos` 테이블, `reminder` → `reminders` 테이블 (+ 모두 `structured_requests`에도 원본 저장).
- `personal_list_saved_schedules`는 내부적으로 `store.list_schedules(...)`를 호출하는데, 이건 **`schedules` 테이블만** 조회한다 (`fixed/app_store.py:480-505`). `todos`/`reminders` 테이블은 아예 안 봄.
- 즉 `kind="todo"`나 `kind="reminder"`를 넘겨도 `personal_list_saved_schedules`는 구조적으로 항상 빈 결과만 준다. 에러도 안 나고 "조용히 빈 리스트"가 나오니 디버깅 없이는 알기 어려움.
- todo/reminder까지 담고 있는 건 `list_saved_requests`/`get_saved_request` (`structured_requests` 원본 테이블 조회)인데, **`WEEK03_TOOL_CALL_PROMPT`의 `[조회]` 섹션은 이 두 tool을 한 번도 언급하지 않는다** (`week03_build_nanas_logbook.py:47-49`). 사용자가 "내가 등록한 할 일 보여줘" 라고 물어도 LLM에게 "이럴 땐 list_saved_requests를 써라"는 지시가 전혀 없음.
- 결과적으로 `list_saved_requests`/`get_saved_request`는 tool 목록에는 있지만 프롬프트상 "언제 쓰는지" 안내가 없는 **죽은 tool**에 가깝고, todo/reminder는 저장 경로만 있고 조회 경로가 실질적으로 막혀있다.
- **TODO**: `[조회]` 섹션에 kind 분기 추가 — "personal_schedule/group_schedule 조회는 personal_list_saved_schedules, todo/reminder 조회는 list_saved_requests(kind=...)" 식으로.

### 3. todo/reminder는 **수정/삭제 tool도 없음**
- `AppSQLiteStore`에 `todos`/`reminders`/`structured_requests`용 update/delete 메서드가 전혀 없다 (grep 결과 0건). `personal_update_saved_schedule`/`personal_delete_saved_schedules`는 전부 `schedules` 테이블 대상.
- 즉 한번 저장된 todo/reminder는 앱 재시작 없이는 사실상 고칠 수도 지울 수도 없음. 지금 당장 고칠 범위는 아닐 수 있지만(4주차 몫일 수도), 최소한 "현재는 todo/reminder 수정·삭제 tool이 없다"는 걸 시스템 프롬프트나 문서에 명시해서 LLM이 있는 척 안내하다가 실패하는 상황을 막아야 함.
- **TODO**: 범위 밖이면 최소한 알려진 제약으로 기록. 범위 안이면 `list_saved_requests`/`get_saved_request`와 대칭되는 update/delete 경로 설계 필요.

---

## 🟡 우선순위 중간 — 동작은 하지만 일관성이 깨져 있음

### 4. `personal_list_saved_schedules`의 `filters`가 "실제 적용된 값"이 아니라 "원본 인자"를 돌려줌
- `week03_build_nanas_logbook.py:495-507`: 실제 쿼리에는 `kind or "personal_schedule"`이 적용되는데, 응답 `filters`에는 원본 `kind`(즉 `None`일 수도 있음)를 그대로 넣고 있다.
- 이건 `WEEK3_NOTES.md` §3.11 "적용된 값 vs 원본 파라미터 구분"에 학생이 **이미 스스로 적어둔 교훈**인데, 정작 이 코드에는 반영이 안 됐다. trace 디버깅할 때 "왜 kind=None인데 personal_schedule만 나오지?" 하고 헷갈릴 수 있음.
- **TODO**: `filters`에 `kind or "personal_schedule"` (실제 적용값)을 넣도록 수정.

### 5. `save_structured_request`의 `args_schema` 클래스 docstring이 죽은 텍스트
- `SaveStructuredRequestInput`(`week03_build_nanas_logbook.py:238-239`)에 클래스 docstring을 써놨지만, `@tool(args_schema=...)`에서 tool의 최종 description은 **함수 자신의 docstring이 항상 우선**한다(`args_schema` docstring은 함수 docstring이 없을 때만 fallback). `save_structured_request` 함수에 이미 docstring이 있으므로 `SaveStructuredRequestInput`의 클래스 docstring은 LLM에게 절대 전달되지 않음.
- 버그는 아니지만 "설명을 두 군데 써놨는데 하나는 항상 무시된다"는 걸 모르고 있으면 나중에 설명 갱신할 때 엉뚱한 곳(모델 docstring)만 고치는 실수를 하게 됨.
- 참고로 필드별 `Field(description=...)`는 이 규칙과 무관하게 항상 LLM에게 전달됨 — 죽는 건 **클래스 docstring**뿐.
- **TODO**: 굳이 고칠 필요는 없지만, 다음에 `args_schema` 쓸 때는 "tool 설명은 함수 docstring에만 쓴다" 규칙을 정해서 중복 작성 자체를 없애는 게 낫다.

### 6. 참석자 필드 이름이 tool마다 다름 (`attendees` vs `members`)
- Week1 `personal_create_schedule`/`SavedScheduleUpdateInput`은 `attendees`, Week2 `StructuredRequest`/Week3 `save_structured_request`는 같은 개념을 `members`로 부른다.
- `structured_request_from_week01_schedule`(`week03_build_nanas_logbook.py:368-380`)에서 `members = schedule.get("attendees")`로 매핑해주고 있어서 지금은 동작하지만, 이름이 갈라져 있으니 필드 하나 늘리거나 옮길 때 실수하기 쉬움.
- **TODO**: 지금 당장 리네이밍하기엔 범위가 크니, 최소한 어디가 `attendees`고 어디가 `members`인지 주석/문서로 명확히 표시. 여유가 되면 장기적으로 통일 고려.

### 7. `extract_schedule_request` / `extract_structured_request` / `_coerce_structured_request` — 이미 알고 있던 스텁, 여전히 미구현
- `week02_structure_natural_language_requests.py:137-153` 세 함수 모두 `...`만 있고 반환값이 없음 (`WEEK3_NOTES.md` "남은 작업" §1에 이미 기록돼 있던 항목).
- 지금 상태로 `_save_input_from`(`week03_build_nanas_logbook.py:255-265`)에 문자열이 들어오면 `extract_structured_request(value)`가 `None`을 반환하고, 그 다음 `SaveStructuredRequestInput.model_validate(None)`에서 `ValidationError`가 난다. (LLM이 직접 필드를 채워 호출하는 정상 경로는 문자열 입력이 아니라서 영향 없음 — 문자열을 직접 넘기는 테스트/helper 호출에서만 터짐.)
- **추가로 확인할 점**: `student_parts_baseline`의 완성 버전을 봐도, `extract_schedule_request`를 실제로 "언제 호출해야 하는지"가 `WEEK03_TOOL_CALL_PROMPT`에 전혀 없다 (`[저장]` 섹션은 `personal_create_schedule`/`save_structured_request`로 바로 시작). Week2의 kind 분류 규칙(`WEEK02_PROMPT`)은 이미 시스템 프롬프트 텍스트로 통째로 누적되어 있어서, 단일 agent가 굳이 `extract_schedule_request`를 tool-call로 다시 거치지 않고도 `save_structured_request` 인자를 바로 채울 수 있는 구조가 돼버렸다.
- **TODO**: (a) baseline대로 세 함수 구현. (b) 구현한 뒤에도 "이 tool을 실제로 언제 호출해야 하는지"를 `WEEK03_TOOL_CALL_PROMPT`에 추가할지, 아니면 지금 구조(단일 agent + 누적 프롬프트)에서는 이 bridge tool 자체가 불필요한지 먼저 판단하고 결정.

---

## 🟢 참고 — 사소하지만 짚어둘 만한 것

### 8. `list_saved_requests` tool에 `limit`이 노출 안 됨
- `AppSQLiteStore.list_saved_requests`(`fixed/app_store.py:418-424`)는 `limit: int = 20`을 받지만, `SavedRequestListInput`/`list_saved_requests` tool(`week03_build_nanas_logbook.py:282-288`, `452-467`)엔 `limit` 파라미터가 없어서 항상 기본값 20으로 고정.
- 지금은 문제 없지만, 저장된 요청이 많아지면 "더 보여줘" 같은 요청을 처리할 방법이 없음.
- **TODO**: 필요하면 `SavedRequestListInput`에 `limit` 필드 추가.

---

## 다음에 확인할 순서 제안
1. 🔴 1번(`[삭제]` override 누락)부터 — 가장 조용히, 가장 크게 틀릴 수 있는 부분.
2. 🔴 2, 3번(todo/reminder 조회·수정·삭제 공백) — 범위가 Week3인지 Week4인지부터 정하기.
3. 🟡 4번(`filters` 실제값) — 5분 안에 고칠 수 있는 작은 수정.
4. 🟡 7번(`extract_schedule_request` 스텁) — 구현 자체보다 "필요한가?"를 먼저 결정.
