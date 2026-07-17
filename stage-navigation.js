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
  return Math.max(1, Math.min(3, Number(stageNumber) || 1));
}

// Stage 1 Cinder Span: a bridge over the drowned forge — void edges.
// Stage 2 Veil Citadel: twin raised plateaus (the two signal nodes) + ramps.
// Stage 3 Echo Throne: stepped ascent toward the throne.
export function buildStageHeightfield(stageNumber) {
  const height = Array.from(
    { length: STAGE_GRID_HEIGHT },
    () => Array(STAGE_GRID_WIDTH).fill(0),
  );
  if (normalizeStageNumber(stageNumber) === 1) {
    for (let x = 0; x < STAGE_GRID_WIDTH; x += 1) {
      height[0][x] = -1;
      height[STAGE_GRID_HEIGHT - 1][x] = -1;
      if (x >= 5 && x <= 10) {
        height[1][x] = -1;
        height[STAGE_GRID_HEIGHT - 2][x] = -1;
      }
    }
  } else if (normalizeStageNumber(stageNumber) === 2) {
    for (let y = 2; y <= 5; y += 1) {
      for (let x = 5; x <= 6; x += 1) height[y][x] = 1;
      for (let x = 9; x <= 10; x += 1) height[y][x] = 1;
    }
  } else {
    for (let y = 2; y <= 5; y += 1) {
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
