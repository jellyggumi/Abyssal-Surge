import assert from "node:assert/strict";
import test from "node:test";

import { selectCurrentCommand, textOf } from "../battle-field-command-overlay.js";

function command({ ariaCurrent = null, currentObjective = false, disabled = false } = {}) {
  return {
    disabled,
    getAttribute(name) {
      return name === "aria-current" ? ariaCurrent : null;
    },
    classList: {
      contains(name) {
        return name === "current-objective" && currentObjective;
      },
    },
  };
}

test("selectCurrentCommand resolves marked and enabled commands in priority order", () => {
  const enabled = command();
  const objective = command({ currentObjective: true, disabled: true });
  const currentStep = command({ ariaCurrent: "step", disabled: true });

  const cases = [
    {
      name: "aria-current step wins over current-objective and enabled commands",
      commands: [enabled, objective, currentStep],
      expected: currentStep,
    },
    {
      name: "current-objective wins over an earlier enabled command when no step is marked",
      commands: [enabled, objective],
      expected: objective,
    },
    {
      name: "the first enabled command is selected when no command is marked",
      commands: [command({ disabled: true }), enabled, command()],
      expected: enabled,
    },
  ];

  for (const { name, commands, expected } of cases) {
    assert.equal(selectCurrentCommand(commands), expected, name);
  }
});

test("selectCurrentCommand retains the first command when every command is disabled", () => {
  const firstDisabled = command({ disabled: true });
  const secondDisabled = command({ disabled: true });

  assert.equal(
    selectCurrentCommand([firstDisabled, secondDisabled]),
    firstDisabled,
    "an all-disabled command panel must retain a stable command target instead of returning nothing",
  );
});

test("textOf normalizes meaningful text and uses the supplied fallback for blank or missing elements", () => {
  const cases = [
    {
      name: "collapses internal whitespace and trims surrounding whitespace",
      element: { textContent: "\n  Rally\tthrough   the breach  \n" },
      fallback: "No command",
      expected: "Rally through the breach",
    },
    {
      name: "uses the supplied fallback for blank text",
      element: { textContent: " \n\t " },
      fallback: "No command",
      expected: "No command",
    },
    {
      name: "uses the supplied fallback when no element exists",
      element: null,
      fallback: "No command",
      expected: "No command",
    },
  ];

  for (const { name, element, fallback, expected } of cases) {
    assert.equal(textOf(element, fallback), expected, name);
  }
});
