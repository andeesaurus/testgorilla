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

## Question bank (`js/questions.js`, `js/bank-*.js`)
- 163 fixed questions across six categories, in four tiers: L1 warm-up, L2 core, L3 stretch, L4 challenge.
- Every earlier question was rewritten with new numbers, contexts and wording, keeping its trap.
  Reference samples (CaseStar, CaseBasix, MBB Gorilla) and the example screenshots appear only in adapted form.
- New formats from the screenshots: person-hours work-rate problems, hidden rules in multi-year tables,
  two-option "what insight would help most" judgment questions, and stress/workload people scenarios.
- Generators write fresh-number questions on every draw (Numerical Reasoning, Working with Data, Problem Solving),
  including L3/L4 work-rate, missing-segment weighted averages, reversed successive changes and table-rule items.

## Difficulty
- Within each test, questions run from easiest to hardest.
- Progressive difficulty (default): each finished full mock moves the next one up a level, from the standard
  3/6/3 mix to a mix weighted towards L3 and L4. A fixed level can be chosen in Setup.
- Questions you have answered correctly are held back from later draws while fresh ones remain.

Independent practice tool. Not affiliated with or endorsed by Bain & Company or TestGorilla.
