# Week 2 Day 5 — AI 에이전트 핵심 용어 정리

---

## 1. AI Agent

LLM을 "두뇌"로 삼아 목표가 달성될 때까지 **스스로 판단하고 행동을 반복**하는 시스템.

단순한 LLM 호출(질문→답변)과 다른 점은 **루프**다.

```
목표 입력
  ↓
[LLM] 다음 행동 결정
  ↓
Tool 실행 (검색, 파일 읽기, 코드 실행 ...)
  ↓
결과를 context에 추가
  ↓
목표 달성? ──Yes──→ 종료
     │
     No
     ↓
 다시 [LLM]으로
```

이 루프를 **Agentic Loop**라고 부른다.

---

## 2. 핵심 용어 4개 — 한눈에 비교

혼동하기 쉬운 이유: 모두 "에이전트가 뭔가를 할 수 있게 해주는 것"처럼 들린다.  
차이를 잡는 핵심 질문은 두 가지다.

> **"누가 정의하는가?"** vs **"누가 실행하는가?"**

| 용어 | 한 줄 정의 | 정의 주체 | 실행 주체 |
|---|---|---|---|
| **Harness** | 에이전트를 실행하는 런타임 환경 전체 | 플랫폼 | 플랫폼 |
| **Skills** | 사용자가 `/명령어`로 부르는 재사용 워크플로우 | 사용자/팀 | Harness |
| **MCP Server** | Tool을 외부에서 제공하는 표준화된 서버 | 외부 개발자 | Harness |
| **Tools** | LLM이 직접 호출하는 개별 함수 | 개발자/MCP | LLM |

---

## 3. 각 용어 상세

### Harness

에이전트 전체를 **감싸고 돌리는 실행 인프라**.

Claude Code는 인터페이스 형태가 여러 개지만 모두 **같은 Harness**다:
- Claude Code CLI
- Claude Code VSCode/JetBrains Extension
- Claude Code 데스크탑 앱

Harness가 담당하는 것:

```
Harness가 하는 일
  ├── 실행     — Agentic Loop를 돌린다 (핵심)
  ├── 연결     — LLM, Tools, MCP Server를 이어준다
  ├── 관리     — Context, 대화 히스토리를 유지한다
  ├── 제어     — 권한 검사, CLAUDE.md 지침 주입
  └── 자동화   — Hooks, Skills를 실행한다
```

```
┌─────────────────── Harness ────────────────────┐
│                                                 │
│   사용자 입력 → [LLM] → Tool 실행 → [LLM] → … │
│                                                 │
│   Skills도 여기서 실행됨                        │
│   MCP Server 연결도 여기서 관리됨              │
└─────────────────────────────────────────────────┘
```

> 비유: OS(운영체제). 앱 실행, 권한 제어, 하드웨어 연결을 모두 담당하는 것처럼,  
> Harness도 LLM 실행·제어·연결을 모두 담당한다.  
> OS의 역할을 "권한 제어"로만 설명하면 좁듯, Harness도 마찬가지다.

#### Harness 커스터마이징

Harness 자체를 뜯어고치는 게 아니라, **설정 파일로 동작 방식을 조정**하는 것을 말한다.  
"Harness Engineering"이라는 확립된 용어는 없고, 작업 종류에 따라 다르게 불린다:

| 하는 일 | 실제로 부르는 용어 |
|---|---|
| CLAUDE.md로 LLM 행동 정의 | Agent Configuration, Prompt Engineering |
| Hooks로 이벤트 자동화 | Harness Customization |
| Skills 만들기 | Skill Authoring |
| MCP Server 연결 | MCP Integration |
| 위 전체를 아우르는 말 | **Agent Infrastructure**, Agentic Workflow Design |

---

### Skills

사용자(또는 팀)가 **미리 정의해둔 재사용 가능한 워크플로우**.  
`/skill-name` 형태의 슬래시 커맨드로 호출된다.

```
사용자: /review
  → Harness가 review skill 로드
  → skill에 정의된 프롬프트/로직을 Claude에 전달
  → Claude가 PR 리뷰 수행
```

Skills의 특징:
- LLM이 자율적으로 선택하는 게 아니라 **사용자가 명시적으로 호출**
- 반복되는 작업을 하나의 커맨드로 캡슐화
- 프롬프트 템플릿, 설정값, 실행 순서 등을 포함할 수 있음

Claude Code에 내장된 Skills 예시:

| 커맨드 | 하는 일 |
|---|---|
| `/review` | 현재 브랜치의 PR을 리뷰 |
| `/init` | 프로젝트를 분석해서 CLAUDE.md 초안 생성 |
| `/security-review` | 변경된 코드의 보안 취약점 검사 |
| `/simplify` | 변경된 코드를 리뷰하고 불필요한 복잡도 제거 |

> 비유: 요리 레시피. 재료(Tools)를 어떤 순서로, 어떻게 쓸지 미리 정해둔 절차.

---

### MCP Server

**MCP(Model Context Protocol)** 는 Anthropic이 제안한 표준 프로토콜.  
MCP Server는 이 프로토콜을 따르는 서버로, **Tool들을 외부에서 제공**한다.

```
Harness ←──MCP 프로토콜──→ MCP Server
                              ├── tool: search_web
                              ├── tool: read_notion_page
                              └── tool: query_database
```

MCP Server가 필요한 이유:
- 누구나 Tool을 표준화된 방식으로 만들어 제공할 수 있음
- Harness는 어떤 MCP Server인지 몰라도 연결 가능 (표준 규격이므로)
- 기업/개인이 자신의 시스템을 MCP Server로 만들면 AI 에이전트가 바로 연동 가능

> 비유: 전원 콘센트 규격. 110V든 220V든 규격만 맞으면 어떤 플러그든 꽂을 수 있듯,  
> MCP 규격만 맞으면 어떤 서버든 에이전트에 연결 가능.

---

### Tools

**LLM이 직접 호출하는 개별 함수**.  
에이전트가 "생각"만 하지 않고 실제로 뭔가를 **할 수 있게** 해주는 가장 작은 단위.

```python
# Tool의 실제 형태 (LLM API 관점)
{
  "name": "read_file",
  "description": "파일을 읽어 내용을 반환한다",
  "parameters": {
    "file_path": { "type": "string" }
  }
}
```

LLM은 이 스펙을 보고 "언제 어떤 Tool을 호출할지" 스스로 결정한다.  
Tool의 실제 실행은 Harness가 담당한다.

Tool의 출처는 다양하다:
- Harness에 내장된 Tool (Read, Edit, Bash 등)
- MCP Server가 제공하는 Tool
- 개발자가 직접 등록한 Tool

> 비유: 공구. 망치, 드라이버, 줄자 — 각각 하나의 명확한 기능을 가진 도구.

---

## 4. 전체 관계도

```
사용자
  │
  ├─ "/review" 입력 (Skills 호출)
  │
  ▼
┌──────────────────────────────── Harness ────────────────────────────────┐
│                                                                          │
│  Skills 로드 → 프롬프트 구성 → [LLM] 호출                              │
│                                    │                                     │
│                           Tool 호출 결정                                 │
│                                    │                                     │
│              ┌─────────────────────┼──────────────────────┐             │
│              │                     │                      │             │
│         내장 Tool            내장 Tool           MCP Server Tool         │
│         (Read)               (Bash)              (search_web)           │
│                                                       │                 │
│                                               MCP Server                │
│                                          (외부 서버, 표준 프로토콜)      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 혼동 포인트 정리

**"Tools와 MCP Server의 차이"**  
→ Tools는 함수 하나. MCP Server는 그 함수들을 묶어서 제공하는 서버.  
→ 하나의 MCP Server가 여러 Tool을 노출한다.

**"Skills와 Tools의 차이"**  
→ Skills는 **사람**이 `/명령어`로 호출하는 고수준 워크플로우.  
→ Tools는 **LLM**이 추론 중에 자율적으로 호출하는 저수준 함수.

**"Harness와 나머지의 차이"**  
→ Harness는 **실행 환경** 그 자체. Skills, MCP Server, Tools는 모두 Harness 위에서 동작하는 **구성 요소**.  
→ Harness가 없으면 나머지는 그냥 정의일 뿐, 아무것도 실행되지 않는다.
