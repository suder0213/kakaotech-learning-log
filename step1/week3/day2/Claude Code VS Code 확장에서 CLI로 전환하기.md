# Claude Code VS Code 확장 프로그램에서 CLI로 전환하기

- 지금까지는 VS Code 확장(Extension)으로 Claude Code를 사용해왔음
- 이번 주부터는 터미널 기반 CLI로 전환해서 사용해보기로 함

## 왜 CLI로 전환하는가?

- VS Code 확장은 에디터 안에서만 동작 → 특정 IDE에 종속됨
- CLI는 터미널만 있으면 어디서든 실행 가능 (원격 서버, WSL, 다른 에디터 등)
- 자동화(스크립트, cron, 훅) 연동이 CLI 쪽이 훨씬 자유로움
- Claude Code의 핵심 기능(스킬, 서브에이전트, MCP, 훅, 워크플로우 등)은 CLI가 기준이고
  VS Code 확장은 그 위에 얹힌 UI에 가까움 → 기능적으로 CLI가 더 넓음

## 설치 과정

1. Node.js 설치 여부 확인 (Claude Code는 Node 기반)
   - `node -v` 로 버전 확인
2. npm으로 전역 설치
   - `npm install -g @anthropic-ai/claude-code`
3. 설치 확인
   - `claude --version`
4. 로그인
   - `claude` 실행 후 최초 1회 로그인 절차 진행 (계정 인증)

## VS Code 확장과 다른 점 (사용하면서 느낀 차이)

- 확장은 사이드바 채팅창 UI였다면, CLI는 터미널에서 바로 대화하는 방식
- 프로젝트 폴더로 이동(`cd`) 후 `claude` 실행 → 해당 디렉토리를 컨텍스트로 잡음
- 파일 수정/커맨드 실행 시 권한 확인(permission prompt)이 뜨는 방식은 동일
- 슬래시 커맨드(`/help`, `/clear`, `/init` 등)는 CLI에서도 그대로 사용 가능
- CLAUDE.md 같은 프로젝트/전역 설정 파일은 CLI 기준으로 만들어진 것 → 확장에서도 인식은 하지만 CLI가 원래 대상
- 여러 개의 서브에이전트(Agent), 워크플로우, 훅(hook) 설정은 CLI 환경에서 다루기 훨씬 수월함

## 느낀 점 / 정리

- 처음엔 터미널 조작이 익숙하지 않아 어색했지만, 명령어 몇 개(`claude`, `/help`, `claude --version`)만 알면 바로 적응 가능
- 에디터에 묶여있지 않다는 점이 자유로움 → 다른 프로젝트, 다른 환경에서도 동일하게 사용 가능
- 앞으로는 CLI를 기본으로 사용하고, VS Code는 코드 확인/네비게이션 용도로 병행할 예정
