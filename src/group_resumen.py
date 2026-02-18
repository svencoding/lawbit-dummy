import pandas as pd

# Read CSV
df = pd.read_csv("Resumen.csv", sep=";", encoding="latin-1", low_memory=False)

# Parse the work date and extract year-month
df["Fecha Trabajo"] = pd.to_datetime(df["Fecha Trabajo"], errors="coerce")
df["Mes"] = df["Fecha Trabajo"].dt.to_period("M").astype(str)

# Group by Usuario (user) + Codigo Asunto (project) + Month
group_keys = ["Usuario", "Codigo Asunto", "Mes"]

# Columns to sum (hours and monetary)
sum_cols = [
    "Tiempo Reportado",
    "Tiempo Reportado (Minutos)",
    "Tiempo Trabajado",
    "Tiempo Trabajado (Minutos)",
    "Horas Facturables",
    "Total Horaria",
    "Total HorariaUSD",
    "Total RACUSD",
    "Producción RAC",
    "Costo Total",
    "% Producción Asunto",
    "Facturación Asunto",
    "Facturación Distribuida",
    "Total_1",
]

# Coerce sum columns to numeric
for col in sum_cols:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

# Columns to drop entirely
drop_cols = ["Concepto", "ID", "Fecha Trabajo", "Fecha_Ultima_Modificacion", "Fecha Creación"]

# All other columns (not group keys, not sum cols, not drop cols) -> take first value
first_cols = [
    c for c in df.columns
    if c not in group_keys and c not in sum_cols and c not in drop_cols and c != "Mes"
]

# Build aggregation dict
agg_dict = {}
for col in sum_cols:
    if col in df.columns:
        agg_dict[col] = "sum"
for col in first_cols:
    if col in df.columns:
        agg_dict[col] = "first"

# Group and aggregate
grouped = df.groupby(group_keys, as_index=False).agg(agg_dict)

# Reorder columns logically
desired_order = ["Usuario"]
for c in df.columns:
    if c in drop_cols or c == "Mes" or c == "Usuario":
        continue
    desired_order.append(c)

# Insert Mes where Fecha Trabajo used to be (after Horas Facturables)
if "Horas Facturables" in desired_order:
    idx = desired_order.index("Horas Facturables") + 1
    desired_order.insert(idx, "Mes")
else:
    desired_order.append("Mes")

# Keep only columns that exist in grouped
final_order = [c for c in desired_order if c in grouped.columns]
grouped = grouped[final_order]

# Sort by user, project, month
grouped = grouped.sort_values(["Usuario", "Codigo Asunto", "Mes"]).reset_index(drop=True)

rows_before = len(df)
rows_after = len(grouped)

# Save
grouped.to_csv("Resumen_Agrupado.csv", sep=";", index=False, encoding="latin-1")

print(f"Done! {rows_before} rows -> {rows_after} rows")
print(f"Saved to: Resumen_Agrupado.csv")
