import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { PrimaryColorProvider } from "@/hooks/usePrimaryColor";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Facturacion from "./pages/Facturacion";
import Utilizacion from "./pages/Utilizacion";
import Proyecciones from "./pages/Proyecciones";
import Clientes from "./pages/Clientes";
import Top20Clientes from "./pages/Top20Clientes";
import Comparacion from "./pages/Comparacion";
import Alertas from "./pages/Alertas";
import Pricing from "./pages/Pricing";
import Settings from "./pages/Settings";
import UserProfile from "./pages/UserProfile";
import ReportesPDF from "./pages/ReportesPDF";
import Profesionales from "./pages/Profesionales";
import Hernandez from "./pages/Hernandez";
import Planificacion from "./pages/Planificacion";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="lawbit-theme">
      <PrimaryColorProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/facturacion" element={<Facturacion />} />
            <Route path="/facturacion/utilizacion" element={<Utilizacion />} />
            <Route path="/dashboard/proyecciones" element={<Proyecciones />} />
            <Route path="/dashboard/clientes" element={<Clientes />} />
            <Route
              path="/dashboard/top20-clientes"
              element={<Top20Clientes />}
            />
            <Route path="/dashboard/comparacion" element={<Comparacion />} />
            <Route path="/dashboard/alertas" element={<Alertas />} />
            <Route path="/dashboard/pricing" element={<Pricing />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/user/:userCode" element={<UserProfile />} />
            <Route path="/dashboard/reportes" element={<ReportesPDF />} />
            <Route path="/dashboard/profesionales" element={<Profesionales />} />
            <Route path="/dashboard/hernandez" element={<Hernandez />} />
            <Route path="/dashboard/planificacion" element={<Planificacion />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </PrimaryColorProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
