import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Clock,
  DollarSign,
  Briefcase,
  ArrowLeft,
  ArrowUpDown,
  Search,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  getUserProfileData,
  getUsuarios,
  getRawTimeEntries,
  getTimeEntryDescription,
} from "@/lib/mockDataUtils";
import { Badge } from "@/components/ui/badge";
import type { TimeEntry as RelationalTimeEntry } from "@/lib/mock/types";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
// Import the image - Vite handles image imports
import fotoSven from "@/assets/foto-sven.png";

const USE_MOCK_DATA = true;

type ProjectSortField =
  | "project_name"
  | "project_code"
  | "client_name"
  | "total_hours"
  | "total_cost"
  | "revenue";
type ClientSortField =
  | "client_name"
  | "client_code"
  | "project_count"
  | "total_hours"
  | "total_cost"
  | "revenue";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 8;

// Helper function to format currency compactly: M for millions, K for thousands,
// otherwise plain. Keeps one decimal only when needed.
function formatMillions(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k % 1 === 0 ? k : k.toFixed(1)}K`;
  }
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

// Helper function to normalize dates from "M/D/YYYY" to Date object
function normalizeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  // Handle ISO format dates
  if (dateStr.includes("-")) {
    return new Date(dateStr + "T00:00:00");
  }

  // Handle "M/D/YYYY" format
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  return null;
}

// Calculate working days - using fixed 20 days per month
function getWorkingDaysInMonth(year: number, month: number): number {
  return 20;
}

// Helper function to get billable hours from time entry (handles both field names)
function getBillableHours(entry: RelationalTimeEntry): number {
  // Handle both billable_hours (plural) and billable_hour (singular) field names
  const entryAny = entry as RelationalTimeEntry & { billable_hours?: number };
  return entryAny.billable_hours ?? entry.billable_hour ?? 0;
}

const UserProfile = () => {
  const { userCode } = useParams<{ userCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterProjectId = searchParams.get("projectId");
  const filterProjectName = searchParams.get("projectName");
  const filterClientId = searchParams.get("clientId");
  const filterClientName = searchParams.get("clientName");
  const clearProjectFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("projectId");
    next.delete("projectName");
    setSearchParams(next, { replace: true });
  };
  const clearClientFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("clientId");
    next.delete("clientName");
    setSearchParams(next, { replace: true });
  };
  const [profileData, setProfileData] = useState<{
    user_id: number;
    user_name: string;
    user_code: string;
    total_hours: number;
    total_revenue: number;
    total_cost: number;
    projects: Array<{
      project_id: number;
      project_name: string;
      project_code: string;
      client_name: string;
      client_code: string;
      total_hours: number;
      total_cost: number;
      revenue: number;
    }>;
    clients: Array<{
      client_name: string;
      client_code: string;
      total_hours: number;
      total_cost: number;
      revenue: number;
      project_count: number;
    }>;
  } | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Projects table state
  const [projectsSearchTerm, setProjectsSearchTerm] = useState("");
  const [projectsSortField, setProjectsSortField] =
    useState<ProjectSortField>("total_hours");
  const [projectsSortOrder, setProjectsSortOrder] = useState<SortOrder>("desc");
  const [projectsCurrentPage, setProjectsCurrentPage] = useState(1);

  // Clients table state
  const [clientsSearchTerm, setClientsSearchTerm] = useState("");
  const [clientsSortField, setClientsSortField] =
    useState<ClientSortField>("total_hours");
  const [clientsSortOrder, setClientsSortOrder] = useState<SortOrder>("desc");
  const [clientsCurrentPage, setClientsCurrentPage] = useState(1);

  // Time entries table state
  const [entriesCurrentPage, setEntriesCurrentPage] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && userCode) {
      setDataLoading(true);
      // Simulate async loading
      setTimeout(() => {
        if (USE_MOCK_DATA) {
          // Get date filters from URL params if available
          const urlParams = new URLSearchParams(window.location.search);
          const startDateParam = urlParams.get("startDate");
          const endDateParam = urlParams.get("endDate");

          const startDate = startDateParam
            ? new Date(startDateParam)
            : undefined;
          const endDate = endDateParam ? new Date(endDateParam) : undefined;

          const data = getUserProfileData(userCode, startDate, endDate);
          setProfileData(data);
        }
        setDataLoading(false);
      }, 300);
    }
  }, [user, userCode]);

  // Filter and sort projects
  const filteredAndSortedProjects = useMemo(() => {
    if (!profileData) return [];
    let filtered = [...profileData.projects];

    if (filterProjectId) {
      const id = parseInt(filterProjectId, 10);
      filtered = filtered.filter((p) => p.project_id === id);
    } else if (filterClientName) {
      filtered = filtered.filter((p) => p.client_name === filterClientName);
    }

    // Apply search filter
    if (projectsSearchTerm) {
      filtered = filtered.filter(
        (project) =>
          project.project_name
            .toLowerCase()
            .includes(projectsSearchTerm.toLowerCase()) ||
          project.project_code
            .toLowerCase()
            .includes(projectsSearchTerm.toLowerCase()) ||
          project.client_name
            .toLowerCase()
            .includes(projectsSearchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (projectsSortField) {
        case "project_name":
          comparison = a.project_name.localeCompare(b.project_name);
          break;
        case "project_code":
          comparison = a.project_code.localeCompare(b.project_code);
          break;
        case "client_name":
          comparison = a.client_name.localeCompare(b.client_name);
          break;
        case "total_hours":
          comparison = a.total_hours - b.total_hours;
          break;
        case "total_cost":
          comparison = a.total_cost - b.total_cost;
          break;
        case "revenue":
          comparison = a.revenue - b.revenue;
          break;
      }

      return projectsSortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [profileData, projectsSearchTerm, projectsSortField, projectsSortOrder, filterProjectId, filterClientName]);

  // Paginate projects
  const paginatedProjects = useMemo(() => {
    const startIndex = (projectsCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedProjects.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [filteredAndSortedProjects, projectsCurrentPage]);

  const projectsTotalPages = Math.ceil(
    filteredAndSortedProjects.length / ITEMS_PER_PAGE
  );

  // Filter and sort clients
  const filteredAndSortedClients = useMemo(() => {
    if (!profileData) return [];
    let filtered = [...profileData.clients];

    if (filterClientName) {
      filtered = filtered.filter((c) => c.client_name === filterClientName);
    }

    // Apply search filter
    if (clientsSearchTerm) {
      filtered = filtered.filter(
        (client) =>
          client.client_name
            .toLowerCase()
            .includes(clientsSearchTerm.toLowerCase()) ||
          client.client_code
            .toLowerCase()
            .includes(clientsSearchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (clientsSortField) {
        case "client_name":
          comparison = a.client_name.localeCompare(b.client_name);
          break;
        case "client_code":
          comparison = a.client_code.localeCompare(b.client_code);
          break;
        case "project_count":
          comparison = a.project_count - b.project_count;
          break;
        case "total_hours":
          comparison = a.total_hours - b.total_hours;
          break;
        case "total_cost":
          comparison = a.total_cost - b.total_cost;
          break;
        case "revenue":
          comparison = a.revenue - b.revenue;
          break;
      }

      return clientsSortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [profileData, clientsSearchTerm, clientsSortField, clientsSortOrder, filterClientName]);

  // Paginate clients
  const paginatedClients = useMemo(() => {
    const startIndex = (clientsCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedClients.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [filteredAndSortedClients, clientsCurrentPage]);

  const clientsTotalPages = Math.ceil(
    filteredAndSortedClients.length / ITEMS_PER_PAGE
  );

  // Time entries (raw, filtered by user + active project/client filter)
  const filteredTimeEntries = useMemo(() => {
    if (!profileData || !userCode) return [];
    const all = getRawTimeEntries().filter(
      (e) => e.user_name === userCode,
    );

    let filtered = all;
    if (filterProjectId) {
      const pid = parseInt(filterProjectId, 10);
      filtered = filtered.filter((e) => Number(e.asunto_id) === pid);
    } else if (filterClientName) {
      const projectIdsForClient = new Set(
        profileData.projects
          .filter((p) => p.client_name === filterClientName)
          .map((p) => p.project_id),
      );
      filtered = filtered.filter((e) =>
        projectIdsForClient.has(Number(e.asunto_id)),
      );
    }

    const MAX_HOURS_PER_DAY = 8;
    const split: Array<{
      date: Date;
      asunto_id: number | string;
      hours: number;
      billable: number;
      nonBillable: number;
      cost: number;
      production: number;
      description: string;
      taskType: string;
    }> = [];

    filtered.forEach((e) => {
      const baseDate = normalizeDate(e.date);
      if (!baseDate) return;
      const totalHours = Number(e.hours ?? 0);
      if (totalHours <= 0) return;

      const totalBillable = Number((e as any).billable_hours ?? e.billable_hour ?? 0);
      const totalNonBillable = Number((e as any).non_billable_hours ?? e.non_billable ?? 0);
      const totalCost = Number(e.total_cost ?? 0);
      const totalProduction = Number(e.production ?? 0);
      const { taskType, description } = getTimeEntryDescription(
        e.date,
        e.user_name,
        e.asunto_id,
        totalHours,
      );

      let remaining = totalHours;
      let cursor = new Date(baseDate);
      while (remaining > 0) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) {
          const h = Math.min(MAX_HOURS_PER_DAY, remaining);
          const ratio = h / totalHours;
          split.push({
            date: new Date(cursor),
            asunto_id: e.asunto_id,
            hours: h,
            billable: totalBillable * ratio,
            nonBillable: totalNonBillable * ratio,
            cost: totalCost * ratio,
            production: totalProduction * ratio,
            description,
            taskType,
          });
          remaining -= h;
        }
        cursor.setDate(cursor.getDate() - 1);
      }
    });

    return split.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [profileData, userCode, filterProjectId, filterClientName]);

  const paginatedEntries = useMemo(() => {
    const startIndex = (entriesCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredTimeEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTimeEntries, entriesCurrentPage]);

  const entriesTotalPages = Math.ceil(
    filteredTimeEntries.length / ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setEntriesCurrentPage(1);
  }, [filterProjectId, filterClientName]);

  const projectNameByAsuntoId = useMemo(() => {
    const map = new Map<number, string>();
    profileData?.projects.forEach((p) => map.set(p.project_id, p.project_name));
    return map;
  }, [profileData]);

  const handleProjectsSort = (field: ProjectSortField) => {
    if (projectsSortField === field) {
      setProjectsSortOrder(projectsSortOrder === "asc" ? "desc" : "asc");
    } else {
      setProjectsSortField(field);
      const isNumeric = ["total_hours", "total_cost", "revenue"].includes(field);
      setProjectsSortOrder(isNumeric ? "desc" : "asc");
    }
    setProjectsCurrentPage(1);
  };

  const handleClientsSort = (field: ClientSortField) => {
    if (clientsSortField === field) {
      setClientsSortOrder(clientsSortOrder === "asc" ? "desc" : "asc");
    } else {
      setClientsSortField(field);
      const isNumeric = ["total_hours", "total_cost", "revenue", "project_count"].includes(field);
      setClientsSortOrder(isNumeric ? "desc" : "asc");
    }
    setClientsCurrentPage(1);
  };

  // Reset to page 1 when search changes
  useEffect(() => {
    setProjectsCurrentPage(1);
  }, [projectsSearchTerm]);

  useEffect(() => {
    setClientsCurrentPage(1);
  }, [clientsSearchTerm]);

  // Get user info and calculate utilization
  const userInfo = useMemo(() => {
    if (!profileData || !userCode) return null;

    const usuarios = getUsuarios();
    const usuario = usuarios.find((u) => u.code === userCode);
    if (!usuario) return null;

    // Get date filters from URL params if available
    const urlParams = new URLSearchParams(window.location.search);
    const startDateParam = urlParams.get("startDate");
    const endDateParam = urlParams.get("endDate");

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Get raw time entries
    const timeEntries = getRawTimeEntries();

    // Filter entries for this user
    let filteredEntries = timeEntries.filter(
      (entry) => entry.user_name === userCode
    );

    // Filter by date range if provided
    if (startDate || endDate) {
      filteredEntries = filteredEntries.filter((entry) => {
        const date = normalizeDate(entry.date);
        if (!date) return false;
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      });
    }

    // Calculate actual billable hours
    let actualBillableHours = 0;
    const dateSet = new Set<string>();

    filteredEntries.forEach((entry) => {
      const date = normalizeDate(entry.date);
      if (!date) return;

      const dateKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      dateSet.add(dateKey);

      // Get billable hours and convert minutes to hours
      const billableHours = getBillableHours(entry) / 60;
      actualBillableHours += billableHours;
    });

    // Calculate expected billable hours
    // Formula: (daily_goal * working days) / 7
    let totalExpectedBillableHours = 0;
    dateSet.forEach((dateKey) => {
      const [year, month] = dateKey.split("-").map(Number);
      const workingDays = getWorkingDaysInMonth(year, month - 1);
      totalExpectedBillableHours += (usuario.daily_goal * workingDays) / 7;
    });

    // Calculate utilization rate
    const utilizationRate =
      totalExpectedBillableHours > 0
        ? (actualBillableHours / totalExpectedBillableHours) * 100
        : 0;

    return {
      category: usuario.category,
      practiceArea: usuario.practice_area,
      utilizationRate,
      actualBillableHours,
      expectedBillableHours: totalExpectedBillableHours,
    };
  }, [profileData, userCode]);

  if (authLoading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  if (!profileData) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/facturacion")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Usuario no encontrado
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const stats = [
    {
      title: "Total de Horas",
      value: Math.round(profileData.total_hours).toLocaleString(),
      description: "Horas totales trabajadas",
      icon: Clock,
      color: "text-blue-600",
    },
    {
      title: "Ingresos Totales",
      value: formatMillions(profileData.total_revenue),
      description: "Ingresos generados",
      icon: DollarSign,
      color: "text-emerald-600",
    },
    {
      title: "Costo Total",
      value: formatMillions(profileData.total_cost),
      description: "Costo total incurrido",
      icon: DollarSign,
      color: "text-amber-600",
    },
    {
      title: "Utilización",
      value: userInfo ? `${userInfo.utilizationRate.toFixed(1)}%` : "N/A",
      description: userInfo
        ? `${userInfo.actualBillableHours.toFixed(
            1
          )}h / ${userInfo.expectedBillableHours.toFixed(1)}h`
        : "Tasa de utilización",
      icon: Activity,
      color: userInfo
        ? userInfo.utilizationRate >= 100
          ? "text-emerald-600"
          : userInfo.utilizationRate >= 85
          ? "text-amber-600"
          : "text-red-600"
        : "text-gray-600",
    },
    {
      title: "Proyectos",
      value: profileData.projects.length.toString(),
      description: "Proyectos trabajados",
      icon: Briefcase,
      color: "text-purple-600",
    },
    {
      title: "Clientes",
      value: profileData.clients.length.toString(),
      description: "Clientes atendidos",
      icon: Users,
      color: "text-indigo-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/facturacion")}
            className="h-8 w-8 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={fotoSven} alt={profileData.user_name} />
            <AvatarFallback>
              {profileData.user_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-0.5">
              <h1 className="text-2xl font-semibold text-foreground truncate">
                {profileData.user_name}
              </h1>
              {userInfo && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {userInfo.category}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>{profileData.user_code}</span>
              {userInfo && (
                <>
                  <span className="text-border">|</span>
                  <span>{userInfo.practiceArea}</span>
                  <span className="text-border">|</span>
                  <span>
                    Utilización{" "}
                    <span
                      className={`font-medium ${
                        userInfo.utilizationRate >= 100
                          ? "text-emerald-600"
                          : userInfo.utilizationRate >= 85
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {userInfo.utilizationRate.toFixed(1)}%
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Active filter chips (from ProjectProfile click-through) */}
        {(filterProjectName || filterClientName) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrado por:</span>
            {filterProjectName && (
              <Badge
                variant="secondary"
                className="text-xs gap-1.5 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
              >
                Proyecto: {filterProjectName}
                <button
                  onClick={clearProjectFilter}
                  className="hover:text-foreground"
                  aria-label="Quitar filtro de proyecto"
                >
                  ×
                </button>
              </Badge>
            )}
            {filterClientName && (
              <Badge
                variant="secondary"
                className="text-xs gap-1.5 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
              >
                Cliente: {filterClientName}
                <button
                  onClick={clearClientFilter}
                  className="hover:text-foreground"
                  aria-label="Quitar filtro de cliente"
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stat) => (
            <Card
              key={stat.title}
              className="border-border/40 shadow-sm"
            >
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color} opacity-70`} />
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {stat.value}
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projects Table */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-foreground text-base">Proyectos</CardTitle>
                <CardDescription className="text-xs">
                  {filteredAndSortedProjects.length} proyectos
                </CardDescription>
              </div>
              <div className="relative flex-1 sm:flex-initial sm:w-56">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar proyectos..."
                  value={projectsSearchTerm}
                  onChange={(e) => setProjectsSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {profileData.projects.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead
                          onClick={() => handleProjectsSort("project_name")}
                          className="cursor-pointer select-none text-xs"
                        >
                          <span className="inline-flex items-center gap-1">
                            Proyecto
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleProjectsSort("project_code")}
                          className="cursor-pointer select-none text-xs"
                        >
                          <span className="inline-flex items-center gap-1">
                            Código
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleProjectsSort("client_name")}
                          className="cursor-pointer select-none text-xs"
                        >
                          <span className="inline-flex items-center gap-1">
                            Cliente
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleProjectsSort("total_hours")}
                          className="cursor-pointer select-none text-xs text-right"
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Horas
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleProjectsSort("total_cost")}
                          className="cursor-pointer select-none text-xs text-right"
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Costo
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleProjectsSort("revenue")}
                          className="cursor-pointer select-none text-xs text-right"
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Ingresos
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedProjects.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8"
                          >
                            No se encontraron proyectos
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedProjects.map((project) => (
                          <TableRow key={project.project_id} className="h-10">
                            <TableCell className="font-medium text-sm">
                              {project.project_name}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                                {project.project_code}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{project.client_name}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {Math.round(project.total_hours).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-amber-600">
                              {formatMillions(project.total_cost)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-emerald-600 font-medium">
                              {formatMillions(project.revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {projectsTotalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setProjectsCurrentPage((prev) =>
                                Math.max(1, prev - 1)
                              )
                            }
                            className={
                              projectsCurrentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {Array.from(
                          { length: projectsTotalPages },
                          (_, i) => i + 1
                        ).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setProjectsCurrentPage(page)}
                              isActive={projectsCurrentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setProjectsCurrentPage((prev) =>
                                Math.min(projectsTotalPages, prev + 1)
                              )
                            }
                            className={
                              projectsCurrentPage === projectsTotalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay proyectos registrados
              </p>
            )}
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-foreground text-base">Clientes</CardTitle>
                <CardDescription className="text-xs">
                  {filteredAndSortedClients.length} clientes
                </CardDescription>
              </div>
              <div className="relative flex-1 sm:flex-initial sm:w-56">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
                  value={clientsSearchTerm}
                  onChange={(e) => setClientsSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {profileData.clients.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead
                          onClick={() => handleClientsSort("client_name")}
                          className="cursor-pointer select-none text-xs"
                        >
                          <span className="inline-flex items-center gap-1">
                            Cliente
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleClientsSort("client_code")}
                          className="cursor-pointer select-none text-xs"
                        >
                          <span className="inline-flex items-center gap-1">
                            Código
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleClientsSort("project_count")}
                          className="cursor-pointer select-none text-xs text-right"
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Proyectos
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleClientsSort("total_hours")}
                          className="cursor-pointer select-none text-xs text-right"
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Horas
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleClientsSort("total_cost")}
                          className="cursor-pointer select-none text-xs text-right"
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Costo
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                        <TableHead
                          onClick={() => handleClientsSort("revenue")}
                          className="cursor-pointer select-none text-xs text-right"
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Ingresos
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClients.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8"
                          >
                            No se encontraron clientes
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedClients.map((client) => (
                          <TableRow key={client.client_code} className="h-10">
                            <TableCell className="font-medium text-sm">
                              {client.client_name}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                                {client.client_code}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {client.project_count}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {Math.round(client.total_hours).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-amber-600">
                              {formatMillions(client.total_cost)}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-emerald-600 font-medium">
                              {formatMillions(client.revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {clientsTotalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setClientsCurrentPage((prev) =>
                                Math.max(1, prev - 1)
                              )
                            }
                            className={
                              clientsCurrentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {Array.from(
                          { length: clientsTotalPages },
                          (_, i) => i + 1
                        ).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setClientsCurrentPage(page)}
                              isActive={clientsCurrentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setClientsCurrentPage((prev) =>
                                Math.min(clientsTotalPages, prev + 1)
                              )
                            }
                            className={
                              clientsCurrentPage === clientsTotalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay clientes registrados
              </p>
            )}
          </CardContent>
        </Card>

        {/* Time entries detail */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-foreground text-base">Detalle de horas</CardTitle>
                <CardDescription className="text-xs">
                  {filteredTimeEntries.length} registros
                  {filterProjectName ? ` · ${filterProjectName}` : ""}
                  {!filterProjectName && filterClientName ? ` · ${filterClientName}` : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTimeEntries.length > 0 ? (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Fecha</TableHead>
                        <TableHead className="text-xs">Proyecto</TableHead>
                        <TableHead className="text-xs">Descripción</TableHead>
                        <TableHead className="text-right text-xs">Horas</TableHead>
                        <TableHead className="text-right text-xs">Billable</TableHead>
                        <TableHead className="text-right text-xs">No billable</TableHead>
                        <TableHead className="text-right text-xs">Costo</TableHead>
                        <TableHead className="text-right text-xs">Valor trabajado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntries.map((entry, idx) => {
                        const dateLabel = entry.date.toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });
                        const projectName =
                          projectNameByAsuntoId.get(Number(entry.asunto_id)) ??
                          `Asunto ${entry.asunto_id}`;
                        const fmtHours = (h: number) =>
                          h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
                        return (
                          <TableRow key={`${entry.date.toISOString()}-${entry.asunto_id}-${idx}`}>
                            <TableCell className="text-xs whitespace-nowrap">{dateLabel}</TableCell>
                            <TableCell className="text-xs">
                              <span className="font-medium">{projectName}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-col">
                                <span className="text-foreground">{entry.description}</span>
                                <span className="text-[10px] text-muted-foreground">{entry.taskType}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{fmtHours(entry.hours)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                              {entry.billable > 0 ? fmtHours(entry.billable) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                              {entry.nonBillable > 0 ? fmtHours(entry.nonBillable) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              <div className="flex flex-col items-end">
                                <span>${Math.round(entry.cost).toLocaleString()}</span>
                                {entry.hours > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ${Math.round(entry.cost / entry.hours).toLocaleString()}/h
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              <div className="flex flex-col items-end">
                                <span>${Math.round(entry.production).toLocaleString()}</span>
                                {entry.hours > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ${Math.round(entry.production / entry.hours).toLocaleString()}/h
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {entriesTotalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setEntriesCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            className={
                              entriesCurrentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {Array.from({ length: entriesTotalPages }, (_, i) => i + 1)
                          .filter(
                            (page) =>
                              page === 1 ||
                              page === entriesTotalPages ||
                              Math.abs(page - entriesCurrentPage) <= 1,
                          )
                          .map((page, i, arr) => (
                            <PaginationItem key={page}>
                              {i > 0 && page - arr[i - 1] > 1 && (
                                <span className="px-2 text-muted-foreground">…</span>
                              )}
                              <PaginationLink
                                onClick={() => setEntriesCurrentPage(page)}
                                isActive={page === entriesCurrentPage}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setEntriesCurrentPage((prev) =>
                                Math.min(entriesTotalPages, prev + 1),
                              )
                            }
                            className={
                              entriesCurrentPage === entriesTotalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No hay registros de horas para los filtros seleccionados
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UserProfile;
