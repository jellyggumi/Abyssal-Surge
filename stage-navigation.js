// Authored tactical navigation for both battle renderers. Grid cells are 1×1;
// -1 is a chasm and each non-negative value is its terrain elevation.
export const STAGE_GRID_WIDTH = 16;
export const STAGE_GRID_HEIGHT = 8;

export const STAGE_TACTICAL_ANCHORS = Object.freeze({
  portal: Object.freeze({ x: 1, y: 3.5 }),
  boss: Object.freeze({ x: 14, y: 3.5 }),
  node: Object.freeze({ x: 7.5, y: 3.5 }),
});

function normalizeStageNumber(stageNumber) {
  return Math.max(1, Math.min(10, Number(stageNumber) || 1));
}

// Stage 1 Cinder Span: a bridge over the drowned forge — void edges.
// Stage 2 Veil Citadel: twin raised plateaus (the two signal nodes) + ramps.
// Stage 3 Echo Throne: stepped ascent toward the throne.
// Stage 4 Sunken Bastion: a narrow breakwater causeway over the flood.
// Stage 5 Howling Sprawl: open ruin field pocked with collapse pits.
// Stage 6 Glass Necropolis: twin grave-glass terraces (the two nodes).
// Stage 7 Starless Canal: a dark waterway crossed by two bridge lanes.
// Stage 8 Shattered Causeway: broken span - gaps force lane discipline.
// Stage 9 Abyss Chancel: three floating rite platforms and connectors.
// Stage 10 Gate Zenith: the grand stair to the Regent, void on both sides.
export function buildStageHeightfield(stageNumber) {
  const height = Array.from(
    { length: STAGE_GRID_HEIGHT },
    () => Array(STAGE_GRID_WIDTH).fill(0),
  );
  const number = normalizeStageNumber(stageNumber);
  const H = STAGE_GRID_HEIGHT;
  const W = STAGE_GRID_WIDTH;
  if (number === 1) {
    for (let x = 0; x < W; x += 1) {
      height[0][x] = -1;
      height[H - 1][x] = -1;
      if (x >= 5 && x <= 10) {
        height[1][x] = -1;
        height[H - 2][x] = -1;
      }
    }
  } else if (number === 2) {
    for (let y = 2; y <= 5; y += 1) {
      for (let x = 5; x <= 6; x += 1) height[y][x] = 1;
      for (let x = 9; x <= 10; x += 1) height[y][x] = 1;
    }
  } else if (number === 3) {
    for (let y = 2; y <= 5; y += 1) {
      for (let x = 11; x <= 12; x += 1) height[y][x] = 1;
      for (let x = 13; x <= 15; x += 1) height[y][x] = 2;
    }
  } else if (number === 4) {
    // Breakwater causeway: wide flood voids press the lane to the middle rows.
    for (let x = 0; x < W; x += 1) {
      height[0][x] = -1;
      height[1][x] = -1;
      height[H - 1][x] = -1;
      height[H - 2][x] = -1;
      if (x >= 4 && x <= 11 && x % 3 === 1) {
        height[2][x] = -1;
        height[H - 3][x] = -1;
      }
    }
  } else if (number === 5) {
    // Ruin sprawl: open field with collapse pits that break straight rushes.
    for (const [px, py] of [[4, 2], [7, 5], [10, 2], [6, 6], [9, 6], [12, 4]]) {
      height[py][px] = -1;
    }
  } else if (number === 6) {
    // Grave-glass terraces mirror the citadel plateaus, pushed apart.
    for (let y = 1; y <= 3; y += 1) for (let x = 5; x <= 6; x += 1) height[y][x] = 1;
    for (let y = 4; y <= 6; y += 1) for (let x = 9; x <= 10; x += 1) height[y][x] = 1;
    height[0][7] = -1;
    height[H - 1][8] = -1;
  } else if (number === 7) {
    // Canal: a void channel with two bridge lanes at x=5 and x=10.
    for (let x = 3; x <= 12; x += 1) {
      for (let y = 3; y <= 4; y += 1) {
        if (x !== 5 && x !== 10) height[y][x] = -1;
      }
    }
  } else if (number === 8) {
    // Shattered span: staggered gaps across the bridge rows.
    for (let x = 0; x < W; x += 1) {
      height[0][x] = -1;
      height[H - 1][x] = -1;
    }
    for (const [px, py] of [[5, 2], [5, 3], [8, 4], [8, 5], [11, 2], [11, 3]]) {
      height[py][px] = -1;
    }
    for (let y = 2; y <= 5; y += 1) for (let x = 13; x <= 15; x += 1) height[y][x] = 1;
  } else if (number === 9) {
    // Floating chancel: three rite platforms joined by narrow connectors.
    for (let x = 0; x < W; x += 1) { height[0][x] = -1; height[H - 1][x] = -1; }
    for (let y = 1; y <= 2; y += 1) for (let x = 4; x <= 6; x += 1) height[y][x] = 1;
    for (let y = 5; y <= 6; y += 1) for (let x = 7; x <= 9; x += 1) height[y][x] = 1;
    for (let y = 3; y <= 4; y += 1) for (let x = 11; x <= 12; x += 1) height[y][x] = 1;
  } else {
    // Gate Zenith: the grand stair - three rising tiers toward the Regent.
    for (let x = 0; x < W; x += 1) { height[0][x] = -1; height[H - 1][x] = -1; }
    for (let y = 2; y <= 5; y += 1) {
      for (let x = 8; x <= 9; x += 1) height[y][x] = 1;
      for (let x = 11; x <= 12; x += 1) height[y][x] = 1;
      for (let x = 13; x <= 15; x += 1) height[y][x] = 2;
    }
  }
  return height;
}

export function createStageNavigation(stageNumber) {
  const height = buildStageHeightfield(stageNumber);
  const heightAt = (x, y) => {
    if (x < 0 || y < 0 || x >= STAGE_GRID_WIDTH || y >= STAGE_GRID_HEIGHT) return -1;
    return height[y][x];
  };
  const elevationAt = (x, y) => Math.max(0, heightAt(Math.floor(x), Math.floor(y)));
  return Object.freeze({
    width: STAGE_GRID_WIDTH,
    height: STAGE_GRID_HEIGHT,
    cells: height,
    heightAt,
    walkable: (x, y) => heightAt(x, y) >= 0,
    climbOk: (x0, y0, x1, y1) => {
      const from = heightAt(x0, y0);
      const to = heightAt(x1, y1);
      return from >= 0 && to >= 0 && Math.abs(to - from) <= 1;
    },
    elevationAt,
  });
}
