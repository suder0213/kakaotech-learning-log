# json 라이브러리 정리

실습 파일: `json_library_practice.py`

## 핵심 개념
- JSON은 **텍스트 포맷**이다. 웹으로 데이터를 주고받을 때 실제로 오가는 건 항상 문자열(`str`)이고, 파이썬 객체(dict 등)가 그대로 전송되는 게 아니다.

## 함수 정리

| 함수 | 방향 | 대상 | 용도 |
|---|---|---|---|
| `json.dumps(obj)` | 객체 -> 문자열 | 메모리 ↔ 메모리 | 웹 요청/응답 body처럼 "문자열이 필요할 때" |
| `json.loads(str)` | 문자열 -> 객체 | 메모리 ↔ 메모리 | 받은 문자열(body)을 파이썬 객체로 복원할 때 |
| `json.dump(obj, fp)` | 객체 -> 파일 | 파일 | 객체를 파일에 바로 저장. `fp` 필수 인자 |
| `json.load(fp)` | 파일 -> 객체 | 파일 | 파일에서 읽어서 객체로 복원 |

- 이름 규칙: `s`가 붙으면 **문자열(string)** 대상, 안 붙으면 **파일(file pointer)** 대상.
- `loads`의 결과 타입은 JSON 최상위 구조를 따른다 — `{...}`면 `dict`, `[...]`면 `list`.

## 주의할 옵션 (dumps/dump 공통)
- `ensure_ascii=False`: 한글 등 non-ASCII 문자를 `\uXXXX` 이스케이프 없이 그대로 출력. 안 주면 기능은 같지만 사람이 읽기 어려움.
- `indent=2`: pretty-print. 로그/디버깅용으로 보기 좋게.
- `sort_keys=True`: 키를 알파벳순으로 정렬해서 출력.

## 웹 통신 흐름 (실습 4번 시나리오)
```
클라이언트 dict --dumps--> 문자열(요청 body) --전송-->
서버가 받음 --loads--> dict로 복원 --처리--> 응답 dict 생성 --dumps--> 문자열(응답 body) --전송-->
클라이언트가 받음 --loads--> dict로 복원해서 사용
```

## 자주 하는 실수
- `json.dump(obj)` 처럼 `fp` 없이 호출 -> `TypeError: dump() missing 1 required positional argument: 'fp'`
- `dumps`/`dump` 이름이 한 글자 차이라 헷갈리기 쉬움: **s 있으면 문자열, 없으면 파일**로 외우기.
