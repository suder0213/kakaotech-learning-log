**해당 학습일지는 AI를 사용해 week2 폴더의 내용들을 요약하여 작성, 검토하며 학습했음을 명시합니다.**

**모든 내용을 넣기보다는, 새로 배운 내용이나 핵심이라고 생각되는 내용만 추려서 정리했습니다.**


# 📒 Week 2 학습 요약

## Day 1 - SQL 심화

### 기본 조회

```sql
-- DISTINCT: 중복 제거 (2개 이상 지정 시 모두 같아야 중복 처리)
SELECT DISTINCT genre, author FROM book;

-- WHERE 조건 조합
SELECT * FROM book
WHERE price BETWEEN 10000 AND 30000
  AND genre IN ('소설', '에세이');

-- LIKE: 와일드카드 문자열 검색
SELECT * FROM book WHERE title LIKE '%파이썬%';

-- ORDER BY: 정렬 (ASC 기본, DESC 내림차순)
SELECT * FROM book ORDER BY price DESC;
```

### DML (데이터 조작)

| 구문 | 용도 |
|------|------|
| `INSERT INTO` | 데이터 삽입 |
| `UPDATE ... SET` | 데이터 수정 |
| `DELETE FROM` | 데이터 삭제 |

```sql
INSERT INTO book (title, price) VALUES ('클린코드', 25000);

UPDATE book SET price = 20000 WHERE id = 1;

DELETE FROM book WHERE id = 1;
```

> **주의**: `UPDATE`·`DELETE`는 반드시 `WHERE` 조건 확인 후 실행 (조건 없으면 전체 영향)

### 집계 함수

| 함수 | 설명 |
|------|------|
| `COUNT(칼럼)` | 행 수 (NULL 제외) |
| `SUM(칼럼)` | 합계 |
| `AVG(칼럼)` | 평균 |
| `MAX(칼럼)` | 최댓값 |
| `MIN(칼럼)` | 최솟값 |
| `LIMIT n` | 결과 행 수 제한 |

```sql
SELECT COUNT(*), AVG(price), MAX(price) FROM book;

-- LIMIT: 2번째 행부터 5개 (인덱스 0 시작)
SELECT * FROM book LIMIT 1, 5;
```

### 그룹화 & JOIN

```sql
-- GROUP BY + HAVING (GROUP BY의 조건은 WHERE가 아닌 HAVING)
SELECT user_id, COUNT(*) AS rental_count
FROM rental
GROUP BY user_id
HAVING COUNT(user_id) > 1;
```

| JOIN 종류 | 설명 |
|-----------|------|
| `INNER JOIN` | 두 테이블 모두에 일치하는 행만 |
| `LEFT JOIN` | 왼쪽 테이블 전체 + 오른쪽 일치 행 (없으면 NULL) |
| `RIGHT JOIN` | 오른쪽 테이블 전체 + 왼쪽 일치 행 (없으면 NULL) |

```sql
-- LEFT JOIN: 대여 이력이 없는 사용자도 포함
SELECT u.name, r.book_id
FROM users u
LEFT JOIN rental r ON u.id = r.user_id;
```

---

## Day 2 - Pydantic & SQLAlchemy ORM

**도메인**: 서비스 안에 존재하는 개념 단위 (유저, 상품, 주문 등)

**Pydantic**: 타입 힌트 기반 데이터 자동 검증

```python
from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str
    age: int
```

**SQLAlchemy (ORM)**: Python 문법으로 SQL을 실행할 수 있게 하는 인터페이스

`DeclarativeBase`는 SQLAlchemy가 제공하는 기반 클래스다. 이걸 상속해서 만든 `Base`가 "모든 테이블 클래스의 공통 부모" 역할을 한다. 각 테이블 클래스가 `Base`를 상속하면, SQLAlchemy가 그 클래스를 DB 테이블로 인식하고 `Base.metadata.create_all()` 한 번으로 등록된 테이블을 전부 생성할 수 있다.

```python
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):   # ← SQLAlchemy에 "여기서부터 테이블 정의 시작"을 알리는 기반 클래스
    pass

class User(Base):              # Base를 상속 → SQLAlchemy가 테이블로 인식
    __tablename__ = "users"
    id   = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)

class Post(Base):              # 이것도 Base 상속 → users, posts 두 테이블이 함께 관리됨
    __tablename__ = "posts"
    id      = Column(Integer, primary_key=True)
    content = Column(String)

# Base에 등록된 모든 테이블(users, posts)을 한 번에 생성
Base.metadata.create_all(engine)
```

**SQL 인젝션 방어**: ORM이나 파라미터 바인딩(`?`)을 사용하면 SQL 구문과 데이터가 DB에 분리된 채널로 전달된다.

이스케이프 처리로 막는 게 아니라, **SQL 구조(코드)와 데이터를 처음부터 분리해서 데이터가 SQL 문법으로 해석될 기회 자체를 없애는 방식**이다. 이를 Prepared Statement(준비된 구문)라고 한다.

```python
# 위험: 문자열 직접 삽입
# DB가 받는 것: "SELECT * FROM users WHERE name = '' OR '1'='1'"
# → DB가 이걸 SQL로 파싱 → OR '1'='1'이 SQL 문법의 일부가 되어 항상 참
name = "' OR '1'='1"
cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")

# 안전: 파라미터 바인딩
# 1단계 → DB가 받는 것: "SELECT * FROM users WHERE name = ?"
#          DB가 이 시점에 쿼리 구조를 컴파일, 실행 계획 확정
# 2단계 → DB가 받는 것: (데이터) "' OR '1'='1"
#          이미 확정된 쿼리에 값으로만 채워 넣음 → SQL로 해석할 여지 없음
cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
# 결과: name이 "' OR '1'='1"인 행을 찾는 쿼리 실행 → 해당 행 없으면 빈 결과
```

---

## Day 3 - HTML & CSS

### HTML

**역할 분리**

| 언어 | 역할 |
|------|------|
| HTML | 웹 페이지의 구조와 내용 |
| CSS | 웹 페이지의 스타일·레이아웃 |
| JavaScript | 웹 페이지의 동적 동작 |

**핵심 태그**

```html
<!-- 컨테이너: block vs inline -->
<div>한 줄 전체 차지 (block)</div>
<span>줄 안에 여러 개 배치 (inline)</span>

<!-- class: 같은 스타일 여러 요소에 / id: 문서 내 유일한 식별자 -->
<div class="card" id="main-card">...</div>

<!-- semantic tag: div와 기능은 동일하지만 구조 가독성 향상 -->
<header>...</header>
<nav>...</nav>
<main>...</main>
<footer>...</footer>
```

**label · input 연결 구조**

`label`의 `for`과 `input`의 `id`는 "어떤 입력창에 대한 라벨인지"를 연결하는 역할이고, `input`의 `name`은 "서버에 전송할 때 key"로 쓰인다. 세 가지가 각각 다른 목적을 가진다.

```html
<form method="POST" action="/login">

  <!-- for="uid" → id="uid"와 연결 -->
  <!-- 연결되면: 라벨 텍스트 클릭 시 입력창에 자동 포커스 -->
  <label for="uid">아이디</label>
  <input type="text" id="uid" name="username">
  <!--                ↑ for과 짝        ↑ 서버 전송 시 key -->

  <label for="pw">비밀번호</label>
  <input type="password" id="pw" name="password">

  <button type="submit">로그인</button>
</form>

<!-- 제출하면 서버에 이렇게 전달됨 -->
<!-- POST /login  body: username=alice&password=1234 -->
<!--              name값이 key, input에 입력한 값이 value -->
```

> `id`와 `for`은 화면 UX(클릭 편의)를 위한 연결이고, `name`은 실제 데이터 전송의 key다. `id`와 `name`이 같아 보여서 헷갈리지만 역할이 다르다.

### CSS

**적용 방식** (외부 스타일 시트 권장)

```html
<head>
  <link rel="stylesheet" href="style.css">
</head>
```

**선택자 우선순위**
```
!important > 인라인 > #id > .class > 태그 > * (전체)
```

**박스 모델**

```css
/* border-box: padding·border 포함한 실제 보이는 크기로 계산 */
* { box-sizing: border-box; }

/* 인접 블록 간 margin은 합산이 아닌 큰 값으로 겹침 (margin collapse) */
```

**레이아웃**

```css
/* Flexbox: 1차원 (행 또는 열) */
.container {
  display: flex;
  justify-content: space-between; /* main axis 정렬 */
  align-items: center;            /* cross axis 정렬 */
}

/* Grid: 2차원 (행 + 열) */
.container {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr; /* 3열 균등 분할 */
}
```

**가상 선택자**

```css
a:hover { color: blue; }        /* 마우스 올릴 때 */
p::first-letter { font-size: 2em; } /* 첫 글자만 */
```

---

## Day 4 - AI 활용

- AI에게 단순 요청 후 **"더 잘할 수 없어?"** 처럼 개선을 요청하면 품질 향상 가능
- 개념 학습 시 **"이 개념을 interactive HTML로 설명해줘"** 형태로 시각적 학습 자료 생성 가능

---

## Day 5 - JavaScript 기초

**특징**: 동적 타입 언어, 브라우저·Node.js 환경 모두 실행 가능

### 변수 선언

| 키워드 | 재선언 | 재할당 | 스코프 |
|--------|--------|--------|--------|
| `var` | 가능 | 가능 | 함수 레벨 |
| `let` | 불가 | 가능 | 블록 레벨 |
| `const` | 불가 | 불가 | 블록 레벨 |

> `var`보다 `let`·`const` 사용 권장 (예측 불가능한 버그 방지)

### 데이터 타입 & 비교

```javascript
// 기본 타입
let name = "Alice";       // string
let age = 25;             // number
let active = true;        // boolean
let empty = null;         // 명시적으로 비어있음
let notDefined;           // undefined

typeof name;              // "string"

// == vs ===
"5" == 5   // true  (타입 변환 후 비교 → 예상치 못한 버그 위험)
"5" === 5  // false (값 + 타입 모두 비교 → 권장)
```

### 객체 & 배열 & 함수

```javascript
// 객체: {key: value} / 함수가 value이면 메서드
const user = {
  name: "Alice",
  greet() { return `안녕, ${this.name}`; }  // template literal
};

// 배열
const nums = [1, 2, 3];

// 함수 선언 vs 화살표 함수
function add(a, b) { return a + b; }
const add = (a, b) => a + b;  // 화살표 함수 (람다식)
```

### 출력·입력

```javascript
console.log("디버깅 출력");
alert("팝업 메시지");
const input = prompt("입력하세요");
const ok = confirm("확인?");          // true / false 반환
document.write("HTML에 직접 출력");
```
