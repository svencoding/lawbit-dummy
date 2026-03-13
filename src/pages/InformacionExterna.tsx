import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Globe, Search, Loader2, X, Newspaper, Shield, Clock, Building2, Scale, AlertTriangle, Gavel, FileWarning, Landmark, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const INTENDENCIAS = [
  { value: "1271", label: "Intendencia Regional de Amazonas" },
  { value: "1272", label: "Intendencia Regional de Áncash" },
  { value: "1274", label: "Intendencia Regional de Arequipa" },
  { value: "1275", label: "Intendencia Regional de Ayacucho" },
  { value: "1276", label: "Intendencia Regional de Cajamarca" },
  { value: "1277", label: "Intendencia Regional del Callao" },
  { value: "1278", label: "Intendencia Regional de Cusco" },
  { value: "1279", label: "Intendencia Regional de Huancavelica" },
  { value: "1280", label: "Intendencia Regional de Huánuco" },
  { value: "1281", label: "Intendencia Regional de Ica" },
  { value: "1282", label: "Intendencia Regional de Junín" },
  { value: "1283", label: "Intendencia Regional de La Libertad" },
  { value: "1284", label: "Intendencia Regional de Lambayeque" },
  { value: "462", label: "Intendencia de Lima Metropolitana" },
  { value: "1273", label: "Intendencia Regional de Lima Provincias" },
  { value: "1285", label: "Intendencia Regional de Loreto" },
  { value: "1286", label: "Intendencia Regional de Madre de Dios" },
  { value: "1287", label: "Intendencia Regional de Moquegua" },
  { value: "1288", label: "Intendencia Regional de Pasco" },
  { value: "1289", label: "Intendencia Regional de Piura" },
  { value: "1290", label: "Intendencia Regional de Puno" },
  { value: "1291", label: "Intendencia Regional de San Martín" },
  { value: "1292", label: "Intendencia Regional de Tacna" },
  { value: "1293", label: "Intendencia Regional de Tumbes" },
  { value: "1294", label: "Intendencia Regional de Ucayali" },
  { value: "1295", label: "Intendencia Regional de Apurímac" },
];

const SUNAFIL_TOKEN =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGVsbGlkb1BhdGVybm8iOiJTVU5BRklMIiwibnVtZXJvRGVwZW5kZW5jaWEiOiI0NjIiLCJkZXNjcmlwY2lvbkRlcGVuZGVuY2lhIjoiU1VOQUZJTC1JTlRFTkRFTkNJQSBERSBMSU1BIE1FVFJPUE9MSVRBTkEiLCJ1c2VyX25hbWUiOiJTVU5BRklMIiwic2NvcGUiOlsicmVhZCIsIndyaXRlIl0sImV4cCI6MTc3Mjc1MjExOSwibm9tYnJlIjoiU1VOQUZJTCIsImF1dGhvcml0aWVzIjpbIlJPTEVfQURNSU5JU1RSQURPUiJdLCJqdGkiOiIzYWNlZmNjMi1iY2QxLTQwM2EtOTVhZS0wZjA0ZWRkN2JiODgiLCJjbGllbnRfaWQiOiJzdW5hZmlsIiwiYXBlbGxpZG9NYXRlcm5vIjoiU1VOQUZJTCJ9.AKJATsH95Ij1nMR93iwSS3QkS861gnGbz7QVhyv8sKVbbwXE-2kirVsC9DlwrHCzETNt2PITAwrDqdQuKOE7ICYus4zKaPa1OF-iGSguJBgmQHlaHAB3VA6kl2L-0Tak0J68RaiiTcegwtdVLnFunK0VGvc6ZPjMpbHEQ7fSLtdnY8n5g1A00ZmMUWLaquchnTta8cfBc3qVBm7TTH61xdIxqGWoN4dGk11jn9pvDjyWogD-pt0wO23P4dFAWea6uXVJ0j5vro6PeHvlvunwYJgcblTvvhaxNxd1OKEy8iAWo9UR85IdI5vJltzvCsLYWn2UcZdVgNAvZ7pyFcGbsg";

const SUNAFIL_HEADERS = {
  Authorization: `Bearer ${SUNAFIL_TOKEN}`,
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
};

async function searchByOrden(
  ordenInspeccion: string,
  anio: string,
  intendencia: string,
) {
  const ordenPadded = ordenInspeccion.padStart(10, "0");
  const res = await fetch(
    `/sunafil-api/ws.denuncia/denuncias/fases/ordenInspeccion/${ordenPadded}/${anio}/${intendencia}`,
    { headers: SUNAFIL_HEADERS },
  );
  if (!res.ok) throw new Error(`SUNAFIL respondió con error ${res.status}`);
  return res.json();
}

async function searchFases(
  registroEntrada: string,
  anioRegistro: string,
  depRegistro: string,
  ordenInspeccion: string,
  anioOI: string,
  depOI: string,
) {
  const registroPadded = registroEntrada.padStart(10, "0");
  const ordenPadded = ordenInspeccion.padStart(10, "0");
  const res = await fetch(
    `/sunafil-api/ws.denuncia/denuncias/fases/${registroPadded}/${anioRegistro}/${depRegistro}/${ordenPadded}/${anioOI}/${depOI}`,
    { headers: SUNAFIL_HEADERS },
  );
  if (!res.ok) throw new Error(`SUNAFIL respondió con error ${res.status}`);
  return res.json();
}

function ResultDisplay({ data }: { data: any }) {
  if (Array.isArray(data) && data.length > 0) {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {Object.keys(data[0]).map((key) => (
                <TableHead key={key}>{key}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any, idx: number) => (
              <TableRow key={idx}>
                {Object.values(row).map((val: any, i: number) => (
                  <TableCell key={i}>
                    {val === null || val === undefined
                      ? "-"
                      : typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(data).map(([key, val]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              {key}
            </span>
            <span className="text-sm">
              {val === null || val === undefined ? (
                "-"
              ) : typeof val === "object" ? (
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(val, null, 2)}
                </pre>
              ) : typeof val === "boolean" ? (
                <Badge variant={val ? "default" : "secondary"}>
                  {val ? "Sí" : "No"}
                </Badge>
              ) : (
                String(val)
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-muted-foreground">No se encontraron resultados</p>
  );
}

// --- Mock News Data ---

type NewsCategory = "laboral" | "corporativo" | "tributario" | "regulatorio" | "litigios" | "compliance";

interface NewsItem {
  id: number;
  client: string;
  title: string;
  summary: string;
  category: NewsCategory;
  date: string;
  source: string;
}

const CATEGORY_CONFIG: Record<NewsCategory, { label: string; color: string; icon: typeof Scale }> = {
  laboral: { label: "Laboral", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: Shield },
  corporativo: { label: "Corporativo", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300", icon: Building2 },
  tributario: { label: "Tributario", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300", icon: Landmark },
  regulatorio: { label: "Regulatorio", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: BookOpen },
  litigios: { label: "Litigios", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300", icon: Gavel },
  compliance: { label: "Compliance", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300", icon: FileWarning },
};

const MOCK_NEWS: NewsItem[] = [
  { id: 1, client: "TechNova Solutions", title: "SUNAFIL inicia fiscalización por jornada laboral en sector tech", summary: "La Superintendencia anunció inspecciones focalizadas en empresas tecnológicas por presuntas irregularidades en el registro de horas extras y trabajo remoto.", category: "laboral", date: "2026-03-12", source: "Gestión" },
  { id: 2, client: "GreenWave Enterprises", title: "Nuevo reglamento ambiental impacta operaciones industriales", summary: "El MINAM publicó modificaciones al Reglamento de Gestión Ambiental que exigen nuevos estándares de cumplimiento para empresas del sector energético.", category: "regulatorio", date: "2026-03-12", source: "El Peruano" },
  { id: 3, client: "SkyHigh Innovations", title: "Demanda colectiva por patentes en sector aeronáutico", summary: "Un grupo de inventores independientes presentó demanda contra varias empresas de innovación por uso indebido de patentes de diseño industrial.", category: "litigios", date: "2026-03-11", source: "La Ley" },
  { id: 4, client: "Horizon Logistics", title: "SUNAT intensifica auditorías en empresas de transporte", summary: "La autoridad tributaria anunció un plan especial de fiscalización para empresas logísticas con facturación superior a S/ 10 millones anuales.", category: "tributario", date: "2026-03-11", source: "Gestión" },
  { id: 5, client: "CrystalClear Technologies", title: "Obligaciones de protección de datos personales se endurecen", summary: "La Autoridad Nacional de Protección de Datos emitió nueva directiva que obliga a empresas tech a implementar DPO antes de junio 2026.", category: "compliance", date: "2026-03-11", source: "El Comercio" },
  { id: 6, client: "BlueOcean Ventures", title: "Fusión en el sector pesquero genera revisión antimonopolio", summary: "INDECOPI abrió investigación preliminar tras el anuncio de adquisición de tres empresas del sector acuícola por un conglomerado internacional.", category: "corporativo", date: "2026-03-10", source: "Semana Económica" },
  { id: 7, client: "SilverLeaf Consulting", title: "Reforma laboral: nuevos requisitos para contratos de consultoría", summary: "El Congreso aprobó en primera votación un proyecto que establece beneficios laborales obligatorios para consultores con contratos superiores a 6 meses.", category: "laboral", date: "2026-03-10", source: "RPP" },
  { id: 8, client: "SunRise Energy", title: "Conflicto por servidumbre minera llega al Tribunal Constitucional", summary: "La empresa enfrenta un recurso de amparo por parte de comunidades campesinas que alegan afectación de derechos territoriales ancestrales.", category: "litigios", date: "2026-03-10", source: "La Ley" },
  { id: 9, client: "Quantum Dynamics", title: "Incentivos tributarios para I+D se amplían hasta 2028", summary: "El MEF anunció la extensión del régimen de deducciones adicionales para gastos en investigación, desarrollo e innovación tecnológica.", category: "tributario", date: "2026-03-09", source: "El Peruano" },
  { id: 10, client: "RapidGrow Marketing", title: "INDECOPI sanciona prácticas de publicidad engañosa", summary: "Tres empresas de marketing digital fueron multadas por difundir testimonios falsos y métricas infladas en campañas publicitarias.", category: "regulatorio", date: "2026-03-09", source: "Gestión" },
  { id: 11, client: "EcoFusion Group", title: "Nuevo marco regulatorio para bonos de carbono en Perú", summary: "El gobierno publicó el reglamento para la certificación y comercialización de créditos de carbono, abriendo oportunidades para el sector verde.", category: "regulatorio", date: "2026-03-09", source: "El Peruano" },
  { id: 12, client: "MetroBuild Construction", title: "Accidente laboral en obra genera responsabilidad penal", summary: "La fiscalía formalizó investigación contra directivos de constructora por presunta negligencia en protocolos de seguridad ocupacional.", category: "laboral", date: "2026-03-08", source: "La República" },
  { id: 13, client: "Vertex Financial Services", title: "SBS endurece regulación para fintechs y entidades financieras", summary: "Nuevas disposiciones exigen capital mínimo más alto y reportes de operaciones sospechosas en tiempo real para empresas del sector.", category: "compliance", date: "2026-03-08", source: "Gestión" },
  { id: 14, client: "StarLink Communications", title: "Conflicto por espectro radioeléctrico escala a arbitraje", summary: "El MTC y la operadora no lograron acuerdo sobre la renovación de licencias, llevando el caso a un tribunal arbitral internacional.", category: "litigios", date: "2026-03-08", source: "El Comercio" },
  { id: 15, client: "OmniHealth Medical", title: "DIGEMID refuerza controles sobre dispositivos médicos importados", summary: "Nuevos requisitos de trazabilidad y registro sanitario entrarán en vigor en abril, afectando la cadena de suministro de equipos médicos.", category: "regulatorio", date: "2026-03-07", source: "El Peruano" },
  { id: 16, client: "BrightPath Education", title: "Universidades privadas bajo escrutinio por incumplimiento laboral", summary: "SUNAFIL detectó irregularidades en contratos docentes de tiempo parcial en cinco universidades, iniciando procedimientos sancionadores.", category: "laboral", date: "2026-03-07", source: "La Ley" },
  { id: 17, client: "UrbanNest Realty", title: "Modificaciones a la Ley de Arrendamiento afectan sector inmobiliario", summary: "El proyecto de ley busca establecer topes a incrementos de renta y nuevas obligaciones de registro ante SUNARP para contratos de alquiler.", category: "corporativo", date: "2026-03-07", source: "Semana Económica" },
  { id: 18, client: "PureWater Industries", title: "ANA impone sanciones por uso excesivo de recursos hídricos", summary: "La Autoridad Nacional del Agua sancionó a empresas industriales por extracciones que superaron los límites de sus licencias de uso.", category: "regulatorio", date: "2026-03-06", source: "El Peruano" },
  { id: 19, client: "Infinity Software", title: "Controversia por cláusulas de no competencia en contratos tech", summary: "Un juzgado laboral declaró nulas las cláusulas de no competencia de una empresa de software por considerarlas desproporcionadas.", category: "laboral", date: "2026-03-06", source: "La Ley" },
  { id: 20, client: "GlobalEdge Consulting", title: "Nuevas reglas para precios de transferencia impactan multinacionales", summary: "SUNAT actualizó las directrices de documentación sobre precios de transferencia, alineándose con las recomendaciones de la OCDE.", category: "tributario", date: "2026-03-06", source: "Gestión" },
  { id: 21, client: "NextGen Robotics", title: "Debate sobre regulación de inteligencia artificial avanza en el Congreso", summary: "La Comisión de Ciencia y Tecnología aprobó dictamen que establece responsabilidad civil por daños causados por sistemas de IA autónomos.", category: "regulatorio", date: "2026-03-05", source: "El Comercio" },
  { id: 22, client: "SolarFlare Systems", title: "Conflicto tributario por exoneraciones en zona franca", summary: "SUNAT cuestiona beneficios tributarios aplicados por empresas en la zona franca de Tacna, iniciando procesos de determinación de deuda.", category: "tributario", date: "2026-03-05", source: "Gestión" },
  { id: 23, client: "BlueSky Architects", title: "Municipalidad revoca licencias de construcción en zona protegida", summary: "Proyectos arquitectónicos en el centro histórico de Lima enfrentan paralización tras resolución municipal que endurece criterios patrimoniales.", category: "litigios", date: "2026-03-05", source: "La República" },
  { id: 24, client: "EcoSustain Solutions", title: "OEFA incrementa fiscalización ambiental en sector minero", summary: "El organismo anunció un plan de supervisión especial que incluye uso de drones y monitoreo satelital para detectar pasivos ambientales.", category: "compliance", date: "2026-03-04", source: "El Peruano" },
  { id: 25, client: "CyberShield Security", title: "Ley de Ciberdelitos: nuevas obligaciones para empresas de seguridad digital", summary: "La modificatoria de la Ley 30096 establece que empresas de ciberseguridad deben reportar incidentes al CERT-PE en un plazo máximo de 24 horas.", category: "compliance", date: "2026-03-04", source: "La Ley" },
  { id: 26, client: "FreshStart Foods", title: "DIGESA emite alerta sanitaria y ordena retiro de productos", summary: "La autoridad sanitaria ordenó el retiro preventivo de lotes de alimentos procesados tras detectar niveles irregulares de conservantes.", category: "regulatorio", date: "2026-03-04", source: "RPP" },
  { id: 27, client: "PureTech Labs", title: "Disputa por propiedad intelectual en sector farmacéutico", summary: "INDECOPI resolvió a favor de laboratorio nacional en caso de patente sobre proceso de síntesis de principio activo genérico.", category: "litigios", date: "2026-03-03", source: "La Ley" },
  { id: 28, client: "FutureVision Media", title: "Regulación de plataformas digitales: obligaciones tributarias y de contenido", summary: "El proyecto de ley aprobado en comisión establece que plataformas de streaming deben retener IGV y cumplir cuotas de contenido nacional.", category: "tributario", date: "2026-03-03", source: "Gestión" },
  { id: 29, client: "Aurora Pharmaceuticals", title: "Proceso penal por adulteración de medicamentos genéricos", summary: "La Fiscalía Especializada formalizó investigación contra directivos por presunta comercialización de medicamentos con principios activos alterados.", category: "compliance", date: "2026-03-03", source: "El Comercio" },
  { id: 30, client: "DreamScape Productions", title: "Conflicto laboral por derechos de autor en producciones audiovisuales", summary: "Guionistas y directores demandan reconocimiento de derechos patrimoniales sobre contenido producido bajo relación de dependencia laboral.", category: "laboral", date: "2026-03-02", source: "La República" },
];

function NoticiasRelevantes() {
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | "all">("all");

  const filteredNews = selectedCategory === "all"
    ? MOCK_NEWS
    : MOCK_NEWS.filter((n) => n.category === selectedCategory);

  return (
    <div className="space-y-5">
      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory("all")}
        >
          Todas
        </Button>
        {(Object.entries(CATEGORY_CONFIG) as [NewsCategory, typeof CATEGORY_CONFIG[NewsCategory]][]).map(
          ([key, config]) => (
            <Button
              key={key}
              variant={selectedCategory === key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(key)}
              className="gap-1.5"
            >
              <config.icon className="h-3.5 w-3.5" />
              {config.label}
            </Button>
          ),
        )}
      </div>

      {/* News grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredNews.map((news) => {
          const catConfig = CATEGORY_CONFIG[news.category];
          const CatIcon = catConfig.icon;
          return (
            <Card
              key={news.id}
              className="flex flex-col hover:shadow-md transition-shadow border-l-4"
              style={{
                borderLeftColor: news.category === "laboral" ? "#3b82f6"
                  : news.category === "corporativo" ? "#8b5cf6"
                  : news.category === "tributario" ? "#f59e0b"
                  : news.category === "regulatorio" ? "#22c55e"
                  : news.category === "litigios" ? "#ef4444"
                  : "#14b8a6",
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge variant="outline" className={`text-xs ${catConfig.color} border-0`}>
                    <CatIcon className="h-3 w-3 mr-1" />
                    {catConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(news.date).toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <CardTitle className="text-sm leading-tight line-clamp-2">
                  {news.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">
                  {news.summary}
                </p>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-primary truncate max-w-[150px]">
                      {news.client}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground italic">
                    {news.source}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredNews.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No hay noticias para esta categoría.
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>
          Estas noticias son datos de ejemplo. Próximamente se integrarán fuentes de noticias en tiempo real mediante scraping automatizado para cada cliente.
        </span>
      </div>
    </div>
  );
}

// --- SUNAFIL Tab Content ---

function SunafilContent() {
  const [ordenInspeccion, setOrdenInspeccion] = useState("15");
  const [anio, setAnio] = useState("2026");
  const [intendencia, setIntendencia] = useState("1273");
  const [searching1, setSearching1] = useState(false);
  const [result1, setResult1] = useState<any>(null);
  const [error1, setError1] = useState<string | null>(null);

  const [registroEntrada, setRegistroEntrada] = useState("2650");
  const [anioRegistro, setAnioRegistro] = useState("2025");
  const [depRegistro, setDepRegistro] = useState("1273");
  const [ordenFases, setOrdenFases] = useState("15");
  const [anioFases, setAnioFases] = useState("2026");
  const [depFases, setDepFases] = useState("1273");
  const [searching2, setSearching2] = useState(false);
  const [result2, setResult2] = useState<any>(null);
  const [error2, setError2] = useState<string | null>(null);

  const handleSearch1 = async () => {
    if (!ordenInspeccion || !anio || !intendencia) {
      setError1("Completa todos los campos");
      return;
    }
    setSearching1(true);
    setError1(null);
    setResult1(null);
    try {
      const data = await searchByOrden(ordenInspeccion, anio, intendencia);
      setResult1(data);
    } catch (err: any) {
      setError1(err.message || "Error de conexión");
    } finally {
      setSearching1(false);
    }
  };

  const handleClear1 = () => {
    setOrdenInspeccion("");
    setAnio("");
    setIntendencia("");
    setResult1(null);
    setError1(null);
  };

  const handleSearch2 = async () => {
    if (
      !registroEntrada ||
      !anioRegistro ||
      !depRegistro ||
      !ordenFases ||
      !anioFases ||
      !depFases
    ) {
      setError2("Completa todos los campos");
      return;
    }
    setSearching2(true);
    setError2(null);
    setResult2(null);
    try {
      const data = await searchFases(
        registroEntrada,
        anioRegistro,
        depRegistro,
        ordenFases,
        anioFases,
        depFases,
      );
      setResult2(data);
    } catch (err: any) {
      setError2(err.message || "Error de conexión");
    } finally {
      setSearching2(false);
    }
  };

  const handleClear2 = () => {
    setRegistroEntrada("");
    setAnioRegistro("");
    setDepRegistro("");
    setOrdenFases("");
    setAnioFases("");
    setDepFases("");
    setResult2(null);
    setError2(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Consulta por Orden de Inspección
          </CardTitle>
          <CardDescription>
            /ws.denuncia/denuncias/fases/ordenInspeccion/&#123;orden&#125;/&#123;año&#125;/&#123;intendencia&#125;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Orden de inspección"
              value={ordenInspeccion}
              onChange={(e) => setOrdenInspeccion(e.target.value)}
              className="sm:w-48"
            />
            <Input
              placeholder="Año"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              type="number"
              className="sm:w-32"
            />
            <Select value={intendencia} onValueChange={setIntendencia}>
              <SelectTrigger className="sm:w-80">
                <SelectValue placeholder="Intendencia" />
              </SelectTrigger>
              <SelectContent>
                {INTENDENCIAS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch1} disabled={searching1}>
              {searching1 ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
            <Button variant="outline" onClick={handleClear1}>
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
          {error1 && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error1}
            </div>
          )}
        </CardContent>
      </Card>

      {result1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Resultado - Orden de Inspección
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResultDisplay data={result1} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Consulta de Fases del Expediente
          </CardTitle>
          <CardDescription>
            /ws.denuncia/denuncias/fases/&#123;registro&#125;/&#123;añoReg&#125;/&#123;depReg&#125;/&#123;orden&#125;/&#123;añoOI&#125;/&#123;depOI&#125;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="N° Registro Entrada"
                value={registroEntrada}
                onChange={(e) => setRegistroEntrada(e.target.value)}
                className="sm:w-48"
              />
              <Input
                placeholder="Año Registro"
                value={anioRegistro}
                onChange={(e) => setAnioRegistro(e.target.value)}
                type="number"
                className="sm:w-32"
              />
              <Select value={depRegistro} onValueChange={setDepRegistro}>
                <SelectTrigger className="sm:w-80">
                  <SelectValue placeholder="Dependencia Registro" />
                </SelectTrigger>
                <SelectContent>
                  {INTENDENCIAS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Orden de inspección"
                value={ordenFases}
                onChange={(e) => setOrdenFases(e.target.value)}
                className="sm:w-48"
              />
              <Input
                placeholder="Año OI"
                value={anioFases}
                onChange={(e) => setAnioFases(e.target.value)}
                type="number"
                className="sm:w-32"
              />
              <Select value={depFases} onValueChange={setDepFases}>
                <SelectTrigger className="sm:w-80">
                  <SelectValue placeholder="Dependencia OI" />
                </SelectTrigger>
                <SelectContent>
                  {INTENDENCIAS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSearch2} disabled={searching2}>
                {searching2 ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar
              </Button>
              <Button variant="outline" onClick={handleClear2}>
                <X className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            </div>
          </div>
          {error2 && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error2}
            </div>
          )}
        </CardContent>
      </Card>

      {result2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Resultado - Fases del Expediente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResultDisplay data={result2} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Main Page ---

const InformacionExterna = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Globe className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Información Externa</h1>
        </div>

        <Tabs defaultValue="noticias">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="noticias" className="gap-2">
              <Newspaper className="h-4 w-4" />
              Noticias Relevantes
            </TabsTrigger>
            <TabsTrigger value="sunafil" className="gap-2">
              <Shield className="h-4 w-4" />
              SUNAFIL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="noticias">
            <NoticiasRelevantes />
          </TabsContent>

          <TabsContent value="sunafil">
            <SunafilContent />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default InformacionExterna;
