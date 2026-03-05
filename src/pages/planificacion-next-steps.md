# Planificación Estratégica — Next Steps

## Forecasting & Projections
- **Rolling forecast**: Auto-project remaining months based on YTD trend (linear regression or moving average), showing a "projected year-end" line on the chart
- **Scenario modeling**: "Optimistic / Base / Pessimistic" toggle — adjust growth assumptions and see how KPIs change
- **Cash flow forecast**: Overlay expected collection dates (factoring in typical payment delays per client) vs billed revenue

## Client-Level Planning
- **Top client budget allocation**: Set revenue targets per key client (top 10-20), track against actuals — helps identify client concentration risk
- **Client retention risk score**: Flag clients whose billing dropped >20% vs prior period, surface in an alert card
- **Pipeline/new business tracker**: Log prospective matters with estimated value, probability, and expected start date

## People & Capacity
- **Headcount planning**: Model "what if we hire 2 more associates in Litigios?" — auto-recalculate utilization targets and revenue capacity
- **Rate card simulator**: Adjust hourly rates per seniority level → see impact on projected revenue
- **Capacity heatmap**: Month × area matrix showing red (overbooked) / green (available capacity) based on target utilization vs current pipeline

## Profitability Deep-Dives
- **Matter-level profitability**: Drill from area → individual matters showing revenue vs cost (hours × blended rate)
- **Realization rate tracking**: Compare billed vs collected vs written-off amounts
- **Cost breakdown**: Split costs into categories (salaries, overhead, external counsel) for more granular budget control

## Alerts & Governance
- **Budget threshold alerts**: Configurable rules like "notify when area costs exceed 80% of annual cap" or "revenue falls below 90% of monthly target"
- **Approval workflow**: Budget changes require partner sign-off (when moving to DB, add an approval status field)
- **Variance commentary required**: Force a note when variance exceeds ±15%

## Reporting & Export
- **Board-ready PDF report**: One-click export of KPIs + chart + breakdown table as a formatted PDF
- **YoY comparison**: Side-by-side 2024 vs 2025 view for the same metrics
- **Benchmark indicators**: Show industry averages (e.g., "avg law firm profit margin: 35%") as reference lines on charts

## UX Enhancements
- **Drag-to-adjust budget**: Drag bar tops in the chart to visually adjust monthly targets
- **Goal progress ring**: Donut/radial chart per area showing % to annual target
- **Quick actions panel**: "Copy last year's budget", "Apply X% increase across all areas", "Reset to defaults"
- **Collapsible KPI cards**: Let users pin/hide specific KPIs based on what matters to them
