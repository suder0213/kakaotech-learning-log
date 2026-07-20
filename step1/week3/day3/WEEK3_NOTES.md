# Week3 (`student_parts/week03_build_nanas_logbook.py`) 구현 정리

## 1. 구현 현황

### 메인과제
| 함수 | 상태 | 비고 |
|---|---|---|
| `save_structured_request` (tool) | ✅ | 인자를 dict로 모으고 None 제외 후 SQLite 저장 |
| `list_saved_requests` (tool) | ✅ | kind/date_from/date_to 필터 조회 |
| `get_saved_request` (tool) | ✅ | request_id 단건 조회, 없으면 row=None |
| `personal_list_saved_schedules` (tool) | ✅ | kind 기본값 personal_schedule, filters+schedules 반환 |

### 추가과제
| 함수 | 상태 | 비고 |
|---|---|---|
| `SaveStructuredRequestInput.unwrap_legacy_payload` | ✅ | payload/structured_request wrapper 정규화 |
| `_save_input_from` | ✅ | str/dict/StructuredRequest/SaveStructuredRequestInput 전부 처리 |
| `save_structured_request_payload` | ✅ | 검증 → 저장 → tool 결과 반환 |
| `_delete_saved_schedules` | ✅ | 삭제 조건 guard + delete_all/필터 분기 |
| `structured_request_from_week01_schedule` | ✅ | Week1 schedule dict → SaveStructuredRequestInput 변환 |
| `personal_create_schedule` (Week1 호환 tool) | ✅ | Week1 tool 호출 → SQLite 이중 저장 |
| `delete_saved_schedules_dict` | ✅ | store 미지정 시 기본 store로 fallback |
| `personal_update_saved_schedule` (tool) | ✅ | 필드 수정 + shared_sync 반환, ID 없으면 ok=False |
| `personal_delete_saved_schedules` (tool) | ✅ | `_delete_saved_schedules` 위임 호출 |
| `build_week03_agent()` | ✅ | `create_agent(model, tools, system_prompt)` |

### 프롬프트
| 항목 | 상태 | 비고 |
|---|---|---|
| `SQLITE_MEMORY_PROMPT` | ✅ | 영속성 차이 명시, personal_list_saved_schedules 강제 |
| `WEEK03_TOOL_CALL_PROMPT` | ✅ | 저장/조회/수정/삭제 단계별 호출 순서 명시 |
| `week03_prompt_parts()` | ✅ | week02_prompt_parts() 누적 + WEEK03_PROMPT + 두 프롬프트 |

---

## 2. 프롬프트 구조

### 합산 순서 (join_system_prompt 기준)
```
CHAT_MEMORY_PROMPT         (agent 정체성, base_date, "높은 주차 우선" 규칙)
WEEK01_PROMPT              (create/list/delete tool, 수정=삭제+생성 규칙)
WEEK02_PROMPT              (kind 분류, "personal_schedule은 week01 tool 사용")
WEEK03_PROMPT              (intro: "아래 지시를 따른다")
SQLITE_MEMORY_PROMPT       (영속성 차이, 조회는 personal_list_saved_schedules)
WEEK03_TOOL_CALL_PROMPT    (저장/조회/수정/삭제 단계별 순서)
```

### WEEK03_TOOL_CALL_PROMPT 설계 원칙
- Week 1 `personal_list_schedules`(세션 범위)를 [조회]에서 명시적으로 override
- Week 1 "수정 = 삭제+생성" 방식을 [수정]에서 명시적으로 override
- 충돌을 "더 높은 주차 우선" 규칙에만 맡기지 않고 해당 섹션에 직접 명시

---

## 3. 트러블슈팅 / 개념 정리

### 3.1 `json.dumps` vs `json.dump` — 이름 한 글자 차이가 완전히 다른 함수
- `json.dumps(obj)` → 파이썬 객체를 **JSON 문자열**로 변환. tool 반환값처럼 "문자열이 필요할 때" 사용.
- `json.dump(obj, fp)` → 객체를 JSON으로 직렬화해서 **파일 객체(fp)에 바로 씀**. `fp`가 필수 인자라, `json.dump(saved_request)`처럼 하나만 넘기면 `TypeError: dump() missing 1 required positional argument: 'fp'`.
- 반대 방향: `json.loads(str)` (문자열 → 객체) / `json.load(fp)` (파일 → 객체).

### 3.2 JSON과 dict는 다른 층위의 개념
- **JSON은 텍스트 포맷**(직렬화된 문자열), **dict는 파이썬 메모리 상의 자료구조**.
- `ensure_ascii=False`를 안 주면 한글이 `\uXXXX` 유니코드 이스케이프로 출력된다. 기능은 동일하지만 Gradio trace 같은 화면에서 읽기 어려움. 그래서 `json_payload()` 헬퍼가 `ensure_ascii=False`를 고정으로 박아둔 것.

### 3.3 LangChain `@tool`로 감싼 함수는 더 이상 "그냥 함수"가 아니다
- `@tool` 데코레이터가 붙으면 원래 함수는 `StructuredTool` 인스턴스로 바뀐다. **직접 `func(a, b)` 호출 불가** (`TypeError: 'StructuredTool' object is not callable`).
- 실행하려면 `.invoke({"a": 1, "b": 2})` — 딕셔너리 하나를 위치 인자로 넘겨야 한다. 키워드 인자 펼치기(`.invoke(a=1, b=2)`)는 안 된다.
- 원본 함수 로직에 접근하고 싶으면 `.func` 속성으로 우회 가능.

### 3.4 `@tool(args_schema=SomeModel)`가 실제로 하는 일
- LLM이 tool을 호출할 때 넘긴 인자를 `SomeModel`로 **검증만** 한다.
- 검증 후 모델 인스턴스를 그대로 넘기는 게 아니라 **필드를 개별 키워드 인자로 풀어서** 함수 시그니처에 매칭시켜 호출한다.
- 그래서 tool 함수 본문에서는 `SomeModel` 인스턴스가 아니라 이미 검증된 개별 값만 다루게 된다.

### 3.5 pydantic `model_validate` — 부모 클래스 인스턴스를 자식 클래스에 못 넣는 문제
```python
class A(BaseModel):
    x: int = 1
class B(A):
    y: int = 2

B.model_validate(A(x=5))
# → ValidationError: Input should be a valid dictionary or instance of B
```
- pydantic v2는 dict이거나 **정확히 그 클래스(또는 서브클래스)의 인스턴스**만 `model_validate`가 받아준다.
- 해결책:
  1. `.model_dump()`로 dict화한 뒤 넘기기 (채택한 방법, `_save_input_from`에 반영)
  2. 자식 클래스에 `model_config = ConfigDict(from_attributes=True)` 추가

### 3.6 `payload.get(key, default)`는 "키가 없을 때만" 기본값을 준다
- `{"kind": None}.get("kind", "unknown")` → `None`. 키는 있으므로 기본값을 쓰지 않는다.
- None인 필드는 **키 자체를 제거**해야 store 쪽 기본값 로직이 의도대로 동작한다:
```python
payload = {k: v for k, v in payload.items() if v is not None}
```

### 3.7 `*` 단독 파라미터 — keyword-only 구분자
```python
def f(a, *, b=None): ...
f(1, b=2)   # OK
f(1, 2)     # TypeError
```
- `*args`/`**kwargs`와 달리 값을 모으지 않고, "여기서부터는 키워드 전용"이라는 표시만 한다.

### 3.8 dict 리터럴은 `키: 값`이지 `키 = 값`이 아니다
```python
{"limit" = limit}   # SyntaxError — import 시점에 파일 전체가 죽는다
{"limit": limit}    # 올바른 문법
```

### 3.9 `X | None`은 타입 힌트 문법이지, 값에 붙이면 비트 OR 연산자
```python
row: dict | None          # 타입 힌트 — 정상
row = store.get(...) | None   # 런타임 값 — TypeError
```

### 3.10 `and`/`or` 조건에서 항목 하나를 빼먹으면 조용히 막힌다
```python
if not(schedule_ids or date or title or start_time or time_unspecified):  # delete_all 빠짐
    ...  # delete_all=True로만 호출해도 여기서 걸려서 삭제 분기에 도달 못 함
```
- 예외가 안 나고 `deleted_count=0`으로 조용히 성공 응답을 주기 때문에 실행해서 값을 확인하지 않으면 놓치기 쉽다.

### 3.11 필터 조회에서 "적용된 값" vs "원본 파라미터" 구분
- `kind=None`이어도 실제 쿼리에는 `kind or "personal_schedule"`이 적용된다.
- trace/디버깅용 응답에는 가능하면 실제로 적용된 값을 넣는 게 좋다.

### 3.12 프롬프트 충돌 — "더 높은 주차 우선"만으로는 부족한 경우
- Week 1 PROMPT: "수정 = 조회 후 삭제 + 새 생성", "personal_schedule은 personal_list_schedules로 조회"
- Week 2 PROMPT: "personal_schedule 요청은 반드시 week01 tool 사용"
- 이 두 규칙이 Week 3의 `personal_update_saved_schedule`, `personal_list_saved_schedules`와 충돌한다.
- `join_system_prompt`의 "더 뒤에 있는 지시 우선" header로 어느 정도 해결되지만, **충돌 당사자 섹션에 직접 "Week 1/2 방식 대신 이걸 써라"를 명시**하는 게 안전하다.

---

## 4. 남은 작업
1. `extract_schedule_request` / `extract_structured_request` (`week02_structure_natural_language_requests.py`) — 스텁 상태. **week02 "1회차" 가이드에 명세 없음** → 2회차 가이드 배포 후 구현 필요.
2. `./run.sh --week3`로 실제 자연어 입력 → trace에서 tool 호출 순서 확인.
