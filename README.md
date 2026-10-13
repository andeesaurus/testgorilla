# Bain Screening Test Simulator

A browser-based practice simulator for the Bain online screening assessment, built from the PRD
("PRD: Bain TestGorilla Assessment Simulator") and the reference sample question set.
Open `index.html` in a browser. It's fully client-side, with no build step or backend.

## What's in it
- **Simulator tab**: Full mock (Bain 2026 standard, Legacy US, or Custom lineup), Single test, and Practice.
  10:00 per test, 12–15 questions chosen at random by default (or fixed 10–15), answers lock on submit,
  no Back button, the timer survives refresh and auto-submits at 0:00, and each test opens with an unscored example.
- **Results**: score per test, time per question (fast / on pace / slow), "One thing to work on" with a
  5-question drill, and a full review with worked solutions and "Why your choice does not work".
- **Formulas & Tips tab**: searchable cards with "Practice this" drills. It's locked during timed tests.
- **History tab**: per-device history with accuracy and pace charts, plus export, import and reset.

## Question bank (`js/questions.js`)
- 25 reference sample items (CaseStar, CaseBasix, MBB Gorilla), each labelled with its source in the review.
  The flawed CaseBasix sequence item (81, 54, 36, 24) is left out.
- 91 original items across all six categories, plus generators that write new Numerical Reasoning,
  Working with Data and number-series questions with fresh numbers on every draw.
- Every wrong option carries the named mistake behind it.

Independent practice tool. Not affiliated with or endorsed by Bain & Company or TestGorilla.
