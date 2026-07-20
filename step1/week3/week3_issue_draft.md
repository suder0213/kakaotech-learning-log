[1단계] Week03 <구조화 데이터 영속화(SQLite)와 프롬프트/스키마 설명의 "죽는 지점" 정리>

## 🗓 이번 주 개요
- 주차: Week 03 (7/13~7/17)
- 키워드: #SQLite #StructuredOutput #ArgsSchema #Harness

## 📚 이번 주 학습한 것

## 1. "휘발" 되던 대화 결과를 SQLite로 영속화하기

- Week1~2에서는 대화가 끝나면 사라지던 결과(임시 메모리)를, Week3에서는 Pydantic으로 두 번 검증한 뒤 SQLite에 실제로 저장하도록 구현함
- 흐름을 코드 레벨로 추적해보니 검증이 **두 단계**로 나뉘어 있다는 게 핵심이었음

```
사용자 입력
  → StructuredRequest (Week2)        — 자연어를 1차 구조화
  → SaveStructuredRequestInput (Week3) — 저장 직전 스키마로 재검증
  → AppSQLiteStore.save_structured_request() — 실제 INSERT
```

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

- `StructuredRequest`를 재정의하지 않고 **상속**해서 저장용 필드만 얹는 구조라, Week2 스키마와 Week3 스키마가 따로 놀지 않고 이어짐
- DB는 `structured_requests`(원본 payload 그대로, 감사 로그)와 `schedules`/`todos`/`reminders`(kind별 정규화 테이블)로 나뉘고, 두 쪽은 **`request_id` 외래키 참조**로만 연결됨 (row를 복사해서 품는 게 아님)

```
structured_requests (PK: request_id)
        ▲ FK로 값만 복사해서 참조
        │
kind에 따라 셋 중 하나에만 생성
  ┌────────────┬──────────┬───────────┐
  schedules      todos      reminders
```

- 실제 sqlite 파일을 열어 row를 직접 확인해보니, `title`/`date`/`start_time`처럼 자주 조회되는 필드는 양쪽에 중복 저장되고, `original_text`/`priority`/`reason`처럼 가끔만 필요한 필드는 `raw_json` 안에만 있는 걸 확인함 → 조회 성능과 감사 목적을 분리해서 얻는 트레이드오프라고 이해
- Week1/2에서 정한 프롬프트 규칙(예: "수정 = 삭제 후 재생성", "personal_schedule은 week01 tool 사용")이 Week3의 새 tool과 충돌하는 지점이 있었는데, "더 높은 주차 우선"이라는 일반 규칙만 믿지 않고 **충돌 당사자 섹션에 직접 override 문구를 명시**해야 실제로 안전하다는 걸 리뷰 중 깨달음 (예: `[삭제]` 섹션에 override가 빠져서, Week1 tool로 지워도 SQLite 원본은 안 지워지고 재부팅 후 되살아날 수 있는 위험을 발견)

## 2. tool description이 실제로 LLM에게 "살아있는지" 전수 조사

- `@tool(args_schema=...)` 데코레이터를 쓸 때 설명을 어디에 적어도 다 전달되는 줄 알았는데, 실제로는 우선순위 규칙이 있었음
- 규칙: **함수 docstring이 있으면 args_schema 클래스 docstring은 완전히 무시됨** (병합 안 됨), 파라미터별 설명은 `Field(description=...)`을 명시했을 때만 전달됨
- Week3에 노출된 tool 10개를 전부 확인한 결과, **args_schema 클래스 docstring 6개가 전부 죽어있었음** — 습관적으로 클래스에도 docstring을 달아둔 게 처음부터 불필요했던 것
- 부모 클래스에서 상속받은 필드는 설명이 살아있지만, **자식 클래스가 필드를 재선언하면 부모의 설명이 통째로 사라짐**도 직접 코드로 재현해서 확인함

```python
class Parent(BaseModel):
    kind: Literal["a","b"] = Field(default="a", description="매우 길고 자세한 설명")
class Child(Parent):
    kind: Literal["a","b"] = Field(default="a", description="짧은 설명")
# Child.model_json_schema()["properties"]["kind"]["description"] == "짧은 설명"
# 부모의 긴 설명은 완전히 사라짐
```

- 실제로 `SaveStructuredRequestInput.kind`가 이 케이스였음 — `StructuredRequest`에 있던 4줄짜리 분류 기준 설명이 재선언하면서 "분류된 요청 종류" 한 줄로 축약되어 사라짐. 지금은 시스템 프롬프트에 분류 기준이 텍스트로 누적되어 있어서 문제가 안 드러났지만, 이 tool이 프롬프트 없이 단독 호출되는 경로가 생기면 바로 드러날 지점이라고 판단함
- 이걸 고치는 게 나을지(Field description 전면 작성) 고민했는데, description이 늘어나면 컨텍스트가 소모되는 트레이드오프가 있어서, 지금처럼 "잘 작동하는 상태"에서 그 비용을 감수할 가치가 있는지는 아직 결론을 못 냄 → 다음 주로 판단 이월

## 3. Harness/Agent 생태계 및 모델 구조 복습

- VS Code 확장에서 CLI로 개발 환경을 전환함 — Claude Code의 핵심 기능(스킬/서브에이전트/훅/워크플로우)은 CLI가 기준이고 확장은 그 위 UI에 가깝다는 걸 실제로 써보며 체감
- `/schedule`(Routine)과 `/loop`의 차이를 학습: `/schedule`은 클라우드에서 도는 완전히 별도의 자동화(컴퓨터가 꺼져 있어도 실행), 승인 프롬프트 없이 자동 실행되므로 권한 범위 설정이 중요하다는 점이 핵심
- Transformer 구조를 다시 정리함: Attention으로 특징을 추출하고 MLP로 패턴을 학습한다는 관점에서 CNN과의 유사점을 이해했고, temperature/top-K가 다음 token 샘플링에 미치는 영향을 재확인
- 지난주 애매하게 남았던 Harness 개념도 이번 주 다시 정리: "Agent를 제어하기 위한 방법론"이며 결국 Prompt로 제어된다는 관점, LLM 모델 선정 자체도 Harness의 일부로 볼 수 있다는 시각을 새로 얻음

## 내가 이해한 것
- Week2/3에서 쌓아온 프롬프트 누적 구조는, 주차가 늘어날수록 "이전 주차 규칙과 충돌하는 부분을 어디에 명시할지"가 관리 포인트가 된다
- args_schema는 입력 검증 게이트일 뿐 아니라, description이 실제로 LLM에게 전달되는지 여부까지 좌우하는 지점이라 tool 하나 만들 때마다 "이 설명이 죽어있지 않은지" 확인이 필요하다
- 구조화(Week2) → 저장(Week3)이 분리되어 있는 이유는 "저장 직전에 다시 한 번 걸러야 할 필요"가 있기 때문이고, 이게 이번 주 SQLite 영속화 흐름 전체를 관통하는 설계 의도라고 이해함

---

## 🔁 이번 주 회고 (KPT)
- Keep 유지하고 싶은 습관: 코드를 그냥 넘기지 않고 실제 sqlite row/trace를 직접 열어 확인하면서 "동작은 하지만 조용히 잘못된" 부분을 찾아낸 것
- Problem 아쉬웠던 점: description 트레이드오프처럼 결론을 못 내린 채 다음 주로 넘긴 판단이 있었음
- Try 다음 주에 시도할 것: todo/reminder 조회·수정·삭제 공백처럼 이번 주에 찾아만 두고 못 고친 부분을 우선순위대로 실제로 반영해보기
