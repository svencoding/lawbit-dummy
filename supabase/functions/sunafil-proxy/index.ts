import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUNAFIL_BASE = "https://aplicativosweb7.sunafil.gob.pe";

// Get a fresh JWT token from SUNAFIL's public OAuth endpoint
async function getSunafilToken(): Promise<string> {
  const res = await fetch(
    `${SUNAFIL_BASE}/ws.autenticacion/oauth/token?grant_type=client_credentials`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa("sunafil:sunafil"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ordenInspeccion, anio, intendencia } = await req.json();

    if (!ordenInspeccion || !anio || !intendencia) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pad ordenInspeccion to 10 digits
    const ordenPadded = ordenInspeccion.toString().padStart(10, "0");

    // Get fresh token
    const token = await getSunafilToken();

    // Query SUNAFIL API
    const res = await fetch(
      `${SUNAFIL_BASE}/ws.denuncia/denuncias/${ordenPadded}/${anio}/${intendencia}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("SUNAFIL API error:", res.status, text);
      return new Response(
        JSON.stringify({ error: `SUNAFIL respondió con error ${res.status}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
