import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Calculator,
  TrendingUp,
  Clock,
  DollarSign,
  BarChart3,
  Info,
  RefreshCw,
  Users,
  AlertTriangle,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Scale,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  GitCompare,
  CheckCircle2,
  Circle,
  FileDown,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAreaColor } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  getPricingData,
  getFullPricingData,
  getAsuntos,
  getBudgetVsActualComparison,
} from "@/lib/mockDataUtils";
import type { HistoricalProject, BudgetVsActualRow } from "@/lib/mockDataUtils";
import CasosPrecedentes from "@/components/CasosPrecedentes";

// Set to true to use mock data for presentations (no database calls)
const USE_MOCK_DATA = true;


interface SeniorityLevel {
  level: string;
  label: string;
  avgHourlyRate: number;
  professionals: string[];
  color: string;
}

interface PricingData {
  avgHourlyRate: number;
  avgTotalBilled: number;
  avgHoursPerCase: number;
  totalCases: number;
  medianHourlyRate: number;
  seniorityLevels: SeniorityLevel[];
}

type SeniorityHours = Record<string, number>;

// Group professionals into seniority levels based on hourly rates
const groupProfessionalsBySeniority = (professionalAverages: {
  [key: string]: number;
}): SeniorityLevel[] => {
  if (Object.keys(professionalAverages).length === 0) {
    return [];
  }

  // Get all rates and sort them
  const rates = Object.values(professionalAverages).sort((a, b) => a - b);
  const minRate = rates[0];
  const maxRate = rates[rates.length - 1];
  const range = maxRate - minRate;

  // Define seniority levels (standard levels)
  const levels = [
    {
      level: "junior",
      label: "Asociado Junior",
      color: "bg-blue-100 text-blue-800",
    },
    {
      level: "associate",
      label: "Asociado",
      color: "bg-green-100 text-green-800",
    },
    {
      level: "senior",
      label: "Asociado Senior",
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      level: "partner",
      label: "Socio",
      color: "bg-orange-100 text-orange-800",
    },
  ];

  // If we have very few professionals, use fewer levels
  const numProfessionals = Object.keys(professionalAverages).length;
  let activeLevels = levels;
  if (numProfessionals <= 2) {
    activeLevels = [levels[0], levels[levels.length - 1]];
  } else if (numProfessionals <= 4) {
    activeLevels = [
      levels[0],
      levels[Math.floor(levels.length / 2)],
      levels[levels.length - 1],
    ];
  }

  // Group professionals by rate percentiles
  const result: SeniorityLevel[] = [];
  const numLevels = activeLevels.length;

  for (let i = 0; i < numLevels; i++) {
    const percentileStart = i / numLevels;
    const percentileEnd = (i + 1) / numLevels;

    const rateStart = minRate + range * percentileStart;
    const rateEnd = minRate + range * percentileEnd;

    const professionals: string[] = [];
    let totalRate = 0;
    let count = 0;

    Object.entries(professionalAverages).forEach(([prof, rate]) => {
      if (
        rate >= rateStart &&
        (i === numLevels - 1 ? rate <= rateEnd : rate < rateEnd)
      ) {
        professionals.push(prof);
        totalRate += rate;
        count++;
      }
    });

    if (professionals.length > 0) {
      result.push({
        level: activeLevels[i].level,
        label: activeLevels[i].label,
        avgHourlyRate: totalRate / count,
        professionals,
        color: activeLevels[i].color,
      });
    }
  }

  return result.sort((a, b) => a.avgHourlyRate - b.avgHourlyRate);
};

const Pricing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // State for form inputs
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<number>(40);
  const [complexityFactor, setComplexityFactor] = useState<number>(1);
  const [customHourlyRate, setCustomHourlyRate] = useState<string>("");
  const [billingMethod, setBillingMethod] = useState<string>("hourly");
  const [useSeniorityAllocation, setUseSeniorityAllocation] =
    useState<boolean>(false);
  const [seniorityHours, setSeniorityHours] = useState<SeniorityHours>({});
  const [firmName, setFirmName] = useState<string>("");
  const [exporting, setExporting] = useState<boolean>(false);

  // New states for advanced pricing controls
  const [targetProfitMargin, setTargetProfitMargin] = useState<number>(30);
  const [targetTotalPrice, setTargetTotalPrice] = useState<string>("");
  const [calculationMode, setCalculationMode] = useState<"forward" | "reverse">(
    "forward"
  );
  const [useTargetPrice, setUseTargetPrice] = useState<boolean>(false);
  const [useTargetMargin, setUseTargetMargin] = useState<boolean>(false);
  const [showSeniorityCosts, setShowSeniorityCosts] = useState<boolean>(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("parametros");
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const comparisonData = useMemo<BudgetVsActualRow[]>(() => getBudgetVsActualComparison(10), []);

  // State for historical data
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);

  // Memoize full pricing data to avoid recomputing on every render
  const fullPricingData = useMemo(() => getFullPricingData(), []);

  // Get available practice areas from mock data
  const availableAreas = useMemo(() => {
    if (!USE_MOCK_DATA) return [];
    const asuntos = getAsuntos();
    const areas = new Set<string>();
    asuntos.forEach((a) => {
      if (a.practice_area) {
        areas.add(a.practice_area);
      }
    });
    return Array.from(areas).sort();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch firm profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("firm_name")
        .eq("id", user.id)
        .single();
      if (profile?.firm_name) {
        setFirmName(profile.firm_name);
      }
    };
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchPricingData = useCallback(
    async (area: string) => {
      const currentEstimatedHours = estimatedHours;
      setDataLoading(true);
      try {
        // Use mock data if flag is enabled
        if (USE_MOCK_DATA) {
          console.log("🎭 Using mock pricing data for presentation");
          // Simulate a small delay for realistic loading
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Get area-specific data from relational data
          const areaData = getPricingData(area);

          if (areaData && areaData.totalCases > 0) {
            setPricingData(areaData);

            // Set estimated hours to historical average for this area
            const hoursToUse = areaData.avgHoursPerCase > 0
              ? Math.round(areaData.avgHoursPerCase)
              : currentEstimatedHours;
            if (areaData.avgHoursPerCase > 0) {
              setEstimatedHours(hoursToUse);
            }

            // Initialize seniority hours distribution
            if (areaData.seniorityLevels.length > 0) {
              const initialHours: SeniorityHours = {};
              areaData.seniorityLevels.forEach((level: any) => {
                initialHours[level.level] = Math.floor(
                  hoursToUse / areaData.seniorityLevels.length
                );
              });
              // Distribute remaining hours to the first level
              const totalDistributed = Object.values(initialHours).reduce(
                (sum, h) => sum + h,
                0
              );
              if (totalDistributed < hoursToUse) {
                initialHours[areaData.seniorityLevels[0].level] +=
                  hoursToUse - totalDistributed;
              }
              setSeniorityHours(initialHours);
            }
          } else {
            // No data for this area - use empty data structure
            const seniorityLevels = Object.entries(
              fullPricingData.seniorityLevels
            )
              .filter(([_, levelData]) => levelData.avgHourlyRate > 0)
              .map(([levelKey, levelData]: [string, any]) => ({
                level: levelKey,
                label: levelData.label,
                avgHourlyRate: levelData.avgHourlyRate,
                professionals: [],
                color: levelData.color,
              }));

            setPricingData({
              avgHourlyRate: 0,
              avgTotalBilled: 0,
              avgHoursPerCase: 0,
              totalCases: 0,
              medianHourlyRate: 0,
              seniorityLevels: seniorityLevels as any,
            });

            // Initialize seniority hours distribution only if we have levels
            if (seniorityLevels.length > 0) {
              const initialHours: SeniorityHours = {};
              seniorityLevels.forEach((level: any) => {
                initialHours[level.level] = Math.floor(
                  currentEstimatedHours / seniorityLevels.length
                );
              });
              const totalDistributed = Object.values(initialHours).reduce(
                (sum, h) => sum + h,
                0
              );
              if (totalDistributed < currentEstimatedHours) {
                initialHours[seniorityLevels[0].level] +=
                  currentEstimatedHours - totalDistributed;
              }
              setSeniorityHours(initialHours);
            }
          }

          setDataLoading(false);
          return;
        }

        // Get all cases for this practice area
        const { data: asuntosData } = await supabase
          .from("asuntos")
          .select("Código, Cliente")
          .eq('"Area de Práctica"', area);

        if (!asuntosData || asuntosData.length === 0) {
          setPricingData({
            avgHourlyRate: 0,
            avgTotalBilled: 0,
            avgHoursPerCase: 0,
            totalCases: 0,
            medianHourlyRate: 0,
            seniorityLevels: [],
          });
          setDataLoading(false);
          return;
        }

        const caseCodes = (
          asuntosData as unknown as Array<{ Código: string | null }>
        )
          .map((a) => a.Código)
          .filter((code): code is string => Boolean(code));

        // Get hours and billing data for these cases, including Profesional
        const { data: horasData } = await supabase
          .from("horas_valor_cobrado")
          .select(
            '"Código Asunto", "Horas Trabajadas", "Valor Cobrado Final", Profesional'
          )
          .in("Código Asunto", caseCodes.length > 0 ? caseCodes : ["NONE"]);

        if (!horasData || horasData.length === 0) {
          setPricingData({
            avgHourlyRate: 0,
            avgTotalBilled: 0,
            avgHoursPerCase: 0,
            totalCases: asuntosData.length,
            medianHourlyRate: 0,
            seniorityLevels: [],
          });
          setDataLoading(false);
          return;
        }

        // Calculate statistics
        const hourlyRates: number[] = [];
        const totalByCase: {
          [key: string]: { hours: number; billed: number };
        } = {};
        const professionalRates: { [key: string]: number[] } = {};

        horasData.forEach(
          (h: {
            "Horas Trabajadas": number | null;
            "Valor Cobrado Final": string | null;
            "Código Asunto": string | null;
            Profesional: string | null;
          }) => {
            const hours = parseFloat(String(h["Horas Trabajadas"] || 0)) || 0;
            const billed =
              parseFloat(String(h["Valor Cobrado Final"] || 0)) || 0;
            const caseCode = h["Código Asunto"];
            const profesional = h.Profesional || "Unknown";

            if (hours > 0 && billed > 0) {
              const hourlyRate = billed / hours;
              hourlyRates.push(hourlyRate);

              // Track rates by professional
              if (!professionalRates[profesional]) {
                professionalRates[profesional] = [];
              }
              professionalRates[profesional].push(hourlyRate);
            }

            if (!totalByCase[caseCode]) {
              totalByCase[caseCode] = { hours: 0, billed: 0 };
            }
            totalByCase[caseCode].hours += hours;
            totalByCase[caseCode].billed += billed;
          }
        );

        // Calculate average hourly rate per professional
        const professionalAverages: { [key: string]: number } = {};
        Object.keys(professionalRates).forEach((prof) => {
          const rates = professionalRates[prof];
          if (rates.length > 0) {
            professionalAverages[prof] =
              rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
          }
        });

        // Group professionals into seniority levels based on their average rates
        const seniorityLevels =
          groupProfessionalsBySeniority(professionalAverages);

        // Calculate averages
        const avgHourlyRate =
          hourlyRates.length > 0
            ? hourlyRates.reduce((sum, rate) => sum + rate, 0) /
              hourlyRates.length
            : 0;

        // Calculate median hourly rate
        const sortedRates = [...hourlyRates].sort((a, b) => a - b);
        const medianHourlyRate =
          sortedRates.length > 0
            ? sortedRates.length % 2 === 0
              ? (sortedRates[sortedRates.length / 2 - 1] +
                  sortedRates[sortedRates.length / 2]) /
                2
              : sortedRates[Math.floor(sortedRates.length / 2)]
            : 0;

        const caseValues = Object.values(totalByCase);
        const avgTotalBilled =
          caseValues.length > 0
            ? caseValues.reduce((sum, c) => sum + c.billed, 0) /
              caseValues.length
            : 0;

        const avgHoursPerCase =
          caseValues.length > 0
            ? caseValues.reduce((sum, c) => sum + c.hours, 0) /
              caseValues.length
            : 0;

        setPricingData({
          avgHourlyRate,
          avgTotalBilled,
          avgHoursPerCase,
          totalCases: asuntosData.length,
          medianHourlyRate,
          seniorityLevels,
        });

        // Initialize seniority hours distribution
        if (seniorityLevels.length > 0) {
          const initialHours: SeniorityHours = {};
          seniorityLevels.forEach((level) => {
            initialHours[level.level] = Math.floor(
              currentEstimatedHours / seniorityLevels.length
            );
          });
          // Distribute remaining hours to the first level
          const totalDistributed = Object.values(initialHours).reduce(
            (sum, h) => sum + h,
            0
          );
          if (totalDistributed < currentEstimatedHours) {
            initialHours[seniorityLevels[0].level] +=
              currentEstimatedHours - totalDistributed;
          }
          setSeniorityHours(initialHours);
        }
      } catch (error) {
        console.error("Error fetching pricing data:", error);
      } finally {
        setDataLoading(false);
      }
    },
    [estimatedHours, fullPricingData]
  );

  // Fetch pricing data when area is selected
  useEffect(() => {
    if (selectedArea && selectedArea !== "") {
      fetchPricingData(selectedArea);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArea]);

  // Keep seniority hours in sync with estimatedHours
  useEffect(() => {
    if (!useSeniorityAllocation || !pricingData || pricingData.seniorityLevels.length === 0) return;
    const currentTotal = Object.values(seniorityHours).reduce((s, h) => s + h, 0);
    if (currentTotal === estimatedHours || currentTotal === 0) return;

    // Redistribute proportionally
    const ratio = estimatedHours / currentTotal;
    const newHours: SeniorityHours = {};
    let distributed = 0;
    const levels = pricingData.seniorityLevels;
    levels.forEach((level, i) => {
      const old = seniorityHours[level.level] || 0;
      if (i === levels.length - 1) {
        newHours[level.level] = estimatedHours - distributed;
      } else {
        const h = Math.round(old * ratio);
        newHours[level.level] = h;
        distributed += h;
      }
    });
    setSeniorityHours(newHours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedHours, useSeniorityAllocation]);

  const calculatePrice = useCallback(() => {
    if (!selectedArea || !pricingData) {
      setCalculatedPrice(0);
      return;
    }

    let price = 0;

    // If using target price (reverse calculation mode)
    if (
      useTargetPrice &&
      targetTotalPrice &&
      parseFloat(targetTotalPrice) > 0
    ) {
      price = parseFloat(targetTotalPrice);
      setCalculatedPrice(Math.round(price));
      return;
    }

    // If using seniority-based allocation
    if (useSeniorityAllocation && pricingData.seniorityLevels.length > 0) {
      let totalPrice = 0;
      let totalHours = 0;

      pricingData.seniorityLevels.forEach((level) => {
        const hours = seniorityHours[level.level] || 0;
        totalHours += hours;
        totalPrice += level.avgHourlyRate * hours;
      });

      // Apply complexity factor
      price = totalPrice * complexityFactor;

      // Adjust for billing method
      switch (billingMethod) {
        case "fixed": {
          const hoursRatio =
            pricingData.avgHoursPerCase > 0
              ? totalHours / pricingData.avgHoursPerCase
              : 1;
          price = pricingData.avgTotalBilled * hoursRatio * complexityFactor;
          break;
        }
        case "value-based":
          price = totalPrice * complexityFactor * 1.5;
          break;
        default:
          // hourly - already calculated
          break;
      }

      // Apply target profit margin if enabled
      if (useTargetMargin && targetProfitMargin > 0) {
        // Calculate total cost first
        let totalCost = 0;
        pricingData.seniorityLevels.forEach((level) => {
          const hours = seniorityHours[level.level] || 0;
          const seniorityData =
            fullPricingData.seniorityLevels[
              level.level as keyof typeof fullPricingData.seniorityLevels
            ];
          if (seniorityData) {
            totalCost += seniorityData.hourlyCost * hours;
          }
        });

        // Calculate required revenue to achieve target margin
        // margin = (revenue - cost) / revenue
        // revenue = cost / (1 - margin/100)
        const requiredRevenue = totalCost / (1 - targetProfitMargin / 100);
        price = requiredRevenue * complexityFactor;
      }
    } else {
      // Original calculation method
      let baseRate = pricingData.avgHourlyRate;

      // Use custom hourly rate if provided
      if (customHourlyRate && parseFloat(customHourlyRate) > 0) {
        baseRate = parseFloat(customHourlyRate);
      }

      switch (billingMethod) {
        case "hourly":
          price = baseRate * estimatedHours * complexityFactor;
          break;
        case "fixed": {
          const hoursRatio =
            pricingData.avgHoursPerCase > 0
              ? estimatedHours / pricingData.avgHoursPerCase
              : 1;
          price = pricingData.avgTotalBilled * hoursRatio * complexityFactor;
          break;
        }
        case "value-based":
          price = baseRate * estimatedHours * complexityFactor * 1.5;
          break;
        default:
          price = baseRate * estimatedHours * complexityFactor;
      }

      // Apply target profit margin if enabled (simple mode)
      if (useTargetMargin && targetProfitMargin > 0) {
        // Estimate cost based on average hourly cost
        const avgHourlyCost =
          fullPricingData.seniorityLevels.associate?.hourlyCost || 50;
        const totalCost = avgHourlyCost * estimatedHours;
        const requiredRevenue = totalCost / (1 - targetProfitMargin / 100);
        price = requiredRevenue * complexityFactor;
      }
    }

    setCalculatedPrice(Math.round(price));
  }, [
    selectedArea,
    pricingData,
    estimatedHours,
    complexityFactor,
    customHourlyRate,
    billingMethod,
    useSeniorityAllocation,
    seniorityHours,
    useTargetPrice,
    targetTotalPrice,
    useTargetMargin,
    targetProfitMargin,
    fullPricingData,
  ]);

  // Recalculate price whenever inputs change
  useEffect(() => {
    calculatePrice();
  }, [calculatePrice]);

  // Calculate profitability metrics
  const calculateProfitability = useCallback(() => {
    if (!pricingData) {
      return null;
    }

    // Calculate total revenue and costs
    const totalRevenue = calculatedPrice;
    let totalCost = 0;
    let totalHours = 0;

    if (useSeniorityAllocation && pricingData.seniorityLevels.length > 0) {
      pricingData.seniorityLevels.forEach((level) => {
        const hours = seniorityHours[level.level] || 0;
        totalHours += hours;

        // Cost based on fixed hourly cost from pricing data
        const seniorityData =
          fullPricingData.seniorityLevels[
            level.level as keyof typeof fullPricingData.seniorityLevels
          ];
        if (seniorityData) {
          const cost = seniorityData.hourlyCost * hours;
          totalCost += cost;
        }
      });
    } else {
      // Simple mode: estimate cost based on average
      totalHours = estimatedHours;
      const avgHourlyCost =
        fullPricingData.seniorityLevels.associate?.hourlyCost || 50;
      totalCost = avgHourlyCost * estimatedHours;
    }

    // Calculate profit and margin
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    const avgHourlyRevenue = totalHours > 0 ? totalRevenue / totalHours : 0;
    const avgHourlyCost = totalHours > 0 ? totalCost / totalHours : 0;

    return {
      totalCost,
      totalRevenue,
      profit,
      profitMargin,
      avgHourlyCost,
      avgHourlyRevenue,
      totalHours,
    };
  }, [
    pricingData,
    calculatedPrice,
    useSeniorityAllocation,
    seniorityHours,
    estimatedHours,
    fullPricingData,
  ]);

  const handleApplyProject = useCallback((project: HistoricalProject) => {
    setEstimatedHours(Math.round(project.total_hours));

    if (project.charge_type === "TASA") {
      setBillingMethod("hourly");
    } else if (project.charge_type === "HITOS") {
      setBillingMethod("fixed");
    }

    if (project.team.length > 1) {
      setUseSeniorityAllocation(true);
      const categoryToLevel: Record<string, string> = {
        Socio: "partner",
        "Asociado Sr": "senior",
        Asociado: "associate",
        "Asociado Junior": "junior",
      };
      const newSeniorityHours: SeniorityHours = {};
      project.team.forEach((member) => {
        const level = categoryToLevel[member.category] || "associate";
        newSeniorityHours[level] =
          (newSeniorityHours[level] || 0) + member.hours;
      });
      setSeniorityHours(newSeniorityHours);
    }

    setComplexityFactor(1);
    setActiveTab("parametros");
  }, []);

  const getComplexityLabel = (factor: number): string => {
    if (factor <= 0.7) return "Muy Baja";
    if (factor <= 0.9) return "Baja";
    if (factor <= 1.1) return "Media";
    if (factor <= 1.3) return "Alta";
    return "Muy Alta";
  };

  const getComplexityColor = (factor: number): string => {
    if (factor <= 0.7) return "bg-blue-100 text-blue-800";
    if (factor <= 0.9) return "bg-green-100 text-green-800";
    if (factor <= 1.1) return "bg-yellow-100 text-yellow-800";
    if (factor <= 1.3) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const exportToPDF = async () => {
    if (!selectedArea || !pricingData) {
      return;
    }

    setExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("COTIZACIÓN DE SERVICIOS LEGALES", pageWidth / 2, yPosition, {
        align: "center",
      });
      yPosition += 10;

      // Firm name
      if (firmName) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "normal");
        doc.text(firmName, pageWidth / 2, yPosition, { align: "center" });
        yPosition += 8;
      }

      // Date
      doc.setFontSize(10);
      const today = new Date();
      const dateStr = today.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(`Fecha: ${dateStr}`, pageWidth - margin, yPosition, {
        align: "right",
      });
      yPosition += 15;

      // Separator
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Practice Area
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Área de Práctica:", margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(selectedArea, margin + 50, yPosition);
      yPosition += 10;

      // Billing Method
      const billingMethodLabels: Record<string, string> = {
        hourly: "Tarifa Fija Mensual",
        fixed: "Hitos",
        "value-based": "Retainer",
      };
      doc.setFont("helvetica", "bold");
      doc.text("Método de Facturación:", margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(billingMethodLabels[billingMethod], margin + 60, yPosition);
      yPosition += 10;

      // Complexity
      doc.setFont("helvetica", "bold");
      doc.text("Factor de Complejidad:", margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${getComplexityLabel(complexityFactor)} (${complexityFactor.toFixed(
          1
        )}x)`,
        margin + 60,
        yPosition
      );
      yPosition += 15;

      // Details Section
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DESGLOSE DE HONORARIOS", margin, yPosition);
      yPosition += 8;

      if (useSeniorityAllocation && pricingData.seniorityLevels.length > 0) {
        // Seniority-based breakdown
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Nivel", margin, yPosition);
        doc.text("Horas", margin + 50, yPosition);
        doc.text("Tarifa/Hora", margin + 80, yPosition);
        doc.text("Subtotal", margin + 130, yPosition);
        yPosition += 7;

        doc.setLineWidth(0.3);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 7;

        let totalHours = 0;
        let subtotal = 0;

        pricingData.seniorityLevels.forEach((level) => {
          const hours = seniorityHours[level.level] || 0;
          if (hours > 0) {
            totalHours += hours;
            const levelSubtotal =
              level.avgHourlyRate * hours * complexityFactor;
            subtotal += levelSubtotal;

            doc.setFont("helvetica", "normal");
            doc.text(level.label, margin, yPosition);
            doc.text(hours.toFixed(1) + "h", margin + 50, yPosition);
            doc.text(
              "$" + Math.round(level.avgHourlyRate).toLocaleString(),
              margin + 80,
              yPosition
            );
            doc.text(
              "$" + Math.round(levelSubtotal).toLocaleString(),
              margin + 130,
              yPosition
            );
            yPosition += 7;

            // Check if we need a new page
            if (yPosition > pageHeight - 40) {
              doc.addPage();
              yPosition = margin;
            }
          }
        });

        yPosition += 3;
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 7;

        doc.setFont("helvetica", "bold");
        doc.text("Total Horas:", margin + 80, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(totalHours.toFixed(1) + "h", margin + 130, yPosition);
        yPosition += 7;
      } else {
        // Simple breakdown
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Horas Estimadas:", margin, yPosition);
        doc.text(`${estimatedHours}h`, margin + 50, yPosition);
        yPosition += 7;

        const rate = customHourlyRate
          ? parseFloat(customHourlyRate)
          : pricingData.avgHourlyRate;
        doc.text("Tarifa por Hora:", margin, yPosition);
        doc.text(
          "$" + Math.round(rate).toLocaleString(),
          margin + 50,
          yPosition
        );
        yPosition += 7;

        doc.text("Factor de Complejidad:", margin, yPosition);
        doc.text(complexityFactor.toFixed(1) + "x", margin + 50, yPosition);
        yPosition += 10;
      }

      // Total
      yPosition += 5;
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("HONORARIO TOTAL ESTIMADO:", margin, yPosition);
      doc.text(
        "$" + calculatedPrice.toLocaleString(),
        pageWidth - margin,
        yPosition,
        { align: "right" }
      );
      yPosition += 15;

      // Validity
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(
        "Esta cotización es válida por 30 días a partir de la fecha de emisión.",
        margin,
        yPosition
      );
      yPosition += 10;

      // Historical data note
      if (pricingData.totalCases > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          `* Basado en ${pricingData.totalCases} caso(s) histórico(s) en ${selectedArea}`,
          margin,
          yPosition
        );
      }

      // Footer
      const footerY = pageHeight - 15;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        "Esta cotización es una estimación basada en datos históricos y puede variar según las circunstancias específicas del caso.",
        margin,
        footerY,
        {
          maxWidth: pageWidth - 2 * margin,
          align: "justify",
        }
      );

      // Save PDF
      const fileName = `Cotizacion_${selectedArea.replace(/\s+/g, "_")}_${
        today.toISOString().split("T")[0]
      }.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Pricing
              </h1>
              <p className="text-sm text-muted-foreground">
                Determine honorarios con base en el historial de la firma y parámetros ajustables
              </p>
            </div>
          </div>
        </div>

        {/* Comparison Section: Presupuestado vs Real */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-sm">
                  <GitCompare className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Presupuestado vs Real</CardTitle>
                  <CardDescription className="text-xs">
                    Seguimiento en tiempo real de cotizaciones contra facturación real
                  </CardDescription>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {comparisonData.filter(d => d.status === "completed").length} completados
                </span>
                <span className="flex items-center gap-1">
                  <Circle className="h-3 w-3 text-blue-500" />
                  {comparisonData.filter(d => d.status === "in_progress").length} en curso
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Summary KPIs */}
            {(() => {
              const completed = comparisonData.filter(d => d.status === "completed");
              const totalBudgeted = completed.reduce((s, d) => s + d.budgetedPrice, 0);
              const totalActual = completed.reduce((s, d) => s + d.actualPrice, 0);
              const avgDeviation = totalBudgeted > 0 ? ((totalActual - totalBudgeted) / totalBudgeted) * 100 : 0;
              const totalBudgetedHours = completed.reduce((s, d) => s + d.budgetedHours, 0);
              const totalActualHours = completed.reduce((s, d) => s + d.actualHours, 0);

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">Total Presupuestado</p>
                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100">${totalBudgeted.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">Total Real</p>
                    <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">${totalActual.toLocaleString()}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${avgDeviation > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50" : "bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/50"}`}>
                    <p className={`text-[11px] font-medium mb-0.5 ${avgDeviation > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>Desviación Promedio</p>
                    <p className={`text-lg font-bold flex items-center gap-1 ${avgDeviation > 0 ? "text-red-900 dark:text-red-100" : "text-green-900 dark:text-green-100"}`}>
                      {avgDeviation > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {Math.abs(avgDeviation).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
                    <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mb-0.5">Horas: Ppto vs Real</p>
                    <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{totalBudgetedHours} / {totalActualHours}</p>
                  </div>
                </div>
              );
            })()}

            {/* Comparison Table */}
            <Collapsible open={showComparison} onOpenChange={setShowComparison}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors text-xs text-muted-foreground">
                  <span className="font-medium">
                    {showComparison ? "Ocultar" : "Ver"} detalle por proyecto ({comparisonData.length})
                  </span>
                  {showComparison ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-lg border overflow-hidden mt-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left p-3 font-medium text-muted-foreground text-xs">Proyecto</th>
                          <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Área</th>
                          <th className="text-right p-3 font-medium text-muted-foreground text-xs">Presupuestado</th>
                          <th className="text-right p-3 font-medium text-muted-foreground text-xs">Real</th>
                          <th className="text-right p-3 font-medium text-muted-foreground text-xs">Desviación</th>
                          <th className="text-center p-3 font-medium text-muted-foreground text-xs">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.map((item) => {
                          const deviation = item.budgetedPrice > 0
                            ? ((item.actualPrice - item.budgetedPrice) / item.budgetedPrice) * 100
                            : 0;
                          const progressPct = item.status === "in_progress"
                            ? Math.min(100, (item.actualPrice / item.budgetedPrice) * 100)
                            : 100;
                          const dateObj = item.date ? new Date(item.date) : null;
                          const dateLabel = dateObj && !isNaN(dateObj.getTime())
                            ? dateObj.toLocaleDateString("es-ES", { month: "short", year: "numeric" })
                            : "";

                          return (
                            <React.Fragment key={item.asuntoId}>
                              <tr
                                className="border-b hover:bg-muted/30 transition-colors cursor-pointer select-none"
                                onClick={() => navigate(`/dashboard/asuntos/${item.asuntoId}`)}
                              >
                                <td className="p-3">
                                  <p className="font-medium text-foreground text-xs leading-tight">{item.project}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {item.displayId}{dateLabel ? ` · ${dateLabel}` : ""}
                                    <span className="ml-1 text-muted-foreground/50">· clic para abrir asunto</span>
                                  </p>
                                </td>
                                <td className="p-3 hidden md:table-cell">
                                  <Badge variant="outline" className="text-[10px] font-normal">{item.area}</Badge>
                                </td>
                                <td className="p-3 text-right">
                                  <p className="font-medium text-xs">${item.budgetedPrice.toLocaleString()}</p>
                                  <p className="text-[11px] text-muted-foreground">{item.budgetedHours}h</p>
                                </td>
                                <td className="p-3 text-right">
                                  <p className="font-medium text-xs">${item.actualPrice.toLocaleString()}</p>
                                  <p className="text-[11px] text-muted-foreground">{item.actualHours}h</p>
                                </td>
                                <td className="p-3 text-right">
                                  {item.status === "completed" || deviation > 0 ? (
                                    <span className={`text-xs font-semibold ${deviation > 5 ? "text-red-600" : deviation < -5 ? "text-emerald-600" : "text-foreground"}`}>
                                      {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <div className="space-y-1">
                                      <span className="text-xs text-muted-foreground">{progressPct.toFixed(0)}%</span>
                                      <div className="w-full bg-muted rounded-full h-1.5">
                                        <div
                                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                                          style={{ width: `${Math.min(100, progressPct)}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {item.status === "completed" ? (
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Cerrado
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">
                                      <Circle className="h-3 w-3 mr-1" />
                                      En curso
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 text-center italic">
                  Datos derivados de los asuntos reales (presupuesto = monto cotizado; real = horas y facturación registradas). Haz clic en una fila para abrir el asunto.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Tabs */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="parametros" className="gap-2">
                  <Calculator className="h-4 w-4" />
                  Parámetros
                </TabsTrigger>
                <TabsTrigger
                  value="historico"
                  className="gap-2"
                  disabled={!selectedArea}
                >
                  <BarChart3 className="h-4 w-4" />
                  Referencia Histórica
                </TabsTrigger>
                <TabsTrigger
                  value="precedentes"
                  className="gap-2"
                  disabled={!selectedArea}
                >
                  <Briefcase className="h-4 w-4" />
                  Casos Precedentes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="parametros">
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                    <Calculator className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Configuración del Asunto</CardTitle>
                    <CardDescription className="text-xs">
                      Defina las características del servicio legal a cotizar
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Area Selection */}
                <div className="space-y-2">
                  <Label htmlFor="area">Área de Práctica Legal</Label>
                  <Select value={selectedArea} onValueChange={setSelectedArea}>
                    <SelectTrigger id="area">
                      <SelectValue placeholder="Selecciona un área de práctica" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAreas.map((area) => (
                        <SelectItem key={area} value={area}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getAreaColor(area) }}
                            />
                            {area}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Billing Method */}
                <div className="space-y-2">
                  <Label htmlFor="billing-method">Modalidad de Cobro</Label>
                  <Select
                    value={billingMethod}
                    onValueChange={setBillingMethod}
                  >
                    <SelectTrigger id="billing-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Tarifa Fija Mensual</SelectItem>
                      <SelectItem value="fixed">Hitos</SelectItem>
                      <SelectItem value="value-based">Retainer</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {billingMethod === "hourly" &&
                      "Se cobra en función de las horas efectivamente dedicadas al asunto"}
                    {billingMethod === "fixed" &&
                      "Monto fijo determinado con base en asuntos comparables"}
                    {billingMethod === "value-based" &&
                      "Honorario vinculado al resultado o valor generado para el cliente"}
                  </p>
                </div>

                <Separator />

                {/* Seniority-Based Allocation Toggle */}
                {pricingData && pricingData.seniorityLevels.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="seniority-allocation"
                        className="flex items-center gap-2"
                      >
                        <Users className="h-4 w-4" />
                        Composición del Equipo por Senioridad
                      </Label>
                      <Switch
                        id="seniority-allocation"
                        checked={useSeniorityAllocation}
                        onCheckedChange={setUseSeniorityAllocation}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Asigne horas por nivel profesional para un costeo más
                      preciso del equipo
                    </p>
                  </div>
                )}

                {/* Estimated Hours - Show unless using target price */}
                {!useTargetPrice && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="hours"
                        className="flex items-center gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        Horas de Dedicación Estimadas
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          step={1}
                          value={estimatedHours}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) setEstimatedHours(Math.max(1, Math.min(500, v)));
                          }}
                          className="w-20 h-7 text-sm font-medium text-right"
                        />
                        <span className="text-sm text-muted-foreground">h</span>
                      </div>
                    </div>
                    <Slider
                      id="hours"
                      min={1}
                      max={500}
                      step={1}
                      value={[estimatedHours]}
                      onValueChange={(value) => setEstimatedHours(value[0])}
                      className="w-full"
                    />
                    {pricingData && pricingData.avgHoursPerCase > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Promedio histórico:{" "}
                        {Math.round(pricingData.avgHoursPerCase)} horas por caso
                      </p>
                    )}
                  </div>
                )}

                {/* Show calculated hours when using target price */}
                {useTargetPrice &&
                  targetTotalPrice &&
                  parseFloat(targetTotalPrice) > 0 &&
                  pricingData && (
                    <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Label className="text-sm font-semibold text-blue-900">
                        Horas Calculadas (basadas en precio objetivo)
                      </Label>
                      <div className="space-y-1">
                        {useSeniorityAllocation &&
                        pricingData.seniorityLevels.length > 0 ? (
                          pricingData.seniorityLevels.map((level) => {
                            const hours = seniorityHours[level.level] || 0;
                            const price =
                              level.avgHourlyRate * hours * complexityFactor;
                            return (
                              <div
                                key={level.level}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-blue-700">
                                  {level.label}:
                                </span>
                                <span className="font-medium text-blue-900">
                                  {hours.toFixed(1)}h
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700">
                              Total estimado:
                            </span>
                            <span className="font-medium text-blue-900">
                              {pricingData.avgHourlyRate > 0
                                ? Math.round(
                                    parseFloat(targetTotalPrice) /
                                      (pricingData.avgHourlyRate *
                                        complexityFactor)
                                  )
                                : 0}
                              h
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-blue-600 mt-2">
                        💡 Ajusta la distribución de horas arriba para optimizar
                        el precio objetivo.
                      </p>
                    </div>
                  )}

                {/* Seniority Hours Allocation */}
                {useSeniorityAllocation &&
                  pricingData &&
                  pricingData.seniorityLevels.length > 0 && (
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Distribución de Horas por Senioridad
                        </Label>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {Object.values(seniorityHours).reduce(
                              (sum, h) => sum + h,
                              0
                            )}
                            h totales
                          </span>
                          {useTargetPrice &&
                            targetTotalPrice &&
                            parseFloat(targetTotalPrice) > 0 && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">
                                    Ajusta las horas para alcanzar el precio
                                    objetivo de $
                                    {parseFloat(
                                      targetTotalPrice
                                    ).toLocaleString()}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                        </div>
                      </div>
                      {pricingData.seniorityLevels.map((level) => {
                        const hours = seniorityHours[level.level] || 0;
                        const totalHours = Object.values(seniorityHours).reduce(
                          (sum, h) => sum + h,
                          0
                        );
                        return (
                          <div key={level.level} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={level.color}
                                  variant="secondary"
                                >
                                  {level.label}
                                </Badge>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground cursor-help">
                                      $
                                      {Math.round(
                                        level.avgHourlyRate
                                      ).toLocaleString()}
                                      /h
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1 text-xs">
                                      <p className="font-semibold">
                                        {level.label}
                                      </p>
                                      <p>
                                        Tarifa: $
                                        {Math.round(
                                          level.avgHourlyRate
                                        ).toLocaleString()}
                                        /hora
                                      </p>
                                      {(() => {
                                        const seniorityData =
                                          fullPricingData.seniorityLevels[
                                            level.level as keyof typeof fullPricingData.seniorityLevels
                                          ];
                                        if (seniorityData) {
                                          return (
                                            <>
                                              <p>
                                                Costo: $
                                                {Math.round(
                                                  seniorityData.hourlyCost
                                                ).toLocaleString()}
                                                /hora
                                              </p>
                                              <p>
                                                Salario mensual: $
                                                {Math.round(
                                                  seniorityData.monthlySalary
                                                ).toLocaleString()}
                                              </p>
                                            </>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={useTargetPrice ? 1000 : estimatedHours}
                                  step={0.5}
                                  value={hours}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v)) {
                                      const maxVal = useTargetPrice ? 1000 : estimatedHours;
                                      const clamped = Math.max(0, Math.min(maxVal, v));
                                      const newHours = { ...seniorityHours };
                                      newHours[level.level] = clamped;
                                      if (!useTargetPrice) {
                                        const newTotal = Object.values(newHours).reduce((sum, h) => sum + h, 0);
                                        if (newTotal !== estimatedHours) {
                                          setEstimatedHours(Math.round(newTotal));
                                        }
                                      }
                                      setSeniorityHours(newHours);
                                    }
                                  }}
                                  className="w-20 h-7 text-sm font-medium text-right"
                                />
                                <span className="text-sm text-muted-foreground">h</span>
                              </div>
                            </div>
                            <Slider
                              min={0}
                              max={useTargetPrice ? 1000 : estimatedHours}
                              step={0.5}
                              value={[hours]}
                              onValueChange={(value) => {
                                const newHours = { ...seniorityHours };
                                newHours[level.level] = value[0];
                                // Adjust total hours (only if not using target price)
                                if (!useTargetPrice) {
                                  const newTotal = Object.values(
                                    newHours
                                  ).reduce((sum, h) => sum + h, 0);
                                  if (newTotal !== estimatedHours) {
                                    setEstimatedHours(Math.round(newTotal));
                                  }
                                }
                                setSeniorityHours(newHours);
                              }}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                {level.professionals.length} profesional(es)
                              </span>
                              <div className="flex items-center gap-3">
                                <span>
                                  {totalHours > 0
                                    ? `${Math.round(
                                        (hours / totalHours) * 100
                                      )}% del total`
                                    : "0%"}
                                </span>
                                {hours > 0 && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="font-medium cursor-help">
                                          ≈ $
                                          {Math.round(
                                            level.avgHourlyRate *
                                              hours *
                                              complexityFactor
                                          ).toLocaleString()}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="space-y-1 text-xs">
                                          <p className="font-semibold">
                                            Desglose de Costos
                                          </p>
                                          <p>
                                            Ingresos: $
                                            {Math.round(
                                              level.avgHourlyRate *
                                                hours *
                                                complexityFactor
                                            ).toLocaleString()}
                                          </p>
                                          {(() => {
                                            const fullPricingData =
                                              getFullPricingData();
                                            const seniorityData =
                                              fullPricingData.seniorityLevels[
                                                level.level as keyof typeof fullPricingData.seniorityLevels
                                              ];
                                            if (seniorityData) {
                                              const cost =
                                                seniorityData.hourlyCost *
                                                hours;
                                              const profit =
                                                level.avgHourlyRate *
                                                  hours *
                                                  complexityFactor -
                                                cost;
                                              const margin =
                                                level.avgHourlyRate *
                                                  hours *
                                                  complexityFactor >
                                                0
                                                  ? (profit /
                                                      (level.avgHourlyRate *
                                                        hours *
                                                        complexityFactor)) *
                                                    100
                                                  : 0;
                                              return (
                                                <>
                                                  <p>
                                                    Costo: $
                                                    {Math.round(
                                                      cost
                                                    ).toLocaleString()}
                                                  </p>
                                                  <p>
                                                    Ganancia: $
                                                    {Math.round(
                                                      profit
                                                    ).toLocaleString()}
                                                  </p>
                                                  <p>
                                                    Margen: {margin.toFixed(1)}%
                                                  </p>
                                                </>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            // Distribute hours evenly
                            const newHours: SeniorityHours = {};
                            const totalHoursToDistribute =
                              useTargetPrice &&
                              targetTotalPrice &&
                              parseFloat(targetTotalPrice) > 0
                                ? estimatedHours
                                : estimatedHours;
                            const hoursPerLevel =
                              totalHoursToDistribute /
                              pricingData.seniorityLevels.length;
                            pricingData.seniorityLevels.forEach((level) => {
                              newHours[level.level] = Math.floor(hoursPerLevel);
                            });
                            // Distribute remainder
                            const totalDistributed = Object.values(
                              newHours
                            ).reduce((sum, h) => sum + h, 0);
                            if (
                              totalDistributed < totalHoursToDistribute &&
                              pricingData.seniorityLevels.length > 0
                            ) {
                              newHours[pricingData.seniorityLevels[0].level] +=
                                totalHoursToDistribute - totalDistributed;
                            }
                            setSeniorityHours(newHours);
                          }}
                        >
                          Distribuir Equitativamente
                        </Button>
                        {useTargetPrice &&
                          targetTotalPrice &&
                          parseFloat(targetTotalPrice) > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                // Calculate hours needed to reach target price
                                const targetPrice =
                                  parseFloat(targetTotalPrice);
                                const newHours: SeniorityHours = {};

                                // Calculate weighted average rate
                                let totalWeight = 0;
                                let weightedRate = 0;
                                pricingData.seniorityLevels.forEach((level) => {
                                  const weight =
                                    1 / pricingData.seniorityLevels.length;
                                  totalWeight += weight;
                                  weightedRate += level.avgHourlyRate * weight;
                                });

                                // Calculate total hours needed
                                const totalHoursNeeded =
                                  targetPrice /
                                  (weightedRate * complexityFactor);

                                // Distribute proportionally based on rates
                                pricingData.seniorityLevels.forEach((level) => {
                                  const proportion =
                                    level.avgHourlyRate / weightedRate;
                                  newHours[level.level] =
                                    Math.round(
                                      totalHoursNeeded * proportion * 10
                                    ) / 10;
                                });

                                // Adjust to match exactly
                                const totalDistributed = Object.values(
                                  newHours
                                ).reduce((sum, h) => sum + h, 0);
                                if (
                                  totalDistributed !== totalHoursNeeded &&
                                  pricingData.seniorityLevels.length > 0
                                ) {
                                  const diff =
                                    totalHoursNeeded - totalDistributed;
                                  newHours[
                                    pricingData.seniorityLevels[0].level
                                  ] =
                                    Math.round(
                                      (newHours[
                                        pricingData.seniorityLevels[0].level
                                      ] +
                                        diff) *
                                        10
                                    ) / 10;
                                }

                                setEstimatedHours(Math.round(totalHoursNeeded));
                                setSeniorityHours(newHours);
                              }}
                            >
                              Calcular para Precio Objetivo
                            </Button>
                          )}
                      </div>
                    </div>
                  )}

                {/* Complexity Factor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="complexity"
                      className="flex items-center gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Factor de Complejidad del Asunto
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">
                            Ajusta el precio según la complejidad del caso. 0.5
                            = Muy simple, 1.0 = Complejidad estándar, 1.5 = Muy
                            complejo
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={getComplexityColor(complexityFactor)}
                        variant="secondary"
                      >
                        {getComplexityLabel(complexityFactor)}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0.5}
                          max={2}
                          step={0.1}
                          value={complexityFactor}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v)) setComplexityFactor(Math.max(0.5, Math.min(2, Math.round(v * 10) / 10)));
                          }}
                          className="w-20 h-7 text-sm font-medium text-right"
                        />
                        <span className="text-sm text-muted-foreground">x</span>
                      </div>
                    </div>
                  </div>
                  <Slider
                    id="complexity"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={[complexityFactor]}
                    onValueChange={(value) => setComplexityFactor(value[0])}
                    className="w-full"
                  />
                </div>

                <Separator />

                {/* Advanced Pricing Controls */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Parámetros Avanzados de Honorarios
                    </Label>
                  </div>

                  {/* Target Total Price */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="target-price"
                        className="flex items-center gap-2 text-sm"
                      >
                        <DollarSign className="h-4 w-4" />
                        Honorario Total Objetivo
                      </Label>
                      <Switch
                        id="use-target-price"
                        checked={useTargetPrice}
                        onCheckedChange={(checked) => {
                          setUseTargetPrice(checked);
                          if (!checked) {
                            setTargetTotalPrice("");
                          }
                        }}
                      />
                    </div>
                    {useTargetPrice && (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input
                            id="target-price"
                            type="number"
                            min="0"
                            step="1000"
                            value={targetTotalPrice}
                            onChange={(e) =>
                              setTargetTotalPrice(e.target.value)
                            }
                            placeholder="Ingresa el precio total deseado"
                            className="pl-7"
                          />
                        </div>
                        {targetTotalPrice && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTargetTotalPrice("");
                              setUseTargetPrice(false);
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Establece un precio total fijo. El sistema calculará las
                      horas/tarifas necesarias.
                    </p>
                  </div>

                  {/* Target Profit Margin */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="target-margin"
                        className="flex items-center gap-2 text-sm"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Margen de Rentabilidad Objetivo
                      </Label>
                      <Switch
                        id="use-target-margin"
                        checked={useTargetMargin}
                        onCheckedChange={setUseTargetMargin}
                      />
                    </div>
                    {useTargetMargin && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Slider
                            id="target-margin"
                            min={0}
                            max={80}
                            step={1}
                            value={[targetProfitMargin]}
                            onValueChange={(value) =>
                              setTargetProfitMargin(value[0])
                            }
                            className="flex-1"
                          />
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={80}
                              step={1}
                              value={targetProfitMargin}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v)) setTargetProfitMargin(Math.max(0, Math.min(80, v)));
                              }}
                              className="w-16 h-7 text-sm font-medium text-right"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          El precio se ajustará automáticamente para alcanzar
                          este margen de ganancia.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Custom Hourly Rate (Optional) */}
                  {!useTargetPrice && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label
                        htmlFor="custom-rate"
                        className="flex items-center gap-2 text-sm"
                      >
                        <DollarSign className="h-4 w-4" />
                        Tarifa Horaria Manual (Opcional)
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input
                            id="custom-rate"
                            type="number"
                            min="0"
                            step="1000"
                            value={customHourlyRate}
                            onChange={(e) =>
                              setCustomHourlyRate(e.target.value)
                            }
                            placeholder="Dejar vacío para usar promedio"
                            className="pl-7"
                          />
                        </div>
                        {customHourlyRate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCustomHourlyRate("")}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {pricingData &&
                        pricingData.avgHourlyRate > 0 &&
                        !customHourlyRate && (
                          <p className="text-xs text-muted-foreground">
                            Usando tarifa promedio: $
                            {Math.round(
                              pricingData.avgHourlyRate
                            ).toLocaleString()}
                            /hora
                          </p>
                        )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
              </TabsContent>

              <TabsContent value="historico">
            {selectedArea && pricingData ? (
              <Card className="border-border/40 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-sm">
                      <BarChart3 className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Referencia Histórica — {selectedArea}</CardTitle>
                      <CardDescription className="text-xs">
                        Estadísticas basadas en {pricingData.totalCases} casos históricos
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-600 font-medium mb-1">
                            Tarifa Promedio/Hora
                          </p>
                          <p className="text-2xl font-bold text-blue-900">
                            $
                            {Math.round(
                              pricingData.avgHourlyRate
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-sm text-purple-600 font-medium mb-1">
                            Tarifa Mediana/Hora
                          </p>
                          <p className="text-2xl font-bold text-purple-900">
                            $
                            {Math.round(
                              pricingData.medianHourlyRate
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-sm text-green-600 font-medium mb-1">
                            Facturación Promedio/Caso
                          </p>
                          <p className="text-2xl font-bold text-green-900">
                            $
                            {Math.round(
                              pricingData.avgTotalBilled
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <p className="text-sm text-amber-600 font-medium mb-1">
                            Horas Promedio/Caso
                          </p>
                          <p className="text-2xl font-bold text-amber-900">
                            {Math.round(pricingData.avgHoursPerCase)}h
                          </p>
                        </div>
                      </div>

                      {/* Seniority Levels */}
                      {pricingData.seniorityLevels.length > 0 && (
                        <div className="pt-4 border-t">
                          <Collapsible
                            open={showSeniorityCosts}
                            onOpenChange={setShowSeniorityCosts}
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between w-full hover:bg-muted/50 p-2 rounded transition-colors">
                                <p className="text-sm font-semibold flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  Niveles de Senioridad Detectados
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Ver costos y salarios
                                  </span>
                                  {showSeniorityCosts ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="space-y-2 mt-3">
                                {pricingData.seniorityLevels.map((level) => {
                                  const seniorityData =
                                    fullPricingData.seniorityLevels[
                                      level.level as keyof typeof fullPricingData.seniorityLevels
                                    ];
                                  return (
                                    <div
                                      key={level.level}
                                      className="p-3 rounded-lg border"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <Badge
                                            className={level.color}
                                            variant="secondary"
                                          >
                                            {level.label}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">
                                            {level.professionals.length}{" "}
                                            profesional(es)
                                          </span>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm font-semibold">
                                            $
                                            {Math.round(
                                              level.avgHourlyRate
                                            ).toLocaleString()}
                                            /h
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Tarifa promedio
                                          </p>
                                        </div>
                                      </div>
                                      {seniorityData && (
                                        <div className="pt-2 border-t space-y-1">
                                          <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">
                                              Costo por hora:
                                            </span>
                                            <span className="font-medium text-red-600">
                                              $
                                              {Math.round(
                                                seniorityData.hourlyCost
                                              ).toLocaleString()}
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">
                                              Salario mensual:
                                            </span>
                                            <span className="font-medium">
                                              $
                                              {Math.round(
                                                seniorityData.monthlySalary
                                              ).toLocaleString()}
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-xs pt-1 border-t">
                                            <span className="text-muted-foreground">
                                              Margen por hora:
                                            </span>
                                            <span className="font-medium text-green-600">
                                              $
                                              {Math.round(
                                                level.avgHourlyRate -
                                                  seniorityData.hourlyCost
                                              ).toLocaleString()}{" "}
                                              (
                                              {Math.round(
                                                ((level.avgHourlyRate -
                                                  seniorityData.hourlyCost) /
                                                  level.avgHourlyRate) *
                                                  100
                                              )}
                                              %)
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Seleccione un área de práctica para ver datos históricos
                  </p>
                </CardContent>
              </Card>
            )}
              </TabsContent>

              <TabsContent value="precedentes">
                {selectedArea ? (
                  <CasosPrecedentes
                    selectedArea={selectedArea}
                    currentEstimate={{
                      totalPrice: calculatedPrice,
                      totalHours: useSeniorityAllocation
                        ? Object.values(seniorityHours).reduce(
                            (s, h) => s + h,
                            0,
                          )
                        : estimatedHours,
                      avgRate: pricingData?.avgHourlyRate || 0,
                      billingMethod,
                      complexityFactor,
                    }}
                    onApplyProject={handleApplyProject}
                    onCombineAndApply={(combined) => {
                      setEstimatedHours(combined.totalHours);
                      setUseSeniorityAllocation(false);
                      if (combined.avgRate > 0) {
                        setCustomHourlyRate(combined.avgRate.toString());
                      }
                      setActiveTab("parametros");
                    }}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Seleccione un área de práctica para ver casos
                        precedentes
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Price Result */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6 border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Honorario Estimado</CardTitle>
                    <CardDescription className="text-xs">
                      Basado en los parámetros seleccionados
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!selectedArea ? (
                  <div className="text-center py-12">
                    <div className="bg-muted/30 rounded-full p-6 mb-4 mx-auto w-fit">
                      <Scale className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <p className="text-base font-medium text-muted-foreground mb-1">
                      Sin área seleccionada
                    </p>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Seleccione un área de práctica legal en la pestaña de
                      parámetros para generar una estimación de honorarios
                    </p>
                  </div>
                ) : dataLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <>
                    {/* Main Price Display */}
                    <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
                      <p className="text-sm text-muted-foreground mb-2">
                        {useTargetPrice
                          ? "Honorario Objetivo Establecido"
                          : "Honorario Total Estimado"}
                      </p>
                      <p className="text-4xl font-bold text-primary mb-2">
                        ${calculatedPrice.toLocaleString()}
                      </p>
                      {calculatedPrice > 0 &&
                        (() => {
                          const totalHours = useSeniorityAllocation
                            ? Object.values(seniorityHours).reduce(
                                (sum, h) => sum + h,
                                0
                              )
                            : estimatedHours;
                          return totalHours > 0 ? (
                            <p className="text-sm text-muted-foreground">
                              ≈ $
                              {Math.round(
                                calculatedPrice / totalHours
                              ).toLocaleString()}
                              /hora
                            </p>
                          ) : null;
                        })()}
                      {useTargetPrice && (
                        <p className="text-xs text-primary/70 mt-2">
                          💡 Ajusta la distribución de horas para optimizar este
                          precio
                        </p>
                      )}
                    </div>

                    {/* Price Breakdown */}
                    <div className="space-y-3">
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Modalidad de cobro:
                        </span>
                        <span className="font-medium">
                          {billingMethod === "hourly" && "Tarifa Fija Mensual"}
                          {billingMethod === "fixed" && "Hitos"}
                          {billingMethod === "value-based" && "Retainer"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Horas estimadas:
                        </span>
                        <span className="font-medium">
                          {useSeniorityAllocation
                            ? Object.values(seniorityHours)
                                .reduce((sum, h) => sum + h, 0)
                                .toFixed(1)
                            : estimatedHours}
                          h
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Factor de complejidad:
                        </span>
                        <span className="font-medium">
                          {complexityFactor.toFixed(1)}x
                        </span>
                      </div>
                      {customHourlyRate && !useSeniorityAllocation && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Tarifa personalizada:
                          </span>
                          <span className="font-medium">
                            ${parseFloat(customHourlyRate).toLocaleString()}/h
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Profitability Analysis - Always show when we have data */}
                    {(() => {
                      const profitability = calculateProfitability();
                      if (!profitability) return null;

                      const marginColor =
                        profitability.profitMargin >=
                        (useTargetMargin ? targetProfitMargin : 20)
                          ? "text-green-600"
                          : profitability.profitMargin >= 0
                          ? "text-yellow-600"
                          : "text-red-600";

                      return (
                        <div className="space-y-3 pt-4">
                          <Separator />
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-sm font-semibold">
                                Análisis de Rentabilidad
                              </Label>
                            </div>
                            {useTargetMargin && (
                              <Badge variant="outline" className="text-xs">
                                Objetivo: {targetProfitMargin}%
                              </Badge>
                            )}
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Ingresos estimados:
                              </span>
                              <span className="font-medium text-emerald-600">
                                $
                                {Math.round(
                                  profitability.totalRevenue
                                ).toLocaleString()}
                              </span>
                            </div>
                            <Collapsible
                              open={showCostBreakdown}
                              onOpenChange={setShowCostBreakdown}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div className="flex justify-between text-sm w-full hover:bg-muted/30 p-1 rounded transition-colors">
                                  <span className="text-muted-foreground">
                                    Costo estimado:
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-red-600">
                                      $
                                      {Math.round(
                                        profitability.totalCost
                                      ).toLocaleString()}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Ver desglose
                                    </span>
                                    {showCostBreakdown ? (
                                      <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="pt-2 space-y-1 border-t mt-2">
                                  {useSeniorityAllocation &&
                                  pricingData.seniorityLevels.length > 0 ? (
                                    pricingData.seniorityLevels.map((level) => {
                                      const hours =
                                        seniorityHours[level.level] || 0;
                                      const seniorityData =
                                        fullPricingData.seniorityLevels[
                                          level.level as keyof typeof fullPricingData.seniorityLevels
                                        ];
                                      if (!seniorityData || hours === 0)
                                        return null;
                                      const cost =
                                        seniorityData.hourlyCost * hours;
                                      return (
                                        <div
                                          key={level.level}
                                          className="flex justify-between text-xs"
                                        >
                                          <span className="text-muted-foreground">
                                            {level.label} ({hours}h):
                                          </span>
                                          <span className="font-medium">
                                            ${Math.round(cost).toLocaleString()}
                                          </span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">
                                        Costo promedio ({estimatedHours}h):
                                      </span>
                                      <span className="font-medium">
                                        $
                                        {Math.round(
                                          profitability.totalCost
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Ganancia estimada:
                            </span>
                            <span
                              className={`font-medium ${
                                profitability.profit >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              $
                              {Math.round(
                                profitability.profit
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm pt-2 border-t">
                            <span className="text-muted-foreground">
                              Margen de ganancia:
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${marginColor}`}>
                                {profitability.profitMargin.toFixed(1)}%
                              </span>
                              {useTargetMargin && (
                                <span className="text-xs text-muted-foreground">
                                  {profitability.profitMargin >=
                                  targetProfitMargin
                                    ? "✓"
                                    : "✗"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between text-xs pt-2 border-t text-muted-foreground">
                            <span>Ingreso/hora:</span>
                            <span>
                              $
                              {Math.round(
                                profitability.avgHourlyRevenue
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Costo/hora:</span>
                            <span>
                              $
                              {Math.round(
                                profitability.avgHourlyCost
                              ).toLocaleString()}
                            </span>
                          </div>
                          {useTargetMargin &&
                            profitability.profitMargin < targetProfitMargin && (
                              <div className="pt-2 border-t">
                                <p className="text-xs text-amber-600">
                                  ⚠️ El margen actual (
                                  {profitability.profitMargin.toFixed(1)}%) está
                                  por debajo del objetivo ({targetProfitMargin}
                                  %). Considera ajustar el precio o reducir
                                  costos.
                                </p>
                              </div>
                            )}
                        </div>
                      );
                    })()}

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-4">
                      <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={exportToPDF}
                        disabled={exporting || !selectedArea || !pricingData}
                      >
                        {exporting ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Generando PDF...
                          </>
                        ) : (
                          <>
                            <FileDown className="h-4 w-4" />
                            Generar Propuesta (PDF)
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-muted-foreground"
                        size="sm"
                        onClick={() => {
                          setSelectedArea("");
                          setEstimatedHours(40);
                          setComplexityFactor(1);
                          setCustomHourlyRate("");
                          setBillingMethod("hourly");
                          setPricingData(null);
                          setCalculatedPrice(0);
                          setUseSeniorityAllocation(false);
                          setSeniorityHours({});
                          setTargetProfitMargin(30);
                          setTargetTotalPrice("");
                          setUseTargetPrice(false);
                          setUseTargetMargin(false);
                          setActiveTab("parametros");
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Limpiar y Comenzar de Nuevo
                      </Button>
                    </div>

                    {/* Warning for low data */}
                    {pricingData && pricingData.totalCases < 5 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-800">
                          ⚠️ Datos limitados: Solo {pricingData.totalCases}{" "}
                          caso(s) histórico(s). Los resultados pueden no ser
                          representativos.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Pricing;
