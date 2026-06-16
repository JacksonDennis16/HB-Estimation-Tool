# BuildRange Estimator

A self-contained browser prototype for preliminary residential remodeling and home-building estimates.

Open `index.html` in a modern browser. No installation or server is required.

## Included

- Client and project intake
- Editable scope line items with low/high unit costs
- National-average templates for kitchens, bathrooms, additions, and custom homes
- Published benchmark references and an adjustable local-market discount
- A searchable 78-line cost database imported from `Estimate and Proposal Workbook .xlsx`
- Cost-code, division, phase, description, unit, and national low/mid/high pricing
- Detailed assemblies with separate site work, concrete/foundation, framing, envelope, MEP, and finish scopes
- Scope items grouped by phase with expected and low-to-high phase subtotals
- Mutually exclusive slab, crawlspace, and component-takeoff foundation methods
- Mutually exclusive all-in rough-framing package and component framing takeoff
- Mutually exclusive all-in HVAC-with-ductwork package and component HVAC takeoff
- Contingency, combined OH&P, tax, permit, and design assumptions
- Live curated client proposal range plus an internal estimator guardrail spread
- Browser-based draft saving
- A local estimate library for saving, reopening, duplicating, and deleting multiple estimates
- A completed-project benchmark from the 329 Chapelwood cottage pro forma
- A company proposal-workbook reference panel using the uploaded `Proposal Spreadsheet.xlsx` ranges
- An independent price-per-square-foot finish allowance planner
- Client summary and print/PDF layout

## Estimating model

1. Direct costs are calculated from quantity × low/high unit cost.
2. Permit and design allowances are added to direct costs.
3. Contingency is calculated from that combined base.
4. Combined OH&P is applied once after contingency.
5. Sales tax is applied last.
6. The broad low/high spread remains available as the internal estimator guardrail.
7. The client proposal range is curated around the expected budget using the selected range percentage.
8. Client-facing totals may be rounded outward to the nearest $1,000.

## National cost basis

- Remodeling templates are calibrated to the 2025 Journal of Light Construction Cost vs. Value national job-cost benchmarks.
- Custom-home pricing is anchored to the NAHB 2024 Cost of Constructing a Home survey and its approximate $162-per-square-foot average direct construction cost.
- The local market discount defaults to `15%`, reducing the national unit costs to reflect the current local market assumption.
- Detailed unit-cost records and their original source references come from the supplied workbook.

The slab-on-grade and crawlspace choices use all-in foundation-system pricing and do not also load footings, poured concrete, or reinforcing. Component takeoff mode removes the all-in system and requires measured quantities. The app warns when overlapping foundation pricing is entered manually.

The default rough-framing package consolidates exterior walls, interior partitions, floor framing when applicable, roof framing or trusses, and sheathing. Component mode removes that package before loading individual framing lines.

The default HVAC package includes normal duct distribution. Component mode removes the package and loads equipment and ductwork separately. The app warns if both methods are priced.

Project management and supervision is excluded from the standard assemblies because it is included in OH&P. The app blocks that cost-database item while OH&P is active and warns if it appears in an older saved estimate.

## Saving estimates

The working draft is auto-saved in the current browser. Use **Save estimate** to create or update a record in the estimate library. Use **Estimates** to reopen or duplicate saved jobs. This local library is not yet synchronized or backed up outside this browser.

## Historical calibration

The custom-home view includes the 329 Chapelwood cottage as a company historical reference: 1,606 HVAC square feet, $170,788 direct construction, $106.34 direct cost per HVAC square foot, and $117.02 per HVAC square foot including the recorded builder OH&P. National unit costs remain the estimating basis; Chapelwood is displayed as a comparison rather than substituted as a universal rate.

Confirm quantities before issuing a contract price. All national costs should still be checked against company history, supplier pricing, subcontractor quotes, and local permit requirements.

The finish allowance planner is an independent scenario tool. Its price-per-square-foot slider generates suggested ranges for lighting, plumbing fixtures, flooring, countertops, cabinetry, and appliances without changing the active estimate or client summary.

The Proposal Spreadsheet reference panel uses the uploaded workbook's broad $/SF low-high ranges as a comparison check. It is intentionally reference-only and does not replace the national cost database or change estimate totals.
