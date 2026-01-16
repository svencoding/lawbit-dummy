export const AREA_PROFESIONAL_COLORS: Record<string, string> = {
  COMPLIANCE: "#00264b",
  CORPORATIVO: "#86626e",
  "CORPORATIVO AAA": "#86626e",
  "DERECHO INMOBILIARIO": "#2a9d8f",
  "DERECHO LABORAL": "#80ffdb",
  "DERECHO MINERO Y RECURSOS MINEROS NATURALES": "#5fa8d3",
  "DERECHO PENAL": "#e76f51",
  "DERECHO PÚBLICO Y MERCADOS REGULADOS": "#c0c0c0",
  "DERECHO TRIBUTARIO": "#e6d6b4",
  ENERGÍA: "#225544",
  "LIBRE COMPETENCIA": "#fa8072",
  LITIGIO: "#708090",
  "LITIGIO KW": "#708090",
  "LITIGIO Y ARBITRAJE": "#708090",
  MEDIOAMBIENTE: "#b9b0c6",
  "NO USAR": "#e9c46a",
  "PI, TECNOLOGÍA Y DATOS": "#cc9900",
};

export const AREAS_PROFESIONALES = [
  { area: "COMPLIANCE", color: "#00264b" },
  { area: "CORPORATIVO", color: "#86626e" },
  { area: "CORPORATIVO AAA", color: "#86626e" },
  { area: "DERECHO INMOBILIARIO", color: "#2a9d8f" },
  { area: "DERECHO LABORAL", color: "#80ffdb" },
  { area: "DERECHO MINERO Y RECURSOS MINEROS NATURALES", color: "#5fa8d3" },
  { area: "DERECHO PENAL", color: "#e76f51" },
  { area: "DERECHO PÚBLICO Y MERCADOS REGULADOS", color: "#c0c0c0" },
  { area: "DERECHO TRIBUTARIO", color: "#e6d6b4" },
  { area: "ENERGÍA", color: "#225544" },
  { area: "LIBRE COMPETENCIA", color: "#fa8072" },
  { area: "LITIGIO", color: "#708090" },
  { area: "LITIGIO KW", color: "#708090" },
  { area: "LITIGIO Y ARBITRAJE", color: "#708090" },
  { area: "MEDIOAMBIENTE", color: "#b9b0c6" },
  { area: "NO USAR", color: "#e9c46a" },
  { area: "PI, TECNOLOGÍA Y DATOS", color: "#cc9900" },
] as const;

// Mapping from common area names to constants keys
const AREA_NAME_MAPPING: Record<string, string> = {
  "Consultoría": "COMPLIANCE",
  "Corporativo": "CORPORATIVO",
  "Laboral": "DERECHO LABORAL",
  "Procesal": "LITIGIO",
  "Penal": "DERECHO PENAL",
  "Litigios": "LITIGIO",
  "Asuntos Internos": "COMPLIANCE",
};

// Helper function to get color by area name
export const getAreaColor = (areaProfesional: string): string => {
  // First try direct match
  if (AREA_PROFESIONAL_COLORS[areaProfesional]) {
    return AREA_PROFESIONAL_COLORS[areaProfesional];
  }

  // Try mapping
  const mappedKey = AREA_NAME_MAPPING[areaProfesional];
  if (mappedKey && AREA_PROFESIONAL_COLORS[mappedKey]) {
    return AREA_PROFESIONAL_COLORS[mappedKey];
  }

  // Try case-insensitive match
  const upperKey = areaProfesional.toUpperCase();
  for (const [key, color] of Object.entries(AREA_PROFESIONAL_COLORS)) {
    if (key.toUpperCase() === upperKey) {
      return color;
    }
  }

  return "#6b7280"; // Default gray color
};
