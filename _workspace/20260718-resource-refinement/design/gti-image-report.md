# GTI Image Report — Abyssal Surge Resource Refinement

- 실행일: 2026-07-18
- 상태: **실제 생성 성공**
- 산출물: `assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png`
- 공유 매니페스트·런타임 파일: 수정하지 않음

## 1. 설치 및 인증 확인

| 항목 | 확인 결과 |
|---|---|
| CLI 경로 | `/Users/jangyoung/.nvm/versions/node/v22.19.0/bin/gti` |
| npm 패키지 | `god-tibo-imagen@0.3.0` |
| Node.js | `v22.19.0` (요구 조건 Node.js 20+ 충족) |
| Codex 인증 파일 | `/Users/jangyoung/.codex/auth.json` 존재 확인; 파일 내용·토큰은 열거나 기록하지 않음 |
| 인증 유효성 | 실제 `private-codex` 생성 요청이 HTTP 200으로 완료되어 확인됨 |

확인 명령과 관찰 결과:

```text
$ command -v gti
/Users/jangyoung/.nvm/versions/node/v22.19.0/bin/gti

$ npm list -g god-tibo-imagen --depth=0
/Users/jangyoung/.nvm/versions/node/v22.19.0/lib
└── god-tibo-imagen@0.3.0

$ node --version
v22.19.0
```

`gti --version`은 이 CLI가 해당 옵션을 제공하지 않아 `Error: Unknown argument: --version`으로 종료했다. 따라서 설치 버전은 npm의 전역 패키지 메타데이터로 확인했다. 이미 요구 버전과 실행 파일이 설치되어 있어 재설치는 하지 않았다.

## 2. 원본 프롬프트

정본 프롬프트 파일:

`assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.prompt.txt`

SHA-256:

`ad192c8f577260cf51e3e4835fd48e8f10bbbe21f2944aef07282e443161750e`

실제 요청에 전달한 원문:

```text
Create an original dark-fantasy cinematic key art hero frame titled only in metadata, never as visible text: “Abyssal Surge resource-forging hero frame.” Use the supplied cinder-span image only as a reference for widescreen scale, deep violet versus furnace-crimson color tension, storm-dark atmosphere, and monumental depth; do not reproduce its character, architecture, portal, army, silhouette, composition, or any recognizable intellectual property.

Scene: one vast abyssal forge carved into black volcanic rock, viewed in a dramatic 16:9 wide composition from a low three-quarter angle. At the visual center, an entirely original masked forge-keeper in practical soot-black armor raises a luminous forging crucible above an anvil-like altar. Four production resources visibly converge into one coherent act of creation: (1) silver wireframe mesh topology and faceted 3D fragments spiral in from the upper left; (2) crisp pixel-art sprite frames, shown as small translucent sequential animation cells with an original non-branded creature silhouette, arc in from the lower left; (3) an amber-cyan sound waveform becomes a physical ribbon of resonant light flowing from the lower right; and (4) a short strip of original blank-edged film frames, each containing abstract storm, ember, and ocean imagery with no logos or characters, sweeps from the upper right. All four streams are being hammered into one molten, wave-shaped artifact above the altar, making “resource refinement” readable through imagery alone.

Art direction: premium original game key art, painterly realism with precise material detail, volcanic glass, hammered iron, airborne ash, salt mist, sparks, restrained bioluminescence, deep blacks, indigo-violet shadows, controlled crimson forge light, cyan accents, high silhouette clarity, strong foreground/midground/background separation, one unmistakable focal point, cinematic volumetric light, believable perspective, no generic glowing portal. The abyss feels maritime and bottomless, with a distant surge of black water suspended behind the forge like a cathedral wall.

Composition and safety: exact 16:9 landscape; keep essential subject matter inside a central safe area; no visible words, letters, UI, logos, brands, watermarks, signatures, franchise costumes, famous characters, copyrighted emblems, gore, or sexual content. Make every character, prop, architecture motif, sprite silhouette, film image, and symbol wholly original. Avoid visual clutter, duplicated limbs, malformed hands, illegible pseudo-text, and reference-image mimicry.
```

## 3. 모델 및 입력 출처

| 항목 | 값 |
|---|---|
| 제공자 | `private-codex` |
| 모델 | `gpt-5.4` |
| 요청 출력 형식 | PNG |
| 요청 크기 | `2048x1152` (16:9) |
| 입력 참조 | `assets/images/cinder-span.png` |
| 입력 참조 형식 | PNG, 1672×941, RGB 8-bit, non-interlaced |
| 입력 참조 SHA-256 | `f6355a83db9568f22c0a32e5cf537377813c4e3af4a22bd5c8e9442f70fa9c36` |
| 참조 사용 범위 | 화면 규모, violet/crimson 색 긴장, 폭풍성 대기, 기념비적 깊이만 참고하도록 제한 |
| 명시적 금지 | 참조의 캐릭터·건축·포털·군대·실루엣·구도 복제, 인식 가능한 IP, 브랜드·로고·워터마크·문자 |

## 4. Dry-run — PASS

실행 명령:

```text
gti --provider private-codex --model gpt-5.4 --size 2048x1152 \
  --prompt "<정본 프롬프트 원문>" \
  --image assets/images/cinder-span.png \
  --output assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png \
  --dry-run
```

관찰 결과:

- 종료 코드: `0`
- 모드: `dry-run`
- 경고 배열: `[]`
- 요청 URL: `https://chatgpt.com/backend-api/codex/responses`
- 요청 모델: `gpt-5.4`
- 입력: `input_text` 1개 + redacted `input_image` 1개
- 이미지 도구: `output_format: png`, `size: 2048x1152`
- 인증·계정·세션·설치 ID 및 이미지 데이터는 CLI 출력에서 redacted 처리됨

## 5. 실제 생성 — PASS

실행 명령:

```text
gti --provider private-codex --model gpt-5.4 --size 2048x1152 \
  --prompt "<정본 프롬프트 원문>" \
  --image assets/images/cinder-span.png \
  --output assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png \
  --debug \
  --debug-dir assets/images/resource-refinement/gti/debug
```

관찰 결과:

| 항목 | 결과 |
|---|---|
| 제공자 상태 | **PASS — HTTP 200** |
| 제공자 오류 | 없음 |
| provider | `private-codex` |
| response ID | `resp_0c09c40b6e8c265e016a5b88f192ac81918ebc2e15432f9cc8` |
| 응답 종료 이벤트 | `response.completed: 1` |
| 이미지 생성 결과 | `hasResult: true` |
| revised prompt | `hasRevisedPrompt: true` |
| 저장 경로 | `assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png` |

Sanitized debug 증거:

| 파일 | SHA-256 |
|---|---|
| `assets/images/resource-refinement/gti/debug/request.json` | `7300583b5958f5de2233dbd9dcddd33eab24a60416e084bbc9021f98e3b37006` |
| `assets/images/resource-refinement/gti/debug/response.json` | `c779e5f80e7075dda2d385912e710b1a763bb3721bb60bc7c70a66c80e759db7` |

## 6. PNG 무결성 및 디코딩 검증

최종 PNG SHA-256:

`df5d800274253512d474d0e45180c4991cc69857b87e435b0cb356d17cff65d2`

검증 명령과 관찰 결과:

```text
$ file assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png
PNG image data, 1672 x 941, 8-bit/color RGB, non-interlaced

$ sips -g format -g pixelWidth -g pixelHeight assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png
format: png
pixelWidth: 1672
pixelHeight: 941

$ shasum -a 256 assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png
df5d800274253512d474d0e45180c4991cc69857b87e435b0cb356d17cff65d2
```

`file`, macOS ImageIO 기반 `sips`, 리포트 작성 전 이미지 디코더 표시까지 모두 성공했다. 제공자는 요청한 2048×1152 대신 1672×941을 반환했다. 실제 비율은 약 1.7768:1로 16:9(약 1.7778:1)에 실질적으로 일치하지만, 전달 해상도는 요청값과 다르므로 그대로 기록한다.

## 7. 콘셉트 아트 점검

디코딩한 최종 이미지를 육안 점검했다.

- 중앙 forge-keeper와 crucible/anvil이 단일 초점을 형성한다.
- 좌상단 wireframe mesh, 좌측 sprite animation cells, 우측 cyan/amber sound waveform, 우상단 film strip이 하나의 심연 대장간에서 중앙 용광로로 수렴한다.
- 검은 바다·폭풍·화산성 금속·violet/crimson/cyan 팔레트가 요청한 다크 판타지 자원 제련 주제를 전달한다.
- 보이는 단어, UI, 로고, 브랜드, 워터마크, 서명, 유명 캐릭터나 프랜차이즈 문장은 관찰되지 않았다.
- 참조 이미지의 붉은 포털, 군대, 좌측 지휘자 실루엣 및 원래 구도는 재현되지 않았다.
- 인물의 양손과 주요 실루엣은 판독 가능하고, 중앙 안전 영역 안에 핵심 피사체가 유지된다.

이 점검은 시각적 품질·명시적 금지 요소 검토이며 법률적 IP 클리어런스를 대신하지 않는다.

## 8. 최종 판정

- Dry-run: **PASS**
- Provider 실제 생성: **PASS (HTTP 200, provider 오류 없음)**
- PNG 저장: **PASS**
- PNG 디코딩: **PASS**
- SHA-256/provenance 기록: **PASS**
- 프로젝트 전체 테스트: 요구대로 실행하지 않음
