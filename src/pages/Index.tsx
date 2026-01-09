import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, FileText, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: FileText,
      title: "Gestión de Casos",
      description:
        "Organiza y administra todos tus casos legales en un solo lugar",
    },
    {
      icon: Shield,
      title: "Seguridad Total",
      description:
        "Protección de datos con los más altos estándares de seguridad",
    },
    {
      icon: TrendingUp,
      title: "Reportes y Análisis",
      description: "Obtén insights valiosos sobre el desempeño de tu estudio",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-secondary">
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg p-1.5">
              <img
                src="/lawbit_logo_black.png"
                alt="Lawbit Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xl font-bold text-foreground">
              Lawbit Enterprise
            </span>
          </div>
          <Button
            onClick={() => navigate("/auth")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            Iniciar Sesión
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
              Gestiona tu estudio legal con{" "}
              <span className="text-primary">eficiencia</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              La plataforma completa para administrar clientes, casos y procesos
              de tu estudio de abogados
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8"
            >
              Comenzar Ahora
            </Button>
            {/* <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 border-border hover:bg-muted"
            >
              Ver Demo
            </Button> */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
