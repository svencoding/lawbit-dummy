import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Building2, Save, Palette, Check, Sparkles } from "lucide-react";
import {
  PRICING_VARIANTS,
  usePricingVariant,
} from "@/hooks/usePricingVariant";
import { usePrimaryColor } from "@/hooks/usePrimaryColor";
import { COLOR_PRESETS } from "@/lib/chartColors";

const ColorPicker = () => {
  const { primaryColor, setPrimaryColor } = usePrimaryColor();

  return (
    <div className="flex flex-wrap gap-3">
      {COLOR_PRESETS.map((preset) => {
        const isSelected =
          primaryColor.h === preset.hsl.h && primaryColor.s === preset.hsl.s;
        return (
          <button
            key={preset.label}
            onClick={() => setPrimaryColor(preset.hsl)}
            className={`relative flex flex-col items-center gap-1.5 group`}
            title={preset.label}
          >
            <div
              className={`w-10 h-10 rounded-full border-2 transition-all ${
                isSelected
                  ? "border-foreground scale-110 shadow-md"
                  : "border-transparent hover:scale-105 hover:shadow-sm"
              }`}
              style={{
                backgroundColor: `hsl(${preset.hsl.h} ${preset.hsl.s}% 35%)`,
              }}
            >
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
              {preset.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const Settings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [firmName, setFirmName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const { variant: pricingVariant, setVariant: setPricingVariant } =
    usePricingVariant();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    setProfileLoading(true);
    console.log("🔍 Fetching profile for user:", user.id);
    const { data: profile, error } = await supabase
      .from("organizations")
      .select("firm_name, firm_logo")
      .eq("id", user.id)
      .maybeSingle();

    console.log("🔍 Fetch result:", { profile, error });

    if (error) {
      console.error(
        "❌ Error fetching profile:",
        error.message,
        error.code,
        error.details,
      );
      toast({
        title: "Error",
        description: "No se pudo cargar el perfil",
        variant: "destructive",
      });
    } else if (profile) {
      console.log("✅ Profile found:", profile);
      setFirmName(profile.firm_name || "");
      setLogoUrl(profile.firm_logo || "");
    } else {
      console.log("ℹ️ No profile row exists yet — will be created on save");
    }
    setProfileLoading(false);
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      console.log("❌ No file or no user:", { file: !!file, user: !!user });
      return;
    }

    console.log("📁 File selected:", {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeInMB: (file.size / (1024 * 1024)).toFixed(2) + "MB",
    });

    // Validate file type
    if (!file.type.startsWith("image/")) {
      console.log("❌ Invalid file type:", file.type);
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo de imagen",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      console.log("❌ File too large:", file.size);
      toast({
        title: "Error",
        description: "El archivo no debe superar los 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Check Supabase connection
      console.log("🔗 Supabase URL:", import.meta.env.VITE_SUPABASE_URL);

      // Check if bucket exists and is accessible
      const { data: buckets, error: bucketsError } =
        await supabase.storage.listBuckets();
      console.log("🪣 Available buckets:", buckets);
      if (bucketsError) {
        console.error("❌ Error listing buckets:", bucketsError);
      }

      // Create a unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      console.log("📤 Uploading to:", {
        bucket: "firm-logos",
        filePath: filePath,
        fileName: fileName,
        userId: user.id,
      });

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("firm-logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      console.log("📤 Upload response:", {
        data: uploadData,
        error: uploadError,
      });

      if (uploadError) {
        console.error("❌ Upload error details:", {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError,
        });
        throw uploadError;
      }

      console.log("✅ Upload successful:", uploadData);

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("firm-logos").getPublicUrl(filePath);

      console.log("🔗 Public URL:", publicUrl);

      setLogoUrl(publicUrl);

      toast({
        title: "Éxito",
        description: "Logo cargado correctamente",
      });
    } catch (error: any) {
      console.error("❌ Error uploading logo:", {
        error: error,
        message: error?.message,
        statusCode: error?.statusCode,
        name: error?.name,
        stack: error?.stack,
      });
      toast({
        title: "Error",
        description: error?.message || "No se pudo cargar el logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const payload = {
        id: user.id,
        firm_name: firmName,
        firm_logo: logoUrl,
      };
      console.log("💾 Saving profile with payload:", payload);

      const { data, error, status, statusText } = await supabase
        .from("organizations")
        .upsert(payload)
        .select();

      console.log("💾 Save response:", { data, error, status, statusText });

      if (error) throw error;

      // Update sessionStorage to refresh sidebar without full page reload
      sessionStorage.setItem("firmName", firmName);
      sessionStorage.setItem("logoUrl", logoUrl);
      sessionStorage.setItem("profileUpdated", "true");

      toast({
        title: "Éxito",
        description: "Configuración guardada correctamente",
      });

      // Trigger a custom event to notify the sidebar
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "profileUpdated",
          newValue: "true",
          url: window.location.href,
        }),
      );
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Configuración
          </h1>
          <p className="text-muted-foreground">
            Administra la información de tu firma
          </p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Experiencia de Pricing
            </CardTitle>
            <CardDescription>
              Elige cómo se presenta la herramienta de pricing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {PRICING_VARIANTS.map((v) => {
              const selected = pricingVariant === v.value;
              return (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setPricingVariant(v.value)}
                  className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-sm font-semibold text-foreground">
                      {v.label}
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {v.description}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Color Principal
            </CardTitle>
            <CardDescription>
              Selecciona el color principal para gráficos y elementos de la interfaz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ColorPicker />
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Información de la Firma
            </CardTitle>
            <CardDescription>
              Actualiza el nombre y logo de tu firma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="firmName">Nombre de la Firma</Label>
              <Input
                id="firmName"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="Ej: García & Asociados"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo de la Firma</Label>
              <div className="flex items-start gap-4">
                {logoUrl && (
                  <div className="w-24 h-24 border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt="Logo de la firma"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                {!logoUrl && (
                  <div className="w-24 h-24 border border-dashed border-border rounded-lg flex items-center justify-center bg-muted">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Formatos permitidos: JPG, PNG, SVG. Tamaño máximo: 2MB
                  </p>
                  {uploading && (
                    <p className="text-sm text-blue-600">Subiendo archivo...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={saving || uploading}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
