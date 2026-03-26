import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Fuse from "fuse.js";
import { Search, Building2, FolderOpen, User, X } from "lucide-react";
import { getClientes, getAsuntos, getUsuarios } from "@/lib/mockDataUtils";
import type { Cliente, Asunto, Usuario } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "client" | "project" | "employee";
  id: number;
  name: string;
  subtitle: string;
  code?: string;
}

function buildSearchIndex(): { fuse: Fuse<SearchResult>; items: SearchResult[] } {
  const clientes = getClientes();
  const asuntos = getAsuntos();
  const usuarios = getUsuarios();

  // Build a map for client names
  const clienteMap = new Map<number, string>();
  clientes.forEach((c) => clienteMap.set(c.id, c.name || ""));

  const items: SearchResult[] = [
    ...clientes
      .filter((c) => c.name)
      .map((c) => ({
        type: "client" as const,
        id: c.id,
        name: c.name!,
        subtitle: [c.industry, c.fee_type].filter(Boolean).join(" · ") || "Cliente",
        code: String(c.id),
      })),
    ...asuntos
      .filter((a) => a.title)
      .map((a) => ({
        type: "project" as const,
        id: a.id,
        name: a.title!,
        subtitle: [
          clienteMap.get(a.cliente_id ?? -1) || "",
          a.practice_area,
          a.project_type,
        ]
          .filter(Boolean)
          .join(" · ") || "Asunto",
        code: String(a.id),
      })),
    ...usuarios.map((u) => ({
      type: "employee" as const,
      id: u.id,
      name: u.name,
      subtitle: [u.practice_area, u.category].filter(Boolean).join(" · "),
      code: u.code,
    })),
  ];

  const fuse = new Fuse(items, {
    keys: [
      { name: "name", weight: 1.0 },
      { name: "subtitle", weight: 0.4 },
      { name: "code", weight: 0.3 },
    ],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 1,
  });

  return { fuse, items };
}

const typeConfig = {
  client: { icon: Building2, label: "Clientes", color: "text-blue-500" },
  project: { icon: FolderOpen, label: "Asuntos", color: "text-amber-500" },
  employee: { icon: User, label: "Profesionales", color: "text-emerald-500" },
};

export const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { fuse } = useMemo(() => buildSearchIndex(), []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const raw = fuse.search(query, { limit: 15 });
    return raw.map((r) => r.item);
  }, [query, fuse]);

  // Group results by type
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.forEach((r) => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    });
    return groups;
  }, [results]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    const order: Array<"client" | "project" | "employee"> = ["client", "project", "employee"];
    const flat: SearchResult[] = [];
    order.forEach((type) => {
      if (grouped[type]) flat.push(...grouped[type]);
    });
    return flat;
  }, [grouped]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setQuery("");
      setIsOpen(false);
      switch (result.type) {
        case "client":
          navigate(`/dashboard/clientes/${result.id}`);
          break;
        case "project":
          navigate(`/dashboard/asuntos/${result.id}`);
          break;
        case "employee":
          navigate(`/user/${result.code}`);
          break;
      }
    },
    [navigate],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || flatResults.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatResults.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
          break;
        case "Enter":
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            handleSelect(flatResults[selectedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, flatResults, selectedIndex, handleSelect],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  let flatIndex = 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar clientes, asuntos, profesionales...  ⌘K"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-lg border bg-popover shadow-lg overflow-hidden">
          {flatResults.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin resultados para "{query}"
            </div>
          ) : (
            <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1">
              {(["client", "project", "employee"] as const).map((type) => {
                const items = grouped[type];
                if (!items || items.length === 0) return null;
                const config = typeConfig[type];
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {config.label}
                    </div>
                    {items.map((item) => {
                      const currentIndex = flatIndex++;
                      const Icon = config.icon;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          data-index={currentIndex}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={cn(
                            "flex items-center gap-3 w-full px-3 py-2 text-left text-sm transition-colors",
                            currentIndex === selectedIndex
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50",
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{item.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
