# PerfectPixel 단일 상태 시범 평가

- 사이클: `20260718-resource-refinement`
- 평가 목적: 프로젝트의 painterly GLB bridge를 대체하지 않는 저사양 2D 대체 후보 검증
- 판정: **PROVIDER BLOCKED — 후보 품질 평가 불가, 현 GLB bridge 유지**

## 범위와 비대상

평가 대상은 `assets/images/resource-refinement/perfectpixel/`의 독립 출력과 이 보고서뿐이다. 기존 GLB bridge, 공유 매니페스트, `app.js`, `sw.js` 및 다른 런타임 파일은 수정하지 않았다.

## 설치 증거

스킬 지침에 따라 `skill://perfectpixel/scripts/install.sh`를 실행했다.

```text
command: bash skill://perfectpixel/scripts/install.sh
exit: 0
stdout: /Users/jangyoung/.claude/skills/perfectpixel/bin/ppgen
binary SHA-256: ad1971531bc5eaf7e7a2556a57148f3c57143a0cf50c46479311d21b85b1bd31
platform: Mach-O 64-bit executable arm64
```

설치 스크립트는 이미 정상 동작하는 바이너리를 재사용했다. 설치된 바이너리의 `-dump` 결과는 실제 JSON으로 `assets/images/resource-refinement/perfectpixel/ppgen-capabilities.json`에 보존했다.

- capability JSON SHA-256: `283e0e2de2a8728b15ab73750cf926adec422213b280d9f36dd63a409e273e1c`
- 보고된 provider 목록: `gemini`, `openai`, `openrouter`, `fal`, `byteplus`
- 요청된 `god-tibo-imagen`은 목록에 없다.

## 단일 `idle` 시범 실행

성공 여부를 먼저 판정하기 위해 전체 상태 생성보다 앞서 정확히 한 상태만 요청했다.

```text
provider: god-tibo-imagen
model: gpt-5.4
style: pixel
states: idle
attempts: default 3
character prompt: Dusk Shade field scout, obsidian armor, cyan soul flame, strong asymmetric silhouette, no magenta in character
input references: none
output: assets/images/resource-refinement/perfectpixel/idle-pilot
```

실행 명령:

```sh
/Users/jangyoung/.claude/skills/perfectpixel/bin/ppgen \
  -provider god-tibo-imagen \
  -model gpt-5.4 \
  -desc "Dusk Shade field scout, obsidian armor, cyan soul flame, strong asymmetric silhouette, no magenta in character" \
  -style pixel \
  -states idle \
  -out assets/images/resource-refinement/perfectpixel/idle-pilot \
  -key dummy \
  -json \
  -timeout 30m
```

관측 결과:

```text
exit: 1
stderr: ppgen 실패: 지원하지 않는 프로바이더입니다: god-tibo-imagen
elapsed: 0.58 s
```

`-json`이 지정되었지만 이 선행 provider 검증 오류에서 ppgen은 stdout에 JSON 오류 객체를 쓰지 않았다. 실제 stdout은 빈 파일 그대로 `idle-pilot-result.json`에 보존했다. 오류를 JSON 성공 결과로 재구성하거나 가짜 번들을 만들지 않았다.

- 실제 ppgen stdout: `assets/images/resource-refinement/perfectpixel/idle-pilot-result.json` (0 bytes)
- stdout SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- 실제 ppgen stderr: `assets/images/resource-refinement/perfectpixel/idle-pilot-stderr.log`
- stderr SHA-256: `85a16474b29d0441659b84a935d37338f33511085d5058ba502582db2abeb956`
- 생성 출력 디렉터리: 생성되지 않음

## Provider blocker

`skill://perfectpixel` 문서는 `god-tibo-imagen`과 로컬 `~/.codex/auth.json` 사용을 안내하지만, `install.sh`가 제공한 실제 ppgen 바이너리는 해당 provider를 지원하지 않는다. 바이너리 도움말도 provider 플래그를 `gemini|openrouter|fal|byteplus`로 제한하고, capability JSON 역시 `god-tibo-imagen`을 열거하지 않는다. 따라서 이 실패는 인증 만료, 프롬프트, 모델 응답 또는 생성 품질 문제가 아니라 **설치 산출물과 스킬 계약 사이의 provider 기능 불일치**다.

지원 목록에 있는 Gemini fallback도 비밀값을 출력하지 않고 환경변수 존재 여부만 검사했다. `GEMINI_API_KEY=false`, `GOOGLE_API_KEY=false`였으므로 인증 가능한 Gemini 시범은 실행할 수 없었다. 요구된 provider를 몰래 바꾸거나 `dummy` 키로 성공 산출물을 가장하지 않았다.

요청 계약상 `idle` 시범 성공 후에만 동일 정체성의 `idle,walk,attack` 전체 번들을 생성해야 하므로, 실패 뒤 지원되지 않는 다른 provider로 대체하거나 전체 생성을 강행하지 않았다.

## 품질 검사

| 항목 | 요구/검사 기준 | 실제 결과 | 판정 |
|---|---|---|---|
| `idle` 프레임 | preset 기준 4 frames, 6 fps, loop | 프레임 미생성 | NOT ASSESSED |
| `walk` 프레임 | preset 기준 6 frames, 10 fps, loop | 시범 실패로 실행하지 않음 | NOT ASSESSED |
| `attack` 프레임 | preset 기준 5 frames, 12 fps, non-loop | 시범 실패로 실행하지 않음 | NOT ASSESSED |
| 투명 배경 | 모든 frame PNG에서 alpha 배경 확인 | PNG 미생성 | NOT ASSESSED |
| atlas/manifest | atlas, manifest, frame 경로 및 frame count 상호 일치 | 번들 미생성 | NOT ASSESSED |
| identity drift | obsidian armor, cyan soul flame, asymmetric silhouette, no-magenta 정체성의 프레임/상태 간 유지 | 비교 가능한 이미지 없음 | NOT ASSESSED |
| 마젠타 오염 | 캐릭터 내부에 magenta/pink/purple 계열 잔존 없음 | 비교 가능한 이미지 없음 | NOT ASSESSED |

## 저사양 2D 대체 후보 판정

현재 출력은 렌더 비용, atlas 크기, 프레임 연속성, 투명 매팅, 정체성 일관성을 측정할 수 없는 상태다. 따라서 PerfectPixel 결과를 painterly GLB bridge의 대체물로 채택하거나 런타임에 연결할 근거가 없다. **이번 사이클에서는 현 GLB bridge를 유지하고 PerfectPixel 후보는 NOT SCORED로 남긴다.**

재평가의 최소 전제는 `install.sh`가 `god-tibo-imagen`을 실제로 열거하고 수락하는 ppgen을 제공하는 것이다. 그 전제가 충족되면 동일 프롬프트로 `idle` 단일 상태를 다시 통과시킨 뒤에만 `idle,walk,attack`으로 확장해야 한다.

## 로컬 검증

다음 Python eval 셀로 보존된 ppgen JSON이 유효하고, 요청 provider가 실제 capability 목록에 없으며, provider 오류가 정확히 기록되었고, 가짜 이미지/atlas/manifest가 존재하지 않음을 확인했다.

```python
import json
from pathlib import Path
root = Path('assets/images/resource-refinement/perfectpixel')
caps = json.loads((root / 'ppgen-capabilities.json').read_text())
assert 'god-tibo-imagen' not in caps['providers']
assert (root / 'idle-pilot-result.json').stat().st_size == 0
assert (root / 'idle-pilot-stderr.log').read_text().strip() == 'ppgen 실패: 지원하지 않는 프로바이더입니다: god-tibo-imagen'
assert not list(root.rglob('*.png'))
assert not list(root.rglob('*.gif'))
assert not list(root.rglob('*.apng'))
assert not list(root.rglob('manifest.json'))
display({'providers': caps['providers'], 'generated_media': 0, 'blocker_verified': True})
```

관측 결과:

```text
{'providers': ['gemini', 'openai', 'openrouter', 'fal', 'byteplus'], 'generated_media': 0, 'blocker_verified': True}
```
