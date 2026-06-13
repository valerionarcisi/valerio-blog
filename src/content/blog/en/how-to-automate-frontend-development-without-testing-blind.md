---
title: "How to automate frontend development without flying blind"
date: "2026-06-13"
extract: "In frontend development, knowing that something failed is not enough. We use Chrome DevTools to understand the problem, then Playwright to stop it from coming back."
tags:
  - "frontend"
  - "testing"
  - "playwright"
  - "ai"
coverImage: "/img/blog/come-automatizzare-lo-sviluppo-frontend-senza-testare-alla-cieca/cover.jpg"
coverDescription: "An illustration of a browser measured with geometric guides and secured by an automated test"
---

Backend changes are often easy to verify. A function returns the right value, an endpoint responds, or a row exists in the database.

Frontend work is different. A button can be in the DOM but outside the viewport. It can look clickable while a transparent layer intercepts the click. A `fixed` modal can unexpectedly move with an ancestor.

For a long time, we treated these cases as testing problems. They were first **observation problems**.

## Understand first, test second

Browser automation tools can open pages, click elements, and take screenshots. Playwright can tell us that an interaction failed. But the symptom does not always explain the cause.

A screenshot may show a misplaced modal, but it does not reveal which CSS rule moved it. A failed click does not automatically identify the element that intercepted it.

The process that works is the same one we follow manually:

```text
observe -> measure -> fix -> measure again
```

Only after we understand the behaviour do we decide which property should become a permanent test.

## Diagnose with Chrome DevTools

Chrome DevTools measures what the browser actually calculated, rather than what we assume after reading the code.

- `getBoundingClientRect()` shows the real position and dimensions;
- `elementFromPoint(x, y)` reveals which element receives the click;
- `getComputedStyle()` returns resolved values such as `z-index`, `pointer-events`, and `transform`;
- walking up the ancestor tree helps find properties that change how `position: fixed` behaves.

"The modal looks offset" becomes "its right edge extends 84 pixels beyond the viewport." "The button does not work" becomes "the click reaches the overlay at those coordinates."

These measurements are quick and disposable. They help us find the cause; they do not replace tests.

## Use screenshots to confirm the result

Screenshots remain useful for composition, hierarchy, spacing, and the overall visual result. They are less useful for analysing hit-tests, stacking contexts, or resolved CSS values.

Separating those jobs also reduces the context an agent needs. A few coordinates and computed styles cost far less than a sequence of full images.

We do not have a scientific benchmark. In our loops, however, we estimate a **70-95% reduction in diagnostic tokens** when many intermediate screenshots become text measurements plus one final image.

## Use Playwright to prevent regressions

Once the cause is clear and the visual result is correct, we write the E2E test.

The test checks the property discovered during diagnosis: the element stays inside the viewport, the click reaches the correct control, or the modal keeps its expected position.

The order matters. Playwright alone would make us guess the assertion while still investigating. DevTools alone would solve today's problem without protecting us from tomorrow's regression.

For visual fixes, we therefore do not start with the test. We find the right invariant first, then turn it into a contract.

## Red on old, then ship

Before committing, we confirm that the new test fails without the fix and passes with it. This is the **red-on-old** check.

A test that stays green in both states protects nothing. It may target the wrong element or use an assertion that is too permissive.

Our design gate is simple:

```text
measure with DevTools
  -> fix and measure again
  -> check the screenshot
  -> verify red-on-old with Playwright
  -> run the gates and review the diff
  -> commit
```

Automating frontend development does not mean removing human observation. It means making it repeatable: DevTools finds the cause, the screenshot confirms the result, and Playwright prevents the regression from returning.
