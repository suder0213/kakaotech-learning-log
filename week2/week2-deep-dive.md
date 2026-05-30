**week2 학습 중 추가로 깊게 파고든 내용을 별도로 기록합니다.**

**마지막 실제 프로젝트를 제외하고는 AI를 사용해 요약, 검토하였습니다. 원문과 단순 요약은 리포지토리에서 확인 가능합니다.**

---

# 📌 Week 2 심화 학습

## 1. SQLAlchemy DeclarativeBase

`DeclarativeBase`를 상속한 `Base`는 모든 테이블 클래스의 공통 부모다. 테이블 클래스가 `Base`를 상속하면 SQLAlchemy가 내부 registry에 등록하고, `Base.metadata.create_all()` 한 번으로 등록된 테이블을 전부 생성할 수 있다. `Base` 자체는 직접 쓰이는 클래스가 아닌, 테이블 관리의 기준점이다.

```python
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class User(Base):           # Base 상속 → registry 등록
    __tablename__ = "users"
    id   = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)

class Post(Base):           # 마찬가지로 등록
    __tablename__ = "posts"
    id      = Column(Integer, primary_key=True)
    content = Column(String)

Base.metadata.create_all(engine)  # users, posts 테이블 한 번에 생성
```

---

## 2. Prepared Statement와 SQL 인젝션 방어 원리

이스케이프로 막는 게 아니라 SQL 구조(코드)와 데이터를 **다른 시점에, 분리된 채널로** DB에 전달해서 데이터가 SQL 문법으로 해석될 기회 자체를 없애는 방식이다.

```python
name = "' OR '1'='1"

# 위험: DB가 완성된 문자열을 통째로 파싱 → OR '1'='1'이 SQL 문법이 됨
cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")
# DB 수신: SELECT * FROM users WHERE name = '' OR '1'='1'  ← 항상 참

# 안전: 1단계에서 쿼리 구조 컴파일 완료 → 2단계 데이터는 값으로만 채워짐
cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
# 1단계 DB 수신: SELECT * FROM users WHERE name = ?  ← 구조 확정
# 2단계 DB 수신: (데이터) ' OR '1'='1               ← SQL 해석 불가
```

---

## 3. HTML `<label>`의 `for`, `<input>`의 `id`·`name` 역할 구분

| 속성 | 위치 | 역할 |
|------|------|------|
| `for` | `<label>` | 어떤 input과 연결된 라벨인지 지정 |
| `id` | `<input>` | `for`과 짝을 맞춰 label과 연결 |
| `name` | `<input>` | 폼 제출 시 서버에 전달되는 데이터의 key |

`for` ↔ `id` 연결은 라벨 클릭 시 해당 입력창에 포커스가 가는 UX 편의 장치로 서버와 무관하다. `name`이 실제 서버에 전송되는 key이며, `id`와 같은 값으로 쓰이는 경우가 많아 혼동하기 쉽지만 역할이 전혀 다르다.

```html
<form method="POST" action="/login">
  <label for="uid">아이디</label>
  <input type="text" id="uid" name="username">
  <!--               ↑ for과 짝   ↑ 서버 전송 key -->

  <label for="pw">비밀번호</label>
  <input type="password" id="pw" name="password">
</form>
<!-- 제출 시: POST /login  body: username=alice&password=1234 -->
```

---



---

## 📂 실제 프로젝트 코드 분석

아래는 실제로 제가 '오픈소스 주차장 관리 시스템' 프로젝트에서 AI를 통해 생성했던 코드인데, 여태 배운 내용을 토대로 이를 해석해보는 시간을 가졌습니다.

```python

#database.py

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.database_url)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

class Base는 이후 코드에서 실제 엔티티들이 상속 받을 때 쓰였습니다. 이를 보아 DB에 엔티티 테이블이 생성되는 것이 자동이 아니라, DeclarativeBase를 통한 ORM의 명시적 선언을 통해서 등록된 것을 알 수 있었습니다
+ async 와 async with 같은 문법들도 자세히 몰랐는데, 이제는 비동기 제어와 자원 제어를 하고 있다는 것을 이해하고 있습니다.



```python

# auth.py

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, SignupResponse, TokenResponse

router = APIRouter()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8


@router.post("/signup", response_model=SignupResponse, status_code=201)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    if not settings.enable_signup:
        raise HTTPException(status_code=403, detail="signup_disabled")

    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="username_already_exists")

    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="email_already_exists")

    user = User(
        id=uuid.uuid4(),
        username=body.username,
        email=body.email,
        password_hash=bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return SignupResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    if not user or not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="invalid_credentials")

    payload = {
        "sub": str(user.id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return TokenResponse(access_token=token)

```
인증과 관련된 부분을 뒤로 하고, DB 사용은 I/O 작업이므로 async 함수 선언을 한 메서드 내에서 await 를 사용해 비동기 처리하고 있음을 알 수 있다. await 후에 사용되는 db 객체는 AsyncSession 객체인데, database.py에서 AsyncSessionLocal()을 통해 세션을 만들고 완료되면 커밋 후 폐기하는 식으로 사용되고 있다. 그 외에 raise HTTPException 등을 통해서 응답 코드와 detail을 전달하여 디버깅에 유용하도록 작성되고 있었다.


---

-
-
-
-
-
-
-
# 🫡짧은 감상...

 사실 이전 프로젝트들을 짧은 시간 내에 허겁지겁 만드느라 디테일을 많이 뭉개고 기능 위주로만 작업하다보니 코드를 완벽하게 이해하지 못하고 "일단 작동은 돼..."처럼 넘겼는데, 확실히 개념을 짚으며 공부하니까 코드가 어떤 식으로 작동하는지 이해가 되는 것 같다. 앞으로도 이전에 작업했던 프로젝트들의 코드를 간단히 리뷰하는 식으로 작성하면 도움이 많이 될 것 같다.