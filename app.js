const STORAGE_KEY = "buildrange-estimate-v10";
const LEGACY_STORAGE_KEYS = ["buildrange-estimate-v9", "buildrange-estimate-v8", "buildrange-estimate-v7", "buildrange-estimate-v6"];
const ESTIMATE_LIBRARY_KEY = "buildrange-estimate-library-v1";
const JLC_SOURCE = "https://www.jlconline.com/cost-vs-value/2025/";
const NAHB_SOURCE = "https://www.nahb.org/blog/2025/10/square-foot-prices";
const units = [...new Set(COST_DATABASE.map(item => item.unit).concat(["LS", "SF", "LF", "EA", "CY", "SQ", "HR", "DAY", "WK", "MO", "TON"]))];
const divisions = [...new Set(COST_DATABASE.map(item => item.division))];
const costById = Object.fromEntries(COST_DATABASE.map(item => [item.id, item]));
const CHAPELWOOD_BENCHMARK = {
  name: "329 Chapelwood cottage home",
  hvacSquareFeet: 1606,
  underRoofSquareFeet: 2265,
  directConstruction: 170788,
  builderOhp: 17139,
  totalProforma: 214273,
  divisions: [
    ["Framing", 33815],
    ["Exterior", 24769],
    ["MEP", 24609],
    ["Interior Finishes", 21329],
    ["Concrete & Foundation", 20735],
    ["Cabinetry & Counters", 16139],
    ["Site Work", 14568],
    ["Insulation & Drywall", 10194],
    ["General Conditions", 3709],
    ["Closeout", 921]
  ]
};
const ALLOWANCE_CATEGORIES = [
  { name: "Lighting fixtures", lowRate: 0.008, targetRate: 0.0125, highRate: 0.018, note: "Decorative and installed fixture allowance" },
  { name: "Plumbing fixtures", lowRate: 0.012, targetRate: 0.018, highRate: 0.025, note: "Faucets, sinks, toilets, tubs, and showers" },
  { name: "Flooring", lowRate: 0.025, targetRate: 0.04, highRate: 0.06, note: "Material and typical installation allowance" },
  { name: "Countertops", lowRate: 0.008, targetRate: 0.013, highRate: 0.02, note: "Kitchen, bath, and utility work surfaces" },
  { name: "Cabinetry", lowRate: 0.035, targetRate: 0.055, highRate: 0.08, note: "Kitchen, bath, and built-in cabinet allowance" },
  { name: "Appliances", lowRate: 0.015, targetRate: 0.025, highRate: 0.04, note: "Kitchen and laundry appliance allowance" }
];
const PROPOSAL_WORKBOOK_REFERENCE = {
  source: "Proposal Spreadsheet.xlsx",
  squareFeet: 2500,
  bands: [
    { name: "Builder grade construction", low: 125, high: 175 },
    { name: "Mid grade construction", low: 175, high: 250 },
    { name: "High-end custom build", low: 180, high: 500 }
  ],
  phases: [
    { name: "Site work", low: 5, high: 15 },
    { name: "Foundation", low: 8, high: 18 },
    { name: "Concrete", low: 4, high: 12 },
    { name: "Framing", low: 20, high: 40 },
    { name: "Roofing", low: 4, high: 10 },
    { name: "Windows and doors", low: 6, high: 15 },
    { name: "Plumbing", low: 10, high: 20 },
    { name: "Electrical", low: 8, high: 18 },
    { name: "HVAC", low: 8, high: 18 },
    { name: "Insulation", low: 2, high: 5 },
    { name: "Drywall", low: 6, high: 12 },
    { name: "Paint", low: 3, high: 8 },
    { name: "Cabinets", low: 10, high: 35 },
    { name: "Countertops", low: 4, high: 15 },
    { name: "Floors", low: 5, high: 15 },
    { name: "Appliances", low: 3, high: 12 },
    { name: "Landscaping", low: 5, high: 25 }
  ]
};

const nationalBenchmarks = {
  kitchen: {
    title: "Detailed kitchen assembly with national unit costs",
    description: "Workbook line items are checked against JLC's 2025 national kitchen benchmarks: $28,458 minor, $82,793 major midrange, and $164,104 upscale.",
    summary: "$28,458 / $82,793 / $164,104",
    source: JLC_SOURCE,
    projectType: "Kitchen remodel"
  },
  bathroom: {
    title: "Detailed bathroom assembly with national unit costs",
    description: "Workbook line items are checked against JLC's 2025 national bath benchmarks: $26,138 midrange and $81,612 upscale.",
    summary: "$26,138 - $81,612",
    source: JLC_SOURCE,
    projectType: "Bathroom remodel"
  },
  addition: {
    title: "Detailed home-addition assembly",
    description: "Includes site work, driveway, footings, concrete, reinforcing, slab and crawlspace alternatives, framing, envelope, MEP, and finishes.",
    summary: "$80 - $200/SF build-out",
    source: "https://www.angi.com/articles/how-much-do-home-additions-cost.htm",
    projectType: "Home addition"
  },
  custom: {
    title: "Detailed custom-home assembly",
    description: "Workbook national unit costs with separate site, concrete/foundation, framing, envelope, MEP, and finish phases.",
    summary: "$280 - $450/SF custom-home guide",
    source: NAHB_SOURCE,
    projectType: "Custom home build"
  },
  customScope: {
    title: "Custom detailed scope",
    description: "Line items come from the imported workbook cost database and retain their cost code, division, phase, description, and national range.",
    summary: "Workbook national unit costs",
    source: JLC_SOURCE
  }
};

let items = [];
let activeBenchmark = "kitchen";
let selectedFoundationMethod = "slab";
let selectedFramingMethod = "package";
let selectedHvacMethod = "package";
let saveTimer;

const $ = id => document.getElementById(id);
const money = (value, compact = false) => {
  const safe = Number.isFinite(value) ? value : 0;
  if (compact && Math.abs(safe) >= 1000000) return `$${(safe / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (compact && Math.abs(safe) >= 1000) return `$${Math.round(safe / 1000)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(safe);
};
const numberValue = id => Math.max(0, Number($(id).value) || 0);
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const roundQty = value => Math.max(0, Math.round(value * 100) / 100);

function generateEstimateId() {
  const now = new Date();
  return `EST-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function marketFactor() {
  return 1 - localDiscountPercent() / 100;
}

function localDiscountPercent() {
  return Math.min(50, Math.max(0, Number($("localDiscount").value) || 0));
}

function clientRangePercent() {
  return Math.min(35, Math.max(5, Number($("clientRangePercent").value) || 12));
}

function clientProposalRange(totals) {
  const rangeRate = clientRangePercent() / 100;
  const expected = totals.mid.total;
  let low = expected * (1 - rangeRate);
  let mid = expected;
  let high = expected * (1 + rangeRate);
  if ($("roundTotals").checked) {
    low = Math.floor(low / 1000) * 1000;
    mid = Math.round(mid / 1000) * 1000;
    high = Math.ceil(high / 1000) * 1000;
  }
  return { low, mid, high, percent: clientRangePercent() };
}

function finishLevelFor(pricePerSquareFoot) {
  if (pricePerSquareFoot <= 200) return ["Value focused", "Durable standard selections with upgrades kept to priority areas."];
  if (pricePerSquareFoot <= 300) return ["Standard custom", "Balanced selections with upgraded finishes in priority areas."];
  if (pricePerSquareFoot <= 400) return ["Premium custom", "Broader use of premium fixtures, surfaces, cabinetry, and flooring."];
  return ["Luxury custom", "High-design selections, specialty materials, and premium fixture packages."];
}

function updateAllowancePlanner() {
  const squareFeet = Math.max(100, Number($("plannerSquareFeet").value) || 2000);
  const pricePerSquareFoot = Math.max(150, Number($("pricePerSquareFoot").value) || 275);
  const budget = squareFeet * pricePerSquareFoot;
  const [level, description] = finishLevelFor(pricePerSquareFoot);
  const targetAllowance = ALLOWANCE_CATEGORIES.reduce((total, category) => total + budget * category.targetRate, 0);

  $("pricePerSquareFootOutput").textContent = money(pricePerSquareFoot);
  $("plannerBudget").textContent = money(budget);
  $("finishLevel").textContent = level;
  $("finishLevelDescription").textContent = description;
  $("plannerAllowanceTotal").textContent = money(targetAllowance);
  $("plannerAllowanceShare").textContent = `${(targetAllowance / budget * 100).toFixed(1)}% of this planning scenario`;
  $("allowanceResults").innerHTML = ALLOWANCE_CATEGORIES.map(category => `
    <article class="allowance-result">
      <span>${escapeHtml(category.name)}</span>
      <strong>${money(budget * category.lowRate)} - ${money(budget * category.highRate)}</strong>
      <small>Suggested target ${money(budget * category.targetRate)} · ${escapeHtml(category.note)}</small>
    </article>
  `).join("");
}

function syncPlannerSquareFeet() {
  const projectSquareFeet = Number($("squareFootage").value);
  if (projectSquareFeet > 0) {
    $("plannerSquareFeet").value = projectSquareFeet;
    updateAllowancePlanner();
    showToast("Planner square footage updated");
    return;
  }
  showToast("Enter project square footage first");
}

function createFromCost(costId, qty = 1, note = "") {
  const source = costById[costId];
  if (!source) return null;
  return {
    rowId: uid(),
    costId: source.id,
    division: source.division,
    phase: source.phase,
    name: source.item,
    description: note || source.description,
    unit: source.unit,
    qty: roundQty(qty),
    low: source.low,
    mid: source.mid,
    high: source.high,
    costType: source.costType,
    source: source.source,
    sourceUrl: source.sourceUrl
  };
}

function createCustomItem() {
  return {
    rowId: uid(),
    costId: "CUSTOM",
    division: "General Conditions",
    phase: "Custom",
    name: "",
    description: "Custom company scope item",
    unit: "LS",
    qty: 1,
    low: 0,
    mid: 0,
    high: 0,
    costType: "Custom",
    source: "Company cost",
    sourceUrl: ""
  };
}

function buildingMetrics() {
  const area = Math.max(100, numberValue("squareFootage") || 2000);
  const perimeter = 4 * Math.sqrt(area);
  const wallArea = perimeter * 9;
  const roofArea = area * 1.15;
  return { area, perimeter, wallArea, roofArea };
}

function foundationRows(method, metrics = buildingMetrics()) {
  const { area, perimeter } = metrics;
  if (method === "crawlspace") {
    return [
      createFromCost("FC-005", area, "All-in crawlspace foundation system. Do not also price footings, poured concrete, or reinforcing unless specifically excluded from the subcontractor scope.")
    ];
  }
  if (method === "components") {
    return [
      createFromCost("FC-002", perimeter, "Component takeoff: verify footing dimensions and linear footage."),
      createFromCost("FC-003", 0, "Component takeoff: enter measured concrete volume in cubic yards."),
      createFromCost("FC-004", area, "Component takeoff: verify reinforcing area and specification.")
    ];
  }
  return [
    createFromCost("FC-001", area, "All-in slab-on-grade foundation system. This replaces separate footings, poured concrete, and reinforcing lines for preliminary budgeting.")
  ];
}

function createFramingPackage(metrics = buildingMetrics()) {
  const { area } = metrics;
  const crawlspaceNote = selectedFoundationMethod === "crawlspace"
    ? " Includes the raised wood floor system required above the selected crawlspace foundation."
    : "";
  return {
    rowId: uid(),
    costId: "FR-PKG",
    division: "Framing",
    phase: "Rough Framing",
    name: "Rough framing package",
    description: `All-in preliminary framing package including exterior and interior walls, floor framing when applicable, roof framing or trusses, structural sheathing, labor, and normal fastening.${crawlspaceNote}`,
    unit: "SF",
    qty: roundQty(area),
    low: costById["FR-001"].low,
    mid: costById["FR-001"].mid,
    high: costById["FR-001"].high,
    costType: "Material/Labor",
    source: "Workbook framing benchmark consolidated as an all-in package",
    sourceUrl: costById["FR-001"].sourceUrl
  };
}

function framingRows(method, metrics = buildingMetrics()) {
  const { area, wallArea, roofArea } = metrics;
  if (method === "package") return [createFramingPackage(metrics)];
  const rows = [
    createFromCost("FR-001", wallArea, "Component takeoff: exterior wall framing only."),
    createFromCost("FR-002", Math.sqrt(area) * 5, "Component takeoff: verify interior partition length."),
    createFromCost("FR-004", roofArea, "Component takeoff: roof framing or truss area."),
    createFromCost("FR-005", wallArea + roofArea, "Component takeoff: verify wall and roof sheathing areas."),
    createFromCost("FR-006", 0, "Component takeoff: enter structural beam length when required.")
  ];
  if (selectedFoundationMethod === "crawlspace") {
    rows.splice(2, 0, createFromCost("FR-003", area, "Component takeoff: floor framing above the crawlspace foundation."));
  }
  return rows;
}

function createHvacPackage(metrics = buildingMetrics()) {
  const { area } = metrics;
  return {
    rowId: uid(),
    costId: "HVAC-PKG",
    division: "MEP",
    phase: "HVAC",
    name: "HVAC system with ductwork",
    description: "All-in preliminary HVAC package including matched heating and cooling equipment, normal duct distribution, supply and return connections, basic controls, labor, startup, and standard installation materials.",
    unit: "TON",
    qty: Math.max(1, Math.ceil(area / 600)),
    low: costById["MEP-006"].low,
    mid: costById["MEP-006"].mid,
    high: costById["MEP-006"].high,
    costType: "Subcontractor",
    source: "Workbook HVAC system benchmark consolidated with normal ductwork",
    sourceUrl: costById["MEP-006"].sourceUrl
  };
}

function hvacRows(method, metrics = buildingMetrics()) {
  const { area } = metrics;
  if (method === "package") return [createHvacPackage(metrics)];
  return [
    createFromCost("MEP-006", Math.max(1, Math.ceil(area / 600)), "Component takeoff: HVAC equipment and standard installation excluding separately measured ductwork."),
    createFromCost("MEP-007", area, "Component takeoff: duct distribution measured by conditioned floor area.")
  ];
}

function buildAssembly(name) {
  const metrics = buildingMetrics();
  const { area, perimeter, wallArea, roofArea } = metrics;
  const kitchenArea = Math.min(350, Math.max(150, area * 0.1));
  const bathArea = 80;
  const plans = {
    kitchen: [
      ["DM-002", 1],
      ["MEP-004", 3],
      ["MEP-003", 8],
      ["CC-002", 25],
      ["CC-005", 55],
      ["IF-004", kitchenArea],
      ["IF-001", kitchenArea * 3],
      ["CL-001", kitchenArea]
    ],
    bathroom: [
      ["DM-003", 1],
      ["MEP-004", 3],
      ["MEP-008", 1],
      ["BT-003", 100],
      ["BT-004", 1],
      ["BT-005", 1],
      ["BT-006", 1],
      ["IF-005", bathArea],
      ["IF-001", bathArea * 3],
      ["CL-001", bathArea]
    ],
    addition: [
      ["SW-001", area],
      ["SW-002", 0, "Enter excavation quantity after site review."],
      ["SW-004", 400, "Driveway or construction-access allowance; revise measured area."],
      ["EX-001", roofArea / 100],
      ["EX-003", wallArea],
      ["EX-005", wallArea],
      ["EX-008", Math.max(4, Math.round(area / 180))],
      ["MEP-001", area],
      ["MEP-004", 0, "Enter fixture-opening count when plumbing is included."],
      ["ID-001", wallArea + area],
      ["ID-003", wallArea + area * 2],
      ["IF-001", wallArea * 2],
      ["IF-004", area],
      ["IF-002", perimeter * 1.8],
      ["CL-001", area]
    ],
    custom: [
      ["GC-004", 3],
      ["GC-006", 8],
      ["SW-001", area * 1.5],
      ["SW-002", 0, "Enter excavation quantity after survey and site review."],
      ["SW-003", 200],
      ["SW-004", 800, "Driveway or construction-access allowance; revise measured area."],
      ["EX-001", roofArea / 100],
      ["EX-003", wallArea],
      ["EX-005", wallArea],
      ["EX-007", 3],
      ["EX-008", Math.max(8, Math.round(area / 150))],
      ["MEP-001", area],
      ["MEP-004", Math.max(8, Math.round(area / 220))],
      ["MEP-005", 1],
      ["ID-001", wallArea + area],
      ["ID-003", wallArea + area * 2],
      ["IF-001", wallArea * 2],
      ["IF-003", Math.max(10, Math.round(area / 160))],
      ["IF-004", area],
      ["IF-002", perimeter * 2.5],
      ["CC-002", Math.max(25, Math.round(area / 75))],
      ["CC-005", Math.max(55, Math.round(area / 40))],
      ["CL-001", area],
      ["CL-002", 1]
    ]
  };

  const assembly = plans[name].map(([costId, qty, note]) => createFromCost(costId, qty, note)).filter(Boolean);
  if (!["addition", "custom"].includes(name)) return assembly;
  const insertionIndex = assembly.findIndex(item => item.division === "Exterior");
  assembly.splice(insertionIndex < 0 ? assembly.length : insertionIndex, 0, ...foundationRows(selectedFoundationMethod, metrics), ...framingRows(selectedFramingMethod, metrics));
  const insulationIndex = assembly.findIndex(item => item.division === "Insulation & Drywall");
  assembly.splice(insulationIndex < 0 ? assembly.length : insulationIndex, 0, ...hvacRows(selectedHvacMethod, metrics));
  return assembly;
}

function renderItems() {
  const factor = marketFactor();
  const phaseGroups = new Map();
  items.forEach(item => {
    const phase = String(item.phase || "Other scope").trim() || "Other scope";
    if (!phaseGroups.has(phase)) phaseGroups.set(phase, []);
    phaseGroups.get(phase).push(item);
  });

  $("scopeRows").innerHTML = [...phaseGroups.entries()].map(([phase, phaseItems]) => {
    const phaseKey = phaseGroupKey(phase);
    const rows = phaseItems.map(item => {
      const low = item.qty * item.low * factor;
      const high = item.qty * item.high * factor;
      return `
        <tr data-id="${item.rowId}">
          <td class="scope-item-cell">
            <div class="scope-item-top">
              <span class="cost-code">${escapeHtml(item.costId)}</span>
              <input data-field="name" type="text" value="${escapeHtml(item.name)}" placeholder="Describe work">
            </div>
            <span class="scope-description" title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</span>
          </td>
          <td><select data-field="division">${divisions.map(value => `<option ${value === item.division ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></td>
          <td><input data-field="qty" type="number" min="0" step="0.01" value="${item.qty}"></td>
          <td><select data-field="unit">${units.map(value => `<option ${value === item.unit ? "selected" : ""}>${value}</option>`).join("")}</select></td>
          <td><input data-field="low" type="number" min="0" step="0.01" value="${item.low}"></td>
          <td><input data-field="mid" type="number" min="0" step="0.01" value="${item.mid}"></td>
          <td><input data-field="high" type="number" min="0" step="0.01" value="${item.high}"></td>
          <td class="amount-column">${money(low, true)} - ${money(high, true)}</td>
          <td><button class="remove-item" type="button" aria-label="Remove ${escapeHtml(item.name || "item")}">&times;</button></td>
        </tr>`;
    }).join("");
    return `
      <tr class="phase-group-row" data-phase-key="${phaseKey}">
        <td colspan="9">
          <div>
            <span>Phase</span>
            <strong>${escapeHtml(phase)}</strong>
          </div>
          <div class="phase-subtotal">
            <span>Expected <strong data-phase-mid>$0</strong></span>
            <span data-phase-range>$0 - $0</span>
          </div>
        </td>
      </tr>
      ${rows}`;
  }).join("");
  updatePhaseSubtotals();
}

function phaseGroupKey(phase) {
  return encodeURIComponent(String(phase || "Other scope").trim() || "Other scope");
}

function updatePhaseSubtotals() {
  const factor = marketFactor();
  const totalsByPhase = new Map();
  items.forEach(item => {
    const phase = String(item.phase || "Other scope").trim() || "Other scope";
    const totals = totalsByPhase.get(phase) || { low: 0, mid: 0, high: 0 };
    const quantity = Math.max(0, Number(item.qty) || 0);
    totals.low += quantity * Math.max(0, Number(item.low) || 0) * factor;
    totals.mid += quantity * Math.max(0, Number(item.mid) || 0) * factor;
    totals.high += quantity * Math.max(0, Number(item.high) || 0) * factor;
    totalsByPhase.set(phase, totals);
  });
  totalsByPhase.forEach((totals, phase) => {
    const groupRow = document.querySelector(`.phase-group-row[data-phase-key="${phaseGroupKey(phase)}"]`);
    if (!groupRow) return;
    groupRow.querySelector("[data-phase-mid]").textContent = money(totals.mid);
    groupRow.querySelector("[data-phase-range]").textContent = `${money(totals.low)} - ${money(totals.high)}`;
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function calculate() {
  const factor = marketFactor();
  const sum = field => items.reduce((total, item) => total + Math.max(0, Number(item.qty) || 0) * Math.max(0, Number(item[field]) || 0), 0) * factor;
  const directLow = sum("low");
  const directMid = sum("mid");
  const directHigh = sum("high");
  const allowances = numberValue("permitAllowance") + numberValue("designAllowance");
  const contingencyRate = numberValue("contingency") / 100;
  const ohpRate = numberValue("ohp") / 100;
  const taxRate = numberValue("salesTax") / 100;

  const priceScenario = direct => {
    const base = direct + allowances;
    const contingency = base * contingencyRate;
    const ohp = (base + contingency) * ohpRate;
    const preTax = base + contingency + ohp;
    const tax = preTax * taxRate;
    return { total: preTax + tax, contingency, ohp, tax };
  };

  const low = priceScenario(directLow);
  const mid = priceScenario(directMid);
  const high = priceScenario(directHigh);
  let totalLow = low.total;
  let totalMid = mid.total;
  let totalHigh = high.total;
  if ($("roundTotals").checked) {
    totalLow = Math.floor(totalLow / 1000) * 1000;
    totalMid = Math.round(totalMid / 1000) * 1000;
    totalHigh = Math.ceil(totalHigh / 1000) * 1000;
  }
  return { directLow, directMid, directHigh, allowances, low, mid, high, totalLow, totalMid, totalHigh };
}

function updateBenchmarkDisplay() {
  const benchmark = nationalBenchmarks[activeBenchmark] || nationalBenchmarks.customScope;
  $("benchmarkTitle").textContent = benchmark.title;
  $("benchmarkDescription").textContent = benchmark.description;
  $("benchmarkSource").href = benchmark.source;
  $("nationalBenchmark").textContent = benchmark.summary;
  $("costBasisNote").textContent = `${benchmark.title}. Low, mid, and high unit costs come from the imported workbook database and are reduced by the ${localDiscountPercent().toFixed(1)}% local market discount.`;
  updateHistoricalBenchmark();
}

function updateHistoricalBenchmark() {
  const isNewHome = $("projectType").value === "Custom home build";
  $("historicalBenchmark").hidden = !isNewHome;
  if (!isNewHome) return;
  const squareFeet = numberValue("squareFootage");
  const totals = calculate();
  const directPerSf = squareFeet ? totals.directMid / squareFeet : 0;
  const totalPerSf = squareFeet ? totals.totalMid / squareFeet : 0;
  const historicalDirectPerSf = CHAPELWOOD_BENCHMARK.directConstruction / CHAPELWOOD_BENCHMARK.hvacSquareFeet;
  if (!squareFeet) {
    $("historicalComparison").textContent = "Enter project square footage to compare.";
  } else {
    const variance = ((directPerSf / historicalDirectPerSf) - 1) * 100;
    const direction = variance >= 0 ? "above" : "below";
    $("historicalComparison").textContent = `${money(directPerSf)}/SF direct and ${money(totalPerSf)}/SF with assumptions · ${Math.abs(variance).toFixed(1)}% ${direction} Chapelwood direct cost`;
  }
  $("historicalDivisionGrid").innerHTML = CHAPELWOOD_BENCHMARK.divisions.map(([division, amount]) =>
    `<div><span>${escapeHtml(division)}</span><strong>${money(amount / CHAPELWOOD_BENCHMARK.hvacSquareFeet)}/SF</strong></div>`
  ).join("");
}

function updateProposalReference() {
  const projectSquareFeet = numberValue("squareFootage");
  const squareFeet = projectSquareFeet || PROPOSAL_WORKBOOK_REFERENCE.squareFeet;
  const usingProjectArea = projectSquareFeet > 0;
  $("proposalReferenceBasis").textContent = usingProjectArea ? `${squareFeet.toLocaleString()} SF` : "$ / SF";
  $("proposalBandGrid").innerHTML = PROPOSAL_WORKBOOK_REFERENCE.bands.map(band => `
    <div>
      <span>${escapeHtml(band.name)}</span>
      <strong>${money(band.low)}/SF - ${money(band.high)}/SF</strong>
      <small>${usingProjectArea ? `${money(squareFeet * band.low)} - ${money(squareFeet * band.high)}` : "Enter project SF to show total range"}</small>
    </div>
  `).join("");
  $("proposalPhaseGrid").innerHTML = PROPOSAL_WORKBOOK_REFERENCE.phases.map(phase => `
    <div>
      <span>${escapeHtml(phase.name)}</span>
      <strong>${money(phase.low)}/SF - ${money(phase.high)}/SF</strong>
      <small>${usingProjectArea ? `${money(squareFeet * phase.low)} - ${money(squareFeet * phase.high)}` : ""}</small>
    </div>
  `).join("");
}

function updateFoundationControl() {
  const supportsFoundation = ["Home addition", "Custom home build"].includes($("projectType").value);
  $("foundationControl").hidden = !supportsFoundation;
  $("foundationMethod").value = selectedFoundationMethod;
  const notes = {
    slab: "Prices one all-in slab-on-grade system. Footings, concrete, reinforcing, slab preparation, and placement are not added again.",
    crawlspace: "Prices one all-in crawlspace foundation plus the separate wood floor-framing system above it.",
    components: "Removes all-in foundation pricing. Footings and reinforcing are loaded, but measured concrete volume and any missing formwork or placement scope must be completed."
  };
  $("foundationMethodNote").textContent = notes[selectedFoundationMethod];
}

function updateFramingControl() {
  const supportsFraming = ["Home addition", "Custom home build"].includes($("projectType").value);
  $("framingControl").hidden = !supportsFraming;
  $("framingMethod").value = selectedFramingMethod;
  const notes = {
    package: "Prices one all-in rough-framing package. Exterior walls, interior walls, floor framing when applicable, roof framing/trusses, and sheathing are not added again.",
    components: "Removes package pricing and loads individual framing systems for a measured takeoff. Verify wall, floor, roof, sheathing, and beam quantities."
  };
  $("framingMethodNote").textContent = notes[selectedFramingMethod];
}

function updateHvacControl() {
  const supportsHvac = ["Home addition", "Custom home build"].includes($("projectType").value);
  $("hvacControl").hidden = !supportsHvac;
  $("hvacMethod").value = selectedHvacMethod;
  const notes = {
    package: "Prices one all-in HVAC system including normal ductwork. Do not also add the separate ductwork line.",
    components: "Removes the all-in package and loads HVAC equipment plus ductwork as separate measured components."
  };
  $("hvacMethodNote").textContent = notes[selectedHvacMethod];
}

function updateScopeWarning() {
  const quantityFor = costId => items.filter(item => item.costId === costId).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const slabActive = quantityFor("FC-001") > 0;
  const crawlActive = quantityFor("FC-005") > 0;
  const componentActive = ["FC-002", "FC-003", "FC-004"].some(costId => quantityFor(costId) > 0);
  const framingPackageActive = quantityFor("FR-PKG") > 0;
  const framingComponentActive = ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "FR-006"].some(costId => quantityFor(costId) > 0);
  const hvacPackageActive = quantityFor("HVAC-PKG") > 0;
  const hvacComponentActive = ["MEP-006", "MEP-007"].some(costId => quantityFor(costId) > 0);
  const projectManagementActive = quantityFor("GC-003") > 0;
  const warnings = [];
  if (slabActive && crawlActive) {
    warnings.push("Foundation overlap: both slab-on-grade and crawlspace systems have quantities. Price only the selected system.");
  } else if ((slabActive || crawlActive) && componentActive) {
    warnings.push("Foundation overlap: an all-in foundation system and component lines are both priced. Zero or remove the component lines unless they are specifically excluded from the all-in system.");
  } else if (selectedFoundationMethod === "components" && quantityFor("FC-003") === 0) {
    warnings.push("Component foundation takeoff is incomplete: enter the measured poured-concrete quantity and confirm formwork, placement, and finishing scope.");
  }
  if (framingPackageActive && framingComponentActive) {
    warnings.push("Framing overlap: the all-in rough-framing package and component framing lines are both priced. Use only one method.");
  }
  if (hvacPackageActive && hvacComponentActive) {
    warnings.push("HVAC overlap: the all-in HVAC package and separate equipment or ductwork lines are both priced. Use only one method.");
  }
  if (projectManagementActive && numberValue("ohp") > 0) {
    warnings.push("OH&P overlap: project management and supervision is priced as a direct cost while OH&P is active. Remove that line or set OH&P to zero.");
  }
  $("scopeWarning").textContent = warnings.join(" ");
  $("scopeWarning").hidden = warnings.length === 0;
}

function updateTotals() {
  const totals = calculate();
  const clientRange = clientProposalRange(totals);
  $("lowTotal").textContent = money(clientRange.low, true);
  $("expectedTotal").textContent = money(clientRange.mid);
  $("highTotal").textContent = money(clientRange.high, true);
  $("rangeExplainer").textContent = `Client-facing range is curated to +/- ${clientRange.percent}% around the expected budget. Internal estimator guardrail: ${money(totals.totalLow, true)} to ${money(totals.totalHigh, true)}.`;
  $("internalRange").textContent = `${money(totals.totalLow)} - ${money(totals.totalHigh)}`;
  $("directCosts").textContent = `${money(totals.directLow)} - ${money(totals.directHigh)}`;
  $("allowancesTotal").textContent = money(totals.allowances);
  $("contingencyTotal").textContent = `${money(totals.low.contingency)} - ${money(totals.high.contingency)}`;
  $("ohpTotal").textContent = `${money(totals.low.ohp)} - ${money(totals.high.ohp)}`;
  $("taxTotal").textContent = `${money(totals.low.tax)} - ${money(totals.high.tax)}`;
  updateBenchmarkDisplay();
  updateProposalReference();
  updateFoundationControl();
  updateFramingControl();
  updateHvacControl();
  updateScopeWarning();
  updatePhaseSubtotals();
  updateHealth();
  queueSave();
}

function updateHealth() {
  const activeItems = items.filter(item => Number(item.qty) > 0);
  const validPricing = activeItems.length > 0 && activeItems.every(item =>
    String(item.name || "").trim() && Number(item.low) >= 0 && Number(item.mid) >= Number(item.low) && Number(item.high) >= Number(item.mid)
  );
  const checks = [
    { points: 10, done: Boolean($("clientName").value.trim()), suggestion: "Add the client name." },
    { points: 10, done: Boolean($("projectAddress").value.trim()), suggestion: "Add the project address." },
    { points: 5, done: Boolean($("clientEmail").value.trim() || $("clientPhone").value.trim()), suggestion: "Add a client email or phone number." },
    { points: 10, done: Number($("squareFootage").value) > 0, suggestion: "Enter the project square footage." },
    { points: 5, done: Boolean($("targetStart").value), suggestion: "Add the target start date." },
    { points: 10, done: Boolean($("projectNotes").value.trim()), suggestion: "Describe the project scope, finish level, and known exclusions." },
    { points: 15, done: activeItems.length >= 5, suggestion: "Add at least 5 active, priced scope items." },
    { points: 10, done: activeItems.length >= 10, suggestion: "Build the scope to at least 10 active line items for better coverage." },
    { points: 15, done: validPricing, suggestion: "Review quantities and make sure every active line has valid low, expected, and high pricing." },
    { points: 5, done: $("scopeWarning").hidden, suggestion: "Resolve the overlapping-scope warning." },
    {
      points: 5,
      done: numberValue("contingency") > 0 && numberValue("ohp") > 0 && $("salesTax").value !== "" && $("localDiscount").value !== "",
      suggestion: "Confirm contingency, OH&P, sales tax, and the local market discount."
    }
  ];
  const score = checks.reduce((total, check) => total + (check.done ? check.points : 0), 0);
  const missing = checks.filter(check => !check.done).map(check => check.suggestion);
  const zeroQuantityCount = items.filter(item => Number(item.qty) === 0).length;
  if (zeroQuantityCount) missing.push(`Review ${zeroQuantityCount} zero-quantity optional line${zeroQuantityCount === 1 ? "" : "s"} and remove or price them as needed.`);

  $("healthScore").textContent = `${score}%`;
  $("healthBar").style.width = `${score}%`;
  $("healthMessage").textContent = score >= 90 ? "Strong preliminary estimate. Final vendor and subcontractor verification is still recommended."
    : score >= 65 ? "Good working estimate. Complete the items below to improve confidence."
    : "This estimate needs more project detail and measured scope.";
  $("healthSuggestions").innerHTML = missing.length
    ? `<strong>Suggestions to improve</strong><ul>${missing.map(suggestion => `<li>${escapeHtml(suggestion)}</li>`).join("")}</ul>`
    : `<p class="health-complete">All estimate-readiness checks are complete.</p>`;
}

function addCustomItem() {
  activeBenchmark = "customScope";
  items.push(createCustomItem());
  renderItems();
  updateTotals();
  $("scopeRows").querySelector("tr:last-child input[data-field='name']")?.focus();
}

function addDatabaseItem() {
  const input = $("costSearch").value.trim();
  const costId = input.split(/\s/)[0].toUpperCase();
  const match = costById[costId] || COST_DATABASE.find(item => item.item.toLowerCase() === input.toLowerCase());
  if (!match) {
    showToast("Choose a cost item from the search list");
    return;
  }
  if (match.id === "GC-003" && numberValue("ohp") > 0) {
    showToast("Project management is already included in OH&P");
    return;
  }
  activeBenchmark = "customScope";
  items.push(createFromCost(match.id, 1));
  $("costSearch").value = "";
  renderItems();
  updateTotals();
  showToast(`${match.id} added`);
}

function loadAssembly(name) {
  if (!nationalBenchmarks[name]) return;
  activeBenchmark = name;
  if (["addition", "custom"].includes(name)) {
    selectedFoundationMethod = "slab";
    selectedFramingMethod = "package";
    selectedHvacMethod = "package";
  }
  items = buildAssembly(name);
  $("projectType").value = nationalBenchmarks[name].projectType;
  renderItems();
  updateHeading();
  updateTotals();
  showToast(`${items.length} detailed scope items loaded`);
}

function populateCostLibrary() {
  $("databaseCount").textContent = COST_DATABASE.length;
  $("divisionFilter").innerHTML += divisions.map(division => `<option value="${escapeHtml(division)}">${escapeHtml(division)}</option>`).join("");
  updateCostOptions();
}

function updateCostOptions() {
  const division = $("divisionFilter").value;
  const search = $("costSearch").value.trim().toLowerCase();
  const matches = COST_DATABASE.filter(item =>
    (!division || item.division === division) &&
    (!search || `${item.id} ${item.division} ${item.phase} ${item.item} ${item.description}`.toLowerCase().includes(search))
  ).slice(0, 40);
  $("costOptions").innerHTML = matches.map(item =>
    `<option value="${escapeHtml(item.id)} - ${escapeHtml(item.item)}">${escapeHtml(item.division)} / ${escapeHtml(item.phase)} | ${item.unit} | ${money(item.low)} / ${money(item.mid)} / ${money(item.high)}</option>`
  ).join("");
}

function getFormData() {
  const fieldIds = ["clientName", "projectType", "projectAddress", "clientEmail", "clientPhone", "targetStart", "squareFootage", "projectNotes", "contingency", "ohp", "salesTax", "permitAllowance", "designAllowance", "localDiscount", "clientRangePercent"];
  const fields = Object.fromEntries(fieldIds.map(id => [id, $(id).value]));
  return { schemaVersion: 10, estimateId: $("estimateId").textContent, fields, roundTotals: $("roundTotals").checked, activeBenchmark, selectedFoundationMethod, selectedFramingMethod, selectedHvacMethod, items };
}

function getEstimateLibrary() {
  try {
    const records = JSON.parse(localStorage.getItem(ESTIMATE_LIBRARY_KEY) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function setEstimateLibrary(records) {
  localStorage.setItem(ESTIMATE_LIBRARY_KEY, JSON.stringify(records));
}

function estimatePayload(record) {
  return {
    schemaVersion: record.schemaVersion,
    estimateId: record.estimateId,
    fields: record.fields,
    roundTotals: record.roundTotals,
    activeBenchmark: record.activeBenchmark,
    selectedFoundationMethod: record.selectedFoundationMethod,
    selectedFramingMethod: record.selectedFramingMethod,
    selectedHvacMethod: record.selectedHvacMethod,
    items: record.items
  };
}

function currentEstimateIsSaved() {
  const current = getFormData();
  const saved = getEstimateLibrary().find(record => record.estimateId === current.estimateId);
  return Boolean(saved && JSON.stringify(estimatePayload(saved)) === JSON.stringify(current));
}

function saveCurrentEstimate() {
  const data = getFormData();
  const totals = calculate();
  const now = new Date().toISOString();
  const record = {
    ...data,
    savedAt: now,
    summary: {
      client: data.fields.clientName?.trim() || "Unnamed client",
      projectType: data.fields.projectType || "Residential project",
      address: data.fields.projectAddress?.trim() || "Address not entered",
      low: totals.totalLow,
      mid: totals.totalMid,
      high: totals.totalHigh
    }
  };
  const library = getEstimateLibrary();
  const existingIndex = library.findIndex(entry => entry.estimateId === data.estimateId);
  if (existingIndex >= 0) library[existingIndex] = record;
  else library.unshift(record);
  setEstimateLibrary(library);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  $("saveStatus").textContent = "Estimate saved";
  renderEstimateLibrary();
  showToast(existingIndex >= 0 ? "Saved estimate updated" : "Estimate saved to library");
}

function queueSave() {
  $("saveStatus").textContent = "Auto-saving draft...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormData()));
    $("saveStatus").textContent = currentEstimateIsSaved() ? "Estimate saved" : "Working draft auto-saved";
  }, 300);
}

function applyEstimateData(data) {
  $("estimateId").textContent = data.estimateId || generateEstimateId();
  Object.entries(data.fields || {}).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
  if (!data.fields?.localDiscount) {
    const previousFactor = Number(data.fields?.marketFactor);
    $("localDiscount").value = Number.isFinite(previousFactor) && previousFactor !== 1
      ? Math.min(50, Math.max(0, (1 - previousFactor) * 100)).toFixed(1)
      : 15;
  }
  if ((!data.schemaVersion || data.schemaVersion < 9) && Number(data.fields?.salesTax) === 0) {
    $("salesTax").value = 9;
  }
  if (!data.fields?.clientRangePercent) $("clientRangePercent").value = 12;
  if (!data.fields?.ohp && (data.fields?.overhead || data.fields?.profit)) {
    const contingency = Math.max(0, Number(data.fields.contingency) || 0) / 100;
    const overhead = Math.max(0, Number(data.fields.overhead) || 0) / 100;
    const profit = Math.max(0, Number(data.fields.profit) || 0) / 100;
    const equivalentOhp = (overhead + profit * (1 + contingency + overhead)) / (1 + contingency);
    $("ohp").value = (equivalentOhp * 100).toFixed(1);
  }
  $("roundTotals").checked = data.roundTotals !== false;
  activeBenchmark = data.activeBenchmark || "customScope";
  selectedFoundationMethod = data.selectedFoundationMethod || "slab";
  selectedFramingMethod = data.selectedFramingMethod || "package";
  selectedHvacMethod = data.selectedHvacMethod || "package";
  items = Array.isArray(data.items) ? data.items : [];
}

function loadEstimate() {
  const stored = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
  if (!stored) {
    $("estimateId").textContent = generateEstimateId();
    activeBenchmark = "kitchen";
    items = buildAssembly("kitchen");
    return;
  }
  try {
    applyEstimateData(JSON.parse(stored));
  } catch {
    $("estimateId").textContent = generateEstimateId();
    items = buildAssembly("kitchen");
  }
}

function resetEstimate() {
  const warning = currentEstimateIsSaved()
    ? "Start a new estimate? Your saved estimate will remain in the estimate library."
    : "This working draft has not been saved to the estimate library. Start a new estimate and replace the draft?";
  if (!confirm(warning)) return;
  localStorage.removeItem(STORAGE_KEY);
  LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  document.querySelectorAll("input, textarea").forEach(input => {
    if (input.type === "checkbox") input.checked = true;
    else input.value = "";
  });
  $("projectType").selectedIndex = 0;
  $("contingency").value = 10;
  $("ohp").value = 20;
  $("salesTax").value = 9;
  $("permitAllowance").value = 2500;
  $("designAllowance").value = 0;
  $("localDiscount").value = 15;
  $("clientRangePercent").value = 12;
  $("estimateId").textContent = generateEstimateId();
  activeBenchmark = "kitchen";
  selectedFoundationMethod = "slab";
  selectedFramingMethod = "package";
  selectedHvacMethod = "package";
  items = buildAssembly("kitchen");
  renderItems();
  updateHeading();
  updateTotals();
  showToast("New detailed estimate started");
}

function renderEstimateLibrary() {
  const library = getEstimateLibrary().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  if (!library.length) {
    $("savedEstimateList").innerHTML = `
      <div class="empty-library">
        <strong>No saved estimates yet</strong>
        <span>Use “Save current estimate” to add this working draft.</span>
      </div>`;
    return;
  }
  $("savedEstimateList").innerHTML = library.map(record => {
    const summary = record.summary || {};
    const savedDate = record.savedAt ? new Date(record.savedAt).toLocaleString() : "Date unavailable";
    return `
      <article class="saved-estimate-card" data-estimate-id="${escapeHtml(record.estimateId)}">
        <div>
          <h3>${escapeHtml(summary.client || record.fields?.clientName || "Unnamed client")}</h3>
          <p>${escapeHtml(summary.projectType || record.fields?.projectType || "Residential project")} · ${escapeHtml(summary.address || record.fields?.projectAddress || "Address not entered")}</p>
          <p>${escapeHtml(record.estimateId)} · Saved ${escapeHtml(savedDate)}</p>
        </div>
        <strong class="saved-estimate-total">${money(Number(summary.low) || 0)} - ${money(Number(summary.high) || 0)}</strong>
        <div class="saved-estimate-actions">
          <button class="button button-primary open-saved-estimate" type="button">Open</button>
          <button class="button button-secondary duplicate-saved-estimate" type="button">Save as copy</button>
          <button class="button danger-button delete-saved-estimate" type="button">Delete</button>
        </div>
      </article>`;
  }).join("");
}

function openEstimateLibrary() {
  renderEstimateLibrary();
  $("estimateLibraryModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeEstimateLibrary() {
  $("estimateLibraryModal").hidden = true;
  document.body.style.overflow = "";
}

function loadSavedEstimate(estimateId) {
  const record = getEstimateLibrary().find(entry => entry.estimateId === estimateId);
  if (!record) return;
  applyEstimateData(estimatePayload(record));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormData()));
  renderItems();
  updateHeading();
  updateTotals();
  closeEstimateLibrary();
  showToast("Saved estimate opened");
}

function duplicateSavedEstimate(estimateId) {
  const record = getEstimateLibrary().find(entry => entry.estimateId === estimateId);
  if (!record) return;
  const copy = structuredClone(estimatePayload(record));
  copy.estimateId = generateEstimateId();
  applyEstimateData(copy);
  renderItems();
  updateHeading();
  updateTotals();
  saveCurrentEstimate();
  closeEstimateLibrary();
  showToast("Estimate copy created");
}

function deleteSavedEstimate(estimateId) {
  const record = getEstimateLibrary().find(entry => entry.estimateId === estimateId);
  if (!record) return;
  const client = record.summary?.client || record.fields?.clientName || estimateId;
  if (!confirm(`Delete the saved estimate for ${client}? This cannot be undone.`)) return;
  setEstimateLibrary(getEstimateLibrary().filter(entry => entry.estimateId !== estimateId));
  renderEstimateLibrary();
  $("saveStatus").textContent = currentEstimateIsSaved() ? "Estimate saved" : "Working draft auto-saved";
  showToast("Saved estimate deleted");
}

function updateHeading() {
  const client = $("clientName").value.trim();
  const type = $("projectType").value;
  $("projectHeading").textContent = client ? `${type} for ${client}` : type || "New residential project";
}

function changeFoundationMethod(method) {
  selectedFoundationMethod = method;
  const foundationIds = new Set(["FC-001", "FC-002", "FC-003", "FC-004", "FC-005"]);
  items = items.filter(item => !foundationIds.has(item.costId));
  if (selectedFramingMethod === "components") {
    items = items.filter(item => item.costId !== "FR-003");
    if (method === "crawlspace") {
      const framingIndex = items.findIndex(item => item.costId === "FR-004");
      items.splice(framingIndex < 0 ? items.length : framingIndex, 0, createFromCost("FR-003", buildingMetrics().area, "Component takeoff: floor framing above the crawlspace foundation."));
    }
  } else {
    const packageRow = items.find(item => item.costId === "FR-PKG");
    if (packageRow) Object.assign(packageRow, createFramingPackage(), { rowId: packageRow.rowId });
  }
  const insertionIndex = items.findIndex(item => item.division === "Framing");
  items.splice(insertionIndex < 0 ? items.length : insertionIndex, 0, ...foundationRows(method));
  renderItems();
  updateTotals();
  showToast("Foundation pricing method updated");
}

function changeFramingMethod(method) {
  selectedFramingMethod = method;
  const framingIds = new Set(["FR-PKG", "FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "FR-006"]);
  items = items.filter(item => !framingIds.has(item.costId));
  const insertionIndex = items.findIndex(item => item.division === "Exterior");
  items.splice(insertionIndex < 0 ? items.length : insertionIndex, 0, ...framingRows(method));
  renderItems();
  updateTotals();
  showToast("Framing pricing method updated");
}

function changeHvacMethod(method) {
  selectedHvacMethod = method;
  const hvacIds = new Set(["HVAC-PKG", "MEP-006", "MEP-007"]);
  items = items.filter(item => !hvacIds.has(item.costId));
  const insertionIndex = items.findIndex(item => item.division === "Insulation & Drywall");
  items.splice(insertionIndex < 0 ? items.length : insertionIndex, 0, ...hvacRows(method));
  renderItems();
  updateTotals();
  showToast("HVAC pricing method updated");
}

function openSummary() {
  const totals = calculate();
  const clientRange = clientProposalRange(totals);
  const client = $("clientName").value.trim() || "Client";
  const address = $("projectAddress").value.trim() || "Project address to be confirmed";
  const benchmark = nationalBenchmarks[activeBenchmark] || nationalBenchmarks.customScope;
  $("modalEstimateId").textContent = $("estimateId").textContent;
  $("modalTitle").textContent = `${$("projectType").value} for ${client}`;
  $("modalMeta").textContent = address;
  $("modalRange").textContent = `${money(clientRange.low)} - ${money(clientRange.high)}`;
  $("modalExpected").textContent = `Expected budget: ${money(clientRange.mid)} · curated +/- ${clientRange.percent}% client range`;
  const included = items.filter(item => item.name && item.qty > 0 && (item.low > 0 || item.high > 0));
  $("modalScope").innerHTML = included.length ? included.map(item => `
    <div class="scope-summary-row"><span>${escapeHtml(item.division)} / ${escapeHtml(item.name)}</span><span>${money(item.qty * item.mid * marketFactor())}</span></div>
  `).join("") : "<p>No priced scope items have been added.</p>";
  $("modalAssumptions").textContent = `Client range is curated around the expected budget; internal estimator guardrail is ${money(totals.totalLow)} to ${money(totals.totalHigh)}. Costs use the imported workbook's national low, mid, and high unit-cost database with a ${localDiscountPercent().toFixed(1)}% local market discount. Includes ${numberValue("contingency")}% contingency, ${numberValue("ohp")}% combined OH&P, ${money(totals.allowances)} in permit and design allowances, and ${numberValue("salesTax")}% sales tax where applicable. Published comparison: ${benchmark.summary}.`;
  $("summaryModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeSummary() {
  $("summaryModal").hidden = true;
  document.body.style.overflow = "";
}

async function copySummary() {
  const totals = calculate();
  const clientRange = clientProposalRange(totals);
  const text = `${$("projectType").value} - ${$("clientName").value.trim() || "Client"}\nClient proposal range: ${money(clientRange.low)} to ${money(clientRange.high)}\nExpected budget: ${money(clientRange.mid)}\nInternal estimator guardrail: ${money(totals.totalLow)} to ${money(totals.totalHigh)}\nCost basis: imported workbook national unit costs with a ${localDiscountPercent().toFixed(1)}% local market discount\nEstimate: ${$("estimateId").textContent}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Budget summary copied");
  } catch {
    showToast("Copy was not available in this browser");
  }
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2200);
}

$("scopeRows").addEventListener("input", event => {
  const row = event.target.closest("tr");
  if (!row || !event.target.dataset.field) return;
  const item = items.find(entry => entry.rowId === row.dataset.id);
  const field = event.target.dataset.field;
  item[field] = ["qty", "low", "mid", "high"].includes(field) ? Math.max(0, Number(event.target.value) || 0) : event.target.value;
  if (["low", "mid", "high"].includes(field)) {
    event.target.classList.toggle("invalid", item.mid < item.low || item.high < item.mid);
  }
  activeBenchmark = "customScope";
  row.querySelector(".amount-column").textContent = `${money(item.qty * item.low * marketFactor(), true)} - ${money(item.qty * item.high * marketFactor(), true)}`;
  updateTotals();
});
$("scopeRows").addEventListener("change", event => event.target.dispatchEvent(new Event("input", { bubbles: true })));
$("scopeRows").addEventListener("click", event => {
  const button = event.target.closest(".remove-item");
  if (!button) return;
  activeBenchmark = "customScope";
  items = items.filter(item => item.rowId !== button.closest("tr").dataset.id);
  renderItems();
  updateTotals();
});

document.querySelectorAll("#project input, #project select, #project textarea, #assumptions input").forEach(input => {
  input.addEventListener("input", event => {
    if (event.target.id === "localDiscount") renderItems();
    updateHeading();
    updateTotals();
  });
  input.addEventListener("change", () => {
    updateHeading();
    updateTotals();
  });
});
$("addItem").addEventListener("click", addCustomItem);
$("addItemBottom").addEventListener("click", addCustomItem);
$("addDatabaseItem").addEventListener("click", addDatabaseItem);
$("costSearch").addEventListener("input", updateCostOptions);
$("divisionFilter").addEventListener("change", updateCostOptions);
$("costSearch").addEventListener("keydown", event => { if (event.key === "Enter") addDatabaseItem(); });
$("foundationMethod").addEventListener("change", event => changeFoundationMethod(event.target.value));
$("framingMethod").addEventListener("change", event => changeFramingMethod(event.target.value));
$("hvacMethod").addEventListener("change", event => changeHvacMethod(event.target.value));
$("templateSelect").addEventListener("change", event => {
  loadAssembly(event.target.value);
  event.target.value = "";
});
$("saveEstimate").addEventListener("click", saveCurrentEstimate);
$("openEstimates").addEventListener("click", openEstimateLibrary);
$("saveFromLibrary").addEventListener("click", saveCurrentEstimate);
$("closeLibrary").addEventListener("click", closeEstimateLibrary);
$("estimateLibraryModal").addEventListener("click", event => { if (event.target === $("estimateLibraryModal")) closeEstimateLibrary(); });
$("savedEstimateList").addEventListener("click", event => {
  const card = event.target.closest(".saved-estimate-card");
  if (!card) return;
  const estimateId = card.dataset.estimateId;
  if (event.target.closest(".open-saved-estimate")) loadSavedEstimate(estimateId);
  else if (event.target.closest(".duplicate-saved-estimate")) duplicateSavedEstimate(estimateId);
  else if (event.target.closest(".delete-saved-estimate")) deleteSavedEstimate(estimateId);
});
$("newEstimate").addEventListener("click", resetEstimate);
$("reviewEstimate").addEventListener("click", openSummary);
$("closeModal").addEventListener("click", closeSummary);
$("summaryModal").addEventListener("click", event => { if (event.target === $("summaryModal")) closeSummary(); });
$("copySummary").addEventListener("click", copySummary);
$("plannerSquareFeet").addEventListener("input", updateAllowancePlanner);
$("pricePerSquareFoot").addEventListener("input", updateAllowancePlanner);
$("syncPlannerSquareFeet").addEventListener("click", syncPlannerSquareFeet);
$("printEstimate").addEventListener("click", () => { openSummary(); setTimeout(() => window.print(), 80); });
$("modalPrint").addEventListener("click", () => window.print());
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!$("summaryModal").hidden) closeSummary();
  if (!$("estimateLibraryModal").hidden) closeEstimateLibrary();
});

populateCostLibrary();
loadEstimate();
renderItems();
updateHeading();
updateTotals();
updateAllowancePlanner();
