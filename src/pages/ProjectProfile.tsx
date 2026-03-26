import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  DollarSign,
  ArrowLeft,
  ArrowUpDown,
  FolderOpen,
  Building2,
  Users,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getClientes,
  getAsuntos,
  getTransformedTimeEntries,
  getFacturacion,
  getUsuarios,
} from "@/lib/mockDataUtils";

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    const millions = value / 1000000;
    return millions % 1 === 0 ? `$${millions}M` : `$${millions.toFixed(1)}M`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

type ProfSortField = "user_name" | "total_hours" | "total_cost";
type SortOrder = "asc" | "desc";

const ProjectProfile = () => {
  const { asuntoId } = useParams<{ asuntoId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dataLoading, setDataLoading] = useState(true);

  const [profSortField, setProfSortField] = useState<ProfSortField>("total_hours");
  const [profSortOrder, setProfSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const projectData = useMemo(() => {
    if (!asuntoId) return null;
    const id = parseInt(asuntoId, 10);

    const asuntos = getAsuntos();
    const asunto = asuntos.find((a) => a.id === id);
    if (!asunto) return null;

    const clientes = getClientes();
    const cliente = asunto.cliente_id
      ? clientes.find((c) => c.id === asunto.cliente_id)
      : null;

    // Get time entries for this project
    const entries = getTransformedTimeEntries().filter(
      (e) => e.project_id === id,
    );

    // Totals
    let totalHours = 0;
    let totalCost = 0;
    let billableHours = 0;

    // Aggregate by professional
    const profMap = new Map<
      number,
      { user_id: number; user_name: string; user_code: string; total_hours: number; total_cost: number }
    >();
    const allUsuarios = getUsuarios();

    entries.forEach((e) => {
      const cost =
        e.originalEntry.total_cost ?? e.duration * (e.originalEntry.hourly_cost || 0);
      totalHours += e.duration;
      totalCost += cost;
      billableHours += e.billable_duration;

      if (!profMap.has(e.user_id)) {
        const u = allUsuarios.find((u) => u.id === e.user_id);
        profMap.set(e.user_id, {
          user_id: e.user_id,
          user_name: e.user_name,
          user_code: u?.code || "",
          total_hours: 0,
          total_cost: 0,
        });
      }
      const prof = profMap.get(e.user_id)!;
      prof.total_hours += e.duration;
      prof.total_cost += cost;
    });

    // Get payments for this project
    const payments = getFacturacion().filter((p) => p.asunto_id === id);
    const totalBilled = payments.reduce((sum, p) => sum + (p.amount_charged || 0), 0);

    return {
      asunto,
      cliente,
      totalHours,
      totalCost,
      billableHours,
      totalBilled,
      professionals: Array.from(profMap.values()),
    };
  }, [asuntoId]);

  useEffect(() => {
    if (user && asuntoId) {
      setDataLoading(true);
      setTimeout(() => setDataLoading(false), 200);
    }
  }, [user, asuntoId]);

  const sortedProfessionals = useMemo(() => {
    if (!projectData?.professionals) return [];
    const sorted = [...projectData.professionals];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (profSortField) {
        case "user_name":
          cmp = a.user_name.localeCompare(b.user_name);
          break;
        case "total_hours":
          cmp = a.total_hours - b.total_hours;
          break;
        case "total_cost":
          cmp = a.total_cost - b.total_cost;
          break;
      }
      return profSortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [projectData, profSortField, profSortOrder]);

  const handleProfSort = (field: ProfSortField) => {
    if (profSortField === field) {
      setProfSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setProfSortField(field);
      setProfSortOrder(field === "user_name" ? "asc" : "desc");
    }
  };

  if (authLoading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  if (!projectData) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Asunto no encontrado
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { asunto, cliente, totalHours, totalCost, billableHours, totalBilled, professionals } =
    projectData;

  const stats = [
    {
      title: "Horas Totales",
      value: Math.round(totalHours).toLocaleString(),
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Costo Total",
      value: formatCurrency(totalCost),
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      title: "Horas Facturables",
      value: Math.round(billableHours).toLocaleString(),
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "Profesionales",
      value: professionals.length.toString(),
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{asunto.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {cliente && (
                  <button
                    className="hover:text-foreground hover:underline"
                    onClick={() => navigate(`/dashboard/clientes/${cliente.id}`)}
                  >
                    <Building2 className="h-3.5 w-3.5 inline mr-1" />
                    {cliente.name}
                  </button>
                )}
                {asunto.practice_area && (
                  <>
                    <span>·</span>
                    <Badge variant="secondary" className="text-xs">
                      {asunto.practice_area}
                    </Badge>
                  </>
                )}
                {asunto.project_type && (
                  <>
                    <span>·</span>
                    <span>{asunto.project_type}</span>
                  </>
                )}
                {asunto.charge_type && (
                  <>
                    <span>·</span>
                    <span>{asunto.charge_type}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    <p className="text-lg font-semibold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Professionals Table */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">Profesionales asignados</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleProfSort("user_name")}
                      >
                        Nombre
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("total_hours")}
                      >
                        Horas
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("total_cost")}
                      >
                        Costo
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProfessionals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Sin horas registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedProfessionals.map((prof) => (
                      <TableRow
                        key={prof.user_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/user/${prof.user_code}`)}
                      >
                        <TableCell className="font-medium text-sm">
                          {prof.user_name}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {Math.round(prof.total_hours).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(prof.total_cost)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProjectProfile;
