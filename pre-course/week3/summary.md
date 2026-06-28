# Week 3 학습 정리

## Day 1 — DOM & 이벤트

DOM(문서 객체 모델): JS 엔진이 HTML을 해석한 결과. `querySelector`, `getElementById` 등으로 요소를 선택하고, `createElement` + `appendChild`로 동적으로 추가.

```js
const li = document.createElement("li");
li.appendChild(document.createTextNode("항목"));
document.querySelector("ul").appendChild(li);
```

- `addEventListener`로 이벤트 리스너 등록
- `event.stopPropagation()`으로 이벤트 버블링 차단

> **💬 Q. innerText vs innerHTML 차이가 뭐야?**
>
> `innerText`는 태그를 문자 그대로 출력하고, `innerHTML`은 태그를 실제 HTML로 해석해서 렌더링한다.
>
> ```js
> const el = document.querySelector("div");
>
> el.innerText = "<b>굵게</b>";  // 화면: <b>굵게</b>  (태그가 문자로 보임)
> el.innerHTML = "<b>굵게</b>";  // 화면: **굵게**     (실제 볼드 처리됨)
> ```
>
> - **innerText 쓸 때**: 사용자 입력이나 외부 데이터를 텍스트로 표시할 때 — XSS 공격 방지
> - **innerHTML 쓸 때**: 직접 작성한 신뢰할 수 있는 HTML 구조를 동적으로 삽입할 때
>
> → 외부에서 받은 데이터를 innerHTML에 넣으면 `<script>` 등이 실행될 수 있어서 위험하다.

---

## Day 2 — ES6+, 비동기, Promise

### ES6+ 문법

```js
const { name, age } = person;           // 구조 분해 할당
const add = (a, b) => a + b;            // 화살표 함수
const msg = `안녕 ${name}!`;            // 템플릿 리터럴
```

- `var`는 함수 스코프 → `let` / `const`(블록 스코프) 사용 권장


### Promise & async/await

```js
// Promise
fetch(url)
  .then(res => res.json())
  .catch(err => console.error(err))
  .finally(() => setLoading(false));

// async/await (더 간결)
const data = await fetch(url).then(r => r.json());
```

> **💬 Q. `new Promise((resolve, reject) => ...)` 에서 resolve, reject는 어디서 온 거야? 내가 선언한 적이 없는데.**
>
> `resolve`와 `reject`는 내가 지은 이름이 아니라 **Promise 생성자가 넘겨주는 함수**다. Promise 내부가 대략 이렇게 생겼다:
>
> ```js
> class Promise {
>   constructor(executor) {
>     const resolve = (value) => { /* 상태를 fulfilled로 바꿈 */ };
>     const reject  = (reason) => { /* 상태를 rejected로 바꿈 */ };
>     executor(resolve, reject); // ← 내가 넘긴 콜백을 호출하면서 두 함수를 인자로 전달
>   }
> }
> ```
>
> 내가 쓰는 건 그 인자를 받는 **매개변수 이름**을 짓는 것뿐이라 `a, b`로 써도 동작한다. `resolve`, `reject`는 관례적인 이름일 뿐 JS 예약어가 아니다.
>
> `const [parentAssets, setParentAssets] = useState(500)`도 같은 맥락이다. `useState`가 `[값, setter함수]` 배열을 반환하고, 구조 분해로 각 자리에 이름을 붙이는 것뿐이다:
>
> ```js
> // 아래 두 코드는 동일
> const arr = useState(500);
> const parentAssets = arr[0];
> const setParentAssets = arr[1];
>
> const [parentAssets, setParentAssets] = useState(500); // 한 줄 버전
> ```
>
> | 경우 | 실제로 일어나는 일 |
> |---|---|
> | `(resolve, reject) =>` | 함수 호출 시 인자로 넘어오는 값에 이름을 붙임 |
> | `const [a, b] = useState()` | 함수가 반환한 배열의 각 자리에 이름을 붙임 |
>
> 두 경우 모두 **내가 변수를 만드는 게 아니라, 이미 존재하는 값에 이름표를 다는 것**이다.
>
> Python의 튜플 언패킹(`a, b = func()`)이나 콜백 패턴(`run(lambda result: ...)`)과 동일한 개념인데, JS/React에서 유독 자주 보이는 이유는 **비동기 처리**가 언어 설계의 핵심이기 때문이다. "언제 끝날지 모르는 작업"을 다루다 보니 함수를 인자로 넘기는 패턴이 백엔드보다 훨씬 빈번하고, React는 "상태를 React가 직접 관리한다"는 원칙 때문에 값과 setter를 쌍으로 돌려주는 독특한 API가 나왔다.

> **💬 Q. Promise가 정확히 뭔데? 왜 필요한 거야?**
>
> 비동기 작업의 **"미래의 결과값"을 담는 객체**다. 작업이 끝나기 전에도 `.then`으로 "완료되면 이거 해줘"를 미리 등록해놓을 수 있다.
>
> **Promise 없이 콜백만 쓰면:**
> ```js
> getData(function(a) {
>   getMore(a, function(b) {
>     getEven(b, function(c) {
>       // 콜백 지옥 — 에러 처리도 각각 해야 함
>     });
>   });
> });
> ```
>
> **Promise 체이닝:**
> ```js
> getData()
>   .then(a => getMore(a))
>   .then(b => getEven(b))
>   .catch(err => console.error(err)); // 에러를 한 곳에서 처리
> ```
>
> Promise는 세 가지 상태를 가진다:
> - `pending` → 아직 결과 없음 (초기 상태)
> - `fulfilled` → `resolve()` 호출됨, `.then`으로 결과값 전달
> - `rejected` → `reject()` 호출됨, `.catch`로 에러 전달
>
> ```js
> const p = new Promise((resolve, reject) => {
>   setTimeout(() => resolve("완료!"), 1000); // 1초 후 fulfilled
> });
> p.then(v => console.log(v)); // "완료!"
> ```
>
> **Promise.all vs Promise.allSettled:**
> - `Promise.all([p1, p2])` — 하나라도 실패하면 전체 reject
> - `Promise.allSettled([p1, p2])` — 성공/실패 무관하게 모두 기다려서 각 결과 반환

---

## Day 3 — React 기초 (useState, useEffect)

### React의 접근법

DOM 직접 조작 대신 **상태가 바뀌면 리액트가 화면을 알아서 업데이트** (가상 DOM으로 변경된 부분만 렌더링).

### JSX & 함수 컴포넌트

```jsx
// 컴포넌트 이름은 반드시 대문자로 시작
function Greeting({ name }) {
  return <h1>안녕, {name}!</h1>;
}
```

### Props: 부모 → 자식 데이터 전달

```jsx
<ParentComponent name="아버지" assets={parentAssets} />
<ChildComponent name="자녀" assets={childAssets} onReceive={handleInherit} />
```

### useState

```jsx
const [parentAssets, setParentAssets] = useState(500);
const [childAssets, setChildAssets] = useState(0);

const handleInherit = () => {
  setChildAssets(prev => prev + parentAssets);
  setParentAssets(0);
};
```

- 배열/객체 상태는 **새 참조**를 만들어 전달해야 리렌더링 발생

> **💬 Q. useState는 값이 바뀐 걸 어떻게 알고 리렌더링을 발생시키는 거야?**
>
> `setState`를 호출하면 React가 **이전 값과 새 값을 `Object.is`로 비교**한다. 다르면 해당 컴포넌트를 리렌더링 큐에 올린다.
>
> ```js
> setCount(5); // 이전 값도 5면 → 같음 → 리렌더링 안 함
> setCount(6); // 이전 값이 5면 → 다름 → 리렌더링 발생
> ```
>
> 배열/객체가 문제가 되는 이유:
> ```js
> const arr = [1, 2, 3];
> arr.push(4);
> setList(arr); // arr의 참조(주소)가 그대로 → Object.is로 보면 "같음" → 리렌더링 안 됨!
>
> setList([...arr, 4]); // 새 배열 → 참조가 다름 → 리렌더링 발생
> ```
>
> React는 값 자체를 깊이 비교하지 않고 참조(메모리 주소)만 비교하기 때문에, 배열/객체는 반드시 새로 만들어서 넘겨야 한다.

### useEffect

```jsx
useEffect(() => {
  if (isSolved || isPaused) return;

  const id = setInterval(() => {
    setTimeLeft(prev => prev <= 1 ? 15 : prev - 1);
  }, 1000);

  return () => clearInterval(id); // cleanup: 메모리 누수 방지
}, [isPaused, isSolved]); // 의존성 배열: 해당 값이 바뀔 때만 재실행
```

> **💬 Q. useEffect는 의존성 배열의 변화를 어떻게 감지해?**
>
> 렌더링이 끝날 때마다 React가 **이번 렌더의 deps 값들**과 **이전 렌더의 deps 값들**을 `Object.is`로 하나씩 비교한다. 하나라도 다르면 effect를 다시 실행한다.
>
> ```
> 1회 렌더: isPaused=false, isSolved=false  → effect 최초 실행
> 2회 렌더: isPaused=true,  isSolved=false  → isPaused 달라짐 → cleanup 실행 후 effect 재실행
> 3회 렌더: isPaused=true,  isSolved=false  → 둘 다 같음 → effect 실행 안 함
> ```
>
> cleanup 함수가 중요한 이유: effect가 재실행되기 전에 **이전 effect를 먼저 정리**해야 하기 때문이다. clearInterval 없이 effect만 쌓이면 타이머가 여러 개 동시에 돌게 된다.
>
> ```js
> useEffect(() => {
>   const id = setInterval(...); // effect: 타이머 시작
>   return () => clearInterval(id); // cleanup: 다음 실행 전 or 언마운트 시 타이머 제거
> }, [dep]);
> ```

---

## Day 4 — React 심화 (컴포넌트 분리, Custom Hook, Tailwind)

### 컴포넌트 분리

하나의 컴포넌트가 너무 많은 역할을 할 때 `Header`, `PostCard`, `Footer` 등으로 분리.

```jsx
export default function App() {
  return (
    <div className="app">
      <Header />
      <ul>{POSTS.map(post => <PostCard key={post.id} post={post} />)}</ul>
      <Footer postCount={POSTS.length} />
    </div>
  );
}
```

### Lifting State Up (상태 끌어올리기)

두 자식 컴포넌트가 같은 상태를 공유해야 할 때 → 공통 부모가 상태 소유.

```jsx
function ShoppingApp() {
  const [cartCount, setCartCount] = useState(0);
  return (
    <>
      <ShoppingHeader count={cartCount} />              {/* 상태 읽기 */}
      <ProductList onAdd={() => setCartCount(c => c+1)} /> {/* 상태 변경 함수 전달 */}
    </>
  );
}
```
