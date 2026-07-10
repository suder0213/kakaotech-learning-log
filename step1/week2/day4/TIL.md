# Week 2 Day 4 — Pydantic 파싱 흐름 & 실제 교환 데이터 분석

---

## 1. JSON → Pydantic 파싱은 어디서 일어나는가?

결론부터: **`langchain/agents/factory.py`의 `handle_model_output` 함수** 안에서 일어난다.

### 경로 추적

```
build_week02_agent()
  └── create_agent(response_format=StructuredRequestBatch)  # week02, line 226~231
        └── factory.py line 878
              AutoStrategy(schema=StructuredRequestBatch)로 감쌈
        └── factory.py line 1121  ← 실제 파싱 위치
              structured_response = structured_tool_binding.parse(tool_call["args"])
```

### 핵심 코드 (factory.py:1117~1138)

```python
# factory.py line 1117~1138
tool_call = structured_tool_calls[0]
try:
    structured_tool_binding = structured_output_tools[tool_call["name"]]
    structured_response = structured_tool_binding.parse(tool_call["args"])
    #                                               ↑
    #              LLM이 반환한 JSON args를 Pydantic 모델로 파싱하는 지점
    return {
        "messages": [...],
        "structured_response": structured_response,  # ← StructuredRequestBatch 객체
    }
```

### 왜 tool_call 형태로 오는가?

`response_format=StructuredRequestBatch`를 넘기면 LangChain은 `StructuredRequestBatch`를
**특별한 hidden tool로 등록**한다. LLM 입장에서는 그냥 tool을 하나 더 호출하는 것처럼 보인다.

```
일반 tool       → personal_create_schedule, personal_list_schedules, ...
structured tool → StructuredRequestBatch  (LangChain이 자동으로 등록)
```

LLM이 최종 답변을 낼 때 `StructuredRequestBatch` tool을 호출하는 JSON을 반환하고,
LangChain이 그 `args`를 `parse()`로 Pydantic 객체로 변환하는 구조다.

---

## 2. 실제로 LLM에 전달되는 전체 JSON 구조

사용자가 `"다음 주 화요일 오후 3시에 철수랑 회의 잡아줘"` 라고 입력했을 때,
LLM API에 전달되는 첫 번째 요청의 실제 구조다.

```json
{
  "model": "gpt-4o-...",
  "messages": [
    {
      "role": "system",
      "content": "아래 system prompt는 주차별로 누적된 안내다. 같은 주제의 지시가 여러 번 나오면 더 높은 주차 또는 더 뒤에 있는 지시를 우선한다.\n\n[CHAT_MEMORY_PROMPT]\n너는 스케쥴 관리 Agent 나나이다...\n\n[WEEK1]\n일정 관련 요청이 들어오면 반드시 아래의 tool을 호출한다...\n\n[WEEK2]\n너는 사용자의 자연어 요청을 StructuredRequestBatch로 구조화하는 역할을 수행하는 Week2 agent다...\n\n[WEEK2 최종 답변 규칙]\n최종 답변은 반드시 StructuredRequestBatch 단일 JSON 객체 하나만 출력한다..."
    },
    {
      "role": "user",
      "content": "다음 주 화요일 오후 3시에 철수랑 회의 잡아줘"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "personal_create_schedule",
        "description": "Nana의 개인 일정을 현재 대화의 임시 메모리에 생성합니다.",
        "parameters": {
          "type": "object",
          "properties": {
            "title":      { "type": "string" },
            "date":       { "type": "string" },
            "start_time": { "type": "string" },
            "end_time":   { "type": "string", "default": "미정" },
            "attendees":  { "type": "array", "items": { "type": "string" } }
          },
          "required": ["title", "date", "start_time"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "personal_list_schedules",
        "description": "선택한 시작일과 종료일 범위에 포함되는 Nana의 개인 일정을 조회합니다.",
        "parameters": {
          "type": "object",
          "properties": {
            "date_from": { "type": "string" },
            "date_to":   { "type": "string" }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "personal_delete_schedule",
        "description": "일정 ID에 해당하는 개인 일정을 삭제합니다.",
        "parameters": {
          "type": "object",
          "properties": {
            "schedule_id": { "type": "string" }
          },
          "required": ["schedule_id"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "StructuredRequestBatch",
        "description": "여러 자연어 의도를 StructuredRequest 목록으로 나누는 2차 과제 스키마입니다.",
        "parameters": {
          "type": "object",
          "properties": {
            "requests": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "kind":          { "type": "string", "description": "요청의 종류 (personal_schedule 등)" },
                  "title":         { "type": "string" },
                  "date":          { "type": "string", "description": "YYYY-MM-DD" },
                  "start_time":    { "type": "string", "description": "HH:MM" },
                  "end_time":      { "type": "string" },
                  "members":       { "type": "array", "items": { "type": "string" } },
                  "priority":      { "type": "string" },
                  "reason":        { "type": "string" },
                  "original_text": { "type": "string" }
                }
              }
            },
            "base_date": { "type": "string", "description": "상대 날짜 해석 기준일 YYYY-MM-DD" }
          }
        }
      }
    }
  ]
}
```

> **포인트:** `StructuredRequestBatch`가 일반 tool과 동일한 형태로 `tools` 배열에 들어간다.  
> LLM은 이걸 "최종 답변을 낼 때 호출해야 하는 tool"로 인식한다.

---

## 3. 유저 입력부터 StructuredRequestBatch까지 전체 흐름

### 입력: `"다음 주 화요일 오후 3시에 철수랑 회의 잡아줘"`

---

### Step 1 — LLM 첫 번째 호출

**전달 데이터:** System Prompt + User Message + tools 4개 (위 JSON 구조)

**LLM 응답 (tool_call):**
```json
{
  "role": "assistant",
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "personal_create_schedule",
      "arguments": "{\"title\": \"철수와 회의\", \"date\": \"2026-07-14\", \"start_time\": \"15:00\", \"end_time\": \"미정\", \"attendees\": [\"철수\"]}"
    }
  }]
}
```

---

### Step 2 — LangChain이 실제 Python 함수 실행

`personal_create_schedule` 함수 호출 → `PERSONAL_SCHEDULES`에 append

**tool 실행 결과 (week01_wake_up_nana.py:194~206):**
```json
{
  "ok": true,
  "tool_name": "personal_create_schedule",
  "created_schedule": {
    "id": "personal_a3f9b21c44",
    "title": "철수와 회의",
    "date": "2026-07-14",
    "start_time": "15:00",
    "end_time": "미정",
    "attendees": ["철수"],
    "created_at": "2026-07-09T15:23:01.123456+09:00",
    "session_id": "default"
  }
}
```

---

### Step 3 — LLM 두 번째 호출

tool 결과를 messages에 추가해서 다시 LLM 호출

**전달 데이터:**
```json
{
  "messages": [
    { "role": "system",    "content": "..." },
    { "role": "user",      "content": "다음 주 화요일 오후 3시에 철수랑 회의 잡아줘" },
    { "role": "assistant", "tool_calls": [{ "name": "personal_create_schedule", ... }] },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "{\"ok\": true, \"tool_name\": \"personal_create_schedule\", \"created_schedule\": {...}}"
    }
  ],
  "tools": [ ... 동일한 4개 ... ]
}
```

**LLM 응답 — 이번엔 `StructuredRequestBatch` tool을 호출:**
```json
{
  "role": "assistant",
  "tool_calls": [{
    "id": "call_xyz789",
    "type": "function",
    "function": {
      "name": "StructuredRequestBatch",
      "arguments": "{\"requests\": [{\"kind\": \"personal_schedule\", \"title\": \"철수와 회의\", \"date\": \"2026-07-14\", \"start_time\": \"15:00\", \"end_time\": \"미정\", \"members\": [\"철수\"], \"original_text\": \"다음 주 화요일 오후 3시에 철수랑 회의 잡아줘\"}], \"base_date\": \"2026-07-09\"}"
    }
  }]
}
```

---

### Step 4 — factory.py가 JSON → Pydantic 파싱

`StructuredRequestBatch` tool_call 감지 → `factory.py:1121`에서 파싱

```python
# factory.py:1121
structured_response = structured_tool_binding.parse(tool_call["args"])
# tool_call["args"] = {"requests": [...], "base_date": "2026-07-09"}
# → StructuredRequestBatch(**args) 와 동일하게 Pydantic 객체 생성
```

**최종 반환 객체:**
```python
StructuredRequestBatch(
    requests=[
        StructuredRequest(
            kind="personal_schedule",
            title="철수와 회의",
            date="2026-07-14",
            start_time="15:00",
            end_time="미정",
            members=["철수"],
            priority=None,
            reason=None,
            original_text="다음 주 화요일 오후 3시에 철수랑 회의 잡아줘"
        )
    ],
    base_date="2026-07-09"
)
```

---

### 전체 흐름 요약

```
유저 입력
"다음 주 화요일 오후 3시에 철수랑 회의 잡아줘"
    ↓
[LangChain] System Prompt + User Message + tools 4개를 LLM에 전달
    ↓
[LLM] personal_create_schedule tool 선택 → tool_call JSON 반환
    ↓
[LangChain] 실제 Python 함수 실행 → created_schedule JSON 반환
    ↓
[LangChain] 결과를 messages에 추가해서 LLM 재호출
    ↓
[LLM] created_schedule을 읽고 StructuredRequestBatch tool 호출
    ↓
[LangChain factory.py:1121] tool_call["args"] → Pydantic 파싱
    ↓
structured_response: StructuredRequestBatch 객체 반환
```

---

## 핵심 포인트 3가지

1. **파싱 위치:** `langchain/agents/factory.py:1121` — `structured_tool_binding.parse(tool_call["args"])`

2. **StructuredRequestBatch는 hidden tool:** `create_agent(response_format=StructuredRequestBatch)`를 넘기는 순간 LangChain이 이를 tool로 등록한다. LLM 입장에서는 tool을 하나 더 받은 것

3. **LLM은 두 번 호출된다:**
   - 1회차: 일반 tool(`personal_create_schedule`) 선택
   - 2회차: tool 결과를 보고 `StructuredRequestBatch` tool 호출로 최종 구조화
