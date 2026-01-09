// Sistema de caché para el Dashboard
// Evita recargar datos cada vez que cambias de pestaña

interface CacheEntry {
  data: any;
  timestamp: number;
  version: number;
  filters: {
    selectedArea: string;
    startDate: string | null;
    endDate: string | null;
  };
}

class DashboardCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  private readonly CACHE_VERSION = 7; // Incrementar cuando cambie la estructura de datos
  private readonly MAX_ENTRIES = 20; // Máximo de combinaciones de filtros en caché

  private getCacheKey(filters: {
    selectedArea: string;
    startDate?: Date;
    endDate?: Date;
  }): string {
    return `${filters.selectedArea}|${
      filters.startDate?.toISOString() || "null"
    }|${filters.endDate?.toISOString() || "null"}`;
  }

  set(
    data: any,
    filters: { selectedArea: string; startDate?: Date; endDate?: Date }
  ) {
    const key = this.getCacheKey(filters);

    // Si alcanzamos el límite, eliminar la entrada más antigua
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      version: this.CACHE_VERSION,
      filters: {
        selectedArea: filters.selectedArea,
        startDate: filters.startDate?.toISOString() || null,
        endDate: filters.endDate?.toISOString() || null,
      },
    });

    console.log(
      `💾 Datos guardados en caché. Total entradas: ${this.cache.size}`
    );
  }

  get(filters: {
    selectedArea: string;
    startDate?: Date;
    endDate?: Date;
  }): any | null {
    const key = this.getCacheKey(filters);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Verificar versión del caché
    if (entry.version !== this.CACHE_VERSION) {
      console.log("🔄 Caché invalidado por cambio de versión");
      this.cache.delete(key);
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > this.CACHE_DURATION;

    if (isExpired) {
      console.log("⏰ Caché expirado, eliminando entrada");
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear() {
    this.cache.clear();
    console.log("🗑️ Caché completamente limpiado");
  }

  getStats() {
    return {
      entries: this.cache.size,
      maxEntries: this.MAX_ENTRIES,
    };
  }
}

export const dashboardCache = new DashboardCache();
