(function () {
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const e = React.createElement;
  if (typeof window !== "undefined" && !window.location) {
    window.location = { hostname: "" };
  }

  function BackgroundLayer() {
    return e('div', { className: 'medieval-bg-layer' },
      e('div', { id: 'liquid-ether-bg', className: 'liquid-ether-container', 'aria-hidden': 'true' }),
      e('canvas', { id: 'particles-canvas', 'aria-hidden': 'true' })
    );
  }

  function GameHeader() {
    return e('header', { className: 'site-header medieval-header' },
      e('div', null,
        e('p', { className: 'eyebrow', 'data-i18n': 'header.eyebrow' }, '오리지널 심연 RTS-RPG'),
        e('h1', { className: 'shiny-text' }, 'Abyssal Command'),
        e('p', { className: 'subtitle shiny-text', 'data-i18n': 'header.subtitle' }, '가라앉은 문을 차지하라')
      ),
      e('div', { className: 'header-controls' },
        e('button', {
          id: 'bgm-toggle',
          type: 'button',
          className: 'ghost-toggle',
          'aria-pressed': 'false',
          'data-i18n-aria': 'bgmToggle.aria',
          'aria-label': 'Toggle epic theme music'
        },
          e('span', { className: 'ghost-toggle-icon', 'aria-hidden': 'true' }, '♪'),
          ' ',
          e('span', { 'data-i18n': 'bgmToggle.label' }, '배경음악')
        ),
        e('button', {
          id: 'lang-toggle',
          type: 'button',
          className: 'ghost-toggle',
          'aria-pressed': 'false',
          'data-i18n-aria': 'langToggle.aria',
          'aria-label': 'Switch to English'
        }, 'EN'),
        e('p', { id: 'build-label', className: 'build-label', 'data-i18n': 'header.buildLabel' }, '오프라인 캠페인 준비 완료')
      )
    );
  }

  function CampaignLobby() {
    return e('section', {
      id: 'campaign-lobby',
      className: 'panel lobby-panel medieval-lobby',
      'aria-labelledby': 'campaign-title'
    },
      e('p', { className: 'eyebrow', 'data-i18n': 'lobby.eyebrow' }, '10단계 캠페인'),
      e('h2', { id: 'campaign-title', 'data-i18n': 'lobby.title' }, '가라앉은 문을 차지하라'),
      e('div', {
        id: 'campaign-resume-summary',
        className: 'campaign-resume-summary lobby-hero-resume',
        hidden: true,
        'aria-live': 'polite'
      },
        e('p', { className: 'campaign-resume-summary-heading', 'data-i18n': 'lobby.activeRun' }, '진행 중인 로컬 캠페인'),
        e('dl', null,
          e('div', null,
            e('dt', { 'data-i18n': 'lobby.resumeStageLabel' }, '스테이지'),
            e('dd', { id: 'campaign-resume-stage' })
          ),
          e('div', null,
            e('dt', { 'data-i18n': 'lobby.resumeStatusLabel' }, '상태'),
            e('dd', { id: 'campaign-resume-status' })
          ),
          e('div', { id: 'campaign-resume-boss-row', hidden: true },
            e('dt', { 'data-i18n': 'lobby.resumeBossLabel' }, '다음 위협'),
            e('dd', null,
              e('img', { id: 'campaign-resume-boss-portrait', alt: '', className: 'campaign-resume-boss-portrait', hidden: true }),
              e('span', { id: 'campaign-resume-boss-name' })
            )
          )
        )
      ),
      e('p', { className: 'lede', 'data-i18n': 'lobby.lede' }, '신더 스팬부터 게이트 제니스까지 열 개 전장을 가로질러 그림자 군단을 지휘하라. 모든 행동은 결정론적이며 터치와 키보드 모두로 조작할 수 있고, 기록은 이 기기에만 남는다.'),
      e('div', { className: 'button-row lobby-hero-controls' },
        e('button', {
          id: 'start-campaign',
          className: 'primary',
          type: 'button',
          'aria-describedby': 'campaign-description',
          'data-i18n': 'lobby.startButton'
        }, '새 캠페인 시작'),
        e('button', {
          id: 'resume-campaign',
          type: 'button',
          hidden: true,
          'data-i18n': 'lobby.resumeButton'
        }, '로컬 캠페인 이어하기')
      ),
      e('div', { className: 'cinematic-control cinematic-theater-container' },
        e('button', {
          id: 'play-cinematic',
          type: 'button',
          'aria-controls': 'campaign-cinematic',
          'data-i18n': 'lobby.cinematicButton'
        }, '선택형 캠페인 시네마틱 재생'),
        e('button', {
          id: 'toggle-cinematic-transcript',
          type: 'button',
          'aria-controls': 'cinematic-transcript',
          'aria-expanded': 'false',
          'data-i18n': 'lobby.cinematicTranscriptToggle'
        }, '시네마틱 시각 설명문 보기'),
        e('video', {
          id: 'campaign-cinematic',
          className: 'cinematic-theater-video',
          muted: true,
          playsInline: true,
          controls: true,
          preload: 'none',
          poster: 'assets/images/cinder-span.png',
          hidden: true,
          'aria-label': '선택형 캠페인 시네마틱',
          'data-i18n-aria': 'lobby.cinematicAria'
        },
          e('track', {
            kind: 'captions',
            srcLang: 'ko',
            label: '한국어 자막',
            src: 'assets/video/abyssal-surge-cinematic.ko.vtt',
            default: true,
            'data-i18n-label': 'lobby.cinematicTrackLabelKo'
          }),
          e('span', { 'data-i18n': 'lobby.cinematicUnavailable' }, '시네마틱을 재생할 수 없습니다.'),
          e('a', { href: 'assets/video/abyssal-surge-cinematic.mp4', 'data-i18n': 'lobby.cinematicOpenMp4' }, 'MP4 파일 열기')
        ),
        e('p', { id: 'cinematic-fallback', className: 'hint', hidden: true },
          e('span', { 'data-i18n': 'lobby.cinematicPlaybackUnavailable' }, '영상 재생을 사용할 수 없습니다.'),
          e('a', { href: 'assets/video/abyssal-surge-cinematic.mp4', 'data-i18n': 'lobby.cinematicOpenRepresentativeMp4' }, '대표 MP4 직접 열기'),
          e('span', { 'data-i18n': 'lobby.cinematicTranscriptAlternative' }, '또는 시각 설명문을 이용하세요.')
        ),
        e('section', {
          id: 'cinematic-transcript',
          className: 'cinematic-transcript cinematic-theater-transcript',
          'aria-labelledby': 'cinematic-transcript-heading',
          tabIndex: -1,
          hidden: true
        },
          e('h3', { id: 'cinematic-transcript-heading', 'data-i18n': 'lobby.cinematicTranscriptHeading' }, '시네마틱 시각 설명문'),
          e('p', { id: 'cinematic-transcript-intro', className: 'hint', 'data-i18n': 'lobby.cinematicTranscriptIntro' }, '시네마틱은 선택 사항입니다. 아래 설명문은 영상과 소리 없이도 캠페인 브리핑을 전달합니다.'),
          e('p', { className: 'hint', 'data-i18n': 'lobby.cinematicTranscriptSummary' }, '대표 시네마틱은 신더 스팬, 베일 시타델, 메아리 왕좌의 세 전장을 19초 몽타주로 요약합니다.'),
          e('ol', null,
            e('li', null,
              e('strong', { 'data-i18n': 'lobby.cinematicTranscriptTime1' }, '00:00–00:06.5 · 신더 스팬.'),
              ' ',
              e('span', { 'data-i18n': 'lobby.cinematicTranscriptDesc1' }, '붉은 게이트 앞에서 그림자 군주와 군단이 첫 사냥을 시작합니다.')
            ),
            e('li', null,
              e('strong', { 'data-i18n': 'lobby.cinematicTranscriptTime2' }, '00:06.5–00:12.5 · 베일 시타델.'),
              ' ',
              e('span', { 'data-i18n': 'lobby.cinematicTranscriptDesc2' }, '보랏빛 성채의 두 거점을 향해 군세가 전진합니다.')
            ),
            e('li', null,
              e('strong', { 'data-i18n': 'lobby.cinematicTranscriptTime3' }, '00:12.5–00:19.02 · 메아리 왕좌.'),
              ' ',
              e('span', { 'data-i18n': 'lobby.cinematicTranscriptDesc3' }, '군주의 영역을 펼쳐 게이트 소버린과의 결전을 준비합니다.')
            )
          ),
          e('p', { id: 'cinematic-transcript-brief', className: 'hint', 'data-i18n': 'lobby.cinematicTranscriptBrief' }, '캠페인 명령: 신더 스팬에서 사냥과 추출을 시작하고, 베일 시타델에서 두 거점을 장악한 뒤, 메아리 왕좌에서 군주의 영역으로 게이트 소버린에 맞섭니다.')
        ),
        e('p', { id: 'cinematic-status', className: 'hint', 'aria-live': 'polite', 'data-i18n': 'lobby.cinematicStatus' }, '시네마틱은 선택 사항이며 처음에는 음소거됩니다.')
      ),
      e('p', { id: 'campaign-description', className: 'hint', 'data-i18n': 'lobby.description' }, '새 캠페인을 시작하면, 확인 후 현재 로컬 진행 상황이 대체됩니다.'),
      e('div', { className: 'campaign-map-section war-table-container' },
        e('h3', { className: 'shiny-text', 'data-i18n': 'map.heading' }, '캠페인 지도 & 이동 경로'),
        e('p', { className: 'hint', 'data-i18n': 'map.hint' }, '파편화된 심연 도시를 가로지르는 황혼의 감시자의 여정.'),
        e('div', { className: 'campaign-map-grid war-table-grid' },
          [
            { id: 1, name: 'cinder-span', file: 'cinder-span.png', alt: 'Cinder Span' },
            { id: 2, name: 'veil-citadel', file: 'veil-citadel.png', alt: 'Veil Citadel' },
            { id: 3, name: 'echo-throne', file: 'echo-throne.png', alt: 'Echo Throne' },
            { id: 4, name: 'sunken-bastion', file: 'sunken-bastion.png', alt: 'Sunken Bastion' },
            { id: 5, name: 'howling-sprawl', file: 'howling-sprawl.png', alt: 'Howling Sprawl' },
            { id: 6, name: 'glass-necropolis', file: 'glass-necropolis.png', alt: 'Glass Necropolis' },
            { id: 7, name: 'starless-canal', file: 'starless-canal.png', alt: 'Starless Canal' },
            { id: 8, name: 'shattered-causeway', file: 'shattered-causeway.png', alt: 'Shattered Causeway' },
            { id: 9, name: 'abyss-chancel', file: 'abyss-chancel.png', alt: 'Abyss Chancel' },
            { id: 10, name: 'gate-zenith', file: 'gate-zenith.png', alt: 'Gate Zenith' }
          ].reduce(function (acc, stage, idx) {
            if (idx > 0) {
              acc.push(e('div', { key: 'conn-' + idx, className: 'map-connector' }, e('span', { className: 'connector-arrow' }, '➔')));
            }
            acc.push(
              e('div', {
                key: 'node-' + stage.id,
                className: 'map-node war-table-node',
                id: 'map-node-' + stage.id,
                'data-stage-number': String(stage.id),
                'data-node-status': stage.id === 1 ? 'current' : 'locked'
              },
                e('div', { className: 'map-node-image-wrapper' },
                  e('img', { src: 'assets/images/' + stage.file, alt: stage.alt, className: 'map-node-image' }),
                  e('div', { className: 'map-node-badge', 'data-i18n': 'map.stage' + stage.id + 'Badge' }, stage.id + '단계'),
                  e('span', { className: 'map-node-status' })
                ),
                e('h4', { 'data-i18n': 'map.node' + stage.id + 'Title' }, stage.alt),
                e('p', { 'data-i18n': 'map.node' + stage.id + 'Desc' })
              )
            );
            return acc;
          }, [])
        )
      ),
      e('div', { className: 'storyboard-section' },
        e('h3', { className: 'shiny-text', 'data-i18n': 'storyboard.heading' }, '황혼의 감시자 실록'),
        e('p', { className: 'hint', 'data-i18n': 'storyboard.hint' }, '그림자 추출과 전술 빙의 루프의 시각 기록.'),
        e('div', { className: 'storyboard-grid' },
          [
            { id: '00', name: 'opening_gate', title: '00. 문이 열리다', desc: '달의 균열이 해안 지구로 메아리 심연의 물질을 방출한다.', alt: 'Opening Gate', file: 'scene_00_opening_gate_v01.jpg' },
            { id: '01', name: 'soul_pool', title: '01. 영혼 추출', desc: '재의 메아리를 처치하고 감시자의 "결속" 명령으로 군단을 실체화하라.', alt: 'Soul Extraction', file: 'scene_01_soul_pool_v01.jpg' },
            { id: '03', name: 'possession_action', title: '03. 전술 빙의', desc: '그림자 유닛을 직접 조종해 정밀한 전투 기동을 수행하라.', alt: 'Possession', file: 'scene_03_possession_action_v01.jpg' },
            { id: '04', name: 'domain_shift', title: '04. 영역 전환', desc: '군주의 영역을 발동해 군단에게 일시적 무적을 부여하라.', alt: 'Lord\'s Domain', file: 'scene_04_domain_shift_v01.jpg' },
            { id: '07', name: 'return_ui', title: '07. 귀환과 계승', desc: '심연의 성소로 귀환해 영구 그림자 수용력을 강화하라.', alt: 'Return to Shrine', file: 'scene_07_return_ui_v01.jpg' }
          ].map(function (card) {
            return e('div', { key: card.id, className: 'storyboard-card' },
              e('img', { src: 'assets/images/storyboard/' + card.file, alt: card.alt }),
              e('div', { className: 'card-content' },
                e('h5', { 'data-i18n': 'storyboard.card' + card.id + 'Title' }, card.title),
                e('p', { 'data-i18n': 'storyboard.card' + card.id + 'Desc' }, card.desc)
              )
            );
          })
        )
      ),
      e('div', { className: 'feature-preview-section' },
        e('h3', { className: 'shiny-text', 'data-i18n': 'features.heading' }, '예정된 사령부 체계'),
        e('p', { className: 'hint', 'data-i18n': 'features.hint' }, '심연 저편에서 구상 중인 확장 시스템의 미리보기.'),
        e('div', { className: 'feature-preview-grid' },
          e('article', {
            id: 'shop-root',
            className: 'feature-card feature-card-shop relic-shop-container relic-shop-host'
          },
            e('span', { className: 'feature-tag', 'data-i18n': 'features.shop.tag' }, '예정'),
            e('h4', { 'data-i18n': 'features.shop.title' }, '상점 · 교환소'),
            e('p', { 'data-i18n': 'features.shop.body' }, '거둔 영혼과 파편을 바쳐 군단의 외형과 힘을 해금할 교환소가 열립니다.')
          ),
          e('article', { className: 'feature-card feature-card-communication' },
            e('span', { className: 'feature-tag', 'data-i18n': 'features.communication.tag' }, '구상 중'),
            e('h4', { 'data-i18n': 'features.communication.title' }, '교신 · 군단 결속'),
            e('p', { 'data-i18n': 'features.communication.body' }, '언젠가 황혼의 감시자들이 유령 메아리를 남기고 군단의 결속을 맺게 됩니다.')
          ),
          e('article', { className: 'feature-card feature-card-interface' },
            e('span', { className: 'feature-tag', 'data-i18n': 'features.interface.tag' }, '예정'),
            e('h4', { 'data-i18n': 'features.interface.title' }, '사령부 형상 개조'),
            e('p', { 'data-i18n': 'features.interface.body' }, '명령 패널 배치와 심연 테마, 접근성 설정으로 사령부를 당신의 방식으로 빚으십시오.')
          )
        )
      ),
      e('div', { className: 'codex-section', 'aria-labelledby': 'codex-heading' },
        e('h3', { id: 'codex-heading', className: 'shiny-text', 'data-i18n': 'guide.codex.heading' }, '심연 지식체'),
        e('p', { className: 'hint', 'data-i18n': 'guide.codex.hint' }, '전장에 나서기 전, 행동 순서와 필드 아이템, 전술 스킬을 미리 확인하십시오.'),
        e('div', { className: 'codex-subsection' },
          e('h4', { 'data-i18n': 'guide.actions.heading' }, '행동 순서'),
          e('p', { className: 'hint', 'data-i18n': 'guide.actions.hint' }, '사냥으로 흔적을 찾고, 추출로 영혼을 모으고, 실체화로 군단을 일으킨 뒤 거점을 점거하십시오.'),
          e('ol', { className: 'codex-action-loop' },
            [
              { id: 'hunt', icon: 'action-hunt.png', name: 'command.hunt.name', label: '사냥', desc: 'command.hunt.desc', text: '균열 흔적 두 곳을 탐색' },
              { id: 'extract', icon: 'action-extract.png', name: 'command.extract.name', label: '추출', desc: 'command.extract.desc', text: '그림자 은닉처를 확보' },
              { id: 'materialize', icon: 'action-materialize.png', name: 'command.materialize.name', label: '실체화', desc: 'command.materialize.desc', text: '그림자 군단을 소환' },
              { id: 'capture', icon: 'action-capture.png', name: 'command.capture.name', label: '점거', desc: 'command.capture.desc', text: '기술 거점을 고정' },
              { id: 'possess', icon: 'action-possess.png', name: 'command.possess.name', label: '빙의', desc: 'command.possess.desc', text: '2단계에서 해금' },
              { id: 'domain', icon: 'action-domain.png', name: 'command.domain.name', label: '군주의 영역', desc: 'command.domain.desc', text: '3단계에서 1회 사용' },
              { id: 'assault', icon: 'action-assault.png', name: 'command.assault.name', label: '총공격', desc: 'command.assault.desc', text: '스테이지 보스를 무너뜨림' }
            ].map(function (act) {
              return e('li', { key: act.id, className: 'codex-action-card' },
                e('img', { src: 'assets/images/ui/' + act.icon, alt: '', className: 'codex-action-icon' }),
                e('div', null,
                  e('strong', { 'data-i18n': act.name }, act.label),
                  e('small', { 'data-i18n': act.desc }, act.text)
                )
              );
            })
          )
        ),
        e('div', { className: 'codex-subsection' },
          e('h4', { 'data-i18n': 'guide.items.heading' }, '필드 아이템'),
          e('p', { className: 'hint', 'data-i18n': 'guide.items.hint' }, '웨이브를 처치하면 상자가 등장합니다. 상자를 열어 아래 여섯 효과 중 하나를 획득하십시오.'),
          e('ul', { className: 'codex-item-grid' },
            [
              { id: 'void-blade', glyph: '\u2694', effectType: 'ATTACK', name: 'item.void-blade.name', label: '공허의 칼날', desc: 'item.void-blade.description', text: '총공격력 증가', effectText: '총공격 강화' },
              { id: 'iron-resolve', glyph: '\uD83D\uDEE1', effectType: 'DEFENSE', name: 'item.iron-resolve.name', label: '강철의 결의', desc: 'item.iron-resolve.description', text: '방어력 증가', effectText: '요새 보호벽' },
              { id: 'tempest-boots', glyph: '\u26A1', effectType: 'HASTE', name: 'item.tempest-boots.name', label: '폭풍의 장화', desc: 'item.tempest-boots.description', text: '쿨다운 가속 및 속도 증가', effectText: '가속' },
              { id: 'aegis-shield', glyph: '\u2726', effectType: 'INVINCIBLE', name: 'item.aegis-shield.name', label: '이지스의 방패', desc: 'item.aegis-shield.description', text: '다음 피해 무효화', effectText: '무적' },
              { id: 'shadow-cloak', glyph: '\uD83D\uDCA8', effectType: 'EVASION', name: 'item.shadow-cloak.name', label: '그림자 망토', desc: 'item.shadow-cloak.description', text: '보스 타격 회피', effectText: '회피' },
              { id: 'crippling-curse', glyph: '\u2620', effectType: 'DEBUFF', name: 'item.crippling-curse.name', label: '무력화의 저주', desc: 'item.crippling-curse.description', text: '적 공격력 약화', effectText: '적 디버프' }
            ].map(function (item) {
              return e('li', { key: item.id, className: 'codex-item-card' },
                e('span', { className: 'codex-item-glyph codex-item-glyph--' + item.effectType.toLowerCase(), 'aria-hidden': 'true' }, item.glyph),
                e('div', null,
                  e('strong', { 'data-i18n': item.name }, item.label),
                  e('small', { 'data-i18n': item.desc }, item.text),
                  e('span', { className: 'codex-item-effect', 'data-i18n': 'effect.' + item.effectType }, item.effectText)
                )
              );
            })
          )
        ),
        e('div', { className: 'codex-subsection' },
          e('h4', { 'data-i18n': 'guide.skills.heading' }, '전술 스킬 & 소환수 진화'),
          e('p', { className: 'hint', 'data-i18n': 'guide.skills.hint' }, '전술 휘장으로 지휘력·요새화·기동력을 강화하고, 소환 정수로 소환수를 진화시키십시오.'),
          e('ul', { className: 'codex-skill-grid' },
            [
              { id: 'command', kind: 'tactical', name: 'tactical.skill.command', label: '지휘력', desc: 'tactical.skill.commandDesc', text: '지휘 대기열을 확장하며, 소환수 공격 및 버프를 증폭하고 적의 디버프 효과를 상쇄합니다.' },
              { id: 'fortification', kind: 'tactical', name: 'tactical.skill.fortification', label: '요새화', desc: 'tactical.skill.fortificationDesc', text: '방어 타워 및 바리케이드 성능을 강화하고 쉴드 충전량, 일시적 무적 부여 및 상자 획득을 보호합니다.' },
              { id: 'mobility', kind: 'tactical', name: 'tactical.skill.mobility', label: '기동력', desc: 'tactical.skill.mobilityDesc', text: '사령관의 이동 속도를 향상시키고 보스 타격에 대한 회피를 극대화하며 웨이브 중 쿨다운을 줄입니다.' },
              { id: 'ember-scion', kind: 'summon', name: 'summon.recipe.ember-scion.name', label: '잿불 후예', desc: 'summon.recipe.ember-scion.description', text: '실체화 시 추가 그림자를 소환합니다.' },
              { id: 'rift-hound', kind: 'summon', name: 'summon.recipe.rift-hound.name', label: '균열 사냥개', desc: 'summon.recipe.rift-hound.description', text: '총공격 피해를 강화합니다.' },
              { id: 'ward-wisp', kind: 'summon', name: 'summon.recipe.ward-wisp.name', label: '수호 도깨비불', desc: 'summon.recipe.ward-wisp.description', text: '보스의 반격 피해를 줄입니다.' }
            ].map(function (skill) {
              return e('li', { key: skill.id, className: 'codex-skill-card codex-skill-card--' + skill.kind },
                e('strong', { 'data-i18n': skill.name }, skill.label),
                e('small', { 'data-i18n': skill.desc }, skill.text)
              );
            })
          )
        )
      )
    );
  }

  function CampaignCockpit() {
    return e('section', {
      id: 'campaign-screen',
      className: 'cockpit battle-hud-cockpit',
      hidden: true,
      'aria-labelledby': 'stage-heading'
    },
      e('p', {
        id: 'fullscreen-status',
        className: 'sr-only',
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'true'
      }),
      e('div', { className: 'cockpit-top' },
        e('div', { className: 'cockpit-stage-id' },
          e('p', { id: 'stage-number', className: 'eyebrow' }, '3단계 중 1단계'),
          e('h2', { id: 'stage-heading', tabIndex: -1, className: 'shiny-text' }, 'Cinder Span'),
          e('p', { id: 'stage-region', className: 'muted' }),
          e('p', { id: 'commander-identity', className: 'commander-identity', 'data-i18n': 'screen.commanderIdentity' }, '황혼의 감시자 · 그림자 군단을 지휘 중')
        ),
        e('nav', {
          id: 'stage-selector',
          className: 'stage-selector',
          'aria-label': '캠페인 스테이지 진행 상태',
          'data-i18n-aria': 'stage.selectorAria'
        },
          e('ol', null,
            [
              { num: 1, title: 'map.node1Title', text: '신더 스팬' },
              { num: 2, title: 'map.node2Title', text: '베일 시타델' },
              { num: 3, title: 'map.node3Title', text: '메아리 왕좌' },
              { num: 4, title: 'map.node4Title', text: '선큰 바스티온' },
              { num: 5, title: 'map.node5Title', text: '하울링 스프롤' },
              { num: 6, title: 'map.node6Title', text: '글래스 네크로폴리스' },
              { num: 7, title: 'map.node7Title', text: '스타리스 커낼' },
              { num: 8, title: 'map.node8Title', text: '섀터드 코즈웨이' },
              { num: 9, title: 'map.node9Title', text: '어비스 챈슬' },
              { num: 10, title: 'map.node10Title', text: '게이트 제니스' }
            ].map(function (stage) {
              return e('li', { key: stage.num },
                e('button', {
                  id: 'stage-select-' + stage.num,
                  'data-stage-number': String(stage.num),
                  type: 'button',
                  disabled: true,
                  'aria-current': stage.num === 1 ? 'step' : undefined
                },
                  e('span', null, String(stage.num).padStart(2, '0')),
                  ' ',
                  e('span', { 'data-i18n': stage.title }, stage.text)
                )
              );
            })
          )
        ),
        e('dl', {
          className: 'battle-resource-bar',
          'aria-label': '전투 자원',
          'data-i18n-aria': 'status.resourceAria'
        },
          e('div', { 'data-resource': 'souls' },
            e('dt', { 'data-i18n': 'status.souls' }, '영혼'),
            e('dd', { id: 'souls-value' }, '0')
          ),
          e('div', { 'data-resource': 'legion' },
            e('dt', { 'data-i18n': 'status.legion' }, '군단 슬롯'),
            e('dd', { id: 'legion-value' }, '0 / 10')
          ),
          e('div', { 'data-resource': 'nodes' },
            e('dt', { 'data-i18n': 'status.nodes' }, '점거 거점'),
            e('dd', { id: 'nodes-value' }, '0 / 1')
          ),
          e('div', { 'data-resource': 'integrity' },
            e('dt', { 'data-i18n': 'status.integrity' }, '군주 내구도'),
            e('dd', { id: 'integrity-value' }, '10 / 10')
          ),
          e('div', { 'data-resource': 'boss' },
            e('img', {
              id: 'boss-portrait',
              className: 'resource-boss-portrait',
              src: 'assets/images/ui/boss-cinder-warden.png',
              alt: '',
              hidden: true
            }),
            e('dt', { id: 'boss-label' }, '보스 보호막'),
            e('dd', { id: 'boss-value' }, '8 / 8')
          )
        ),
        e('span', { id: 'battle-wave-indicator', className: 'wave-badge' }, '웨이브 1/3'),
        e('details', { className: 'campaign-heading-actions-menu' },
          e('summary', {
            className: 'campaign-heading-actions-trigger',
            'aria-label': '설정',
            'data-i18n-aria': 'screen.settingsMenu',
            title: '설정'
          }, '⚙'),
          e('div', { className: 'campaign-heading-actions' },
            e('button', {
              id: 'toggle-fullscreen',
              className: 'fullscreen-toggle',
              type: 'button',
              'aria-pressed': 'false',
              'aria-keyshortcuts': 'Shift+F',
              title: '전체 화면 시작 (Shift+F)',
              'data-i18n': 'screen.fullscreenEnter'
            }, '전체 화면'),
            e('button', {
              id: 'retry-stage',
              type: 'button',
              'aria-label': '현재 스테이지 재시도',
              'data-i18n-aria': 'screen.retryButton',
              'data-i18n': 'screen.retryButton'
            }, '스테이지 재시도'),
            e('button', {
              id: 'return-to-lobby',
              type: 'button',
              'data-i18n': 'screen.returnButton'
            }, '사령부로 돌아가기')
          )
        )
      ),
      e('div', {
        id: 'stage-briefing',
        className: 'mission-briefing',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'briefing-title',
        hidden: true
      },
        e('section', { className: 'panel mission-briefing-panel' },
          e('p', { className: 'eyebrow', 'data-i18n': 'briefing.eyebrow' }, '작전 브리핑'),
          e('h3', { id: 'briefing-title', 'data-i18n': 'briefing.title' }, '문이 열린다'),
          e('p', { className: 'commander-identity', 'data-i18n': 'screen.commanderIdentity' }, '황혼의 감시자 · 그림자 군단을 지휘 중'),
          e('p', { id: 'briefing-player-job', className: 'mission-briefing-player-job' }),
          e('p', { id: 'briefing-stage', className: 'mission-briefing-stage' }),
          e('p', { id: 'briefing-region', className: 'mission-briefing-region' }),
          e('dl', { className: 'mission-briefing-facts' },
            e('div', null,
              e('dt', { 'data-i18n': 'briefing.objectiveLabel' }, '목표'),
              e('dd', { id: 'briefing-objective' })
            ),
            e('div', null,
              e('dt', { 'data-i18n': 'briefing.operationLabel' }, '작전'),
              e('dd', { id: 'briefing-operation' })
            ),
            e('div', null,
              e('dt', { 'data-i18n': 'briefing.doctrineLabel' }, '교리'),
              e('dd', { id: 'briefing-doctrine' })
            ),
            e('div', null,
              e('dt', { 'data-i18n': 'briefing.bossLabel' }, '대상'),
              e('dd', { id: 'briefing-boss' })
            )
          ),
          e('p', { id: 'briefing-narration', className: 'mission-briefing-narration', 'aria-hidden': 'true' }),
          e('p', { id: 'briefing-next-order', className: 'mission-briefing-next', 'data-i18n': 'briefing.nextOrder' }, '첫 명령: 균열 흔적을 두 번 사냥해 영혼 은닉처를 드러내세요.'),
          e('button', {
            id: 'start-combat',
            className: 'primary',
            type: 'button',
            'data-i18n': 'briefing.startButton'
          }, '전투 개시')
        )
      ),
      e('div', { className: 'cockpit-main' },
        e('section', {
          id: 'battle-field',
          className: 'panel battle-field-panel battle-hud-panel',
          'aria-label': '3D 전술 전장',
          'data-i18n-aria': 'battle.fieldAria'
        },
          e('div', { id: 'canvas-container-3d', className: 'canvas-container-3d' },
            e('canvas', {
              id: 'battle-canvas-3d',
              tabIndex: 0,
              'aria-label': '실시간 전술 전장',
              'aria-keyshortcuts': '1 2 3 4 5 6 7',
              'data-i18n-aria': 'battle.canvasAria',
              'aria-describedby': 'battle-direct-help'
            }),
            e('canvas', {
              id: 'battle-canvas-fallback',
              tabIndex: 0,
              'aria-label': '전술 전장 대체 화면',
              'aria-keyshortcuts': '1 2 3 4 5 6 7',
              'data-i18n-aria': 'battle.fallbackCanvasAria',
              hidden: true
            }),
            e('canvas', {
              id: 'battle-object-feedback-canvas',
              'aria-hidden': 'true',
              style: { pointerEvents: 'none' }
            }),
            e('div', {
              id: 'battle-loading-screen',
              className: 'battle-loading-screen',
              role: 'status',
              'aria-live': 'polite',
              'data-i18n-aria': 'battle.loadingScreen.aria'
            },
              e('div', { className: 'battle-loading-screen__spinner', 'aria-hidden': 'true' }),
              e('p', { className: 'battle-loading-screen__title', 'data-i18n': 'battle.loadingScreen.title' }, '전장 불러오는 중'),
              e('p', { id: 'battle-loading-screen-hint', className: 'battle-loading-screen__hint', 'data-i18n': 'battle.loadingScreen.hint' }, '3D 전술 전장 자산을 준비하고 있습니다. 잠시만 기다려 주세요.')
            ),
            e('aside', {
              id: 'battle-visual-fallback',
              className: 'battle-visual-fallback',
              'aria-labelledby': 'battle-fallback-title',
              hidden: true
            },
              e('p', { className: 'battle-fallback-kicker', 'data-i18n': 'battle.fallback.kicker' }, '정적 전술 브리핑'),
              e('h4', { id: 'battle-fallback-title', 'data-i18n': 'battle.fallback.title' }, '렌더링을 사용할 수 없음'),
              e('p', { id: 'battle-fallback-operation', className: 'battle-operation', 'data-i18n': 'battle.cinderSpan.operation' }, '작전: 잿불 돌파'),
              e('p', { id: 'battle-fallback-doctrine', 'data-i18n': 'battle.cinderSpan.doctrine' }, '제련소 길을 열고 그림자를 일으켜 워든의 지배를 끊으십시오.'),
              e('dl', { className: 'battle-force-labels' },
                e('div', null,
                  e('dt', { 'data-i18n': 'battle.commandLabel' }, '지휘 부대'),
                  e('dd', { id: 'battle-fallback-ally-label' }, '그림자 군단')
                ),
                e('div', null,
                  e('dt', { 'data-i18n': 'battle.hostileLabel' }, '적대 세력'),
                  e('dd', { id: 'battle-fallback-hostile-label' }, '잿빛 수호대')
                )
              ),
              e('p', { className: 'battle-fallback-note', 'data-i18n': 'battle.fallback.note' }, '직접 렌더러를 사용할 수 없습니다. 전술 브리핑과 명령 패널은 활성 상태로 유지됩니다.')
            )
          ),
          e('div', {
            id: 'command-tutorial-alarm',
            className: 'command-tutorial-alarm',
            role: 'alert',
            'aria-live': 'assertive',
            hidden: true,
            'data-i18n-aria': 'tutorial.cameraSelectAria'
          },
            e('p', { className: 'command-tutorial-alarm__message', 'data-i18n': 'tutorial.cameraSelectHint' }, '명령을 실행하려면 카메라를 움직여 전장을 살피고, 대상 오브젝트나 부대를 선택하세요.')
          ),
          e('div', {
            id: 'battle-screen-ui',
            className: 'battle-screen-ui',
            'aria-label': '전장 화면 UI',
            'data-i18n-aria': 'fieldOverlay.aria'
          },
            e('section', {
              className: 'battle-screen-ui__selection',
              'aria-label': '현재 선택된 지휘 부대',
              'data-i18n-aria': 'command.selectionAria'
            },
              e('img', {
                className: 'battle-screen-ui__selection-image',
                'data-battle-screen': 'selection-image',
                src: 'assets/images/ui/action-possess.png',
                alt: ''
              }),
              e('div', { className: 'battle-screen-ui__selection-copy' },
                e('span', { className: 'battle-screen-ui__eyebrow', 'data-battle-screen': 'selection-label', 'data-i18n': 'command.selectionLabel' }, '선택 부대'),
                e('strong', { className: 'battle-screen-ui__selection-name', 'data-battle-screen': 'selection-name', 'data-i18n': 'command.selectionNone' }, '선택 없음'),
                e('small', { className: 'battle-screen-ui__selection-role', 'data-battle-screen': 'selection-role', 'data-i18n': 'command.selectionRole' }, '황혼의 감시자 · 전선 지휘관'),
                e('div', { className: 'battle-screen-ui__selection-stats' },
                  e('span', null,
                    e('span', { 'data-i18n': 'command.selectionCount' }, '선택 수'),
                    ' ',
                    e('b', { 'data-battle-screen': 'selection-count' }, '0 / 0')
                  ),
                  e('span', null,
                    e('span', { 'data-i18n': 'command.selectionHealth' }, '통합 체력'),
                    ' ',
                    e('b', { 'data-battle-screen': 'selection-health' }, '0 / 0')
                  ),
                  e('span', null,
                    e('span', { 'data-i18n': 'command.selectionOrder' }, '현재 명령'),
                    ' ',
                    e('b', { 'data-battle-screen': 'selection-order', 'data-i18n': 'command.selection.order.none' }, '대기')
                  )
                ),
                e('output', {
                  className: 'battle-screen-ui__selection-status',
                  'data-battle-screen': 'selection-status',
                  'aria-live': 'polite'
                })
              )
            ),
            e('dl', {
              className: 'battle-screen-ui__resources',
              'aria-label': '전투 자원',
              'data-i18n-aria': 'status.resourceAria'
            },
              [
                ['souls', 'status.souls', '영혼'],
                ['legion', 'status.legion', '군단 슬롯'],
                ['nodes', 'status.nodes', '점거 거점'],
                ['integrity', 'status.integrity', '군주 내구도'],
                ['boss', 'boss.hp', '보스 보호막']
              ].map(([id, labelKey, label]) => e('div', { key: id, 'data-battle-screen-resource': id },
                e('dt', { 'data-i18n': labelKey }, label),
                e('dd', { 'data-battle-screen': id }, '—')
              ))
            ),
            e('div', { className: 'battle-screen-ui__mission', role: 'status', 'aria-live': 'polite' },
              e('span', { className: 'battle-screen-ui__eyebrow', 'data-i18n': 'fieldOverlay.order' }, '현재 명령'),
              e('strong', { 'data-battle-screen': 'objective' }, '현재 목표를 불러오는 중…'),
              e('small', { 'data-battle-screen': 'pressure' }, '전장 상태를 불러오는 중…'),
              e('output', { className: 'battle-screen-ui__feedback', 'data-battle-screen': 'feedback', 'aria-live': 'polite' }),
              e('span', { className: 'battle-screen-ui__wave', 'data-battle-screen': 'wave' }, '웨이브 대기'),
              e('dl', { className: 'battle-screen-ui__frontline' },
                [
                  ['forecast', 'battle.live.forecastLabel', '다음 웨이브', '웨이브 예측 대기'],
                  ['advance', 'battle.live.advanceLabel', '진입 상태', '적 진입 대기'],
                  ['boss-phase', 'battle.live.bossPhaseLabel', '보스 단계', '보스 잠김'],
                  ['enemy-growth', 'battle.live.enemyGrowthLabel', '적 성장', '성장 단계 대기']
                ].map(([id, labelKey, label, value]) => e('div', { key: id },
                  e('dt', { 'data-i18n': labelKey }, label),
                  e('dd', { 'data-battle-screen': id }, value)
                ))
              )
            )
          ),
          e('p', { id: 'battle-direct-help', className: 'battle-mouse-help', 'data-i18n': 'battle.directHelp' }, '전장을 선택한 후, WASD나 방향키를 길게 눌러 사령관을 이동하고 Shift를 눌러 돌진하십시오. 드래그하여 회전하고 휠로 확대/축소할 수 있으며, 지면을 클릭해 사령관을 소집하고 우클릭으로 그림자를 집결시키며 표시된 대상을 클릭해 명령을 발동하십시오.')
        ),
        e('section', {
          id: 'command-panel',
          className: 'panel command-panel cockpit-commands field-command-dock battle-hud-dock',
          'aria-labelledby': 'commands-heading'
        },
          e('div', { className: 'selection-dossier', 'aria-label': '선택 부대', 'data-i18n-aria': 'command.selectionAria' },
            e('img', { id: 'dossier-image', src: 'assets/images/ui/action-possess.png', alt: '' }),
            e('div', { className: 'dossier-copy' },
              e('span', { id: 'dossier-label', 'data-i18n': 'command.selectionLabel' }, '선택 부대'),
              e('strong', { id: 'dossier-name', 'data-i18n': 'command.selectionNone' }, '선택 없음'),
              e('small', { id: 'dossier-role', 'data-i18n': 'command.selectionRole' }, '황혼의 감시자 · 전선 지휘관'),
              e('dl', { id: 'dossier-stats', className: 'dossier-stats' },
                e('div', null,
                  e('dt', { 'data-i18n': 'command.selectionCount' }, '선택 수'),
                  e('dd', { id: 'dossier-count' }, '0 / 0')
                ),
                e('div', null,
                  e('dt', { 'data-i18n': 'command.selectionHealth' }, '통합 체력'),
                  e('dd', { id: 'dossier-health' }, '0 / 0')
                ),
                e('div', null,
                  e('dt', { 'data-i18n': 'command.selectionOrder' }, '현재 명령'),
                  e('dd', { id: 'dossier-order', 'data-i18n': 'command.selection.order.none' }, '대기')
                )
              ),
              e('p', { id: 'dossier-selection-hint', className: 'dossier-selection-hint', 'data-i18n': 'command.selectionHint' }, '아군을 클릭하거나 드래그해 선택 · 우클릭으로 집결'),
              e('span', { id: 'dossier-status', className: 'dossier-status', 'aria-live': 'polite', 'aria-atomic': 'true' })
            )
          ),
          e('div', { className: 'section-heading' },
            e('div', null,
              e('h3', { id: 'commands-heading', 'data-i18n': 'command.heading' }, '의미 기반 명령'),
              e('output', { id: 'campaign-status', className: 'status-message', 'aria-live': 'polite' })
            ),
            e('p', { className: 'hint command-hint', 'data-i18n': 'command.hint' }, '사령관이 대상까지 자동으로 이동해 명령을 수행합니다 (부대 선택과 무관). 부대를 선택하면 그림자 군단을 따로 이동·집결시킬 수 있습니다. 버튼을 사용하거나, 다른 컨트롤에 포커스가 없을 때 표시된 키를 누르세요.')
          ),
          e('div', { id: 'command-pad', className: 'command-grid' },
            [
              { id: 'hunt', key: '1', name: 'command.hunt.name', label: '사냥', desc: 'command.hunt.desc', text: '균열 흔적 두 곳을 탐색' },
              { id: 'extract', key: '2', name: 'command.extract.name', label: '추출', desc: 'command.extract.desc', text: '그림자 은닉처를 확보' },
              { id: 'materialize', key: '3', name: 'command.materialize.name', label: '실체화', desc: 'command.materialize.desc', text: '그림자 군단을 소환' },
              { id: 'capture', key: '4', name: 'command.capture.name', label: '점거', desc: 'command.capture.desc', text: '기술 거점을 고정' },
              { id: 'possess', key: '5', name: 'command.possess.name', label: '빙의', desc: 'command.possess.desc', text: '2단계에서 해금' },
              { id: 'domain', key: '6', name: 'command.domain.name', label: '군주의 영역', desc: 'command.domain.desc', text: '3단계에서 1회 사용' },
              { id: 'assault', key: '7', name: 'command.assault.name', label: '총공격', desc: 'command.assault.desc', text: '스테이지 보스를 무너뜨림' }
            ].map(function (act) {
              return e('button', {
                key: act.id,
                id: 'action-' + act.id,
                'data-action': act.id,
                type: 'button',
                className: 'battle-pointer-target',
                'aria-keyshortcuts': act.key
              },
                e('img', { className: 'action-icon', src: 'assets/images/ui/action-' + act.id + '.png', alt: '' }),
                e('span', { className: 'key' }, act.key),
                e('strong', { 'data-i18n': act.name }, act.label),
                e('small', { 'data-i18n': act.desc }, act.text),
                e('div', { className: 'cooldown-overlay', hidden: true },
                  e('span', { className: 'cooldown-timer' }, '0.0s')
                )
              );
            })
          )
          ,
          // 1. Tactical Marks Display and Skill Controls
          e('div', { id: 'tactical-skill-controls', className: 'tactical-hud-section tactical-skills' },
            e('div', { className: 'section-heading' },
              e('h4', { 'data-i18n': 'tactical.skillsHeading' }, '전술 등급 및 업그레이드'),
              e('div', { className: 'marks-counter' },
                e('span', { 'data-i18n': 'tactical.marksLabel' }, '전술 휘장:'),
                ' ',
                e('strong', { id: 'tactical-marks-value' }, '8')
              )
            ),
            e('div', { className: 'skills-grid' },
              [
                { id: 'command', label: '지휘력', name: 'tactical.skill.command', desc: 'tactical.skill.commandDesc', descText: '대기열 크기 증가' },
                { id: 'fortification', label: '요새화', name: 'tactical.skill.fortification', desc: 'tactical.skill.fortificationDesc', descText: '구조물 성능 강화' },
                { id: 'mobility', label: '기동력', name: 'tactical.skill.mobility', desc: 'tactical.skill.mobilityDesc', descText: '사령관 이동 속도 향상' }
              ].map(function (skill) {
                return e('div', {
                  key: skill.id,
                  className: 'skill-card',
                  'data-skill': skill.id
                },
                  e('div', { className: 'skill-info' },
                    e('strong', { 'data-i18n': skill.name }, skill.label),
                    e('small', { className: 'skill-desc', 'data-i18n': skill.desc }, skill.descText),
                    e('span', { className: 'skill-level-text' },
                      e('span', { 'data-i18n': 'tactical.levelLabel' }, '레벨'),
                      ': ',
                      e('span', { id: 'skill-level-' + skill.id }, '1')
                    )
                  ),
                  e('button', {
                    className: 'skill-upgrade-btn battle-pointer-target',
                    type: 'button',
                    'data-skill': skill.id,
                    'data-i18n-aria': 'tactical.skill.' + skill.id + '.aria',
                    'aria-label': skill.label + ' 업그레이드'
                  },
                    e('span', { 'data-i18n': 'tactical.upgrade' }, '업그레이드'),
                    ' (',
                    e('span', { id: 'skill-cost-' + skill.id }, '4'),
                    ' M)'
                  )
                );
              })
            )
          ),
          e('div', {
            id: 'summon-evolution-controls',
            className: 'tactical-hud-section summon-evolutions',
            'aria-labelledby': 'summon-evolution-heading'
          },
            e('div', { className: 'summon-evolution-heading' },
              e('h4', { id: 'summon-evolution-heading', 'data-i18n': 'summon.heading' }, '소환수 진화'),
              e('span', { className: 'summon-essence' },
                e('span', { 'data-i18n': 'summon.essence' }, '정수'),
                ' ',
                e('strong', { id: 'summon-essence-value' }, '0')
              )
            ),
            e('div', { className: 'summon-evolution-grid' },
              [
                { id: 'ember-scion', name: '잿불 후예', description: '실체화 소환 수 강화' },
                { id: 'rift-hound', name: '균열 사냥개', description: '총공격 피해 강화' },
                { id: 'ward-wisp', name: '수호 도깨비불', description: '반격 피해 감소' }
              ].map(function (recipe) {
                return e('button', {
                  key: recipe.id,
                  type: 'button',
                  className: 'summon-evolution-card battle-pointer-target',
                  'data-summon-recipe': recipe.id,
                  'aria-label': recipe.name + ' 진화'
                },
                  e('strong', { 'data-i18n': 'summon.recipe.' + recipe.id + '.name' }, recipe.name),
                  e('small', { 'data-i18n': 'summon.recipe.' + recipe.id + '.description' }, recipe.description),
                  e('span', { className: 'summon-evolution-meta' },
                    e('span', { 'data-summon-level': '' }, '레벨 0 / 3'),
                    e('span', { 'data-summon-cost': '' }, '다음 비용 4')
                  )
                );
              })
            )
          ),
          // 2. Tower/Barricade Placement Palette
          e('div', { id: 'tactical-deployment-controls', className: 'tactical-hud-section tactical-deployments' },
            e('h4', { 'data-i18n': 'placement.heading' }, '방어 시설 배치'),
            e('div', { className: 'deployment-grid' },
              [
                { id: 'tower', label: '방어 타워', name: 'placement.tower', desc: 'placement.towerDesc', descText: '자동 사격 타워 건설 (비용: 4 휘장)', cost: 4 },
                { id: 'barricade', label: '바리케이드', name: 'placement.barricade', desc: 'placement.barricadeDesc', descText: '이동 경로를 차단하는 장애물 (비용: 2 휘장)', cost: 2 }
              ].map(function (dep) {
                return e('button', {
                  key: dep.id,
                  id: 'deploy-' + dep.id,
                  className: 'deployment-btn battle-pointer-target',
                  type: 'button',
                  'data-kind': dep.id,
                  'data-i18n-aria': 'placement.' + dep.id + '.aria',
                  'aria-label': dep.label + ' 배치'
                },
                  e('strong', { 'data-i18n': dep.name }, dep.label),
                  e('span', { className: 'count-badge' }, '[0/0]'),
                  e('small', { 'data-i18n': dep.desc }, dep.descText),
                  e('span', { className: 'cost-badge' }, dep.cost + ' M')
                );
              })
            )
          ),
          // 3. Command Reservation Controls and Queue
          e('div', { className: 'tactical-hud-section tactical-reservations' },
            e('div', { id: 'reserve-command', className: 'reserve-command-panel' },
              e('h4', { 'data-i18n': 'queue.reserveTitle' }, '사전 명령 예약'),
              e('div', { className: 'reserve-buttons-row' },
                [
                  { id: 'hunt', key: '1', label: '사냥' },
                  { id: 'extract', key: '2', label: '추출' },
                  { id: 'materialize', key: '3', label: '실체화' },
                  { id: 'capture', key: '4', label: '점거' },
                  { id: 'possess', key: '5', label: '빙의' },
                  { id: 'domain', key: '6', label: '군주의 영역' },
                  { id: 'assault', key: '7', label: '총공격' }
                ].map(function (act) {
                  return e('button', {
                    key: act.id,
                    className: 'reserve-btn battle-pointer-target',
                    type: 'button',
                    'data-reserve-action': act.id,
                    'data-i18n-aria': 'queue.reserve.' + act.id + '.aria',
                    'aria-label': act.label + ' 예약'
                  }, act.key);
                })
              )
            ),
            e('div', { className: 'queue-panel' },
              e('div', { className: 'queue-panel-heading' },
                e('h4', { 'data-i18n': 'queue.heading' }, '예약 대기열'),
                e('button', {
                  id: 'clear-reservation-queue',
                  type: 'button',
                  className: 'queue-clear-button',
                  'data-i18n': 'queue.clearButton',
                  'data-i18n-aria': 'queue.clearButtonAria',
                  'aria-label': '예약 대기열 비우기'
                }, '전체 취소')
              ),
              e('ol', {
                id: 'command-reservation-queue',
                className: 'queue-list',
                'aria-live': 'polite',
                'aria-atomic': 'false',
                'aria-relevant': 'additions removals text'
              })
            )
          )
        ),
        e('aside', {
          className: 'cockpit-rail field-edge-hud battle-hud-rail',
          'aria-label': '전술 전장 상태',
          'data-i18n-aria': 'battle.statusAria'
        },
          // Minimap Canvas at top of rail
          e('section', {
            className: 'panel rail-panel battle-minimap-panel',
            'aria-labelledby': 'minimap-heading'
          },
            e('h4', { id: 'minimap-heading', className: 'sr-only', 'data-i18n': 'battle.minimapHeading' }, '전술 미니맵'),
            e('canvas', {
              id: 'battle-minimap',
              tabIndex: 0,
              role: 'application',
              'aria-label': '실시간 미니맵',
              'data-i18n-aria': 'battle.minimapAria',
              'aria-describedby': 'battle-minimap-hint'
            },
              e('span', { 'data-i18n': 'battle.minimapFallback' }, '실시간 미니맵을 표시할 수 없습니다.')
            ),
            e('p', { id: 'battle-minimap-hint', className: 'sr-only', 'data-i18n': 'battle.minimapHint' }, '방향키로 초점 칸을 이동하고 Enter나 Space로 전술 카메라를 이동하십시오.'),
            e('p', { className: 'battle-minimap-caption', 'data-i18n': 'battle.minimapCaption' }, '미니맵: 클릭하면 전술 카메라가 그 위치를 비춥니다. 부대는 이동하지 않습니다.')
          ),
          e('section', {
            id: 'battle-tactical-brief',
            className: 'panel rail-panel battle-tactical-brief',
            'aria-labelledby': 'battle-operation'
          },
            e('h4', { id: 'battle-operation', className: 'battle-operation' }, '작전: 잿불 돌파'),
            e('p', { id: 'battle-doctrine', className: 'rail-doctrine' }, '제련소 길을 열고 그림자를 일으켜 워든의 지배를 끊으십시오.'),
            e('dl', { className: 'battle-force-labels' },
              e('div', null,
                e('dt', { 'data-i18n': 'battle.commandLabel' }, '지휘 부대'),
                e('dd', { id: 'battle-ally-label' }, '그림자 군단')
              ),
              e('div', null,
                e('dt', { 'data-i18n': 'battle.hostileLabel' }, '적대 세력'),
                e('dd', { id: 'battle-hostile-label' }, '잿빛 수호대')
              )
            ),
            e('p', { id: 'battle-pressure', className: 'battle-pressure', 'aria-live': 'polite' }, '준비 단계: 첫 번째 적 웨이브가 공격로에 진입하기 전에 명령을 내리십시오.'),
            e('p', { id: 'battle-asset-status', className: 'battle-asset-status', 'aria-live': 'polite' }, 'GLB 전장 자산 대기 중')
          ),
          e('section', {
            className: 'panel rail-panel rail-boss',
            'aria-labelledby': 'boss-spec-name'
          },
            e('div', { className: 'rail-boss-head' },
              e('img', {
                id: 'boss-portrait-spec',
                className: 'boss-portrait-rail',
                src: 'assets/images/ui/boss-cinder-warden.png',
                alt: '보스 초상화',
                'data-i18n-alt': 'boss.portraitAlt'
              }),
              e('div', null,
                e('h4', { id: 'boss-spec-name', className: 'shiny-text' }, '잿불 감시자'),
                e('dl', { className: 'spec-list spec-list-compact' },
                  e('div', null,
                    e('dt', { 'data-i18n': 'boss.threat' }, '위협'),
                    e('dd', { id: 'boss-spec-threat' }, 'A급')
                  ),
                  e('div', null,
                    e('dt', { 'data-i18n': 'boss.hp' }, 'HP'),
                    e('dd', { id: 'boss-spec-hp' }, '8 HP')
                  ),
                  e('div', null,
                    e('dt', { 'data-i18n': 'boss.counter' }, '반격'),
                    e('dd', { id: 'boss-spec-counter' }, '1')
                  ),
                  e('div', null,
                    e('dt', { 'data-i18n': 'boss.nodes' }, '거점'),
                    e('dd', { id: 'boss-spec-nodes' }, '1개 거점')
                  )
                )
              )
            ),
            e('p', { id: 'boss-spec-lore', className: 'hint rail-lore' }, '잿빛 다리의 포식자. 침입하는 영혼들의 닻을 끊어 심연의 거름으로 삼는다.'),
            e('ul', { className: 'stats-list stats-list-compact' },
              e('li', null,
                e('span', { 'data-i18n': 'stats.integrity' }, '최대 내구도'),
                ' ',
                e('span', { id: 'stat-max-integrity' }, '10')
              ),
              e('li', null,
                e('span', { 'data-i18n': 'stats.cooldown' }, '쿨타임 감소'),
                ' ',
                e('span', { id: 'stat-cooldown-reduction' }, '0%')
              ),
              e('li', null,
                e('span', { 'data-i18n': 'stats.modifiers' }, '전장 보정'),
                ' ',
                e('span', { id: 'stat-extra-damage' }, '없음')
              ),
              e('li', null,
                e('span', { 'data-i18n': 'stats.items' }, '보상 아이템'),
                ' ',
                e('span', { id: 'stat-active-items' }, '없음')
              )
            )
          ),
          e('section', {
            className: 'panel rail-panel campaign-status',
            'aria-labelledby': 'status-heading'
          },
            e('div', { className: 'section-heading' },
              e('h3', { id: 'status-heading', 'data-i18n': 'status.heading' }, '지휘 상태')
            ),
            e('p', { className: 'field-current-objective' },
              e('span', { 'data-i18n': 'battle.currentObjective' }, '현재 목표'),
              ' ',
              e('span', { id: 'stage-objective' })
            ),
            e('ol', {
              id: 'objective-checklist',
              className: 'objective-checklist',
              'aria-label': '스테이지 목표',
              'data-i18n-aria': 'battle.objectivesAria'
            })
          )
        ),
        e('details', { className: 'cockpit-details' },
          e('summary', { 'data-i18n': 'screen.operationalDetail' }, '작전 상세 정보'),
          e('section', {
            className: 'panel rail-panel rail-intel',
            'aria-label': '스테이지 내레이션',
            'data-i18n-aria': 'battle.narrationAria'
          },
            e('div', { id: 'stage-transition', className: 'stage-transition stage-transition-rail', 'aria-live': 'polite' },
              e('video', {
                id: 'stage-transition-video',
                className: 'stage-transition-video',
                muted: true,
                playsInline: true,
                preload: 'metadata',
                hidden: true,
                'aria-label': '선택적 스테이지 환경',
                'data-i18n-aria': 'battle.stageVideoAria'
              }),
              e('div', { id: 'narrator-atlas', className: 'narrator-atlas', 'aria-hidden': 'true' }),
              e('div', { className: 'stage-transition-copy' },
                e('p', { id: 'narration-line', className: 'narration-line', 'aria-hidden': 'true' }),
                e('p', { id: 'narration-sr', className: 'sr-only', role: 'status' }),
                e('button', {
                  id: 'toggle-stage-ambience',
                  type: 'button',
                  'aria-pressed': 'false',
                  'data-i18n': 'battle.toggleAmbience'
                }, '환경음 재생')
              )
            )
          )
        ),
        e('details', { className: 'save-dock-menu' },
          e('summary', {
            className: 'save-dock-trigger',
            'aria-label': '저장',
            'data-i18n-aria': 'save.menuAria',
            title: '저장'
          }, '💾'),
          e('section', {
            id: 'save-dock',
            className: 'panel save-panel save-dock',
            'aria-labelledby': 'save-heading'
          },
            e('div', { className: 'section-heading' },
              e('div', null,
                e('h3', { id: 'save-heading', 'data-i18n': 'save.heading' }, '로컬 캠페인 저장'),
                e('p', { id: 'save-status', className: 'hint', role: 'status', 'data-i18n': 'save.statusText' }, '로컬 저장 데이터 준비 중…'),
                e('p', { id: 'campaign-mirror-status', className: 'mirror-status', role: 'status', 'data-i18n': 'save.mirrorStatusText' }, '탭 간 로컬 동기화를 확인하는 중입니다.')
              ),
              e('div', { className: 'button-row' },
                e('button', { id: 'export-save', type: 'button', 'data-i18n': 'save.exportButton' }, '저장 내보내기'),
                e('label', { className: 'file-button', htmlFor: 'import-save' },
                  e('span', { 'data-i18n': 'save.importButton' }, '저장 불러오기'),
                  e('input', {
                    id: 'import-save',
                    type: 'file',
                    accept: 'application/json,.json'
                  })
                )
              )
            ),
            e('p', { className: 'hint', 'data-i18n': 'save.hint' }, '캠페인 상태는 버전이 관리되는 IndexedDB 봉투에 로컬로 저장됩니다. 브라우저 데이터를 지우기 전에 파일로 내보내세요.')
          )
        )
      ),
      e('div', {
        id: 'view-result',
        className: 'result-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'result-title',
        hidden: true
      },
        e('section', { className: 'panel result-panel' },
          e('h3', { id: 'result-title', className: 'shiny-text' }, '전투 결과'),
          e('div', { id: 'result-status-box', className: 'result-status-box' },
            e('span', { id: 'result-text', className: 'result-text victory' }, '승리')
          ),
          e('section', {
            id: 'reward-panel',
            className: 'reward-selection-container',
            'aria-labelledby': 'reward-heading'
          },
            e('p', { className: 'eyebrow', 'data-i18n': 'reward.eyebrow' }, '특별 보상'),
            e('h3', { id: 'reward-heading', tabIndex: -1, 'data-i18n': 'reward.heading' }, '영구 보너스 하나를 선택하라'),
            e('p', { id: 'reward-summary', 'data-i18n': 'reward.summary' }, '선택하지 않은 보상은 균열 속으로 사라집니다. 선택 즉시 다음 전장이 열립니다.'),
            e('div', {
              id: 'reward-options',
              className: 'reward-options',
              role: 'group',
              'aria-label': '보상 하나 선택',
              'data-i18n-aria': 'reward.optionsAria'
            })
          ),
          e('section', {
            id: 'campaign-complete',
            className: 'completion-panel',
            'aria-labelledby': 'completion-heading',
            hidden: true
          },
            e('p', { className: 'eyebrow', 'data-i18n': 'completion.eyebrow' }, '캠페인 완료'),
            e('h3', { id: 'completion-heading', tabIndex: -1, 'data-i18n': 'completion.heading' }, '가라앉은 문이 침묵하다'),
            e('img', {
              className: 'completion-emblem',
              src: 'assets/images/ui/emblem-gate-sovereign.jpg',
              alt: '빛나는 차원문 고리 안에서 패배한 게이트 소버린의 로우폴리 기념비',
              'data-i18n-alt': 'completion.emblemAlt'
            }),
            e('p', { id: 'completion-summary' }),
            e('button', {
              id: 'restart-campaign',
              className: 'primary',
              type: 'button',
              'data-i18n': 'completion.restartButton'
            }, '새로운 캠페인 시작')
          ),
          e('div', { className: 'button-row center-row' },
            e('button', {
              id: 'retry-from-result',
              className: 'secondary',
              type: 'button',
              'data-i18n': 'screen.retryButton',
              hidden: true
            }, '다시 시도'),
            e('button', {
              id: 'return-to-lobby-from-result',
              className: 'secondary',
              type: 'button',
              'data-i18n': 'screen.returnButton'
            }, '사령부로 돌아가기')
          )
        )
      )
    );
  }

  function App() {
    const useState = React.useState || ((initial) => [initial, () => {}]);
    const useEffect = React.useEffect || (() => {});

    const [agentationLoaded, setAgentationLoaded] = useState(!!window.Agentation);

    useEffect(() => {
      if (window.Agentation) return;
      const handleLoaded = () => setAgentationLoaded(true);
      window.addEventListener('agentation:loaded', handleLoaded);
      return () => window.removeEventListener('agentation:loaded', handleLoaded);
    }, []);

    const containerRef = function (node) {
      if (node) {
        document.getElementById('react-game-root').setAttribute('data-mounted', 'true');
        document.documentElement.dataset.uiRuntime = 'react18';
        window.dispatchEvent(new CustomEvent('abyssal:react-ready'));
      }
    };

    const isLocalhost = window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    return e('div', {
      ref: containerRef,
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '0',
        width: '100%'
      }
    },
      e(BackgroundLayer),
      e('a', { className: 'skip-link', href: '#command-panel', 'data-i18n': 'skipLink' }, '캠페인 명령으로 건너뛰기'),
      e(GameHeader),
      e('audio', { id: 'bgm-player', src: 'assets/audio/bgm-theme.mp3', loop: true, preload: 'none' }),
      e('main', { id: 'game-root', tabIndex: -1, style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } },
        e(CampaignLobby),
        e(CampaignCockpit)
      ),
      e('div', { id: 'visual-effect', className: 'visual-effect', 'aria-hidden': 'true' }),
      isLocalhost && agentationLoaded && window.Agentation ? e(window.Agentation, { endpoint: 'http://localhost:4747' }) : null
    );
  }

  const container = document.getElementById('react-game-root');
  if (container) {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';
    container.style.minHeight = '0';
    ReactDOM.render(e(App), container);
  }
})();
