#!/usr/bin/env bash
# Claude Code 클라우드 세션(claude.ai/code)이 시작될 때 의존성을 설치한다. 로컬에서는 아무것도 하지 않는다.
# .claude/settings.json의 SessionStart 훅이 부른다. README「Claude Code 클라우드에서 작업하기」 참고.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# lock 파일이 바뀌지 않았으면 이미 설치된 node_modules를 그대로 쓴다 (다시 열기·이어 하기가 빠르다)
stamp=node_modules/.cloud-setup-lock
if [ -f "$stamp" ] && cmp -s package-lock.json "$stamp"; then
  exit 0
fi

npm ci --no-audit --no-fund
cp package-lock.json "$stamp"
