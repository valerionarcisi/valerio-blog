---
title: "How to automate frontend development without flying blind"
date: "2026-06-13"
extract: "Frontend feedback is less clear-cut than backend feedback. We built a two-step design gate: Chrome DevTools to understand the problem, then Playwright to stop it from coming back."
tags:
  - "frontend"
  - "testing"
  - "playwright"
  - "ai"
coverImage: "/img/blog/come-automatizzare-lo-sviluppo-frontend-senza-testare-alla-cieca/cover.jpg"
coverDescription: "An illustration of a browser measured with geometric guides and secured by an automated test"
---

In backend development, the verification point is often clear. A function returns the right value or it does not. An endpoint responds with the expected status or it fails. A row exists in the database or it does not.

Frontend development is harder to judge. An interface can be technically correct and still be wrong.

A button may exist in the DOM but sit outside the viewport. An element may look clickable while a transparent layer intercepts the click. A fixed modal may unexpectedly move with one of its ancestors.

The UX can also work without matching what we designed.

For a long time, we treated this as a testing problem. We eventually realised it was first an **observation problem**.

We were asking tools to prevent a regression before we had understood what was happening in the interface.

That led us to a two-step design gate. First, we use Chrome DevTools to diagnose the real browser behaviour. Then we use Playwright to freeze the property we discovered.

Screenshots remain part of the process, but they no longer carry the entire burden of verification.

## Our first attempt: automate everything immediately

Our initial goal was straightforward. We wanted an agent to develop and verify the frontend without forcing us to inspect every change manually.

That is why we started testing **chrome-agent**, a browser automation tool designed for AI agents.

It can open pages, inspect the accessibility tree, locate elements, click, fill forms, read text, and take screenshots. It turns many browser operations into structured commands that are relatively cheap to place in a model's context.

We tested it alongside Playwright to close the entire loop: edit the code, open the application, interact with the page, and verify the result.

On paper, that looked sufficient. In practice, we kept hitting the same limitation.

The tools could perform actions, but they could not always explain **why** the interface was wrong.

Playwright could tell us that a click failed. chrome-agent could list the available elements or produce a screenshot. Yet a gap remained between the symptom and its cause.

We accumulated screenshots, guessed from the source code, and eventually opened Chrome ourselves to perform the check we wanted to automate.

The loop had become more automated in execution, but not in understanding.

## We replicated what we did manually

The turning point came when we observed our own behaviour during a normal frontend development session.

When something looks wrong, we do not immediately write an E2E test. We open the browser, look at the page, and ask concrete questions.

Where is the element actually positioned? Which layer receives the click? What is the resolved value of `pointer-events`? Did a transformed ancestor change the containing block of a fixed element?

Then we edit the code, reload the page, and check again. The real loop is:

```text
observe -> measure -> fix -> measure again
```

We gave agents the same process. They no longer received only a browser they could control.

They also received Chrome DevTools to interrogate the live page, plus screenshots as eyes for judging the overall result.

This moved the testing phase later in the workflow. We first understand the behaviour. Only then do we decide which property deserves to become permanent.

## Step one: Chrome DevTools as the chisel

Chrome DevTools is our diagnostic tool. It operates against a real Chrome instance and measures what the browser has actually calculated, rather than what we imagine after reading the CSS and components.

The most useful checks are often simple:

- `getBoundingClientRect()` tells us where an element is, how large it is, and whether it has negative coordinates or extends beyond the viewport;
- `elementFromPoint(x, y)` performs a real hit-test and reveals which element is under the click position;
- `getComputedStyle()` returns resolved values such as `z-index`, `pointer-events`, `position`, and `transform`;
- walking up the ancestor tree can reveal a `transform`, `filter`, or another property that changes how `position: fixed` behaves.

These checks return numbers and values we can compare.

We no longer say, "the modal looks offset." We can say its right edge is 84 pixels beyond the viewport.

We no longer say, "the button does not receive the click." We can see that `elementFromPoint()` returns the overlay at those coordinates.

The loop remains deliberately exploratory: measure, fail, edit, and measure again.

The diagnostic queries are disposable and never committed. Chrome DevTools is the **chisel**: fast, precise, interactive, and free from test boilerplate.

Those qualities also make it the wrong tool for CI. An interactive session is not a repeatable guarantee.

## Screenshots are the eyes, not the diagnosis

We did not remove screenshots. We stopped using them to answer questions they are not suited to answer.

A screenshot is excellent for judging composition, hierarchy, spacing, and the overall visual result.

It is less useful for discovering which layer intercepts a click or why a fixed element has changed its reference frame. Those questions require the DOM and the values resolved by the browser.

This distinction also reduces the context agents need.

A full image must be encoded and analysed as visual input. A structured response containing four coordinates, an element name, and a few computed styles usually occupies far less space.

We do not have a controlled benchmark to publish, so we do not present the result as a scientific percentage.

As an operational estimate, we expect a **70-95% reduction in diagnostic tokens** for loops with many intermediate checks.

The largest savings appear when ten screenshots become ten compact text measurements plus one final screenshot.

The exact result depends on image resolution, model, and the amount of extracted data. The direction is consistent: ask the browser for a few facts first, then use the image to confirm the whole interface.

## Step two: Playwright as the vise

Once the measurements are correct and the screenshot matches the expected result, the exploratory work is over. Playwright enters at that point.

We write an E2E test around the measurable property revealed during diagnosis.

The element must remain inside the viewport. A hit-test at a coordinate must reach the button. The modal must be the last child of its container. A control must remain clickable after an overlay opens.

Playwright is the **vise**. It is more cumbersome than the chisel during exploration, but it holds the property in place over time.

The test stays in the repository, runs in CI, and can execute across multiple browsers.

The order matters.

Using only Playwright would make us guess the assertion while still investigating the cause. Using only Chrome DevTools would solve today's problem without preventing its return.

The separation between diagnosis and enforcement is not an implementation detail. It is the design gate.

## We do not use test-first for visual fixes

Test-first remains effective for pure logic. When we know the inputs, outputs, and invariants, we can describe the behaviour before implementing it.

A visual or geometric fix often begins under different conditions. We do not yet know the correct invariant.

We know something is wrong, but we do not know whether the test should verify coordinates, DOM order, a hit-test result, or a resolved CSS property.

Writing the test at that point means encoding a hypothesis.

Chrome DevTools reveals the measurable fact. Playwright turns that fact into a contract. The E2E test does not discover the bug: **it freezes the property that prevents the bug from returning**.

## Red-on-old is mandatory

Before committing, we verify that the new test genuinely protects against the previous behaviour.

We temporarily set the fix aside, run the test, and watch it fail. Then we restore the change and watch it pass.

That is the red-on-old check: red against the old behaviour, green against the new one.

A test that stays green in both states proves nothing.

It may target the wrong element, use an assertion that is too permissive, or verify a property unrelated to the fix. The check usually takes less than a minute and separates a regression test from mere test code.

## From the design gate to build, verify, ship

The design gate sits inside a broader delivery cycle:

```text
develop
  -> Chrome DevTools: measure live
  -> failing? fix and measure again
  -> correct: take a screenshot
  -> Playwright: red-on-old, then green-on-new
  -> typecheck, lint, and CI
  -> review the diff
  -> commit
```

We keep WIP at one: one active front until it is merged.

Before every commit, we review the diff rather than relying on our memory of what changed.

Our definition of done requires tests at the appropriate layers, E2E first, a screenshot in the recap, green gates, and updated backlog state.

Specs, backlog, and learnings preserve decisions. Chat remains a temporary working environment.

When an item is complete, we clear the context and move to the next one. We do not ask an ever-growing conversation to become the project's database.

For us, automating frontend development did not mean removing human observation. It meant decomposing it.

Screenshots give agents eyes. Chrome DevTools provides measurements. Playwright prevents the correct behaviour from escaping.

First we understand. Then we lock it down. Only then do we ship.
