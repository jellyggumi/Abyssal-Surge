const PALETTE = Object.freeze({
  ember: Object.freeze({
    background: "#070b13",
    ally: "#70e5d0",
    hostile: "#ff7f79",
    accent: "#ffb85c",
    domain: "#ab68ff",
    grid: "#3b4c68",
    gridSecondary: "#1b2740"
  }),
  veil: Object.freeze({
    background: "#09101a",
    ally: "#8ee7d8",
    hostile: "#c876ff",
    accent: "#ffe18a",
    domain: "#6d7cff",
    grid: "#41566f",
    gridSecondary: "#1d2b3a"
  }),
  throne: Object.freeze({
    background: "#100b18",
    ally: "#88d7ff",
    hostile: "#ff8a5c",
    accent: "#f6c85f",
    domain: "#ba7cff",
    grid: "#55476e",
    gridSecondary: "#2a1f40"
  }),
  tide: Object.freeze({
    background: "#061218",
    ally: "#7fe8c3",
    hostile: "#39d1c2",
    accent: "#9adcff",
    domain: "#68a7ff",
    grid: "#2f5a66",
    gridSecondary: "#12303a"
  }),
  howl: Object.freeze({
    background: "#12100a",
    ally: "#8ce08c",
    hostile: "#ffae42",
    accent: "#ffd27a",
    domain: "#c08aff",
    grid: "#5a5138",
    gridSecondary: "#2b2417"
  }),
  glass: Object.freeze({
    background: "#0b1020",
    ally: "#7fd4ff",
    hostile: "#dfe9ff",
    accent: "#b8c8ff",
    domain: "#8f9dff",
    grid: "#46557d",
    gridSecondary: "#1e2740"
  }),
  canal: Object.freeze({
    background: "#0a0f0a",
    ally: "#7fe8d8",
    hostile: "#c8ff6b",
    accent: "#eaff9a",
    domain: "#7bd7ff",
    grid: "#3e5a3a",
    gridSecondary: "#1a2b18"
  }),
  causeway: Object.freeze({
    background: "#140d08",
    ally: "#8fd8ff",
    hostile: "#ff9d5c",
    accent: "#ffc27a",
    domain: "#c08aff",
    grid: "#6a4a35",
    gridSecondary: "#33231a"
  }),
  chancel: Object.freeze({
    background: "#0e0a1a",
    ally: "#9be5d8",
    hostile: "#b98aff",
    accent: "#e2c9ff",
    domain: "#7f8dff",
    grid: "#4c3f72",
    gridSecondary: "#241d3d"
  }),
  zenith: Object.freeze({
    background: "#160910",
    ally: "#8fd8ff",
    hostile: "#ff5c5c",
    accent: "#f6c85f",
    domain: "#d08aff",
    grid: "#6e4050",
    gridSecondary: "#361b26"
  })
});

export const BATTLE_PRESENTATIONS = Object.freeze({
  "cinder-span": Object.freeze({
    stageNumber: 1,
    operation: "Operation: Ember Break",
    doctrine: "Open the forge lane, raise shades, then sever the Warden's hold.",
    objectiveKey: "onboarding.stage1.objective",
    operationKey: "battle.cinderSpan.operation",
    doctrineKey: "battle.cinderSpan.doctrine",
    allyLabel: "Dusk Legion",
    hostileLabel: "Ashbound Ward",
    palette: PALETTE.ember
  }),
  "veil-citadel": Object.freeze({
    operation: "Operation: Veil Breach",
    stageNumber: 2,
    doctrine: "Hold both signal nodes before the Tactician closes the listening routes.",
    allyLabel: "Veil Vanguard",
    hostileLabel: "Citadel Screen",
    palette: PALETTE.veil
  }),
  "echo-throne": Object.freeze({
    operation: "Operation: Thronefall",
    stageNumber: 3,
    doctrine: "Secure the throne node, invoke the Domain, and break the Sovereign's gate.",
    allyLabel: "Thronebound Legion",
    hostileLabel: "Sovereign Guard",
    palette: PALETTE.throne
  }),
  "sunken-bastion": Object.freeze({
    stageNumber: 4,
    operation: "Operation: Breakwater",
    doctrine: "Hold the causeway above the flood; drown nothing you cannot recall.",
    allyLabel: "Tidebound Legion",
    hostileLabel: "Flood Ward",
    palette: PALETTE.tide
  }),
  "howling-sprawl": Object.freeze({
    stageNumber: 5,
    operation: "Operation: Muzzle",
    doctrine: "Take the howl node and turn the pack's own sentinel against the Herald.",
    allyLabel: "Duskfang Legion",
    hostileLabel: "Pack Vanguard",
    palette: PALETTE.howl
  }),
  "glass-necropolis": Object.freeze({
    stageNumber: 6,
    operation: "Operation: Silence",
    doctrine: "Hold both glass terraces; let the choir sing to empty graves.",
    allyLabel: "Requiem Legion",
    hostileLabel: "Grave Chorus",
    palette: PALETTE.glass
  }),
  "starless-canal": Object.freeze({
    stageNumber: 7,
    operation: "Operation: Blackwater",
    doctrine: "Seize both toll bridges and douse every lantern the Tyrant hangs.",
    allyLabel: "Starless Legion",
    hostileLabel: "Lantern Toll",
    palette: PALETTE.canal
  }),
  "shattered-causeway": Object.freeze({
    stageNumber: 8,
    operation: "Operation: Keystone",
    doctrine: "Anchor the broken span; the Colossus falls where the bridge already fell.",
    allyLabel: "Spanbound Legion",
    hostileLabel: "Causeway Watch",
    palette: PALETTE.causeway
  }),
  "abyss-chancel": Object.freeze({
    stageNumber: 9,
    operation: "Operation: Countersign",
    doctrine: "Claim all three rite platforms and unbind the Concordat's signatures.",
    allyLabel: "Oathbreaker Legion",
    hostileLabel: "Concordat Guard",
    palette: PALETTE.chancel
  }),
  "gate-zenith": Object.freeze({
    stageNumber: 10,
    operation: "Operation: Crownfall",
    doctrine: "Spend every boon earned below; the Regent answers only to the whole legion.",
    allyLabel: "Zenith Legion",
    hostileLabel: "Regent's Own",
    palette: PALETTE.zenith
  })
});

export const DEFAULT_BATTLE_PRESENTATION = BATTLE_PRESENTATIONS["cinder-span"];

export function getBattlePresentation(stageId) {
  return BATTLE_PRESENTATIONS[stageId] ?? DEFAULT_BATTLE_PRESENTATION;
}
