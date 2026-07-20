"""
json 라이브러리 실습
- dumps/loads: 문자열 <-> 파이썬 객체 (웹 통신에서 실제로 쓰는 형태)
- dump/load: 파일 <-> 파이썬 객체
- 웹에서 데이터를 주고받는 흐름을 흉내내본다 (요청 body 만들기 -> 서버가 파싱 -> 응답 body 만들기)

실행: python json_library_practice.py
"""

import json
import sys

# Windows 콘솔 기본 인코딩(cp949)에서 한글이 깨지는 걸 막기 위해 stdout을 utf-8로 강제
sys.stdout.reconfigure(encoding="utf-8")


def section(title: str) -> None:
    print(f"\n=== {title} ===")


# ---------------------------------------------------------------------------
# 1. json.dumps : 파이썬 객체 -> JSON 문자열
#    실제 웹 요청을 보낼 때 body에 넣는 값이 바로 이 "문자열"이다.
# ---------------------------------------------------------------------------
section("1. json.dumps - 객체를 문자열로 직렬화")

user = {
    "name": "김철수",
    "age": 25,
    "is_active": True,
    "roles": ["student", "admin"],
    "profile": {"city": "대구", "score": 95.5},
    "note": None,
}

json_str_default = json.dumps(user)
print("[기본]", json_str_default)
print("타입:", type(json_str_default))  # str

# ensure_ascii=False를 안 주면 한글이 \uXXXX 로 escape 된다 (기능은 같지만 읽기 어려움)
json_str_kr = json.dumps(user, ensure_ascii=False)
print("\n[ensure_ascii=False]", json_str_kr)
print("타입:", type(json_str_kr))

# indent를 주면 사람이 읽기 좋은 pretty-print 형태가 된다 (API 응답 로그 확인용)
json_str_pretty = json.dumps(user, ensure_ascii=False, indent=2, sort_keys=True)
print("\n[indent=2, sort_keys=True]")
print(json_str_pretty)
print("타입:", type(json_str_pretty))


# ---------------------------------------------------------------------------
# 2. json.loads : JSON 문자열 -> 파이썬 객체
#    서버가 요청 body(문자열)를 받아서 dict로 복원할 때 쓰는 함수.
# ---------------------------------------------------------------------------
section("2. json.loads - 문자열을 객체로 역직렬화")

restored = json.loads(json_str_kr)
print("복원된 값:", restored)
print("타입:", type(restored))  # dict
print("원본과 같은 값인가?", restored == user)


# ---------------------------------------------------------------------------
# 3. json.dump / json.load : 파일에 직접 쓰고 읽기
#    dumps와 헷갈리기 쉬움: dump(obj, fp) -> fp는 필수 인자, 파일에 바로 쓴다.
# ---------------------------------------------------------------------------
section("3. json.dump / json.load - 파일로 저장하고 다시 읽기")

file_path = "user_data.json"

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(user, f, ensure_ascii=False, indent=2)
print(f"'{file_path}' 파일에 저장 완료")

with open(file_path, "r", encoding="utf-8") as f:
    loaded_from_file = json.load(f)
print("파일에서 읽은 값:", loaded_from_file)
print("타입:", type(loaded_from_file))

# dump(obj) 처럼 fp 없이 호출하면 어떻게 되는지 확인 (의도적으로 에러 발생시켜보기)
try:
    json.dump(user)
except TypeError as e:
    print("\n[일부러 에러 내보기] json.dump(user) ->", e)


# ---------------------------------------------------------------------------
# 4. 웹에서 데이터를 주고받는 흐름 흉내내기
#    클라이언트: dict를 만들고 -> dumps로 문자열(body)을 만들어 "전송"
#    서버:      전송받은 문자열(body) -> loads로 dict 복원 -> 처리 -> 응답 dict 생성 -> dumps로 응답 body 생성
#    클라이언트: 응답 문자열(body) -> loads로 복원해서 사용
# ---------------------------------------------------------------------------
section("4. 웹 통신 흉내내기 (클라이언트 -> 서버 -> 클라이언트)")

# 클라이언트가 보낼 요청 body
request_payload = {"method": "create_todo", "title": "json 공부하기", "done": False}
request_body = json.dumps(request_payload, ensure_ascii=False)
print("클라이언트 -> 서버 (실제로 전송되는 문자열):")
print(request_body)
print("타입:", type(request_body))

# 서버 쪽: 문자열로 받은 body를 dict로 복원해서 처리
received = json.loads(request_body)
print("\n서버가 받아서 복원한 dict:", received)
print("타입:", type(received))

# 서버가 처리 후 응답 dict를 만들고, 다시 문자열로 직렬화해서 응답
response_payload = {
    "status": "ok",
    "created": {"id": 1, "title": received["title"], "done": received["done"]},
}
response_body = json.dumps(response_payload, ensure_ascii=False)
print("\n서버 -> 클라이언트 (응답 문자열):")
print(response_body)
print("타입:", type(response_body))

# 클라이언트가 응답 문자열을 다시 dict로 복원
final_result = json.loads(response_body)
print("\n클라이언트가 최종적으로 사용하는 dict:", final_result)
print("타입:", type(final_result))
