# Week 2 Day 1 — Prompt Engineering 심화

---

## 1. Prompt Engineering 기법들

### Zero-shot vs Few-shot

먼저 용어 정리가 필요하다. 이 두 단어는 딥러닝에서 먼저 나왔고, LLM 시대에 의미가 확장됐다.

| | 딥러닝 원래 의미 | LLM에서의 의미 |
|---|---|---|
| **Zero-shot** | 학습 데이터에 없던 클래스도 추론 | 예시 없이 바로 질문 |
| **Few-shot** | 극소수 예시로 일반화하는 학습 방식 | 프롬프트 안에 예시를 넣어 형식 유도 |

> ⚠️ Few-shot ≠ Fine-tuning  
> Fine-tuning은 모델 가중치를 업데이트하는 "훈련"이고,  
> Few-shot prompting은 프롬프트 안에 예시를 넣는 것 — 모델 가중치는 건드리지 않는다.

---

#### Zero-shot

예시 없이 LLM이 알아서 추론하게 한다.

```python
prompt = """
다음 리뷰의 감정을 긍정 / 부정 중 하나로 분류해줘.

리뷰: "배송이 너무 느리고 포장도 엉망이었어요."
"""
# LLM이 학습된 지식만으로 판단 → "부정"
```

언제 쓰나: 태스크가 단순하거나, LLM이 이미 충분히 학습된 영역일 때

---

#### Few-shot

원하는 입출력 패턴을 예시로 먼저 보여주고, 마지막에 실제 질문을 던진다.

```python
prompt = """
다음 리뷰의 감정을 긍정 / 부정 중 하나로 분류해줘.

리뷰: "화질이 정말 선명하고 색감도 좋아요."
감정: 긍정

리뷰: "A/S 센터가 너무 불친절했습니다."
감정: 부정

리뷰: "디자인은 예쁜데 배터리가 너무 빨리 닳아요."
감정:
"""
# LLM이 패턴을 파악하고 → "부정"
```

언제 쓰나: 출력 형식이 특정해야 할 때, zero-shot으로 원하는 포맷이 안 나올 때

---

#### Instruction

어떤 역할로, 어떤 방식으로 답하라고 명시적으로 지시한다.  
주로 System Prompt에 들어가며, 모델의 전반적인 행동 방식을 정의한다.

```python
system_prompt = """
당신은 10년 경력의 시니어 파이썬 개발자입니다.
- 코드 설명은 항상 핵심만 3줄 이내로
- 예시 코드는 반드시 포함
- 초보자도 이해할 수 있는 언어로 설명
"""
```

언제 쓰나: 모델의 페르소나, 답변 형식, 금지 사항을 고정해야 할 때

---

#### CoT (Chain of Thought)

복잡한 문제를 단계별로 생각하게 유도한다.  
LLM이 "중간 추론 과정"을 출력하면 최종 답변의 정확도가 높아진다.

```python
# CoT 없이 (zero-shot)
prompt = "철수는 사과 5개를 갖고 있었는데 영희에게 2개를 주고, 민수에게 1개를 받았다. 지금 몇 개?"
# LLM이 바로 답 → 틀릴 가능성 있음

# CoT 적용
prompt = """
철수는 사과 5개를 갖고 있었는데 영희에게 2개를 주고, 민수에게 1개를 받았다. 지금 몇 개?

단계별로 생각해줘:
1. 처음 사과 수
2. 영희에게 준 후
3. 민수에게 받은 후
"""
# LLM이 과정을 출력하며 추론 → 정확도 향상
```

`"단계별로 생각해줘"` 또는 `"Let's think step by step"` 한 마디만 붙여도 효과가 있다.

---

#### Agent에서의 활용

| 기법 | Agent에서 어디에 쓰나 |
|------|----------------------|
| Zero-shot | 간단한 분류, 간단한 tool 선택 |
| Few-shot | tool description에 예시 입력/출력을 넣어 선택 정확도 향상 |
| Instruction | System Prompt에서 Agent 역할과 행동 규칙 정의 |
| CoT | 복잡한 다단계 작업, 여러 tool을 순서대로 써야 할 때 |

```python
# tool description에 few-shot 넣기
@tool
def get_schedule(date: str) -> str:
    """
    특정 날짜의 일정을 조회합니다.

    예시:
    - 입력: "2026-07-07" → 출력: "15:00 팀 회의, 17:00 코드 리뷰"
    - 입력: "2026-07-08" → 출력: "일정 없음"

    date는 반드시 YYYY-MM-DD 형식으로 전달하세요.
    """
    ...
```

---

## 2. Prompt 계층 구조

LLM API에 실제로 전달되는 프롬프트는 한 덩어리가 아니라 **4개의 계층**으로 구성된다.

```
┌─────────────────────────────────┐
│          LLM Prompt             │  ← LLM이 실제로 받는 전체 맥락
│  ┌───────────────────────────┐  │
│  │      System Prompt        │  │  ← 개발자가 고정으로 설정
│  ├───────────────────────────┤  │
│  │   System Prompt (user)    │  │  ← 사용자/세션별 커스터마이징
│  ├───────────────────────────┤  │
│  │      User Prompt          │  │  ← 사용자의 실제 입력
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

| 계층 | 작성 주체 | 역할 | 변경 가능 여부 |
|------|----------|------|---------------|
| **LLM Prompt** | (자동 조합) | 위 3개를 합친 최종 전달물 | — |
| **System Prompt** | 개발자 | Agent 역할, 행동 규칙, 금지 사항 정의 | ❌ 고정 |
| **System Prompt (user)** | 사용자 또는 세션 | 사용자 맞춤 설정 (이름, 선호 등) | ✅ 가변 |
| **User Prompt** | 사용자 | 실제 요청 | ✅ 매 턴 변경 |

---

### 실제 API 호출 코드

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

llm = ChatAnthropic(model="claude-sonnet-4-6")

# ── System Prompt (개발자가 고정) ──────────────────────────
system_prompt = """
당신은 일정 관리 비서 나나입니다.
- 항상 친절하고 간결하게 답변하세요.
- 일정 관련 요청만 처리하고, 그 외 요청은 정중히 거절하세요.
"""

# ── System Prompt (user) — 세션마다 달라지는 부분 ──────────
user_context = """
[사용자 정보]
이름: 박성규
시간대: Asia/Seoul
선호 언어: 한국어
"""

# ── User Prompt — 사용자의 실제 입력 ──────────────────────
user_input = "내일 오후 3시에 팀 회의 잡아줘"

# ── LLM Prompt — 위 3개를 합쳐서 전달 ─────────────────────
messages = [
    SystemMessage(content=system_prompt + "\n" + user_context),
    HumanMessage(content=user_input),
]

response = llm.invoke(messages)
```

System Prompt와 System Prompt(user)는 보통 하나의 `system` 파라미터에 합쳐서 전달되고,  
어떤 부분을 고정으로, 어떤 부분을 가변으로 관리하느냐가 설계의 핵심이다.

---

## 3. Language Model의 2가지 종류

### Query Model

질문 하나에 답변 하나. **이전 대화를 기억하지 않는다.**

```
사용자: "파이썬에서 리스트 정렬하는 법?"
LLM:   "sorted() 또는 list.sort()를 쓰세요."

사용자: "그럼 역순은?" ← "그럼"이 뭘 가리키는지 모름
LLM:   "무엇을 역순으로 하시겠어요?" ← 맥락 없음
```

```python
# Query Model 방식 — 매번 독립된 호출
def query(user_input: str) -> str:
    response = llm.invoke([HumanMessage(content=user_input)])
    return response.content
```

---

### Chatbot Model

이전 대화를 누적해서 다음 요청에 함께 전달한다.  
**매 턴마다 context window가 늘어난다.**

```
사용자: "파이썬에서 리스트 정렬하는 법?"
LLM:   "sorted() 또는 list.sort()를 쓰세요."

사용자: "그럼 역순은?"
→ LLM에 전달되는 것:
   [이전] 사용자: "파이썬에서 리스트 정렬하는 법?"
   [이전] LLM:   "sorted() 또는 list.sort()를 쓰세요."
   [현재] 사용자: "그럼 역순은?"
LLM:   "reverse=True를 쓰면 됩니다: sorted(lst, reverse=True)"
```

```python
# Chatbot Model 방식 — 대화 히스토리를 누적
history = []

def chat(user_input: str) -> str:
    history.append(HumanMessage(content=user_input))
    response = llm.invoke(history)           # 전체 히스토리 전달
    history.append(response)                 # 응답도 누적
    return response.content
```

---

### 비교

| | Query Model | Chatbot Model |
|---|---|---|
| 맥락 유지 | ❌ | ✅ |
| 매 턴 토큰 소비 | 적음 (현재 입력만) | 늘어남 (누적) |
| 사용 예시 | 단순 검색, 번역 | 대화형 비서, Agent |
| Context 한계 도달 | 늦음 | 빠름 |

---

### Agent는 Chatbot Model이지만 관리가 필요하다

Agent는 도구 실행 결과까지 히스토리에 쌓이기 때문에 context가 빠르게 차오른다.  
context가 가득 찰수록 **Lost in the Middle** 현상이 발생한다 — 중간에 있는 정보를 LLM이 잘 참조하지 못하는 현상.

```
[히스토리가 길어질수록]

[앞부분] ← LLM이 잘 참조함
[중간부분] ← 잘 못 참조함 (Lost in the Middle)
[뒷부분] ← LLM이 잘 참조함
```

**대응 방법:**
- 작업 단위를 작게 나눠 새 대화로 시작
- 요약(Summarization)으로 히스토리 압축
- 오래된 메시지 삭제 (Sliding Window)
