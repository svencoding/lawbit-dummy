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
  Briefcase,
  ArrowLeft,
  ArrowUpDown,
  Building2,
  Users,
  FolderOpen,
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
  getClientCosts,
  getTransformedTimeEntries,
  getFacturacion,
  getUsuarios,
} from "@/lib/mockDataUtils";

function formatMillions(value: number): string {
  const millions = value / 1000000;
  return millions % 1 === 0 ? `$${millions}M` : `$${millions.toFixed(1)}M`;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return formatMillions(value);
  return `$${Math.round(value).toLocaleString()}`;
}

type ProjectSortField = "project_name" | "hours" | "cost";
type ProfessionalSortField = "user_name" | "total_hours" | "total_cost";
type SortOrder = "asc" | "desc";

const ClientProfile = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dataLoading, setDataLoading] = useState(true);

  // Sort state for projects
  const [projectsSortField, setProjectsSortField] = useState<ProjectSortField>("hours");
  const [projectsSortOrder, setProjectsSortOrder] = useState<SortOrder>("desc");

  // Sort state for professionals
  const [profSortField, setProfSortField] = useState<ProfessionalSortField>("total_hours");
  const [profSortOrder, setProfSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Get all client data
  const clientData = useMemo(() => {
    if (!clientId) return null;
    const id = parseInt(clientId, 10);

    const clientes = getClientes();
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return null;

    const asuntos = getAsuntos().filter((a) => a.cliente_id === id);
    const clientCosts = getClientCosts();
    const costData = clientCosts.find((c) => c.client_code === String(id));

    // Get time entries for this client
    const entries = getTransformedTimeEntries().filter(
      (e) => e.client_code === String(id),
    );

    // Aggregate by professional
    const profMap = new Map<
      number,
      { user_id: number; user_name: string; total_hours: number; total_cost: number; project_count: number }
    >();
    const profProjects = new Map<number, Set<number>>();
    entries.forEach((e) => {
      if (!profMap.has(e.user_id)) {
        profMap.set(e.user_id, {
          user_id: e.user_id,
          user_name: e.user_name,
          total_hours: 0,
          total_cost: 0,
          project_count: 0,
        });
        profProjects.set(e.user_id, new Set());
      }
      const prof = profMap.get(e.user_id)!;
      const cost =
        e.originalEntry.total_cost ?? e.duration * (e.originalEntry.hourly_cost || 0);
      prof.total_hours += e.duration;
      prof.total_cost += cost;
      profProjects.get(e.user_id)!.add(e.project_id);
      prof.project_count = profProjects.get(e.user_id)!.size;
    });

    // Get payments
    const payments = getFacturacion().filter((p) => p.cliente_id === id);
    const totalBilled = payments.reduce((sum, p) => sum + (p.amount_charged || 0), 0);

    return {
      cliente,
      asuntos,
      costData,
      professionals: Array.from(profMap.values()),
      totalBilled,
    };
  }, [clientId]);

  useEffect(() => {
    if (user && clientId) {
      setDataLoading(true);
      setTimeout(() => setDataLoading(false), 200);
    }
  }, [user, clientId]);

  const sortedProjects = useMemo(() => {
    if (!clientData?.costData?.projects) return [];
    const sorted = [...clientData.costData.projects];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (projectsSortField) {
        case "project_name":
          cmp = a.project_name.localeCompare(b.project_name);
          break;
        case "hours":
          cmp = a.hours - b.hours;
          break;
        case "cost":
          cmp = a.cost - b.cost;
          break;
      }
      return projectsSortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [clientData, projectsSortField, projectsSortOrder]);

  const sortedProfessionals = useMemo(() => {
    if (!clientData?.professionals) return [];
    const sorted = [...clientData.professionals];
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
  }, [clientData, profSortField, profSortOrder]);

  const handleProjectsSort = (field: ProjectSortField) => {
    if (projectsSortField === field) {
      setProjectsSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setProjectsSortField(field);
      setProjectsSortOrder(field === "project_name" ? "asc" : "desc");
    }
  };

  const handleProfSort = (field: ProfessionalSortField) => {
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

  if (!clientData) {
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
                Cliente no encontrado
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { cliente, asuntos, costData, professionals, totalBilled } = clientData;

  const stats = [
    {
      title: "Horas Totales",
      value: Math.round(costData?.total_hours || 0).toLocaleString(),
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Costo Total",
      value: formatCurrency(costData?.total_cost || 0),
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      title: "Asuntos",
      value: asuntos.length.toString(),
      icon: FolderOpen,
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
            <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{cliente.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {cliente.industry && <span>{cliente.industry}</span>}
                {cliente.industry && cliente.fee_type && <span>·</span>}
                {cliente.fee_type && (
                  <Badge variant="secondary" className="text-xs">
                    {cliente.fee_type}
                  </Badge>
                )}
                {cliente.client_manager && (
                  <>
                    <span>·</span>
                    <span>Encargado: {cliente.client_manager}</span>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects Table */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Asuntos</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleProjectsSort("project_name")}
                        >
                          Asunto
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center gap-1 ml-auto hover:text-foreground"
                          onClick={() => handleProjectsSort("hours")}
                        >
                          Horas
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center gap-1 ml-auto hover:text-foreground"
                          onClick={() => handleProjectsSort("cost")}
                        >
                          Costo
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                          Sin asuntos con horas registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedProjects.map((project) => (
                        <TableRow
                          key={project.project_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            navigate(`/dashboard/asuntos/${project.project_id}`)
                          }
                        >
                          <TableCell className="font-medium text-sm">
                            {project.project_name}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {Math.round(project.hours).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(project.cost)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Professionals Table */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Profesionales</CardTitle>
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
                          Sin profesionales asignados
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedProfessionals.map((prof) => (
                        <TableRow
                          key={prof.user_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            const allUsuarios = getUsuarios();
                            const u = allUsuarios.find(
                              (u) => u.id === prof.user_id,
                            );
                            if (u) navigate(`/user/${u.code}`);
                          }}
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
      </div>
    </DashboardLayout>
  );
};

export default ClientProfile;
