# Week4 시스템 프롬프트 설계 Learning Log

Week4 PR 리뷰 과정에서 tool 라우팅(어떤 조회 요청에 어떤 tool을 쓸지) 프롬프트를 고치며 겪은 문제들을, 발생한 순서가 아니라 **원인별로** 정리한다.

## 원인 1 — 강조 태그(`<반드시>`/`<강제>`)로 우선순위를 해결하려 함

Week1~4가 프롬프트를 계속 누적하는 구조(`weekN_prompt_parts()`가 `week(N-1)_prompt_parts()`를 감싸는 방식)라서, 같은 주제("저장된 일정 조회 시 어떤 tool을 쓸지")에 대한 지시가 Week3에 두 번, Week4에 한 번 겹쳐 있었다. 이걸 각 주차가 `<반드시>`/`<강제>`로 강도를 올려가며 표현하고 있었는데, 강조 태그가 여러 개 경쟁하면 LLM이 결국 "누가 더 세게 말했나"에 의존하게 돼서 오히려 더 예측 불가능해진다.

- **왜 override 자체는 못 없앴나**: `--week N`으로 각 주차 agent를 독립 실행할 수 있어야 해서(Week3만 실행하면 Week4 tool 자체가 없음), Week3 프롬프트를 지우거나 다시 쓸 수 없다. "나중 주차가 이전 주차를 override한다"는 패턴 자체는 구조상 불가피.
- **고친 것**: 강조 태그는 전부 제거하고, override는 조건문/평서문으로만 표현하도록 Week1~4 프롬프트를 다시 씀.
- **부수적으로 확인한 것**: "Week3 도구를 완전히 대체하라"는 명시적 스펙은 실제로 없었다. 근거로 삼았던 건 검증 기준("저장된 일정/할 일 질문은 search_saved_requests가 호출되는지 확인") 뿐이었고, 이건 "새 tool도 호출되는 걸 보고 싶다"는 채점 관점이지 기존 tool 사용을 금지하는 규정이 아니었다.

## 원인 2 — system prompt와 tool docstring은 서로 다른 채널

시스템 프롬프트에 조건 분기를 다 반영했는데도 라우팅이 안 바뀌는 경우가 있었다. 원인은 tool 자체의 docstring이었다:

```python
def personal_list_saved_schedules(...):
    """... Nana가 조회/수정/삭제 후보를 볼 때 사용합니다."""
```

LangChain `@tool`의 docstring은 system prompt와 **별개로** LLM에게 전달되는 tool 설명(schema description)이다. 시스템 프롬프트가 "조회는 다른 tool로"라고 말해도, tool 자신의 설명이 "나도 조회용이다"라고 선언하고 있으면 두 채널이 서로 다른 얘기를 하는 셈이라 충돌한다.

- **고친 것**: system prompt뿐 아니라 관련된 모든 tool의 docstring도 같은 방향으로 맞춤.

## 원인 3 — "하지 마라" 금지 규칙을 계속 쌓는 방식의 구조적 취약성

docstring까지 고쳤는데도 재현되는 경우가 있었고(반복 노출 편향으로 추정 — 프롬프트 전체에서 특정 tool 이름이 더 자주 언급됨), 그걸 "이 목적에는 이 tool을 사용하지 않는다"는 금지문으로 바꿔서 일단 해결했다. 그런데 이후 다른 예외 케이스(날짜 조건, todo/reminder)가 발견될 때마다 금지 규칙을 하나씩 더 추가하는 식으로 대응하다 보니, 조건이 늘어날수록 프롬프트가 복잡해지고 LLM이 그 조건들을 정확히 못 타는 문제가 반복됐다 (whack-a-mole).

- **근본 원인**: "이럴 땐 쓰지 마라"는 금지 규칙은 발견되는 예외 케이스 수만큼 계속 늘어나야 하고, 규칙이 늘수록 전체가 더 깨지기 쉬워진다.
- **전환한 방향**: 금지 규칙을 쌓는 대신, 각 tool이 **실제로 뭘 할 수 있고 뭘 못 하는지를 사실 그대로 설명**하고 tool 선택 판단은 LLM에게 맡기는 쪽으로 바꿈. 예:
  ```
  - personal_list_saved_schedules: personal_schedule/group_schedule만 조회 가능(todo/reminder는 조회 안 됨). date_from/date_to 날짜 필터 가능. 수정/삭제 전 schedule_id 확인 용도.
  - search_saved_requests: 일정/할 일/알림을 종류 상관없이 키워드로 찾을 수 있으나 날짜 범위 필터는 없다.
  ```
  이렇게 하면 새로운 케이스가 나와도 tool의 능력/한계 설명만 정확하면 LLM이 스스로 추론해서 커버되고, 규칙을 추가로 얹을 필요가 없어진다.

## 원인 4 — 프롬프트를 고치기 전에 tool의 실제 데이터/파라미터 한계를 확인하지 않음

"조회는 무조건 search_saved_requests"라는 초기 규칙이 실제로는 두 가지 지점에서 깨졌는데, 둘 다 **코드를 먼저 읽었으면 미리 알 수 있었던** 구조적 한계였다:

1. **날짜 필터 부재**: `SearchSavedRequestsInput`엔 `date_from`/`date_to`가 없고, `search_saved_requests`는 title/reason/raw_json에 대한 키워드 LIKE 검색뿐이다. "이번 주 일정 말해줘" 같은 질문엔 애초에 답할 방법이 없다. 반대로 `personal_list_saved_schedules`(`SavedScheduleListInput`)엔 날짜 필터가 있다.
2. **kind별 테이블 분리**: `personal_list_saved_schedules`가 호출하는 `store.list_schedules`는 `schedules` 테이블만 조회하는데, todo/reminder는 `save_structured_request`에서 애초에 `todos`/`reminders`라는 별도 테이블에 저장된다(`fixed/app_store.py`). 그래서 이 tool은 `kind`를 뭘 넘기든 todo/reminder를 **구조적으로 절대 반환할 수 없다**.
3. (반대로) `search_saved_requests`는 `kind` 파라미터가 LLM에 노출되지 않아 **항상 종류 무관하게** 검색한다 — 즉 할 일/알림 조회는 애초에 이 tool의 정상 커버리지 안에 있었다.

- **교훈**: "이 tool은 이럴 때 써라"는 규칙을 짜기 전에, 그 tool이 실제로 어떤 파라미터를 받고 내부적으로 어느 테이블/컬럼을 건드리는지부터 코드로 확인했어야 한다. 프롬프트 문구만 계속 고치는 시행착오를 줄일 수 있었을 것.

## 원인 5 — 새 tool의 응답 규칙을 기존 코드 관례 확인 없이 임의로 정함

검색 tool 3개에 `ok=bool(hits)`(결과 없으면 실패)를 적용했었는데, 이미 코드베이스에 있던 관례와 어긋났다:
- `list_saved_requests`/`get_saved_request`: 결과가 비어도 `ok`를 따로 계산하지 않고 기본값 `True`.
- `personal_delete_saved_schedules`: `ok=deleted_count != 0` (원하는 효과가 없으면 실패).

즉 이미 세워져 있던 원칙은 **"조회는 메커니즘이 정상 동작했으면 결과가 0건이어도 성공, 삭제/수정은 원하는 효과가 실제로 일어나야 성공"**이었다. 새로 만든 조회 tool 3개도 이 원칙에 맞춰 `ok`를 항상 기본값(`True`)으로 되돌렸다.

- **교훈**: 응답 필드의 의미를 새로 정할 때는, 먼저 기존 코드에 이미 있는 유사 tool들의 관례를 확인해야 일관성이 깨지지 않는다.

## 원인 6 — `ok` 필드와 "진짜 실패"(예외)는 다른 채널이라는 점을 놓치기 쉬움

`ok=False`로 표현되는 것은 "tool이 정상적으로 끝까지 실행됐지만 논리적으로 원하는 결과가 없었다"는 뜻이지, "tool 실행 자체가 깨졌다"는 뜻이 아니다. 진짜 예외(DB 연결 실패, embedding API 에러 등)는 tool 함수 안에서 잡히지 않고 그대로 전파되다가, 최상위 agent 실행 레이어(`fixed/week_agent_registry.py`)의 `try/except`에서 잡혀 완전히 다른 형태(`error`/`error_type` 필드가 있는 trace, "Week N agent 실행 중 오류가 발생했습니다" 답변)로 사용자에게 전달된다.

- **교훈**: 조회 tool에서 `ok`를 항상 `True`로 둬도 진짜 장애를 숨기는 게 아니다 — 장애는 애초에 `ok` 필드가 담당하는 영역 밖에서 별도로 처리된다.
