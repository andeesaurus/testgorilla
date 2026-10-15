/* Formulas & Tips content. Each card's `drill` names the question sub-skill its
 * "Practice this" button draws from. */
(function () {
  "use strict";
  const C = (id, name, formula, example, trap, drill) => ({ id, name, formula, example, trap, drill });

  const SECTIONS = [
    {
      id: "pct", name: "Percentages & growth", cards: [
        C("pct-change", "% change", "(New − Old) ÷ Old × 100", "84 → 97 = +15.5%", "Dividing by the new value", ["NR", "% change"]),
        C("reverse-pct", "Reverse %", "Original = Final ÷ (1 ± r)", "£168 after 30% off → £240", "Adding the % back to the final value", ["NR", "reverse %"]),
        C("pp", "Percentage points vs %", "pp = difference of two rates; % = relative change", "20% → 25% is +5 pp, or +25%", "Treating the two as the same", ["NR", "percentage points"]),
        C("successive", "Successive changes", "(1 + a)(1 + b) − 1", "+10% then −10% = −1%", "Adding the percentages", ["NR", "successive changes"]),
        C("cagr", "CAGR", "(End ÷ Start)^(1/n) − 1", "100 → 121 in 2 yrs = 10%", "Dividing total growth by the number of years", ["NR", "growth/CAGR"]),
        C("rule72", "Rule of 72", "Years to double ≈ 72 ÷ growth %", "8% a year → ~9 years", "Using it at rates above 20%", ["NR", "growth/CAGR"]),
      ],
    },
    {
      id: "biz", name: "Business math", cards: [
        C("margin", "Profit & margin", "Profit = Revenue − Cost; Margin = Profit ÷ Revenue", "4,500 − 3,960 = 540 → 12%", "Mixing £m and £k", ["NR", "margin"]),
        C("markup", "Markup vs margin", "Markup = Profit ÷ Cost; Margin = Profit ÷ Price", "Cost 80, price 100 → 25% markup, 20% margin", "Swapping the bases", ["NR", "margin"]),
        C("break-even", "Break-even", "Units = Fixed costs ÷ (Price − Variable cost)", "1,200 ÷ (50 − 30) = 60 units", "Rounding units down instead of up", ["NR", "break-even"]),
        C("target-profit", "Target profit", "Units = (Fixed costs + Target profit) ÷ Contribution per unit", "(1,200 + 1,010) ÷ 20 = 110.5 → 111", "Same rounding trap", ["NR", "break-even"]),
        C("tiered", "Tiered pricing", "Charge each band only on the volume inside that band", "160 GB: 100 × 6 + 60 × 4 = £840", "Applying the cheaper rate to all units", ["NR", "tiered pricing"]),
        C("roi", "ROI & payback", "ROI = Gain ÷ Investment; Payback = Investment ÷ Annual cash flow", "£500k ÷ £125k/yr = 4 yrs", "Using revenue instead of cash flow", ["NR", "ROI/payback"]),
        C("share", "Market share", "Company sales ÷ Market sales", "30 ÷ 120 = 25%", "Using the wrong market definition", ["NR", "ratios"]),
        C("retention", "Retention (cohort)", "Retained from the opening group ÷ Opening group", "(570 − 90) ÷ 600 = 80%", "Dividing by the closing count", ["WD", "cohort retention"]),
        C("work-rate", "Work rate (person-hours)", "Person-hours per unit = people × hours a day × days ÷ units; Days = units × person-hours per unit ÷ (people × hours a day)", "15 people × 5 h × 10 days ÷ 30 units = 25 person-hours each → 10 units by 10 people at 10 h a day = 250 ÷ 100 = 2.5 days", "Scaling people or hours the wrong way: more workers means fewer days", ["NR", "work rate"]),
        C("units", "Units & per-day rates", "Convert to one unit first (1m = 1,000k; 1 h = 60 min); compare rates per equal period", "£9m − £8,100k = £900k → 10%", "Comparing totals from windows of different length", ["WD", "unit conversion"]),
      ],
    },
    {
      id: "stats", name: "Statistics & probability", cards: [
        C("mean", "Mean", "Sum ÷ Count", "2, 4, 9 → 5", "Averaging averages from groups of different sizes", ["NR", "weighted averages"]),
        C("wavg", "Weighted average", "Σ(weight × value) ÷ Σ weights", "(200 × 30 + 300 × 40) ÷ 500 = 36", "Taking the simple average of averages", ["NR", "weighted averages"]),
        C("median", "Median & mode", "Median = middle value of the sorted list; mode = most frequent value", "3, 5, 9, 20 → median 7", "Not sorting first", ["NR", "statistics"]),
        C("spread", "Range & standard deviation", "Range = Max − Min; SD = spread around the mean (compare, don't calculate)", "The set with values closer together has the lower SD", "Calculating when you only need to compare", ["NR", "statistics"]),
        C("prob", "Probability", "P = favourable ÷ total; P(not A) = 1 − P(A)", "2 red of 8 balls → 25%", "Forgetting the complement shortcut", ["NR", "probability"]),
        C("andor", "And / Or", "P(A and B) = P(A) × P(B) if independent; P(A or B) = P(A) + P(B) − P(A and B)", "0.5 × 0.4 = 0.2", "Double-counting the overlap", ["NR", "probability"]),
        C("ev", "Expected value", "Σ(probability × outcome)", "0.3 × 100 + 0.7 × 20 = 44", "Leaving out the zero or negative outcomes", ["NR", "probability"]),
        C("sequences", "Sequences", "Check differences, then second differences, then ratios", "2, 6, 12, 20, 30 → 42", "Stopping at the first differences", ["PS", "number series"]),
      ],
    },
  ];

  const MENTAL = [
    "Fractions to percents: 1/2 = 50%, 1/3 ≈ 33.3%, 1/4 = 25%, 1/5 = 20%, 1/6 ≈ 16.7%, 1/7 ≈ 14.3%, 1/8 = 12.5%, 1/9 ≈ 11.1%, 1/10 = 10%, 1/11 ≈ 9.1%, 1/12 ≈ 8.3%.",
    "Split percentages: 15% = 10% + 5%; 17.5% = 10% + 5% + 2.5%.",
    "Swap a percentage and its base: 8% of 25 = 25% of 8 = 2.",
    "Multiply by 5 as × 10 ÷ 2, by 25 as × 100 ÷ 4, and by 9 as × 10 − itself.",
    "Round to estimate, then check the options. If they're far apart, estimate and move on.",
    "Track zeros: write k / m / bn next to each number, and remember 1m = 1,000k.",
  ];

  const TIPS = [
    { id: "pacing", name: "Pacing", text: "Divide the time by the number of questions before you start (10:00 ÷ 12 ≈ 50 s). If a question passes 90 s, make your best guess and move on, since you can't come back." },
    { id: "order", name: "Read in this order", text: "The question first, then the exhibit's title, units and period, then the numbers." },
    { id: "elim", name: "Eliminate", text: "Rule out options that are impossible or the wrong order of magnitude before calculating anything." },
    { id: "denom", name: "Choose the right denominator", text: "Before dividing, say out loud what it's “a percentage of”." },
    { id: "critical", name: "Critical thinking", text: "“Must be true” means true in every case, “best supported” means the passage gives the most evidence for it, and “some” means at least one. A correlation alone never proves a cause." },
    { id: "table", name: "Hidden rules in tables", text: "Work the rule out from a complete row (e.g. dividend = profit ÷ shareholders), test it on a second row, then apply it to the missing cell. Don't average the other years." },
    { id: "deal", name: "Deals and synergies", text: "Strategic fit and synergies come from overlap you can combine: shared customers, networks and costs. Market growth tells you how attractive a market is, not how well two firms fit. When you're the seller, weigh what each option costs your own company." },
    { id: "rules", name: "Rule puzzles", text: "List the fixed facts first, then branch on the most constrained item. An option that could be true isn't the same as one that must be true." },
    { id: "bj", name: "Business Judgment", text: "Pick the option that most directly meets the stated objective within its timeline and constraints." },
    { id: "lead", name: "Leadership", text: "Prefer a private, root-cause-first, collaborative response, and escalate only when that fails." },
    { id: "setup", name: "Setup", text: "Have a physical calculator and scratch paper ready if your invite allows them. Use a quiet room and one screen, and close all other tabs. Do the practice example on each test's intro screen; it is not timed." },
    { id: "accuracy", name: "Accuracy over speed", text: "Results reportedly weigh accuracy more heavily, so don't rush easy questions just to bank time." },
  ];

  // Where "One thing to work on" sends each sub-skill.
  const SUB_LINK = {
    "% change": "pct-change", "reverse %": "reverse-pct", "percentage points": "pp", "successive changes": "successive",
    "growth/CAGR": "cagr", "margin": "margin", "break-even": "target-profit", "tiered pricing": "tiered",
    "weighted averages": "wavg", "ratios": "share", "unit conversion": "units", "probability": "prob",
    "statistics": "median", "ROI/payback": "roi", "estimation": "tip:elim", "cohort retention": "retention",
    "definitions": "tip:order", "chart selection": "tip:order", "unequal windows": "units", "per-unit averages": "units",
    "trend reading": "tip:order", "reading exhibits": "tip:order",
    "causal inference": "tip:critical", "sampling bias": "tip:critical", "quantifiers": "tip:critical",
    "hidden assumptions": "tip:critical", "must be true": "tip:critical", "strengthen/weaken": "tip:critical", "best supported": "tip:critical",
    "scheduling": "tip:rules", "ordering": "tip:rules", "resource allocation": "tip:rules", "number series": "sequences", "case facts": "tip:denom",
    "work rate": "work-rate", "table relationships": "tip:table", "deal evaluation": "tip:deal",
    "managing up": "tip:lead", "wellbeing": "tip:lead", "ethics": "tip:lead",
    "objective fit": "tip:bj", "trade-offs": "tip:bj", "risk": "tip:bj",
    "feedback": "tip:lead", "conflict": "tip:lead", "delegation": "tip:lead", "missed deadlines": "tip:lead", "escalation": "tip:lead", "inclusion": "tip:lead",
  };

  window.TG_FORMULAS = { SECTIONS, MENTAL, TIPS, SUB_LINK };
})();
