# Week 2 Day 2 — MCP 서버 예습

---

## 1. MCP란?

**MCP (Model Context Protocol)** 는 Anthropic이 2024년 공개한 표준 프로토콜이다.  
LLM이 외부 도구나 데이터 소스에 접근하는 방식을 **표준화**한 것.

### 등장 배경

MCP 이전에는 각 AI 앱이 외부 도구를 각자 다른 방식으로 연결했다.

```
기존 방식 — 앱마다 직접 연결
┌─────────┐     ┌──────────┐
│  앱 A   │────▶│  DB      │  (앱 A만의 방식)
└─────────┘     └──────────┘
┌─────────┐     ┌──────────┐
│  앱 B   │────▶│  DB      │  (앱 B만의 방식)
└─────────┘     └──────────┘
```

```
MCP 방식 — 표준 프로토콜로 연결
┌─────────┐     ┌──────────────┐     ┌──────────┐
│  앱 A   │────▶│  MCP Server  │────▶│  DB      │
└─────────┘     └──────────────┘     └──────────┘
┌─────────┐           ↑
│  앱 B   │───────────┘  (같은 MCP 서버를 공유)
└─────────┘
```

---

## 2. MCP vs 일반 Tool의 차이

일반 `@tool`과 MCP tool은 **LLM 입장에서는 동일하게 보인다.**  
차이는 어디서 실행되느냐다.

| | 일반 Tool | MCP Tool |
|---|---|---|
| 실행 위치 | 앱 코드 안 (같은 프로세스) | 별도 서버 (다른 프로세스/머신) |
| 접근 방식 | 함수 직접 호출 | HTTP / stdio 통신 |
| 공유 가능 | ❌ 한 앱에서만 | ✅ 여러 앱/에이전트가 공유 |
| 추가 세팅 | `@tool` 데코레이터만 | MCP 서버 별도 실행 필요 |

```python
# 일반 tool — 같은 프로세스 안에서 실행
@tool
def get_schedule(date: str) -> str:
    return db.query(date)  # 내 DB에 직접 접근

# MCP tool — 외부 서버에 요청
@tool
def get_shared_schedule(member: str, date: str) -> str:
    return call_mcp_server("get_shared_schedule", {"member": member, "date": date})
    # 외부 MCP 서버가 처리하고 결과를 돌려줌
```

---

## 3. MCP 구조

MCP는 **서버 / 클라이언트** 구조로 동작한다.

```
┌──────────────────────────────────────────────┐
│                  Agent                        │
│                                              │
│   LLM ──▶ tool 선택 ──▶ MCP Client          │
│                              │               │
└──────────────────────────────┼───────────────┘
                               │ (표준 프로토콜)
                               ▼
                    ┌──────────────────┐
                    │   MCP Server     │
                    │                  │
                    │  - tool 목록 제공 │
                    │  - tool 실행     │
                    │  - 결과 반환     │
                    └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   실제 데이터 소스   │
                    │  (DB, API, 파일 등) │
                    └─────────────────────┘
```

### MCP 서버가 제공하는 것

```python
# MCP 서버는 이런 tool 목록을 외부에 노출한다
tools = [
    {
        "name": "create_shared_schedule",
        "description": "팀원 공유 일정을 생성합니다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "member_name": {"type": "string"},
                "title":       {"type": "string"},
                "date":        {"type": "string"},
                "start_time":  {"type": "string"},
                "end_time":    {"type": "string"},
            }
        }
    },
    {
        "name": "get_shared_schedule",
        "description": "특정 팀원의 공유 일정을 조회합니다.",
        ...
    }
]
```

---

## 4. KanaMate에서 MCP가 쓰이는 위치

KanaMate는 두 종류의 데이터 저장소를 운영한다.

```
┌──────────────────────────────────────────────────┐
│                  KanaMate                         │
│                                                  │
│  ┌──────────┐          ┌──────────┐             │
│  │   나나    │          │   카나   │             │
│  │(개인 비서)│          │(대화 검색)│             │
│  └────┬─────┘          └────┬─────┘             │
│       │                     │                   │
│  [개인 SQLite]          [MCP Client]             │
│   내 일정만 저장              │                   │
└──────────────────────────────┼───────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     MCP Server       │
                    │   공유 일정 저장소    │
                    │  (팀원 A, B, C 일정) │
                    └─────────────────────┘
```

### 5주차: 카나의 MCP 활용

카나는 MCP 서버를 통해 **팀원들의 이전 대화와 일정**을 불러온다.

```python
# 카나가 MCP를 통해 팀원 일정 조회
@tool
def search_member_conversations(member: str, query: str) -> str:
    """팀원의 이전 대화 기록을 검색합니다."""
    return call_mcp_server("search_conversations", {
        "member_name": member,
        "query": query
    })
```

### 6주차: 개인 일정 → 공유 저장소 동기화

나나가 내 개인 일정을 저장할 때, MCP 공유 저장소에도 복사본을 만든다.  
이렇게 해야 카나메이트가 팀원들의 busy time을 비교해 최적 회의 시간을 찾을 수 있다.

```python
# 내 일정 저장 시 자동으로 공유 저장소에도 반영
def save_my_schedule(schedule):
    # 1. 내 개인 SQLite에 저장
    app_db.insert(schedule)

    # 2. MCP 공유 저장소에도 동기화
    call_mcp_server("create_shared_schedule", {
        "member_name": "나",
        "title":      schedule["title"],
        "date":       schedule["date"],
        "start_time": schedule["start_time"],
        "source_conversation_id": f"app:{schedule['request_id']}"
        # ↑ 나중에 삭제할 때 내 일정과 연결하기 위한 키
    })
```

실제 프로젝트 코드(`external_mcp.py`)에서 `source_conversation_id`로  
앱 DB의 `request_id`와 공유 저장소의 복사본을 연결해두는 이유가 여기 있다.  
일정을 삭제할 때 양쪽을 같이 지워야 하기 때문.

---

## 5. 전체 흐름 요약

```
[사용자] "다음 주 팀 회의 잡아줘"
         ↓
[Supervisor] → 카나에게 팀원 일정 조회 요청
         ↓
[카나] MCP Client → MCP Server → 팀원 A, B, C busy time 조회
         ↓
[Supervisor] → 나나에게 내 일정 조회 요청
         ↓
[나나] 개인 SQLite → 내 빈 시간 조회
         ↓
[Supervisor] 양쪽 결과 비교 → 겹치지 않는 시간 탐색
         ↓
[사용자] "화요일 오후 2시가 모두 가능합니다"
```

---

## 6. DB와 MCP 서버의 차이

MCP 서버를 처음 보면 "그냥 DB 직접 연결하면 되지 않나?" 라는 의문이 든다.

```
DB          →  데이터만 저장
MCP 서버    →  DB + 그 DB를 다루는 함수(tool)를 외부에 노출
```

비유하면 DB가 **창고**라면, MCP 서버는 **창고 + 창구 직원**이다.  
창고에 직접 들어가는 게 아니라 직원에게 요청하면 직원이 꺼내다 주는 구조.

```python
# DB만 있을 때 → 접근하려면 DB 파일 경로, SQL 문법을 알아야 함
conn = sqlite3.connect("external.db")
rows = conn.execute("SELECT * FROM conversations WHERE ...").fetchall()

# MCP 서버가 있을 때 → 함수 이름만 알면 됨
result = call_mcp_server("search_previous_conversations", {"query": "회의"})
```

**DB 직접 연결 vs MCP 서버 비교**

| | DB 직접 연결 | MCP 서버 |
|---|---|---|
| 접근하려면 | DB 파일 경로 + SQL 필요 | 함수 이름만 알면 됨 |
| Agent 입장 | SQL을 프롬프트로 생성해야 함 | 함수 단위로 소통 |
| 외부 공개 | DB 구조 전체 노출 | 허용된 함수만 노출 |
| 재사용 | 앱마다 SQL 따로 작성 | 여러 앱이 같은 서버 공유 |

KanaMate에서 MCP 서버를 쓰는 이유도 여기 있다.  
Agent가 팀원 데이터에 접근할 때 SQL을 직접 짜는 게 아니라,  
`search_previous_conversations`, `list_shared_schedules` 같은 **의미 있는 함수 단위**로 소통하게 하기 위함이다.

---

## 핵심 요약

- MCP는 LLM이 외부 도구에 접근하는 **표준 프로토콜** — 소켓처럼 연결 방식을 통일한 것
- 일반 tool과 원리는 같지만, **별도 서버에서 실행되어 여러 앱이 공유**할 수 있다
- **DB는 데이터만, MCP 서버는 DB + 접근 함수를 외부에 노출한 것**
- Agent는 SQL 대신 함수 이름으로 소통하므로 DB 구조를 몰라도 됨
- KanaMate에서는 개인 SQLite(나나)와 팀 공유 저장소(MCP) 두 계층으로 데이터를 분리한다
