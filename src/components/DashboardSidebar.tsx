import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Loader2,
  LayoutDashboard,
  TrendingUp,
  Users,
  Calculator,
  Settings,
  Bell,
  Activity,
  Trophy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
  { title: "Facturación", url: "/facturacion", icon: LayoutDashboard },
  // { title: "Clientes", url: "/dashboard/clientes", icon: Users },
  { title: "Clientes", url: "/dashboard/top20-clientes", icon: Trophy },
  { title: "Utilización", url: "/facturacion/utilizacion", icon: Activity },
  { title: "Alertas", url: "/dashboard/alertas", icon: Bell },
  { title: "Pricing", url: "/dashboard/pricing", icon: Calculator },
  { title: "Configuración", url: "/dashboard/settings", icon: Settings },
  // { title: "Proyecciones", url: "/dashboard/proyecciones", icon: TrendingUp },
];

// Helper function to extract initials from firm name
function getInitials(firmName: string): string {
  if (!firmName) return "";
  const words = firmName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function DashboardSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [firmName, setFirmName] = useState<string>(() => {
    return sessionStorage.getItem("firmName") || "";
  });
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    return sessionStorage.getItem("logoUrl") || "";
  });
  const [isLoading, setIsLoading] = useState(!logoUrl && !firmName);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("firm_name, firm_logo")
          .eq("id", user.id)
          .single();

        if (profile?.firm_name) {
          setFirmName(profile.firm_name);
          sessionStorage.setItem("firmName", profile.firm_name);
        }
        if (profile?.firm_logo) {
          setLogoUrl(profile.firm_logo);
          sessionStorage.setItem("logoUrl", profile.firm_logo);
        }
      }
      setIsLoading(false);
    };

    if (
      !sessionStorage.getItem("logoUrl") ||
      !sessionStorage.getItem("firmName")
    ) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }

    // Listen for profile updates from Settings page
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "profileUpdated" && e.newValue === "true") {
        sessionStorage.removeItem("profileUpdated");
        fetchProfile();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar
      className={state === "collapsed" ? "w-20" : "w-64"}
      collapsible="icon"
    >
      <SidebarContent className="bg-sidebar">
        <div className="p-4 flex flex-col items-center gap-2">
          {state === "collapsed" ? (
            // When collapsed, show initials in a circular avatar
            <div className="w-12 h-12 rounded-full bg-sidebar-accent flex items-center justify-center border-2 border-sidebar-accent/30">
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-sidebar-foreground animate-spin" />
              ) : firmName ? (
                <span className="text-sidebar-foreground font-bold text-base leading-none">
                  {getInitials(firmName)}
                </span>
              ) : (
                <span className="text-sidebar-foreground font-bold text-base leading-none">
                  LB
                </span>
              )}
            </div>
          ) : (
            // When expanded, show the logo/image
            <div className="w-28 h-28 bg-sidebar-accent/50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative">
              {isLoading ? (
                <Loader2 className="w-10 h-10 text-sidebar-foreground/40 animate-spin" />
              ) : logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo de la firma"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    // If image fails to load, show the lawbit logo as fallback
                    e.currentTarget.src = "/lawbit_logo_black.png";
                  }}
                />
              ) : (
                <img
                  src="/lawbit_logo_black.png"
                  alt="Lawbit Logo"
                  className="w-full h-full object-contain p-2"
                />
              )}
            </div>
          )}
          {state !== "collapsed" && firmName && (
            <div className="text-center">
              <h2 className="text-sm font-bold text-sidebar-foreground">
                {firmName}
              </h2>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">
            Menú Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon
                        className={
                          state === "collapsed" ? "h-6 w-6" : "h-5 w-5"
                        }
                      />
                      {state !== "collapsed" && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
