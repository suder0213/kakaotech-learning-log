**해당 학습일지는 AI를 사용해 week1 폴더의 내용들을 요약하여 작성, 검토하며 학습했음을 명시합니다.**

**모든 내용을 넣기보다는, 새로 배운 내용이나 핵심이라고 생각되는 내용만 추려서 정리했습니다.**


# 📒 Week 1 학습 요약

## Day 1 - 객체지향 프로그래밍 (OOP)

**Early Return 패턴**
- 실패 조건을 먼저 걸러내어 중첩 if문을 줄이고 핵심 로직에 집중하는 패턴

```python
# Early Return 미적용
def process(user):
    if user:
        if user.is_active:
            return do_something(user)

# Early Return 적용
def process(user):
    if not user:
        return
    if not user.is_active:
        return
    return do_something(user)
```

**OOP 핵심 개념**

| 개념 | 설명 |
|------|------|
| 캡슐화 | 데이터와 기능을 하나로 묶고, 외부 접근 제한 (`_` prefix, `@property`) |
| 상속 | 부모 클래스의 속성·메서드 재사용, `super()`로 부모 기능 호출, 오버라이딩 가능 |
| 다형성 | 같은 메서드가 클래스마다 다르게 동작 |
| 추상화 | 불필요한 세부 사항을 감추고 설계도 역할 수행 |

```python
class Animal:
    def speak(self):  # 추상화: 구체 구현은 하위 클래스에 위임
        raise NotImplementedError

class Dog(Animal):
    def __init__(self, name):
        self._name = name  # 캡슐화: 외부 직접 접근 금지

    @property
    def name(self):
        return self._name

    def speak(self):  # 오버라이딩 (다형성)
        return "Woof"

class Cat(Animal):
    def speak(self):  # 다형성: 같은 메서드, 다른 동작
        return "Meow"

animals = [Dog("Rex"), Cat()]
for a in animals:
    print(a.speak())  # Woof / Meow
```

---

## Day 2 - 비동기 프로그래밍 & 테스트

### 비동기 (asyncio)

**동기 vs 비동기**
- Python은 GIL로 인해 멀티스레딩에 한계 → `asyncio`로 단일 스레드 내 비동기 처리
- `async def`로 코루틴 선언, `await`로 제어권 양보
- `create_task`: 여러 작업을 동시 등록 / `await`: 결과가 필요한 시점에 대기

```python
import asyncio

async def fetch(name, delay):
    await asyncio.sleep(delay)  # 대기 중 제어권 양보
    return f"{name} 완료"

async def main():
    # gather: 독립적인 작업 동시 실행 (총 소요 ≈ max(delay))
    results = await asyncio.gather(
        fetch("작업A", 1),
        fetch("작업B", 2),
    )
    print(results)  # ['작업A 완료', '작업B 완료']

asyncio.run(main())
```

**동시 실행 도구**

| 도구 | 용도 |
|------|------|
| `asyncio.gather()` | 독립적인 작업들을 동시 실행, 입력 순서대로 결과 반환 |
| `asyncio.TaskGroup` | 작업 간 의존성이 높을 때, 예외 발생 시 나머지 자동 취소 |
| `asyncio.wait_for()` | 타임아웃 설정 — 실무에서 필수 (빠른 피드백, 리소스 방어) |
| `asyncio.Semaphore()` | 동시 요청 수 제한 (DB 커넥션 풀, 외부 API 호출 제어) |

```python
# wait_for: 타임아웃
result = await asyncio.wait_for(fetch("API", 5), timeout=2.0)
# → 2초 내 응답 없으면 TimeoutError 발생

# Semaphore: 동시 실행 수 제한
sem = asyncio.Semaphore(3)  # 최대 3개만 동시 통과

async def limited_fetch(url):
    async with sem:
        ...
```

**비동기 3가지 함정**
1. `await` 누락
2. `time.sleep()` 등 동기 sleep 사용 (`asyncio.sleep()` 사용해야 함)
3. 동기 라이브러리 혼용 (불가피할 경우 `loop.run_in_executor()` 사용)

---

### 테스트 (pytest)

**FIRST 원칙**: Fast / Independent / Repeatable / Self-validating / Timely

**AAA 구조**: Arrange → Act → Assert

**핵심 도구**

| 도구 | 역할 |
|------|------|
| `pytest.raises()` | 의도한 예외 발생 검증 |
| `@pytest.fixture` | 테스트 사전 준비 (DB 연결, 객체 생성 등) 한 번만 정의 |
| `@pytest.mark.parametrize` | 하나의 테스트에 여러 입력값·기대값 세트 주입 |
| `unittest.mock.patch` | 외부 의존성(HTTP, DB)을 가짜 객체로 대체해 순수 로직만 검증 |
| `pytest --cov` | 테스트 커버리지 측정 |

```python
import pytest
from unittest.mock import patch

# fixture: 공통 준비 객체 재사용
@pytest.fixture
def user():
    return {"id": 1, "name": "Alice"}

# parametrize: 케이스 추가를 튜플 한 줄로
@pytest.mark.parametrize("a, b, expected", [
    (1, 2, 3),
    (0, 0, 0),
    (-1, 1, 0),
])
def test_add(a, b, expected):
    assert a + b == expected

# raises: 의도한 예외 검증
def test_divide_by_zero():
    with pytest.raises(ZeroDivisionError):
        1 / 0

# mock.patch: 외부 HTTP 호출을 가짜로 대체
def test_get_temperature():
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = {"temperature": 24}
        result = get_temperature("Seoul")
        assert result == 24
```

---

## Day 3 - 네트워크 & HTTP

### 네트워크 기초

- **IP 주소**: 패킷의 출발지·목적지 식별 (IPv4 43억 개 한계 → IPv6 전환 중)
- **DNS**: 도메인 이름 ↔ IP 주소 변환
- **Port**: 같은 IP 내 여러 서비스 구분 (0~1023: well-known 포트)

**TCP vs UDP**

| | TCP | UDP |
|--|-----|-----|
| 연결 방식 | 연결 지향 (3-way handshake) | 비연결형 |
| 신뢰성 | 높음 (순서 보장, 재전송) | 낮음 |
| 속도 | 느림 | 빠름 |
| 용도 | 파일 전송, HTTP | 스트리밍, 게임 |

### HTTP & REST API

**HTTP 핵심 특징**
- **무상태성**: 서버가 클라이언트 상태 미보존 → 확장성 용이
- **비연결성**: 요청·응답 후 연결 종료 → 자원 최적화

**HTTP 메서드 & CRUD 매핑**

| CRUD | HTTP 메서드 | 특징 |
|------|------------|------|
| Create | POST | 요청 본문에 데이터 포함 |
| Read | GET | 요청 본문 없음 |
| Update | PUT / PATCH | PUT: 전체 대체 / PATCH: 일부 변경 |
| Delete | DELETE | 리소스 삭제 |

**REST API 설계 원칙**
1. 리소스명은 **명사**, 행위는 HTTP 메서드로 표현
2. 소문자 사용, 계층은 `/`로 구분, 끝에 `/` 미사용
3. 언더바(`_`) 대신 하이픈(`-`) 사용

```
# 잘못된 설계
GET  /getUsers
POST /createUser
GET  /user_orders/

# 올바른 설계
GET    /users
POST   /users
GET    /users/{id}/orders
DELETE /users/{id}
```

---

## Day 4 - FastAPI & Pydantic

**FastAPI**: 비동기 기반 고성능 Python 웹 프레임워크, `/docs`에서 Swagger UI 자동 생성

**Pydantic BaseModel**
- Python 타입 힌트로 요청 데이터 자동 검증 및 타입 변환
- `Field()`로 세부 조건(길이, 범위 등) 지정
- 요청 스키마와 응답 스키마를 분리하여 보안성 강화
- 공통 BaseModel을 상속해 중복 코드 방지 가능

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

app = FastAPI()

# 공통 기반 → 요청/응답 스키마 분리
class UserBase(BaseModel):
    username: str = Field(min_length=2, max_length=20)
    email: str

class UserCreate(UserBase):
    password: str  # 요청에만 포함

class UserResponse(UserBase):
    id: int        # 응답에만 포함 (password 노출 방지)

@app.post("/users", response_model=UserResponse)
async def create_user(body: UserCreate):
    # body.username, body.email 자동 검증 완료
    if already_exists(body.email):
        raise HTTPException(status_code=409, detail="이미 존재하는 이메일")
    return save_user(body)
```

**주요 HTTP 예외**

| 코드 | 의미 |
|------|------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |

---

## Day 5 - 데이터베이스

### DB 기초

- **RDB**: 테이블 구조, 스키마 고정, 무결성 보장 → 구조가 일관적인 데이터에 적합
- **NoSQL**: 스키마 유연, 대용량·고속 처리에 유리

### 제약 조건 & 키

| 제약 조건 | 역할 |
|----------|------|
| NOT NULL | 널 값 비허용 |
| UNIQUE | 중복 값 비허용 |
| DEFAULT | 기본값 지정 |
| CHECK | 허용 값 범위 제한 |
| PRIMARY KEY | 튜플 고유 식별, NULL·중복 불가 |
| FOREIGN KEY | 다른 테이블 기본키 참조, 테이블 간 관계 정의 |

```sql
CREATE TABLE users (
    id      INT           PRIMARY KEY,
    email   VARCHAR(100)  NOT NULL UNIQUE,
    age     INT           CHECK (age >= 0),
    role    VARCHAR(20)   DEFAULT 'user'
);

CREATE TABLE orders (
    id      INT PRIMARY KEY,
    user_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)  -- 참조 무결성
);
```

**무결성 제약 조건**
- **개체 무결성**: 기본키는 NULL·중복 불가
- **참조 무결성**: 외래키는 NULL이거나 참조 테이블의 기본키 값과 동일해야 함

### 데이터 모델링

1. **개념적 설계**: 현실 세계를 개체(명사)·속성·관계(동사)로 추상화 → ERD 작성
2. **논리적 설계**: DBMS가 처리할 수 있는 스키마로 변환
3. **물리적 설계**: 실제 DB에 저장 구조 설계

**ERD 표기법**: Peter Chen 표기법(도형), IE 표기법(까마귀발) 두 가지가 널리 사용됨
