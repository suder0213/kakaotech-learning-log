# Week 3 tool/args_schema description 전수 조사

`@tool(args_schema=...)`에서 "설명이 실제로 LLM에게 전달되는지"를 기준으로, week3에 노출되는 tool 10개와 관련 클래스/함수를 전부 확인했다.

## 규칙 정리

- **tool 설명(description)**: `함수 docstring` > `args_schema 클래스 docstring`. 함수에 docstring이 있으면 클래스 docstring은 **항상 죽는다** (병합 안 됨, 완전히 무시됨).
- **파라미터별 설명**: `args_schema`의 각 필드에 `Field(description=...)`를 줬을 때만 LLM에게 전달된다. `Field()` 없이 `x: str | None = None`처럼 plain type hint만 쓰면 설명 자체가 존재하지 않는다.
- **`args_schema` 없이 `@tool`만 붙인 함수**: 함수 시그니처에서 스키마를 자동 추론하지만, 타입힌트만으로는 필드 설명이 생기지 않는다.
- **자식 클래스가 부모 필드를 재선언하면 부모의 description은 완전히 덮인다** (병합 아님). Pydantic v2 기준으로 직접 코드 실행해서 확인함:
  ```python
  class Parent(BaseModel):
      kind: Literal["a","b"] = Field(default="a", description="매우 길고 자세한 설명")
  class Child(Parent):
      kind: Literal["a","b"] = Field(default="a", description="짧은 설명")
  # Child.model_json_schema()["properties"]["kind"]["description"] == "짧은 설명"
  # 부모의 긴 설명은 완전히 사라짐
  ```
- **tool도 args_schema도 아닌 일반 함수/클래스의 docstring**: LLM은 아예 보지 않는다. 순수하게 사람이 읽는 코드 문서일 뿐.

## Week3에서 노출되는 tool 10개 전수 조사

| tool | args_schema | tool 설명 (LLM이 보는 것) | args_schema 클래스 docstring | 필드별 description |
|---|---|---|---|---|
| `personal_create_schedule` (Week3판) | 없음 (시그니처 자동추론) | ✅ 함수 docstring: "Nana의 개인 일정을 생성하고 Week 3+ 앱 SQLite DB에도 저장합니다." | 해당 없음 | ❌ title/date/start_time/end_time/attendees 전부 plain type hint → 없음 |
| `personal_list_schedules` (Week1, 목록에 여전히 존재) | 없음 | ✅ "선택한 시작일과 종료일 범위에 포함되는 Nana의 개인 일정을 조회합니다." | 해당 없음 | ❌ 없음 |
| `personal_delete_schedule` (Week1, 목록에 여전히 존재) | 없음 | ✅ "일정 ID에 해당하는 개인 일정을 삭제합니다." | 해당 없음 | ❌ 없음 |
| `extract_schedule_request` (Week2 스텁) | 없음 | ✅ "이후 회차에서 저장 흐름과 연결할 예약 tool입니다." (스텁 placeholder 문구 그대로 전달) | 해당 없음 | ❌ 없음 |
| `save_structured_request` | `SaveStructuredRequestInput` | ✅ 함수 docstring: "Week 2 structured_request 필드를 검증한 뒤 SQLite에 저장합니다." | 💀 **죽음** — "SQLite 저장 직전에 검증하는 Week 3 입력 스키마입니다." | 아래 상세 표 참고 |
| `list_saved_requests` | `SavedRequestListInput` | ✅ "SQLite에 저장된 구조화 요청 목록을 조회합니다." | 💀 **죽음** — "저장 요청 목록 조회 입력입니다." | ❌ kind/date_from/date_to 모두 `Field()` 자체를 안 씀 → 원래 없음 |
| `get_saved_request` | `SavedRequestGetInput` | ✅ "request_id로 구조화 요청 행 하나를 조회합니다." | 💀 **죽음** — "저장 요청 단건 조회 입력입니다." | ❌ `request_id: str` — 없음 |
| `personal_list_saved_schedules` | `SavedScheduleListInput` | ✅ "앱 DB에 저장된 일정 목록을 날짜/종류 필터로 반환합니다. Nana가 조회/수정/삭제 후보를 볼 때 사용합니다." | 💀 **죽음** — "저장 일정 목록 조회 입력입니다." | ⚠️ `limit`은 `Field(default=50, ge=1, le=200)`이라 제약조건(ge/le)은 스키마에 살아있지만 `description=`이 없어 텍스트 설명은 없음. kind/date_from/date_to는 `Field()` 자체가 없어 없음 |
| `personal_update_saved_schedule` | `SavedScheduleUpdateInput` | ✅ "앱 DB에 저장된 내 일정 원본을 수정하고 공유 일정 복사본을 같은 값으로 갱신합니다." | 💀 **죽음** — "저장 일정 수정 입력입니다." | ❌ schedule_id/title/date/start_time/end_time/attendees 전부 없음 |
| `personal_delete_saved_schedules` | `SavedScheduleDeleteInput` | ✅ "Nana가 고른 일정 ID나 날짜/제목/시간 필터로 저장 일정을 삭제합니다." | 💀 **죽음** — "저장 일정 삭제 입력입니다." | ❌ schedule_ids/date/title/start_time/time_unspecified/delete_all 전부 없음 |

**패턴**: Week3의 args_schema 클래스 6개 모두 docstring이 달려있는데, 그중 함수 docstring이 이미 존재하는 tool 6개 전부에서 클래스 docstring이 **100% 죽어있다**. 우연이 아니라 "클래스에도 습관적으로 docstring을 다는" 패턴이 반복된 결과 — 애초에 이 6개 docstring은 처음부터 필요 없었다.

## `save_structured_request` 필드별 상세 (`SaveStructuredRequestInput`)

유일하게 필드 description이 실제로 존재하는 스키마. `StructuredRequest`를 상속하면서 일부 필드를 재선언했고, **재선언한 필드는 부모 설명을 완전히 덮어쓴다**.

| 필드 | 출처 | 실제 LLM이 보는 description |
|---|---|---|
| `kind` | `SaveStructuredRequestInput`에서 재선언 | ⚠️ "분류된 요청 종류" (한 줄). `StructuredRequest`에 있던 personal_schedule/group_schedule/todo/reminder/unknown 분류 기준 상세 설명(4줄)은 **여기서 완전히 사라짐**. Week2 agent(구조화 전용 agent)에서는 그 긴 설명이 살아있지만, Week3의 `save_structured_request` tool 스키마에는 없음 |
| `source_schedule_id` | `SaveStructuredRequestInput`에서 신규 추가 | ✅ "Week 1 임시 일정에서 넘어온 원본 일정 ID" |
| `title` | `StructuredRequest`에서 상속 (재선언 안 함) | ✅ 원본 설명 그대로 살아있음 |
| `date` | 상속 | ✅ "요청의 날짜를 YYYY-MM-DD 형식으로... 확실하지 않으면 None" |
| `start_time` | 상속 | ✅ 살아있음 |
| `end_time` | 상속 | ✅ 살아있음 |
| `members` | 상속 | ✅ 살아있음 |
| `priority` | 상속 | ✅ 살아있음 |
| `reason` | 상속 | ✅ 살아있음 |
| `original_text` | 상속 | ✅ 살아있음 |

`kind`만 재선언했다는 이유로 분류 기준 설명이 통째로 날아간 게 실질적으로 중요한 지점이다. 지금은 시스템 프롬프트(`WEEK02_PROMPT`)에 분류 기준이 텍스트로 이미 누적되어 있어서 문제가 드러나지 않고 있지만, "스키마 설명만 보고 판단해야 하는 상황"(예: 이 tool이 프롬프트 없이 단독으로 호출되는 경로)이 오면 바로 드러날 지점.

## LLM이 절대 보지 않는 것 (tool도 args_schema도 아닌 일반 함수/클래스)

아래는 전부 docstring이 있지만 순수 내부 구현 문서일 뿐, LLM에게는 전달되지 않는다:

`_store()`, `_tool_name()`, `json_payload()`, `tool_result()`, `_save_input_from()`, `save_structured_request_payload()`, `_delete_saved_schedules()`, `structured_request_from_week01_schedule()`, `delete_saved_schedules_dict()`, `week03_tools()`, `week03_system_prompt()`, `week03_prompt_parts()`, `build_week03_agent()`, `build_week_agent()`, `SaveStructuredRequestInput.unwrap_legacy_payload()` (model_validator).

## 요약

- **살아있는 description**: 10개 tool 전부의 함수 docstring(tool 설명), `SaveStructuredRequestInput`이 상속받은 9개 필드 중 8개(`kind` 제외), `source_schedule_id`
- **죽어있는 description**: 6개 args_schema 클래스의 클래스 docstring 전부, `SaveStructuredRequestInput.kind`의 부모 설명(재선언으로 덮임)
- **원래부터 없던 것**: 나머지 5개 args_schema 클래스(`SavedRequestListInput`/`SavedRequestGetInput`/`SavedScheduleListInput`/`SavedScheduleUpdateInput`/`SavedScheduleDeleteInput`)의 모든 필드 — `Field(description=...)`를 한 번도 쓰지 않았음
