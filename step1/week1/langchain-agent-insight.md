# LangChain과 Agent에 대한 관찰

---

## 1. LangChain은 마법이 아니다

LangChain을 처음 보면 복잡한 프레임워크처럼 느껴지지만, 핵심 동작은 단순하다.

> **LLM API를 호출할 때, tool 정의를 정리해서 함께 붙여 보내주는 도구일 뿐이다.**

LLM 자체가 tool을 "실행"하는 것이 아니다.  
LLM은 어떤 tool을 어떤 인자로 써야 할지 **JSON으로 답변**할 뿐이고,  
LangChain(혹은 Agent 프레임워크)이 그 JSON을 파싱해서 실제 Python 함수를 호출한다.

---

### 실제로 LLM에게 전달되는 것

아래는 `일정 생성` tool을 등록했을 때, LLM API에 실제로 전달되는 요청 구조다.

```json
{
  "model": "claude-sonnet-4-6",
  "system": "당신은 일정 관리 비서 나나입니다. 사용자의 요청을 분석하고 적절한 도구를 사용하세요.",
  "messages": [
    {
      "role": "user",
      "content": "내일 오후 3시에 팀 회의 일정 추가해줘"
    }
  ],
  "tools": [
    {
      "name": "create_schedule",
      "description": "새로운 일정을 생성합니다. 날짜, 시간, 제목이 필요합니다.",
      "input_schema": {
        "type": "object",
        "properties": {
          "title":    { "type": "string", "description": "일정 제목" },
          "date":     { "type": "string", "description": "날짜 (YYYY-MM-DD)" },
          "time":     { "type": "string", "description": "시간 (HH:MM)" }
        },
        "required": ["title", "date", "time"]
      }
    },
    {
      "name": "get_schedule",
      "description": "특정 날짜의 일정을 조회합니다.",
      "input_schema": {
        "type": "object",
        "properties": {
          "date": { "type": "string", "description": "조회할 날짜 (YYYY-MM-DD)" }
        },
        "required": ["date"]
      }
    }
  ]
}
```

LLM은 이 요청을 받고 tool을 써야 한다고 판단하면 아래처럼 답변한다.

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "tool_abc123",
      "name": "create_schedule",
      "input": {
        "title": "팀 회의",
        "date": "2026-07-07",
        "time": "15:00"
      }
    }
  ]
}
```

LangChain(Agent)은 이 JSON을 파싱해서 실제 `create_schedule("팀 회의", "2026-07-07", "15:00")` 함수를 실행하고, 그 결과를 다시 LLM에 보내 최종 답변을 만든다.

```
사용자 입력
    ↓
[LangChain] tool 정의 + 프롬프트 조합 → LLM 호출
    ↓
LLM: "create_schedule 써야겠다" → JSON 반환
    ↓
[LangChain] JSON 파싱 → 실제 Python 함수 실행
    ↓
실행 결과를 다시 LLM에 전달
    ↓
LLM: 최종 자연어 답변 생성
```

**LangChain이 하는 일은 이게 전부다.**  
tool description을 잘 써야 하는 이유도 여기서 나온다 — LLM이 description을 읽고 tool을 선택하기 때문에, 설명이 모호하면 엉뚱한 tool을 고른다.

---

## 2. Agent는 사실 Tool의 다른 형태다

Multi-Agent 구조를 처음 보면 Agent와 Tool이 다른 것처럼 보인다.  
하지만 구조적으로 보면 **Agent는 LLM을 내부에 품은 Tool**일 뿐이다.

> **차이는 LLM 호출 여부.**  
> - 함수만 실행하면 → Tool  
> - 내부에서 LLM을 다시 호출하면 → Agent

---

### Orchestrator가 sub-Agent를 부르는 흐름

```
사용자: "다음 주 팀 회의 일정 잡아줘"
         ↓
[Orchestrator Agent]
  - 등록된 tool 목록을 LLM에 전달
  - tool 목록: [nana_agent, kana_agent]  ← sub-Agent들이 tool로 등록됨
  - LLM 판단: "개인 일정이 필요하니 nana_agent 써야겠다"
         ↓
[nana_agent 호출]  ← Orchestrator 입장에서는 그냥 tool 호출
  - nana_agent 내부에서 다시 LLM 호출
  - nana_agent의 tool 목록: [create_schedule, get_schedule, delete_schedule]
  - LLM 판단: "get_schedule로 현재 일정 조회 → 빈 시간 찾기"
         ↓
[get_schedule 실행]  ← 실제 Python 함수, LLM 호출 없음
  - 결과를 nana_agent의 LLM에 반환
         ↓
nana_agent가 결과를 Orchestrator에 반환
         ↓
Orchestrator가 최종 답변 생성
```

이 구조에서 핵심은:
- **Orchestrator는 sub-Agent가 내부에서 뭘 하는지 모른다.** 그냥 결과만 받는다.
- **sub-Agent도 Orchestrator에게는 그냥 tool이다.** 호출 인터페이스가 동일하다.
- **tool이 많아질수록 문제가 생기는 이유**: 모든 tool 정의가 LLM 프롬프트에 붙어서 전달되므로, 토큰 소비가 늘고 선택 정확도가 떨어진다. Multi-Agent로 tool을 분산시키는 이유가 여기 있다.

---

### 실제 코드에서는 어떻게 선언되나

#### 일반 Tool — 그냥 Python 함수

```python
from langchain_core.tools import tool

@tool
def get_schedule(date: str) -> str:
    """특정 날짜의 일정을 조회합니다. date는 YYYY-MM-DD 형식."""
    # 실제 DB 조회 로직
    return f"{date}의 일정: 팀 회의 15:00"

@tool
def create_schedule(title: str, date: str, time: str) -> str:
    """새로운 일정을 생성합니다."""
    # 실제 DB 저장 로직
    return f"일정 생성 완료: {title} ({date} {time})"
```

`@tool` 데코레이터가 하는 일: 함수의 **이름**, **docstring**, **타입 힌트**를 읽어서
LLM에 전달할 tool 정의 JSON을 자동으로 만들어준다.
docstring이 곧 LLM이 읽는 description이므로 명확하게 써야 한다.

---

#### sub-Agent — 내부에서 LLM을 다시 호출하는 Tool

```python
from langchain_core.tools import tool
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-6")

# nana가 가진 도구들
nana_tools = [get_schedule, create_schedule]

# nana_agent 자체를 tool로 선언
@tool
def nana_agent(query: str) -> str:
    """개인 일정 관련 요청을 처리하는 에이전트. 일정 생성/조회/삭제를 담당."""

    # 내부에서 LLM을 다시 호출 — 이게 일반 tool과의 유일한 차이
    llm_with_tools = llm.bind_tools(nana_tools)

    messages = [{"role": "user", "content": query}]
    response = llm_with_tools.invoke(messages)

    # tool_call이 있으면 실행하고 결과 반환
    # (실제로는 루프를 돌며 tool_call이 없을 때까지 반복)
    return response.content
```

Orchestrator 입장에서는 `nana_agent`도 그냥 `@tool`로 선언된 함수다.
내부에서 LLM을 또 호출하는지 여부를 Orchestrator는 알지 못한다.

---

#### Orchestrator — sub-Agent들을 tool로 등록

```python
@tool
def kana_agent(query: str) -> str:
    """팀 대화 기록 관련 요청을 처리하는 에이전트. 이전 대화 검색/참석자 추출을 담당."""
    # kana 내부 로직 ...
    return "..."


# Orchestrator는 sub-Agent들을 tool로 받아 동일하게 등록
orchestrator_tools = [nana_agent, kana_agent]  # 일반 tool과 선언 방식 동일

orchestrator_llm = llm.bind_tools(orchestrator_tools)

def run(user_input: str):
    messages = [{"role": "user", "content": user_input}]
    response = orchestrator_llm.invoke(messages)
    # response에 tool_call이 있으면 nana_agent 또는 kana_agent 실행
    ...
```

---

#### 한 눈에 비교

```python
# Tool: LLM 없음, 함수만 실행
@tool
def get_schedule(date: str) -> str:
    return db.query(date)          # DB 조회하고 끝

# Agent: 내부에서 LLM 호출
@tool
def nana_agent(query: str) -> str:
    return llm.invoke(query)       # LLM을 다시 부름
```

선언 방법(`@tool`)은 완전히 동일하다.
LLM을 내부에서 부르느냐 마느냐가 Tool과 Agent의 유일한 차이다.

---

### 정리

| | Tool | Agent |
|---|---|---|
| LLM 호출 | ❌ | ✅ |
| 선언 방식 | `@tool` | `@tool` (동일) |
| Orchestrator 입장 | 그냥 함수 | 그냥 함수 |

Agent를 "특별한 것"으로 보지 말고, **LLM을 내부 엔진으로 쓰는 tool**로 보면 전체 구조가 단순해진다.
