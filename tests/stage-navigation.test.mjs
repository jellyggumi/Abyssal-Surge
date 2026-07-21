import assert from "node:assert/strict";
import test from "node:test";

import {
  STAGE_GRID_HEIGHT,
  STAGE_GRID_WIDTH,
  buildStageHeightfield,
  createStageNavigation,
  validateStageNavigation,
} from "../stage-navigation.js";

const EXPECTED_ROUTE_LENGTHS = Object.freeze([
  Object.freeze([30, 28, 32]),
  Object.freeze([30, 32, 34]),
  Object.freeze([36, 32, 34]),
  Object.freeze([32, 34, 36]),
  Object.freeze([36, 34, 38]),
  Object.freeze([34, 36, 38]),
  Object.freeze([36, 38, 40]),
  Object.freeze([36, 38, 40]),
  Object.freeze([38, 40, 42]),
  Object.freeze([44, 40, 42]),
]);
const EXPECTED_NODE_COUNTS = Object.freeze([1, 2, 1, 1, 1, 2, 2, 2, 3, 3]);

function deterministicSnapshot(navigation) {
  return {
    stageNumber: navigation.stageNumber,
    name: navigation.name,
    revision: navigation.revision,
    cells: navigation.cells,
    anchors: navigation.anchors,
    routes: navigation.routes,
    zones: navigation.zones,
  };
}

function findVoid(navigation) {
  for (let y = 0; y < navigation.height; y += 1) {
    const x = navigation.cells[y].indexOf(-1);
    if (x !== -1) return { x, y };
  }
  return null;
}

test("all ten authored maps validate as immutable 24×12 navigation grids", () => {
  for (let stageNumber = 1; stageNumber <= 10; stageNumber += 1) {
    const navigation = createStageNavigation(stageNumber);
    const heightfield = buildStageHeightfield(stageNumber);

    assert.equal(validateStageNavigation(stageNumber), true, `Stage ${stageNumber} navigation must validate`);
    assert.equal(navigation.width, STAGE_GRID_WIDTH, `Stage ${stageNumber} must expose 24 columns`);
    assert.equal(navigation.height, STAGE_GRID_HEIGHT, `Stage ${stageNumber} must expose 12 rows`);
    assert.equal(navigation.cells.length, 12, `Stage ${stageNumber} must contain 12 rows`);
    assert.ok(
      navigation.cells.every((row) => row.length === 24),
      `Stage ${stageNumber} must contain exactly 24 cells in every row`,
    );
    assert.deepEqual(heightfield, navigation.cells, `Stage ${stageNumber} heightfield must match its navigation grid`);

    assert.equal(Object.isFrozen(navigation), true, `Stage ${stageNumber} navigation must be immutable`);
    assert.equal(Object.isFrozen(navigation.cells), true, `Stage ${stageNumber} row collection must be immutable`);
    assert.ok(
      navigation.cells.every(Object.isFrozen),
      `Stage ${stageNumber} cell rows must be immutable`,
    );

    const originalCell = navigation.cells[0][0];
    assert.throws(
      () => { navigation.cells[0][0] = originalCell === -1 ? 0 : -1; },
      TypeError,
      `Stage ${stageNumber} cells must reject mutation`,
    );
    assert.equal(navigation.cells[0][0], originalCell, `Stage ${stageNumber} mutation attempts must not alter the map`);
  }
});

test("every stage exposes exactly three authored routes with exact lengths and node goals", () => {
  for (let stageNumber = 1; stageNumber <= 10; stageNumber += 1) {
    const navigation = createStageNavigation(stageNumber);
    const expectedLengths = EXPECTED_ROUTE_LENGTHS[stageNumber - 1];

    assert.equal(navigation.routes.length, 3, `Stage ${stageNumber} must expose three tactical routes`);
    assert.deepEqual(
      navigation.routes.map((route) => route.cells.length),
      expectedLengths,
      `Stage ${stageNumber} route lengths must preserve authored pacing`,
    );
    assert.equal(
      navigation.anchors.nodes.length,
      EXPECTED_NODE_COUNTS[stageNumber - 1],
      `Stage ${stageNumber} must expose its authored command-node count`,
    );

    navigation.routes.forEach((route, routeIndex) => {
      assert.equal(Object.isFrozen(route.cells), true, `Stage ${stageNumber} route ${routeIndex + 1} must be immutable`);
      assert.deepEqual(
        navigation.routePath(routeIndex),
        route.cells,
        `Stage ${stageNumber} route ${routeIndex + 1} must be returned in portal-to-boss order`,
      );
      assert.deepEqual(
        navigation.routePath(routeIndex, true),
        [...route.cells].reverse(),
        `Stage ${stageNumber} route ${routeIndex + 1} must reverse deterministically for hostile traversal`,
      );
    });
  }
});

test("repeated generation is deterministic and returned route paths cannot mutate authored navigation", () => {
  for (let stageNumber = 1; stageNumber <= 10; stageNumber += 1) {
    const first = createStageNavigation(stageNumber);
    const second = createStageNavigation(stageNumber);

    assert.deepEqual(
      deterministicSnapshot(second),
      deterministicSnapshot(first),
      `Stage ${stageNumber} generation must be deterministic`,
    );

    const detachedPath = first.routePath(0);
    const authoredStart = { ...first.routes[0].cells[0] };
    detachedPath[0].x = 999;
    detachedPath.push({ x: 999, y: 999 });
    assert.deepEqual(
      first.routePath(0)[0],
      authoredStart,
      `Stage ${stageNumber} callers must not be able to corrupt later route generation`,
    );
    assert.equal(
      first.routePath(0).length,
      EXPECTED_ROUTE_LENGTHS[stageNumber - 1][0],
      `Stage ${stageNumber} route length must survive caller mutation`,
    );
  }
});

test("walkability rejects every grid boundary overflow and authored void", () => {
  for (let stageNumber = 1; stageNumber <= 10; stageNumber += 1) {
    const navigation = createStageNavigation(stageNumber);
    const outOfBounds = [
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: navigation.width, y: 0 },
      { x: 0, y: navigation.height },
    ];

    for (const cell of outOfBounds) {
      assert.equal(navigation.heightAt(cell.x, cell.y), -1, `Stage ${stageNumber} must reject out-of-bounds height lookup`);
      assert.equal(navigation.walkable(cell.x, cell.y), false, `Stage ${stageNumber} must reject out-of-bounds movement`);
    }

    const voidCell = findVoid(navigation);
    assert.ok(voidCell, `Stage ${stageNumber} must retain tactical void space`);
    assert.equal(navigation.walkable(voidCell.x, voidCell.y), false, `Stage ${stageNumber} void must reject movement`);
    assert.equal(
      navigation.findPath(voidCell, navigation.anchors.boss),
      null,
      `Stage ${stageNumber} pathfinding must reject a void origin`,
    );

    assert.deepEqual(
      navigation.worldToGrid(navigation.bounds.left, navigation.bounds.near),
      { x: 0, y: 0 },
      `Stage ${stageNumber} world bounds must map to the grid origin`,
    );
    assert.deepEqual(
      navigation.gridToWorld(navigation.width, navigation.height),
      { x: navigation.bounds.right, z: navigation.bounds.far },
      `Stage ${stageNumber} grid extent must map to its world bounds`,
    );
  }
});

test("portal-to-boss paths remain walkable, 8-directionally adjacent, and elevation-legal on every stage", () => {
  for (let stageNumber = 1; stageNumber <= 10; stageNumber += 1) {
    const navigation = createStageNavigation(stageNumber);
    const path = navigation.findPath(navigation.anchors.portal, navigation.anchors.boss);

    assert.ok(path && path.length > 1, `Stage ${stageNumber} must connect portal to boss`);
    assert.deepEqual(path[0], { x: 1, y: 5 }, `Stage ${stageNumber} path must start at the portal cell`);
    assert.deepEqual(path.at(-1), { x: 22, y: 5 }, `Stage ${stageNumber} path must end at the boss cell`);

    path.forEach((cell, index) => {
      assert.equal(navigation.walkable(cell.x, cell.y), true, `Stage ${stageNumber} path cell ${index} must be walkable`);
      if (index === 0) return;
      const previous = path[index - 1];
      const dx = Math.abs(previous.x - cell.x);
      const dy = Math.abs(previous.y - cell.y);
      assert.equal(
        dx <= 1 && dy <= 1 && (dx + dy) > 0,
        true,
        `Stage ${stageNumber} path step ${index} must be 8-directionally adjacent (cardinal or diagonal, no jumps)`,
      );
      assert.equal(
        navigation.climbOk(previous.x, previous.y, cell.x, cell.y),
        true,
        `Stage ${stageNumber} path step ${index} must respect the elevation limit`,
      );
    });
  }
});

test("deployment validation treats towers as occupying terrain and barricades as route blockers", () => {
  const navigation = createStageNavigation(1);
  const partialSeal = [
    { id: "wall-1", kind: "barricade", cell: { x: 5, y: 4 } },
    { id: "wall-2", kind: "barricade", cell: { x: 5, y: 5 } },
    { id: "wall-3", kind: "barricade", cell: { x: 5, y: 6 } },
  ];

  const tower = navigation.validateDeployment(5, 7, partialSeal, "tower");
  const barricade = navigation.validateDeployment(5, 7, partialSeal, "barricade");

  assert.deepEqual(
    { valid: tower.valid, status: tower.status },
    { valid: true, status: "valid" },
    "a tower on the last open frontage cell must occupy that cell without closing the portal-to-boss route",
  );
  assert.deepEqual(
    { valid: barricade.valid, status: barricade.status, reason: barricade.reason },
    {
      valid: false,
      status: "protected",
      reason: "Deployment would completely block all paths from portal to boss.",
    },
    "a barricade on the same cell must reject when it would seal the last portal-to-boss route",
  );
});

test("all ten stages retain distinct tactical layouts", () => {
  const signatures = [];
  for (let stageNumber = 1; stageNumber <= 10; stageNumber += 1) {
    const navigation = createStageNavigation(stageNumber);
    signatures.push(JSON.stringify({
      cells: navigation.cells,
      routes: navigation.routes.map((route) => route.cells),
      nodes: navigation.anchors.nodes,
    }));
  }

  assert.equal(
    new Set(signatures).size,
    10,
    "no stage may collapse onto another stage's tactical grid, routes, and command nodes",
  );
});
