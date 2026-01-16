import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Loader2,
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

// Helper function to format numbers in millions
function formatMillions(value: number): string {
  const millions = value / 1000000;
  return millions % 1 === 0 ? `$${millions}M` : `$${millions.toFixed(1)}M`;
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
    useState<ProjectSortField>("project_name");
  const [projectsSortOrder, setProjectsSortOrder] = useState<SortOrder>("asc");
  const [projectsCurrentPage, setProjectsCurrentPage] = useState(1);

  // Clients table state
  const [clientsSearchTerm, setClientsSearchTerm] = useState("");
  const [clientsSortField, setClientsSortField] =
    useState<ClientSortField>("client_name");
  const [clientsSortOrder, setClientsSortOrder] = useState<SortOrder>("asc");
  const [clientsCurrentPage, setClientsCurrentPage] = useState(1);

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
  }, [profileData, projectsSearchTerm, projectsSortField, projectsSortOrder]);

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
  }, [profileData, clientsSearchTerm, clientsSortField, clientsSortOrder]);

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

  const handleProjectsSort = (field: ProjectSortField) => {
    if (projectsSortField === field) {
      setProjectsSortOrder(projectsSortOrder === "asc" ? "desc" : "asc");
    } else {
      setProjectsSortField(field);
      setProjectsSortOrder("asc");
    }
    setProjectsCurrentPage(1); // Reset to first page when sorting changes
  };

  const handleClientsSort = (field: ClientSortField) => {
    if (clientsSortField === field) {
      setClientsSortOrder(clientsSortOrder === "asc" ? "desc" : "asc");
    } else {
      setClientsSortField(field);
      setClientsSortOrder("asc");
    }
    setClientsCurrentPage(1); // Reset to first page when sorting changes
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
      bgColor: "bg-blue-100",
    },
    {
      title: "Ingresos Totales",
      value: formatMillions(profileData.total_revenue),
      description: "Ingresos generados",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Costo Total",
      value: formatMillions(profileData.total_cost),
      description: "Costo total incurrido",
      icon: DollarSign,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
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
      bgColor: userInfo
        ? userInfo.utilizationRate >= 100
          ? "bg-emerald-100"
          : userInfo.utilizationRate >= 85
          ? "bg-amber-100"
          : "bg-red-100"
        : "bg-gray-100",
    },
    {
      title: "Proyectos",
      value: profileData.projects.length.toString(),
      description: "Proyectos trabajados",
      icon: Briefcase,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Clientes",
      value: profileData.clients.length.toString(),
      description: "Clientes atendidos",
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/facturacion")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={fotoSven} alt={profileData.user_name} />
                <AvatarFallback>
                  {profileData.user_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-foreground">
                    {profileData.user_name}
                  </h1>
                  {userInfo && (
                    <Badge variant="outline" className="text-sm">
                      {userInfo.category}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <p className="text-muted-foreground">
                    Código: {profileData.user_code}
                  </p>
                  {userInfo && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <p className="text-muted-foreground">
                        Área: {userInfo.practiceArea}
                      </p>
                      <span className="text-muted-foreground">•</span>
                      <p className="text-muted-foreground">
                        Utilización:{" "}
                        <span
                          className={`font-semibold ${
                            userInfo.utilizationRate >= 100
                              ? "text-emerald-600"
                              : userInfo.utilizationRate >= 85
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          {userInfo.utilizationRate.toFixed(1)}%
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.title}
              className="border-border/50 hover:shadow-md transition-shadow"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-lg`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-foreground">
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projects Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-foreground">Proyectos</CardTitle>
                <CardDescription>
                  Proyectos en los que ha trabajado este usuario
                </CardDescription>
              </div>
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proyectos..."
                  value={projectsSearchTerm}
                  onChange={(e) => setProjectsSearchTerm(e.target.value)}
                  className="pl-9"
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
                      <TableRow>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleProjectsSort("project_name")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto"
                          >
                            Proyecto
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleProjectsSort("project_code")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto"
                          >
                            Código
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleProjectsSort("client_name")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto"
                          >
                            Cliente
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleProjectsSort("total_hours")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto ml-auto"
                          >
                            Horas
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleProjectsSort("total_cost")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto ml-auto"
                          >
                            Costo
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleProjectsSort("revenue")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto ml-auto"
                          >
                            Ingresos
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
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
                          <TableRow key={project.project_id}>
                            <TableCell className="font-medium">
                              {project.project_name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {project.project_code}
                              </Badge>
                            </TableCell>
                            <TableCell>{project.client_name}</TableCell>
                            <TableCell className="text-right">
                              {Math.round(project.total_hours).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              {formatMillions(project.total_cost)}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600 font-medium">
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
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-foreground">Clientes</CardTitle>
                <CardDescription>
                  Clientes con los que ha trabajado este usuario
                </CardDescription>
              </div>
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
                  value={clientsSearchTerm}
                  onChange={(e) => setClientsSearchTerm(e.target.value)}
                  className="pl-9"
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
                      <TableRow>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleClientsSort("client_name")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto"
                          >
                            Cliente
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleClientsSort("client_code")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto"
                          >
                            Código
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleClientsSort("project_count")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto ml-auto"
                          >
                            Proyectos
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleClientsSort("total_hours")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto ml-auto"
                          >
                            Horas
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleClientsSort("total_cost")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto ml-auto"
                          >
                            Costo
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleClientsSort("revenue")}
                            className="flex items-center gap-1 p-0 hover:bg-transparent h-auto ml-auto"
                          >
                            Ingresos
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
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
                          <TableRow key={client.client_code}>
                            <TableCell className="font-medium">
                              {client.client_name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {client.client_code}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {client.project_count}
                            </TableCell>
                            <TableCell className="text-right">
                              {Math.round(client.total_hours).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              {formatMillions(client.total_cost)}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600 font-medium">
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
      </div>
    </DashboardLayout>
  );
};

export default UserProfile;
