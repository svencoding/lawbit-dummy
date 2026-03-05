# Project Guidelines

## Cross-Filtering Pattern

When a page has two or more interactive charts/tables, filters must be **independent and stackable** (cross-filtering). Clicking one chart should NOT clear filters set by another chart.

Rules:
- Each filter setter preserves other active filters (`...prev` spread pattern, not resetting other fields)
- Each chart/table filters by all dimensions **except its own** so the user can still see the full distribution for that dimension
- Example: Area pie chart filters by clientName + formaCobro but NOT area; FormaCobro pie chart filters by clientName + area but NOT formaCobro; Client table filters by area + formaCobro but NOT clientName
- Stats/KPIs should reflect all active filters combined
- Active filter badges should be shown for each active filter with individual remove (X) buttons and a "clear all" option
- Reference implementation: `src/hooks/useFacturacionFilters.tsx` and `src/pages/Facturacion.tsx`

## Table Default Sort Order

All data tables must default to **descending order** by the most relevant numeric column (hours, cost, or revenue). When a user clicks a new numeric column to sort, it should also start in descending order.

Rules:
- Default sort field should be `total_hours`, `total_cost`, or the primary numeric metric — never alphabetical by name
- Default sort direction: `"desc"` for numeric columns, `"asc"` for text columns
- When switching to a new sort column, numeric fields default to `desc`, text fields default to `asc`
- Hard-coded sorts in data processing functions (useMemo) should also sort descending by the primary metric
