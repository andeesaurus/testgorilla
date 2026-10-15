/* Question engine data for the Bain screening test simulator.
 *
 * Each question: { id, cat, sub, tier (1-4), src, ex (exhibit or null), stem, opts, sol }
 *   opts: 2-4 options [{ t: text, w: null | "why this option is wrong" }]; exactly one has w === null
 *   sol:  worked-solution steps
 * Tiers: 1 warm-up, 2 core, 3 stretch, 4 challenge.
 * Static items live in bank-*.js and register through TG_DATA.add(). Generators below write
 * fresh-number variants on every draw.
 */
(function () {
  "use strict";

  const SRC = {
    casestar: "Adapted from reference sample · CaseStar",
    casebasix: "Adapted from reference sample · CaseBasix",
    mbb: "Adapted from reference sample · MBB Gorilla",
    shot: "Adapted from your example screenshots",
    orig: "Original",
    gen: "Original · generated numbers",
  };

  // Plain strings in opts are the correct answer; [text, why] pairs are wrong options.
  function Q(id, cat, sub, tier, src, ex, stem, opts, sol) {
    return {
      id, cat, sub, tier, src, ex, stem,
      opts: opts.map((o) => (Array.isArray(o) ? { t: o[0], w: o[1] } : { t: o, w: null })),
      sol,
    };
  }
  const P = (text, title) => ({ type: "passage", title: title || "Passage", text });
  const T = (title, head, rows, note) => ({ type: "table", title, head, rows, note });
  const R = (title, items) => ({ type: "rules", title, items });

  const CATS = {
    CT: { name: "Critical Thinking" },
    WD: { name: "Working with Data" },
    NR: { name: "Numerical Reasoning" },
    PS: { name: "Problem Solving" },
    BJ: { name: "Business Judgment" },
    LP: { name: "Leadership & People Management" },
  };

  const BANK = [];
  const add = (...qs) => BANK.push(...qs);

  /* ------------------------------------------------------------------ */
  /* Unscored examples, one per test intro                              */
  /* ------------------------------------------------------------------ */
  const EXAMPLES = {
    NR: Q("ex-nr", "NR", "% change", 1, SRC.casestar,
      T("Halden Group, quarterly revenue (£000)", ["Segment", "Prior quarter", "Current quarter"], [["Consulting", "2,000", "2,240"], ["Software", "800", "1,000"]]),
      "By what percentage did Consulting revenue increase?",
      [["112%", "Ratio new ÷ old."], ["10.7%", "Divides by the new value."], "12%", ["25%", "The Software figure."]],
      ["(2,240 − 2,000) ÷ 2,000 = 240 ÷ 2,000 = 12%."]),
    WD: Q("ex-wd", "WD", "cohort retention", 2, SRC.casestar,
      T("Member cohort", ["Measure", "Members"], [["Opening members", "800"], ["Closing members", "760"], ["New members in the closing total", "120"]], "Closing members are retained opening members plus new members. Nobody rejoined."),
      "What percentage of the opening cohort is retained at closing?",
      [["20%", "That's the churn rate."], ["95%", "Closing ÷ opening, which includes new members."], "80%", ["84.2%", "Uses the closing base (640 ÷ 760)."]],
      ["Retained = 760 − 120 = 640.", "640 ÷ 800 = 80%."]),
    CT: Q("ex-ct", "CT", "must be true", 1, SRC.orig,
      P("All trainees attend the Friday workshop. Lee attends the Friday workshop."),
      "Which statement must be true?",
      [["Lee is a trainee.", "Affirms the consequent."], ["Lee is not a trainee.", "Not implied either."], "Lee's role cannot be determined from this.", ["Only trainees attend the workshop.", "Reverses the rule."]],
      ["Trainee → attends. Attending doesn't tell you whether someone is a trainee."]),
    PS: Q("ex-ps", "PS", "number series", 1, SRC.orig, null,
      "What is the next number in the sequence: 6, 11, 16, 21, ?",
      [["25", "Added 4."], "26", ["27", "Added 6."], ["42", "Doubled 21."]],
      ["Each term adds 5: 21 + 5 = 26."]),
    BJ: Q("ex-bj", "BJ", "objective fit", 1, SRC.orig,
      P("A bakery chain wants more lunchtime customers within one month.", "Client scenario"),
      "Which option best fits the goal?",
      ["A lunch meal deal promoted to nearby offices", ["A new store design rolled out over two years", "Too slow."], ["Longer evening opening hours", "Wrong time of day."], ["A new central bakery", "Doesn't bring in lunch customers."]],
      ["Pick the option that hits the stated goal within its timeline."]),
    LP: Q("ex-lp", "LP", "feedback", 1, SRC.orig,
      P("A teammate's analysis is good, but they always share it at the last minute.", "Workplace scenario"),
      "What is the best first action?",
      ["Give them private, specific feedback and agree earlier check-in points", ["Tell the manager", "Too early to escalate."], ["Set them earlier fake deadlines without telling them", "Not transparent."], ["Ignore it because the work is good", "The timing problem continues."]],
      ["Private, specific, forward-looking feedback first."]),
  };

  /* ------------------------------------------------------------------ */
  /* Generated items: fresh numbers each draw, same trap design          */
  /* ------------------------------------------------------------------ */
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const r2 = (x) => Math.round(x * 100) / 100;
  const num = (x) => {
    const v = Math.abs(x) >= 1000 ? Math.round(x) : r2(x);
    return Number.isInteger(v) ? v.toLocaleString("en-GB") : v.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  };
  const pct = (x) => {
    const v = Math.round(x * 10) / 10;
    return (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace("-", "−") + "%";
  };
  const money = (sym) => (x) => (x < 0 ? "−" : "") + sym + (Number.isInteger(r2(x)) ? num(Math.abs(r2(x))) : Math.abs(r2(x)).toFixed(2));
  const gbp = money("£");
  const usd = money("$");
  const cur = () => pick([gbp, usd, money("€")]);
  const days = (x) => {
    const v = r2(x);
    return (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, "")) + " days";
  };

  const GENERATORS = {
    NR: [
      function pctChange() {
        const old = pick([80, 120, 160, 200, 240, 400, 500, 800]);
        const p = pick([5, 10, 15, 20, 25, 30, 40]);
        const nw = old * (1 + p / 100);
        if (!Number.isInteger(nw)) return null;
        const label = pick(["Monthly orders", "Website sign-ups", "Support tickets closed", "App downloads"]);
        return Q(`g-pct-${old}-${p}`, "NR", "% change", 1, SRC.gen,
          T(label, ["Period", "Count"], [["Last month", num(old)], ["This month", num(nw)]]),
          `By what percentage did ${label.toLowerCase()} increase?`,
          [pct(p),
           [pct(((nw - old) / nw) * 100), "Divided the change by the new value."],
           [pct(nw - old), "Used the absolute change as if it were a percentage."],
           [pct((nw / old) * 100), "That's the ratio new ÷ old, not the change."]],
          [`(${num(nw)} − ${num(old)}) ÷ ${num(old)} = ${pct(p)}.`]);
      },
      function reversePct() {
        const d = pick([10, 20, 25, 30, 40]);
        const orig = pick([150, 200, 250, 300, 350, 400, 450, 500, 600]);
        const fin = orig * (1 - d / 100);
        if (!Number.isInteger(fin)) return null;
        const m = cur();
        return Q(`g-rev-${orig}-${d}`, "NR", "reverse %", 2, SRC.gen,
          T("Supplier invoice, no tax", ["Item", "Value"], [["Amount paid", m(fin)], ["Discount on list price", `${d}%`]]),
          "What was the list price before the discount?",
          [m(orig),
           [m(fin * (1 + d / 100)), `Added ${d}% to the price paid instead of dividing by ${1 - d / 100}.`],
           [m(fin * (1 - d / 100)), `Took ${d}% off again.`],
           [m(fin / (d / 100)), `Divided by the discount rate (${d / 100}) instead of ${1 - d / 100}.`]],
          [`Price paid = list × ${1 - d / 100}.`, `${m(fin)} ÷ ${1 - d / 100} = ${m(orig)}.`]);
      },
      function weightedAvg() {
        const n1 = pick([100, 200, 300]), n2 = pick([400, 500, 600]);
        const a = pick([40, 50, 60, 70]), b = pick([75, 80, 85, 90]);
        const right = (n1 * a + n2 * b) / (n1 + n2);
        const swap = (n2 * a + n1 * b) / (n1 + n2);
        return Q(`g-wavg-${n1}-${n2}-${a}-${b}`, "NR", "weighted averages", 2, SRC.gen,
          T("Training completion", ["Office", "Staff", "Completion rate"], [["Office 1", num(n1), `${a}%`], ["Office 2", num(n2), `${b}%`]]),
          "What is the completion rate across both offices?",
          [pct(right),
           [pct((a + b) / 2), "Simple average of the two rates, ignoring office size."],
           [pct(swap), "Swapped the weights between the offices."],
           [pct(b), "Used only the larger office's rate."]],
          [`Completed: ${num(n1)} × ${a}% + ${num(n2)} × ${b}% = ${num(n1 * a / 100 + n2 * b / 100)}.`, `÷ ${num(n1 + n2)} = ${pct(right)}.`]);
      },
      function tiered() {
        const th = pick([50, 100, 200]);
        const hi = pick([5, 6, 8]), lo = hi - pick([2, 3]);
        const u = th + pick([20, 40, 60, 80]);
        const right = th * hi + (u - th) * lo;
        const m = cur();
        return Q(`g-tier-${th}-${hi}-${lo}-${u}`, "NR", "tiered pricing", 2, SRC.gen,
          T("Cloud data tariff, marginal bands", ["Band", "Rate"], [[`First ${th} GB`, `${m(hi)} per GB`], [`Each GB above ${th}`, `${m(lo)} per GB`]], `Usage this month: ${u} GB.`),
          "What is the total bill?",
          [m(right),
           [m(u * lo), "Applied the cheaper rate to all usage."],
           [m(u * hi), "Applied the higher rate to all usage."],
           [m((u - th) * lo), "Charged only the usage above the threshold."]],
          [`${th} × ${m(hi)} = ${m(th * hi)}.`, `${u - th} × ${m(lo)} = ${m((u - th) * lo)}.`, `Total ${m(right)}.`]);
      },
      function targetProfit() {
        const price = pick([40, 50, 60, 80]), vc = price - pick([15, 20, 25]);
        const cm = price - vc;
        const fixed = pick([1500, 2000, 2400, 3000]);
        const target = pick([1010, 1240, 1530, 2110]);
        const exact = (fixed + target) / cm;
        if (Number.isInteger(exact)) return null;
        const right = Math.ceil(exact);
        return Q(`g-tp-${price}-${vc}-${fixed}-${target}`, "NR", "break-even", 3, SRC.gen,
          T("Product launch", ["Item", "Value"], [["Fixed costs", gbp(fixed)], ["Price per unit", gbp(price)], ["Variable cost per unit", gbp(vc)]], `Every unit produced is sold. Target: at least ${gbp(target)} profit.`),
          "What is the minimum number of whole units that must be sold?",
          [`${right} units`,
           [`${Math.floor(exact)} units`, `Rounded ${r2(exact)} down, which falls short of the target.`],
           [`${Math.ceil(fixed / cm)} units`, "That's break-even only; it ignores the profit target."],
           [`${Math.ceil((fixed + target) / price)} units`, "Divided by the price instead of the contribution."]],
          [`Contribution = ${gbp(price)} − ${gbp(vc)} = ${gbp(cm)}.`, `(${num(fixed)} + ${num(target)}) ÷ ${cm} = ${r2(exact)}.`, `Round up: ${right} units.`]);
      },
      function margin() {
        const rev = pick([2000, 2400, 3000, 4000, 5000]);
        const m = pick([10, 15, 20, 25, 30, 40]);
        const cost = rev * (1 - m / 100);
        return Q(`g-mar-${rev}-${m}`, "NR", "margin", 1, SRC.gen,
          T("Product line, annual figures (000)", ["Revenue", "Total costs"], [[num(rev), num(cost)]]),
          "What is the profit margin as a percentage of revenue?",
          [pct(m),
           [pct(((rev - cost) / cost) * 100), "That's the markup (profit ÷ cost)."],
           [pct((cost / rev) * 100), "Costs ÷ revenue."],
           [pct((rev / cost) * 100), "Revenue ÷ costs."]],
          [`Profit = ${num(rev)} − ${num(cost)} = ${num(rev - cost)}.`, `${num(rev - cost)} ÷ ${num(rev)} = ${pct(m)}.`]);
      },
      function cagr() {
        const g = pick([10, 20, 30, 50]);
        const start = pick([100, 200, 400, 500]);
        const end = start * (1 + g / 100) ** 2;
        const tot = ((1 + g / 100) ** 2 - 1) * 100;
        return Q(`g-cagr-${start}-${g}`, "NR", "growth/CAGR", 3, SRC.gen,
          T("Subscribers (thousands)", ["Year", "Subscribers"], [["Year 0", num(start)], ["Year 2", num(end)]]),
          "What is the compound annual growth rate?",
          [pct(g),
           [pct(tot / 2), "Divided total growth by the number of years."],
           [pct(tot), "That's total growth over both years."],
           [pct(Math.sqrt(tot / 100) * 100), "Took the square root of the growth rate instead of the ratio."]],
          [`${num(end)} ÷ ${num(start)} = ${r2(end / start)}.`, `√${r2(end / start)} = ${1 + g / 100}, so CAGR = ${pct(g)}.`]);
      },
      function ppVsPct() {
        const a = pick([10, 20, 25, 40, 50]);
        const b = a + pick([5, 10, 15]);
        if (b >= 100) return null;
        return Q(`g-pp-${a}-${b}`, "NR", "percentage points", 2, SRC.gen,
          T("Email open rate", ["Campaign", "Open rate"], [["Previous", `${a}%`], ["Latest", `${b}%`]]),
          "By what percentage did the open rate increase?",
          [pct(((b - a) / a) * 100),
           [pct(b - a), "That's the change in percentage points."],
           [pct(((b - a) / b) * 100), "Divided the change by the new rate."],
           [pct((b / a) * 100), "That's the ratio new ÷ old."]],
          [`Change: ${b} − ${a} = ${b - a} pp.`, `Relative: ${b - a} ÷ ${a} = ${pct(((b - a) / a) * 100)}.`]);
      },
      // Person-hours: adapted from the "15 people, 5 hours a day, 30 units, 10 days" example.
      function workRate() {
        const p1 = pick([8, 10, 12, 15, 20]), h1 = pick([4, 5, 6, 8]), d1 = pick([5, 6, 8, 10, 12]);
        const phPerUnit = pick([4, 5, 6, 8, 10, 12, 16, 20, 24, 25]);
        const u1 = (p1 * h1 * d1) / phPerUnit;
        if (!Number.isInteger(u1)) return null;
        const p2 = pick([4, 5, 6, 8, 10, 12, 16]), h2 = pick([5, 6, 8, 9, 10]);
        if (p2 === p1 && h2 === h1) return null;
        const u2 = pick([u1 / 3, u1 / 2, u1, u1 * 1.5, u1 * 2].filter((x) => Number.isInteger(x) && x > 0));
        const d2 = (u2 * phPerUnit) / (p2 * h2);
        if (!Number.isInteger(d2 * 2) || d2 < 1 || d2 > 40) return null;
        const ignoreHours = (u2 * p1 * d1) / (u1 * p2);
        const ignoreUnits = (u1 * phPerUnit) / (p2 * h2);
        const wrongWay = d1 * (p2 / p1) * (h2 / h1) * (u2 / u1);
        const tier = u2 === u1 ? 3 : 4;
        return Q(`g-work-${p1}-${h1}-${d1}-${u1}-${p2}-${h2}-${u2}`, "NR", "work rate", tier, SRC.shot, null,
          `${p1} people working ${h1} hours a day make ${u1} units of a product in ${d1} days. Everyone works at the same rate and nothing else changes. In how many days can ${p2} people make ${u2} units if each works ${h2} hours a day?`,
          [days(d2),
           [days(ignoreHours), "Scaled people and units but ignored the change in hours per day."],
           [days(ignoreUnits), `Kept the original ${u1} units instead of ${u2}.`],
           [days(wrongWay), "Scaled people and hours the wrong way: more workers means fewer days."]],
          [`Person-hours per unit = ${p1} × ${h1} × ${d1} ÷ ${u1} = ${phPerUnit}.`, `${u2} units need ${u2} × ${phPerUnit} = ${num(u2 * phPerUnit)} person-hours.`, `${p2} × ${h2} = ${p2 * h2} person-hours a day, so ${num(u2 * phPerUnit)} ÷ ${p2 * h2} = ${days(d2)}.`]);
      },
      function weightedMissing() {
        const nA = pick([200, 300, 400, 600]), nB = pick([100, 200, 300, 400]);
        const a = pick([70, 75, 80, 85, 90]), b = pick([40, 45, 50, 55, 60]);
        const comb = (nA * a + nB * b) / (nA + nB);
        if (Math.round(comb * 10) !== comb * 10) return null;
        return Q(`g-wmiss-${nA}-${nB}-${a}-${b}`, "NR", "weighted averages", 4, SRC.gen,
          T("Customer satisfaction survey", ["Segment", "Respondents", "Satisfied"], [["Retail", num(nA), `${a}%`], ["Business", num(nB), "?"], ["All respondents", num(nA + nB), pct(comb)]]),
          "What percentage of business respondents were satisfied?",
          [pct(b),
           [pct(2 * comb - a), "Treated the overall rate as a simple average of the two segments."],
           [pct(comb), "Assumed business matches the overall rate."],
           [pct(((nA + nB) * comb - nA * a) / (nA + nB)), "Divided the business count by all respondents instead of business only."]],
          [`Satisfied overall: ${num(nA + nB)} × ${pct(comb)} = ${num((nA + nB) * comb / 100)}.`, `Retail: ${num(nA)} × ${a}% = ${num(nA * a / 100)}.`, `Business: ${num((nA + nB) * comb / 100 - nA * a / 100)} ÷ ${num(nB)} = ${pct(b)}.`]);
      },
      function successiveReverse() {
        const up = pick([10, 20, 25, 50]), down = pick([10, 20, 25]);
        const orig = pick([100, 200, 240, 400, 500, 800]);
        const fin = orig * (1 + up / 100) * (1 - down / 100);
        if (!Number.isInteger(fin * 100)) return null;
        const net = (1 + up / 100) * (1 - down / 100);
        const m = cur();
        return Q(`g-sucrev-${orig}-${up}-${down}`, "NR", "successive changes", 4, SRC.gen, null,
          `A product's price rose ${up}% and was then cut by ${down}%. It now sells for ${m(fin)}. What was the price before both changes?`,
          [m(orig),
           [m(fin / (1 + (up - down) / 100)), `Netted the changes to ${up - down >= 0 ? "+" : "−"}${Math.abs(up - down)}% instead of multiplying.`],
           [m(fin * net), "Applied both changes again instead of reversing them."],
           [m(fin * (1 - up / 100) * (1 + down / 100)), "Reversed each step by flipping the sign of the percentage."]],
          [`Net factor = ${1 + up / 100} × ${1 - down / 100} = ${r2(net)}.`, `${m(fin)} ÷ ${r2(net)} = ${m(orig)}.`]);
      },
    ],
    WD: [
      function retention() {
        const open = pick([400, 500, 600, 800, 1000]);
        const r = pick([60, 70, 75, 80, 85, 90]);
        const nw = pick([40, 60, 90, 120, 150]);
        const kept = (open * r) / 100;
        const close = kept + nw;
        return Q(`g-ret-${open}-${r}-${nw}`, "WD", "cohort retention", 2, SRC.gen,
          T("Subscriber cohort", ["Measure", "Subscribers"], [["Opening subscribers", num(open)], ["Closing subscribers", num(close)], ["New subscribers in the closing total", num(nw)]], "No subscribers reactivated."),
          "What percentage of the opening cohort is retained at closing?",
          [pct(r),
           [pct((kept / close) * 100), "Used the closing count as the base."],
           [pct((close / open) * 100), "Closing ÷ opening, which includes new subscribers."],
           [pct(100 - r), "That's the churn rate."]],
          [`Retained = ${num(close)} − ${num(nw)} = ${num(kept)}.`, `${num(kept)} ÷ ${num(open)} = ${pct(r)}.`]);
      },
      function windows() {
        const d1 = pick([4, 5, 6]), d2 = pick([7, 8, 10]);
        const v1 = pick([200, 300, 400, 500]);
        const g = pick([10, 20, 25, 30]);
        const v2 = v1 * (1 + g / 100);
        const t1 = d1 * v1, t2 = d2 * v2;
        return Q(`g-win-${d1}-${d2}-${v1}-${g}`, "WD", "unequal windows", 2, SRC.gen,
          T("Pop-up shop sales, all open days included", ["Period", "Open days", "Sales (£)"], [["First run", String(d1), num(t1)], ["Second run", String(d2), num(t2)]]),
          "By what percentage did average sales per open day increase?",
          [pct(g),
           [pct((t2 / t1 - 1) * 100), "Compared totals from runs of different length."],
           [pct((d2 / d1 - 1) * 100), "Compared the number of open days."],
           [pct(((v2 - v1) / v2) * 100), "Divided the change by the later daily figure."]],
          [`First: ${num(t1)} ÷ ${d1} = £${num(v1)} a day.`, `Second: ${num(t2)} ÷ ${d2} = £${num(v2)} a day.`, `${num(v2)} ÷ ${num(v1)} − 1 = ${pct(g)}.`]);
      },
      function unitMargin() {
        const rev = pick([4, 5, 6, 8, 12]);
        const m = pick([8, 10, 12, 15, 20, 25]);
        const costK = rev * 1000 * (1 - m / 100);
        return Q(`g-um-${rev}-${m}`, "WD", "unit conversion", 2, SRC.gen,
          T("Division reports, same division and year", ["Line", "Figure", "Unit"], [["Revenue", String(rev), "£ million"], ["Operating costs", num(costK), "£ thousand"]], "Operating profit = revenue − operating costs."),
          "What is the operating profit margin?",
          [pct(m),
           [pct((m / (100 - m)) * 100), "Profit ÷ costs, the wrong base."],
           [pct(100 - m), "Costs ÷ revenue."],
           ["A loss", "Compared £m with £k without converting."]],
          [`Revenue = £${rev}m = £${num(rev * 1000)}k.`, `Profit = ${num(rev * 1000)} − ${num(costK)} = £${num(rev * 1000 - costK)}k.`, `Margin = ${pct(m)}.`]);
      },
      // Hidden rule in a table: adapted from the "dividend per shareholder" example.
      function tableRule() {
        const cents = (x) => "$" + (Math.round(x * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const k = pick([200, 250, 400, 500]);
        const ovh = pick([0.2, 0.25, 0.3]);
        const years = ["2021", "2022", "2023", "2024"];
        const rows = [];
        for (let i = 0; i < 4; i++) {
          const cost = pick([4000, 6000, 8000, 10000, 12000, 15000, 20000]);
          const sales = cost * pick([2, 2.5, 3]);
          const profit = sales - cost - cost * ovh;
          rows.push({ cost, o: cost * ovh, sales, profit, per: profit / k });
        }
        if (new Set(rows.map((r) => r.profit)).size < 4) return null;
        const miss = ri(0, 3);
        const m = rows[miss];
        const others = rows.filter((_, i) => i !== miss);
        const avg = others.reduce((s, r) => s + r.per, 0) / 3;
        const label = pick([["Dividend per shareholder", "shareholders"], ["Bonus per employee", "employees"]]);
        return Q(`g-rule-${k}-${ovh}-${rows.map((r) => r.cost + "x" + r.sales).join("-")}-${miss}`, "WD", "table relationships", 3, SRC.shot,
          T("Company figures, four years ($)", ["Year", "Production cost", "Overhead", "Sales", "Profit", label[0]],
            rows.map((r, i) => [years[i], num(r.cost), num(r.o), num(r.sales), num(r.profit), i === miss ? "?" : cents(r.per)]),
            `The relationships between the columns stay the same every year. The number of ${label[1]} doesn't change.`),
          `What should the ${label[0].toLowerCase()} have been in ${years[miss]}?`,
          [cents(m.per),
           [cents(m.sales / k), "Divided sales instead of profit by the head count."],
           [cents((m.sales - m.cost) / k), "Left out overhead when working out profit."],
           [cents(avg), "Averaged the other years instead of finding the rule."]],
          [`Find the rule from a complete row: ${num(others[0].profit)} ÷ ${cents(others[0].per)} = ${k}, so the figure is profit ÷ ${k}.`, `Check it on a second row: ${num(others[1].profit)} ÷ ${k} = ${cents(others[1].per)}.`, `${years[miss]}: ${num(m.profit)} ÷ ${k} = ${cents(m.per)}.`]);
      },
    ],
    PS: [
      function series() {
        const a = ri(2, 9), d = ri(2, 5), s = ri(1, 3);
        const seq = [a];
        let diff = d;
        for (let i = 0; i < 5; i++) { seq.push(seq[seq.length - 1] + diff); diff += s; }
        const ans = seq.pop();
        const last = seq[seq.length - 1];
        const lastDiff = diff - 2 * s;
        return Q(`g-ser-${a}-${d}-${s}`, "PS", "number series", 2, SRC.gen, null,
          `What is the next number in the sequence: ${seq.join(", ")}, ?`,
          [String(ans),
           [String(last + lastDiff), "Repeated the last difference."],
           [String(ans + s), "Grew the difference by too much."],
           [String(last * 2), "Doubled the last term."]],
          [`Differences rise by ${s} each time.`, `Next difference: ${lastDiff + s}. ${last} + ${lastDiff + s} = ${ans}.`]);
      },
      function combinedRate() {
        const [a, b] = pick([[6, 3], [12, 4], [10, 15], [12, 6], [20, 5], [8, 24]]);
        const t = (a * b) / (a + b);
        return Q(`g-rate-${a}-${b}`, "PS", "work rate", 3, SRC.gen, null,
          `Machine A finishes a batch in ${a} hours and Machine B finishes the same batch in ${b} hours. Working together at those rates, how long do they take to finish one batch?`,
          [`${r2(t)} hours`,
           [`${r2((a + b) / 2)} hours`, "Averaged the two times."],
           [`${a + b} hours`, "Added the times instead of the rates."],
           [`${r2(Math.min(a, b) / 2)} hours`, "Halved the faster machine's time, as if both were equally fast."]],
          [`Rates: 1/${a} + 1/${b} = ${a + b}/${a * b} of a batch per hour.`, `Time = ${a * b} ÷ ${a + b} = ${r2(t)} hours.`]);
      },
    ],
  };

  function valid(q) {
    if (!q) return false;
    const texts = q.opts.map((o) => o.t);
    return new Set(texts).size === texts.length;
  }

  function generate(cat) {
    const gens = GENERATORS[cat] || [];
    if (!gens.length) return null;
    for (let i = 0; i < 40; i++) {
      const q = pick(gens)();
      if (valid(q)) return q;
    }
    return null;
  }

  function generateFor(cat, sub) {
    const gens = GENERATORS[cat] || [];
    for (let i = 0; i < 80; i++) {
      const q = pick(gens)();
      if (valid(q) && q.sub === sub) return q;
    }
    return null;
  }

  window.TG_DATA = { CATS, BANK, EXAMPLES, GENERATORS, generate, generateFor, add, Q, P, T, R, SRC };
})();
