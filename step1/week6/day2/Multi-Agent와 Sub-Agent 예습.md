# Multi-Agent / Sub-Agent 예습

Week6 주제(Multi-Agent, Sub-Agent) 학습 전에 개념을 미리 정리해둔다.

## 1. 왜 Single Agent만으로는 부족한가

하나의 Agent에 tool을 계속 늘리는 방식(단일 Agent + 모든 tool)은 규모가 커질수록 문제가 생김:

- **tool 오선택 확률 증가**: tool이 많아질수록 LLM이 상황에 맞는 tool을 고르는 정확도가 떨어짐. tool 간 description이 비슷하거나 애매하면 더 심해짐.
- **context 오염**: 관련 없는 tool 결과, 중간 추론 과정이 계속 쌓여서 하나의 context 안에 뒤섞임 → 이전 작업의 잔재가 이후 판단에 영향을 줌.
- **context 낭비**: 당장 필요 없는 tool의 이름/설명/스키마까지 매번 prompt에 다 포함됨 ([[week5_mcp]] 노트의 "필요한 것만 사용" 원칙과 동일한 문제).

→ 이걸 해결하려는 접근이 **Multi-Agent**. 그리고 **Sub-Agent는 별개의 개념이 아니라, Multi-Agent를 구현하는 구조(topology) 중 하나**임에 주의.

## 2. Multi-Agent = 큰 범주(umbrella term)

**정의**: Agent를 하나가 아니라 여러 개 써서 시스템을 구성한다는 큰 범주. 그 안에 구조가 여러 가지 있음:

### 2-1. Peer 구조 (동등한 관계) — Pipeline / Parallel

- 여러 Agent가 **대등한 위치**에서 각자 역할을 맡고, 워크플로우 내내 그 역할을 유지함.
- **Pipeline(순차)**: Agent A의 출력 → Agent B의 입력으로 순서대로 흐름 (예: 검색 Agent → 요약 Agent → 응답 Agent).
- **Parallel(병렬)**: 여러 Agent가 동시에 서로 다른 작업을 수행하고 결과를 나중에 합침(fan-out/fan-in).
- **핵심 문제점**: Agent끼리 **context를 공유하지 않음** → A가 알아낸 정보를 B가 그대로 알 수 없어서, 결과를 텍스트/데이터로 명시적으로 전달(handoff)해야 함.

### 2-2. Hierarchical 구조 (위계 관계) — 이게 바로 Sub-Agent

**정의**: Main Agent가 특정 작업을 **Sub Agent에게 호출/위임(delegate)**하는 구조. Multi-Agent의 한 종류일 뿐, Multi-Agent와 대등하게 비교할 대상이 아님 (비유: "차량 vs 자동차"에서 자동차가 차량의 한 종류인 것과 같음).

- Sub Agent는 Main Agent와 **독립된 별도의 context**에서 실행되고, 작업 하나가 끝나면 **소멸(ephemeral)**함 — peer 구조의 Agent들처럼 워크플로우 내내 지속되는 역할이 아님.
- Sub Agent 내부에서 tool을 몇 번 부르든, 중간 추론 과정이 얼마나 길든, 그 세부 내용은 Main Agent의 context에 쌓이지 않음.
- Main Agent는 Sub Agent의 **최종 결과만** 돌려받음 → Main Agent의 context를 절약.
- **주의**: "과정은 버리고 결과만 남긴다"는 게 "결과를 신경 안 쓴다"는 뜻이 아님. 오히려 결과는 Main이 다음 판단에 반드시 쓰는 핵심 정보고, 버리는 건 그 결과를 만들어낸 과정(tool 호출 횟수, 중간 시행착오)뿐.
- 이번 프로젝트에서 쓰고 있는 `Agent` 툴(Explore, general-purpose 등 subagent_type 지정)이 바로 이 패턴의 실제 예시.

### 2-3. Peer 구조 vs Hierarchical(Sub-Agent) 구조 비교

이게 실제로 비교해야 할 두 축임 ("Multi-Agent vs Sub-Agent"가 아니라):

| | Peer 구조 (pipeline/parallel) | Hierarchical 구조 (Sub-Agent) |
|---|---|---|
| 관계 | 대등, 각자 고정된 역할을 계속 유지 | 상하, Main이 필요할 때마다 호출 |
| 지속성 | Agent들이 워크플로우 내내 존재 | Sub Agent는 작업 하나 끝나면 소멸 |
| 통제 | 흐름을 따라 결과가 전달되며 진행 | Main이 언제 누굴 부를지 전적으로 결정 |
| 목적 | 역할별로 나눠서 각 Agent를 단순하게 유지 | 특정 잡일을 통째로 떼서 Main의 context를 지킴 |
| context 공유 | 명시적 handoff 필요 (Agent 간) | Sub Agent 결과만 Main에 요약되어 리턴 (호출 관계) |

## 4. 언제 무엇을 쓰는가 (판단 기준)

- tool 수가 적고 역할이 단순 → **Single Agent**로 충분.
- 역할이 명확히 나뉘고 서로 결과만 주고받으면 되는 워크플로우 → **Peer 구조(pipeline/parallel)**.
- 특정 하위 작업이 방대한 탐색/중간 결과를 만들어내서 Main Agent의 context를 오염시킬 위험이 큼 (예: 코드베이스 전체 탐색, 긴 문서 요약) → **Hierarchical 구조(Sub-Agent)로 위임**해서 최종 결과만 받기.

## 5. 트레이드오프로 남는 것

- **Latency/Cost**: Agent를 나눌수록 LLM 호출 횟수가 늘어남 → 응답 속도/비용 증가.
- **조율 복잡도**: Agent 간 handoff 로직, 실패 시 재시도/에러 전파 로직을 별도로 설계해야 함.
- **신뢰도 vs 위임 범위**: [[week5_mcp]] 노트 마지막 줄처럼, LLM에 대한 신뢰도가 올라갈수록 점점 더 많은 판단을 Agent(특히 Sub-Agent)에게 위임하는 방향으로 흐르는 추세.

## 6. 예습 중 생긴 질문 (수업 때 확인할 것)

- Multi-Agent 간 handoff 시 데이터 포맷은 보통 어떻게 표준화하는지 (자유 텍스트 vs 구조화된 스키마)?
- Sub-Agent가 실패했을 때 Main Agent가 이를 감지하고 복구하는 일반적인 패턴은?
- Multi-Agent와 Sub-Agent를 같이 섞어 쓰는 실제 사례(계층이 여러 단이 되는 경우)가 흔한지?
