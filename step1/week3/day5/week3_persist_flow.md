# Week3 핵심: "요청 → 처리 → 결과 → 저장"의 영속화 흐름

Week3의 본질은 새로운 기능을 추가하는 게 아니라, Week1~2에서 휘발되던 대화 결과를
**구조화된 데이터(Pydantic)** 로 검증한 뒤 **SQLite에 영속화**하는 것이다.
이 문서는 사용자의 자연어 한 줄이 어떤 클래스/함수를 거쳐 결국 DB row로 남는지만 추적한다.

## 전체 흐름 한눈에 보기

```
사용자 입력 (Gradio)
  → AgentRuntime.run_agent()                      [fixed/agent_runtime.py]
      → app_store.append_message("user", ...)     — 대화 원문 먼저 저장
      → run_active_week_agent()                   — Week3 LangChain agent 실행
          → extract_schedule_request / personal_create_schedule 등 tool 호출
          → StructuredRequest (Week2)              — 자연어를 구조로 변환
          → SaveStructuredRequestInput (Week3)      — 저장 직전 재검증
          → AppSQLiteStore.save_structured_request() — 실제 INSERT
      → app_store.append_message("assistant", ...) — 답변도 저장
```

핵심은 **"검증"이 두 단계로 분리**되어 있다는 점이다.
1. Week2의 `StructuredRequest`: LLM이 자연어에서 뽑아낸 값을 1차로 구조화
2. Week3의 `SaveStructuredRequestInput`: 그 구조를 **저장 스키마로 다시 검증**한 뒤에만 DB에 넣음

## 1. 요청 (Request) — 자연어가 구조로 바뀌는 지점

`student_parts/week02_structure_natural_language_requests.py`

```python
class StructuredRequest(BaseModel):
    kind: RequestKind   # personal_schedule / group_schedule / todo / reminder / unknown
    title: str | None
    date: str | None
    start_time: str | None
    end_time: str | None
    members: list[str]
    priority: str | None
    reason: str | None
    original_text: str
```

- LLM이 "내일 10시 개인 코칭 저장해줘" 같은 문장을 이 필드들로 채운다.
- 이 시점까지는 **아직 저장되지 않는다.** Week2는 순수 구조화(structured output)까지만 책임진다.

## 2. 처리 (Processing) — tool의 args_schema가 저장 전 최종 관문

`student_parts/week03_build_nanas_logbook.py`

```python
class SaveStructuredRequestInput(StructuredRequest):
    kind: RequestKind = Field(default="unknown", ...)
    source_schedule_id: str | None = Field(default=None, ...)

    @model_validator(mode="before")
    @classmethod
    def unwrap_legacy_payload(cls, value):
        # 예전 trace의 payload/structured_request wrapper를 벗겨냄
        ...
```

- `SaveStructuredRequestInput`은 `StructuredRequest`를 **상속**한다 — Week2 스키마를 재정의하지 않고 그대로 이어받아 "저장용" 필드(`source_schedule_id`)만 얹는 구조.
- `@tool(args_schema=SaveStructuredRequestInput)`이 붙은 `save_structured_request(...)`는 LangChain이 LLM의 tool-call 인자를 **이 Pydantic 클래스로 자동 검증**한 뒤에야 함수 본문을 실행시킨다. 즉 "구조화된 요청"이 "저장 가능한 요청"으로 격상되는 게이트가 바로 이 args_schema다.

```python
@tool(args_schema=SaveStructuredRequestInput)
def save_structured_request(kind="unknown", title=None, date=None, ...) -> str:
    store = _store()                       # AppSQLiteStore(CONFIG.app_db_path)
    payload = {k: v for k, v in {...}.items() if v is not None}
    saved_request = store.save_structured_request(payload)   # ← 실제 저장 호출
    return json_payload(tool_result("save_structured_request", saved_request=saved_request))
```

- 함수 본문은 이미 검증이 끝난 인자를 dict로 정리해 `AppSQLiteStore`에 넘기기만 한다 — 여기서 재검증하거나 Pydantic 객체를 다시 만들지 않는 게 설계 의도다.

## 3. 결과 (Result) → 4. 저장 (Persist) — AppSQLiteStore가 실제 SQL을 담당

`fixed/app_store.py::AppSQLiteStore.save_structured_request(payload)`

이 한 메서드가 **원본 기록**과 **조회하기 쉬운 정규화 테이블**을 동시에 채운다.

| 테이블 | 역할 |
|---|---|
| `structured_requests` | LLM이 뽑은 payload 원본 그대로 (`raw_json`) — 감사 로그 |
| `schedules` | `kind`가 `personal_schedule` / `group_schedule`일 때 정규화된 일정 row |
| `todos` | `kind == "todo"`일 때 |
| `reminders` | `kind == "reminder"`일 때 |

```python
def save_structured_request(self, payload: dict[str, Any]) -> dict[str, Any]:
    request_id = new_id("req")
    ...
    with self.connect() as conn:
        conn.execute("INSERT INTO structured_requests (...) VALUES (...)")   # ① 원본 저장
        saved_rows.append({"table": "structured_requests", "id": request_id})

        if kind in {"personal_schedule", "group_schedule"}:
            conn.execute("INSERT INTO schedules (...) VALUES (...)")          # ② 정규화 저장
        elif kind == "todo":
            conn.execute("INSERT INTO todos (...) VALUES (...)")
        elif kind == "reminder":
            conn.execute("INSERT INTO reminders (...) VALUES (...)")

    if schedule_for_shared is not None:
        shared_sync = sync_personal_schedule_to_shared(schedule_for_shared)   # ③ 외부 동기화 (트랜잭션 밖)

    return {"request_id": request_id, "kind": kind, "saved_rows": saved_rows, "shared_sync": shared_sync}
```

세 가지 설계 포인트:
- **원본 + 정규화 이중 저장**: `structured_requests.raw_json`은 나중에 무엇이 왜 저장됐는지 되짚을 수 있는 감사 로그이고, `schedules`/`todos`/`reminders`는 조회·수정·삭제를 SQL로 빠르게 하기 위한 파생 테이블이다.
- **외부 동기화는 DB 트랜잭션 바깥**: 개인/그룹 일정은 다른 사람과의 일정 조율(Week5/6)을 위해 외부 공유 저장소에도 복사되는데, 이 호출이 실패해도 앱 DB 저장 자체는 되돌리지 않는다.
- **`AppSQLiteStore`는 `SQLiteFileStore`(fixed/store_base.py)를 상속** — `connect()`(row_factory 설정), `new_id()`, `now_iso()` 같은 공통 유틸을 재사용하고, 이 클래스 자체는 스키마와 SQL에만 집중한다.

## 4-1. 실제로 DB에 저장된 데이터 형태

`data/kanana_app.sqlite3`를 직접 열어 확인한 실제 row다. 예를 들어
**"내일 9시에 모각코하기 알람 맞춰줘"** 라는 요청 하나가 아래 두 테이블에 걸쳐 저장된다.

`structured_requests` (원본 감사 로그 — `raw_json`에 LLM이 뽑은 payload 전체가 그대로 남음)
```json
{
  "request_id": "req_6213ad5ced",
  "kind": "reminder",
  "title": "모각코하기",
  "date": "2026-07-16",
  "start_time": "09:00",
  "end_time": null,
  "members_json": "[]",
  "priority": null,
  "reason": null,
  "raw_json": "{\"kind\": \"reminder\", \"title\": \"모각코하기\", \"date\": \"2026-07-16\", \"start_time\": \"09:00\", \"members\": [], \"original_text\": \"내일 9시에 모각코하기 알람 맞춰줘\"}",
  "created_at": "2026-07-15T19:21:52.417102+09:00"
}
```

`reminders` (같은 request_id로 연결된 정규화 row — `kind == "reminder"`라서 이 테이블에 생김)
```json
{
  "reminder_id": "rem_96f5a9c3eb",
  "request_id": "req_6213ad5ced",
  "title": "모각코하기",
  "date": "2026-07-16",
  "start_time": "09:00",
  "reason": null,
  "created_at": "2026-07-15T19:21:52.417102+09:00"
}
```

`kind`가 다르면 정규화 테이블만 바뀐다. 예를 들어 **"내일 할 일로 음악 감상회 가기 만들어줘"**(`kind: "todo"`)는
`structured_requests`에 원본이 남고, `todos`에 `todo_id`/`due_date`로 정규화된다:
```json
{
  "todo_id": "todo_36022b8c32",
  "request_id": "req_53b560c046",
  "title": "음악 감상회 가기",
  "due_date": "2026-07-16",
  "priority": null,
  "created_at": "2026-07-15T19:19:02.888954+09:00"
}
```

그리고 개인 일정(`kind: "personal_schedule"` 또는 `group_schedule"`)은 `schedules`에 저장된다 —
`members`가 `attendees_json`이라는 이름으로 바뀌는 것과 `owner`/`source` 컬럼이 추가되는 것에 주목:
```json
{
  "schedule_id": "sch_87d93e974c",
  "request_id": "req_17cc7ffc42",
  "owner": "me",
  "title": "회의",
  "date": "2026-07-16",
  "start_time": "15:00",
  "end_time": null,
  "attendees_json": "[]",
  "source": "structured_output",
  "created_at": "2026-07-15T19:18:38.110802+09:00"
}
```

세 예시 모두 공통적으로 확인되는 패턴:
- **`request_id`가 외래키 역할**을 해서, 정규화 테이블(`schedules`/`todos`/`reminders`) row는 항상 원본(`structured_requests`) row를 가리킨다.
- **`raw_json`은 payload dict를 통째로 직렬화**한 것이라, 정규화 테이블에는 없는 필드(`original_text` 등)도 감사 목적으로 남아있다.
- `members`/`attendees` 같은 list 필드는 SQLite에 그대로 넣을 수 없어 **JSON 문자열(`members_json`/`attendees_json`)로 직렬화**되고, 조회 시 `decode_schedule_row()`가 다시 Python list로 복원한다.

## 4-2. 저장 구조 시각화 — "객체 포함"이 아니라 "외래키 참조"

`schedules`/`todos`/`reminders`는 `structured_requests` row를 **복사해서 품는 게 아니라**,
`request_id` 하나로 원본을 가리키기만 한다. 즉 한 요청에 대해 물리적으로 **두 row가 각자 다른 테이블에 나뉘어 저장**되고, 그 둘을 잇는 건 문자열 ID 하나뿐이다.

```
                          ┌───────────────────────────┐
                          │   structured_requests     │
                          │───────────────────────────│
                          │ request_id     PK         │
                          │ kind                      │
                          │ title                     │
                          │ raw_json                  │
                          │ created_at                │
                          └─────────────┬─────────────┘
                                        │ PK (request_id)
                          kind에 따라 셋 중 하나에만 FK로 참조됨
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
   kind = personal_schedule    kind = todo               kind = reminder
   / group_schedule                     │                         │
              ▼                         ▼                         ▼
   ┌───────────────────────┐  ┌───────────────────┐  ┌───────────────────────┐
   │      schedules        │  │       todos        │  │       reminders       │
   │────────────────────────│  │────────────────────│  │───────────────────────│
   │ schedule_id     PK     │  │ todo_id       PK    │  │ reminder_id     PK    │
   │ request_id      FK ────┼──┘ request_id   FK ────┼──┘ request_id     FK ────┼── (모두 structured_requests.request_id를 가리킴)
   │ owner                  │  │ title               │  │ title                 │
   │ title                  │  │ due_date            │  │ date / start_time     │
   │ attendees_json         │  │ priority            │  │ reason                │
   └───────────────────────┘  └────────────────────┘  └───────────────────────┘
```

- `structured_requests` 1 row에 대해 `schedules`/`todos`/`reminders` 중 **`kind`에 맞는 테이블에만 1 row**가 생긴다 (동시에 여러 테이블에 생기지 않음 — `if/elif` 분기이기 때문).
- 화살표 방향이 중요하다: **참조하는 쪽은 파생 테이블(schedules 등)이고, 참조당하는 쪽은 원본(structured_requests)이다.** 원본은 파생 테이블이 뭐가 있는지 전혀 모른다.

실제 데이터로 이 관계를 다시 그리면 (앞서 확인한 "회의" 일정 예시, `kind: "personal_schedule"`):

```
structured_requests                              schedules
┌─────────────────────────────────┐              ┌────────────────────────────────┐
│ request_id : req_17cc7ffc42  ◄──┼──────────────┤ request_id  : req_17cc7ffc42   │  (FK, 값만 복사)
│ kind       : "personal_schedule" │              │ schedule_id : sch_87d93e974c(PK)│
│ title      : "회의"              │              │ owner       : "me"             │
│ raw_json   : {...original_text} │              │ title       : "회의"            │
│ created_at : 19:18:38           │              │ date/start_time : 07-16 / 15:00│
└─────────────────────────────────┘              │ attendees_json : "[]"          │
        ▲ PK                                     └────────────────────────────────┘
        │                                                   │
        └── schedules.request_id 는 이 PK 값을 "가리킬 뿐" ───┘
            structured_requests row 전체를 복사해 넣지 않는다.
```

- `schedules` row에는 `structured_requests`의 `raw_json`, `priority`, `reason` 같은 필드가 **아예 존재하지 않는다** — 필요하면 `request_id`로 다시 join해서 가져와야 한다. 이게 "객체 포함"과 "외래키 참조"의 실질적 차이다.

### `structured_requests` row를 있는 그대로 통째로 뽑아보면

sqlite3로 `req_17cc7ffc42` 하나를 컬럼별로 그대로 꺼낸 결과다 (파이썬 dict 가공 없이, DB가 실제로 들고 있는 값 그대로):

```
request_id   = 'req_17cc7ffc42'
kind         = 'group_schedule'
title        = '회의'
date         = '2026-07-16'
start_time   = '15:00'
end_time     = None
members_json = '[]'
priority     = None
reason       = None
raw_json     = '{"kind": "group_schedule", "title": "회의", "date": "2026-07-16", "start_time": "15:00", "members": [], "original_text": "내일 3시에 그룹 일정으로 회의 잡아줘"}'
created_at   = '2026-07-15T19:18:38.110802+09:00'
```

여기서 `raw_json` 컬럼의 값 자체가 **JSON을 담고 있는 TEXT 문자열**이라는 걸 눈으로 확인할 수 있다 — SQLite 입장에서는 이 컬럼도 그냥 문자열 하나일 뿐이고, `{`로 시작하고 `}`로 끝나는 구조라는 걸 SQLite는 전혀 모른다. `original_text`("내일 3시에 그룹 일정으로 회의 잡아줘")처럼 **다른 컬럼에는 아예 없는 필드**가 이 문자열 안에만 남아있다는 점이 `raw_json`을 따로 두는 이유다.

같은 `request_id`로 연결된 `schedules` row도 나란히 보면:

```
schedule_id     = 'sch_87d93e974c'
request_id      = 'req_17cc7ffc42'   ← 위 structured_requests.request_id와 동일한 값 (FK)
owner           = 'me'
title           = '회의'
date            = '2026-07-16'
start_time      = '15:00'
end_time        = None
attendees_json  = '[]'
source          = 'structured_output'
created_at      = '2026-07-15T19:18:38.110802+09:00'
```

두 row를 나란히 놓고 보면 `title`/`date`/`start_time`처럼 **자주 조회되는 필드는 양쪽에 중복 저장**되어 있고(조회 성능 때문에), `original_text`/`priority`/`reason`처럼 **가끔만 필요한 필드는 `raw_json` 안에만** 있다는 게 실제 데이터로 확인된다.
- 그 대가로 조회 성능을 얻는다: `personal_list_saved_schedules`처럼 "일정만" 빠르게 훑을 때 `structured_requests`의 `raw_json` 전체를 파싱할 필요 없이 `schedules` 테이블만 스캔하면 된다.
- 반대로 감사/디버깅처럼 "이 일정이 원래 어떤 자연어 요청에서 나왔는지"를 봐야 하면 `request_id`로 `structured_requests`를 다시 찾아가야 한다 — 실제로 `AppSQLiteStore.update_schedule()`이 이 조인을 그대로 수행한다: `schedules`를 수정할 때 `WHERE request_id = ?`로 연결된 `structured_requests.raw_json`도 같이 갱신해서 두 테이블이 서로 다른 값을 보여주지 않게 한다.

## 5. 다시 꺼내기 — 저장이 끝이 아니라 "다음 대화에서도 보이는 것"이 목표

```python
@tool(args_schema=SavedScheduleListInput)
def personal_list_saved_schedules(limit=50, kind=None, date_from=None, date_to=None) -> str:
    store = _store()
    schedules = store.list_schedules(limit=limit, kind=kind or "personal_schedule", ...)
    return json_payload(tool_result("personal_list_saved_schedules", filters=..., schedules=schedules))
```

- `AppSQLiteStore.list_schedules()`가 `schedules` 테이블을 조회하고, `decode_schedule_row()`(store_base.py)가 `attendees_json` 문자열을 다시 Python list로 복원한다.
- 이 조회가 "저장 → 조회 → 새 대화에서도 유지"라는 Week3 메인과제의 검증 기준 그 자체다: 앱을 재시작해도 SQLite 파일에 남아있는 row를 그대로 다시 읽어온다.

## 한 줄 요약

> **자연어(Week2 `StructuredRequest`) → tool 인자 검증(Week3 `SaveStructuredRequestInput`, args_schema) → `AppSQLiteStore.save_structured_request()`의 SQL INSERT → `structured_requests`(원본) + `schedules`/`todos`/`reminders`(정규화) 테이블**

Week1의 "임시 메모리"와 다른 점은 딱 하나, **프로세스가 죽어도 남는 저장소(SQLite 파일)** 를 거친다는 것. 그 저장소로 가기 전에 Pydantic이 두 번(구조화 1차, 저장 스키마 2차) 데이터를 걸러준다는 것이 이번 주차에서 반복해서 등장하는 패턴이다.
