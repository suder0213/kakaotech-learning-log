# Claude Code Schedule 기능 (`/schedule`) 알아보기

## 무엇인가?

- `/schedule`은 "루틴(Routine)"을 만들고 관리하는 기능
- 루틴 = 프롬프트 + 저장소(repo) + 커넥터 설정을 저장해두고, Anthropic이 관리하는 클라우드에서 자동 실행되는 Claude Code 설정
- cron 스케줄 / API 호출 / GitHub 웹훅 이벤트 세 가지 방식으로 트리거 가능
- `/loop`(로컬에서 반복 실행)와 다르게, 내 컴퓨터가 꺼져 있어도 클라우드에서 계속 실행됨

## 사람들이 자주 쓰는 용도 (실제 문서 예시)

- 밀린 백로그 정리: 매일 밤 이슈에 라벨링, 담당자 지정, 요약 코멘트 작성
- 알림 triage: API로 알림 수신 → 원인 분석 후 draft PR 자동 생성
- 코드 리뷰 자동화: PR이 열리면 GitHub 트리거로 팀 체크리스트 적용
- 배포 검증: 배포 후 API 트리거로 스모크 테스트 실행 → go/no-go 결과 게시
- 문서 드리프트 감지: 주 1회 API 문서와 실제 코드가 어긋난 부분 스캔
- 라이브러리 포팅: 원본 코드 변경 시 GitHub 트리거로 다른 언어 SDK에 반영

## 사용 방법

### 만들기
- CLI에서 자연어로 요청: `/schedule daily PR review at 9am`, `/schedule clean up flag in one week` 처럼 말하면 Claude가 세부사항을 되물어보며 설정
- 웹: claude.ai/code/routines → New routine
- 데스크톱 앱: Routines 사이드바 → New routine → Remote 선택
- 트리거 종류: Schedule(cron), API(Bearer 토큰 포함 HTTP POST), GitHub 이벤트(PR, release 등 필터 가능)
- cron 최소 간격은 **1시간** — hourly/daily/weekdays/weekly 프리셋 + `/schedule update`로 커스텀 cron 지정 가능

### 관리
- `/schedule list` — 등록된 루틴 목록 확인
- `/schedule update` — 프롬프트/스케줄 수정, 커스텀 cron 추가
- `/schedule run` — 즉시 한 번 실행
- 웹 UI에서는 일시정지/재개/삭제/실행 이력 확인도 가능

## 주의할 점

- **플랜 제한**: Pro / Max / Team / Enterprise 필요 (Free 플랜 불가)
- **로그인 방식**: claude.ai 계정 로그인 필요 (API 키 방식은 불가)
- **승인 프롬프트 없음**: 자동으로 실행되므로, 저장소/커넥터 접근 권한 범위를 신중하게 설정해야 함
- **일일 실행 횟수 제한**: 계정당 루틴 실행 횟수 제한 있음 (1회성 실행은 예외)
- **Research preview 단계**: 동작 방식이나 제한이 바뀔 수 있음. GitHub 웹훅 이벤트는 루틴당 시간당 호출 제한 있음
- **브랜치 안전장치**: 기본적으로 `claude/*` 브랜치에만 푸시. 기존 브랜치에 푸시하려면 "unrestricted branch pushes" 옵션을 켜야 함
- **조직 단위 비활성화 가능**: Team/Enterprise 관리자가 조직 전체에서 루틴 기능을 끌 수 있음
- **CLI에서 지원 안 되는 것**: API/GitHub 트리거 설정은 CLI에서 불가, 웹에서만 가능

## 느낀 점 / 정리

- 로컬 `/loop`과 헷갈릴 수 있는데, `/schedule`은 클라우드에서 도는 "완전히 별도의 자동화"라는 점이 핵심 차이
- 승인 프롬프트 없이 자동 실행되니, 실제로 쓸 때는 권한 범위를 최소한으로 주는 게 중요할 듯
- PR 리뷰 자동화나 배포 후 스모크 테스트 같은 반복 업무에 적용해보면 좋을 것 같음
