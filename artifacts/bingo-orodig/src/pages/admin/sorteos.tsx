import { useState, useEffect } from "react";
import { useListGames, useListRooms } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { Plus, Radio, Pencil, Trash2, ArrowLeft, Calendar, Eye, RotateCcw, Search } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { apiJson } from "@/lib/api-fetch";

const PATTERN_OPTIONS = [
  { value: "line", label: "Línea" }, { value: "diagonal", label: "Diagonal" },
  { value: "corners", label: "Esquinas" }, { value: "x", label: "X" }, { value: "fullCard", label: "Cartón lleno" },
];
const MODE_OPTIONS = [
  { value: "live", label: "🎙️ En Vivo (admin conectado)", desc: "El admin sortea manualmente en tiempo real" },
  { value: "manual", label: "🖱️ Manual", desc: "El admin sortea desde el panel" },
  { value: "automatic", label: "🤖 Automático", desc: "Las bolas se sortean automáticamente" },
];
const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  playing: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  finished: "bg-white/10 text-white/40 border-white/10",
};
const STATUS_LABELS: Record<string, string> = {
  waiting: "Esperando", playing: "En juego", paused: "Pausado", finished: "Finalizado",
};

type FilterTab = "all" | "waiting" | "playing" | "paused" | "finished";

type FormState = {
  title: string; description: string; roomId: string; mode: string;
  patternType: string; prize: string; ballInterval: string; scheduledAt: string;
};

function SorteoFormPanel({ form, setForm, rooms, onSubmit, saving, isEdit }: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  rooms: any[] | undefined;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  isEdit: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label className="text-white/70">Título del sorteo</Label>
          <Input className="bg-black/40 border-white/10 text-white" placeholder="Ej: Gran Sorteo de Viernes" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-white/70">Descripción (opcional)</Label>
          <Input className="bg-black/40 border-white/10 text-white" placeholder="Detalles del sorteo..." value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-white/70">Sala <span className="text-red-400">*</span></Label>
          <select className="w-full h-10 rounded-md bg-black/40 border border-white/10 text-white px-3"
            value={form.roomId} onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))} required disabled={isEdit}>
            <option value="">Seleccionar sala...</option>
            {rooms?.map((r: any) => <option key={r.id} value={r.id}>{r.name} (${r.prize})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-white/70">Patrón ganador</Label>
          <select className="w-full h-10 rounded-md bg-black/40 border border-white/10 text-white px-3"
            value={form.patternType} onChange={e => setForm(f => ({ ...f, patternType: e.target.value }))}>
            {PATTERN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-white/70">Premio ($)</Label>
          <Input type="number" className="bg-black/40 border-white/10 text-white" value={form.prize}
            onChange={e => setForm(f => ({ ...f, prize: e.target.value }))} min={1} />
        </div>
        <div className="space-y-1">
          <Label className="text-white/70">Intervalo bolas (seg)</Label>
          <Input type="number" className="bg-black/40 border-white/10 text-white" value={form.ballInterval}
            onChange={e => setForm(f => ({ ...f, ballInterval: e.target.value }))} min={2} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-white/70 flex items-center gap-2"><Calendar className="w-4 h-4" />Programar para (opcional)</Label>
          <Input type="datetime-local" className="bg-black/40 border-white/10 text-white" value={form.scheduledAt}
            onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
        </div>
        <div className="col-span-2 space-y-2">
          <Label className="text-white/70">Modo de sorteo</Label>
          <div className="space-y-2">
            {MODE_OPTIONS.map(o => (
              <label key={o.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.mode === o.value ? "border-primary/50 bg-primary/10" : "border-white/5 bg-black/20 hover:border-white/20"}`}>
                <input type="radio" name="mode" value={o.value} checked={form.mode === o.value} onChange={() => setForm(f => ({ ...f, mode: o.value }))} className="mt-1" />
                <div>
                  <p className="font-medium text-white text-sm">{o.label}</p>
                  <p className="text-white/40 text-xs">{o.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-primary to-accent text-black font-bold py-3">
        {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : (form.mode === "live" ? "🎙️ Crear e Ir al Panel Live" : "Crear Sorteo")}
      </Button>
    </form>
  );
}

const blankForm: FormState = {
  title: "", description: "", roomId: "", mode: "live", patternType: "line",
  prize: "500", ballInterval: "8", scheduledAt: "",
};

export default function AdminSorteos({ autoCreate = false }: { autoCreate?: boolean }) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [editGame, setEditGame] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(autoCreate);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: games, refetch } = useListGames({ query: { queryKey: ["/api/games"] } });
  const { data: rooms } = useListRooms({ query: { queryKey: ["/api/rooms"] } });

  const filtered = (games || []).filter(g => {
    const matchTab = tab === "all" || g.status === tab;
    const matchSearch = !search || ((g as any).title || `Sorteo #${g.id}`).toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const tabs: { key: FilterTab, label: string, count: number }[] = [
    { key: "all", label: "Todos", count: games?.length || 0 },
    { key: "waiting", label: "Programados", count: games?.filter(g => g.status === "waiting").length || 0 },
    { key: "playing", label: "En vivo", count: games?.filter(g => g.status === "playing").length || 0 },
    { key: "paused", label: "Pausados", count: games?.filter(g => g.status === "paused").length || 0 },
    { key: "finished", label: "Finalizados", count: games?.filter(g => g.status === "finished").length || 0 },
  ];

  const apiCall = async (path: string, method: string, body?: unknown) =>
    apiJson(path, method, body);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roomId) { toast.error("Selecciona una sala"); return; }
    setSaving(true);
    try {
      const body = {
        roomId: Number(form.roomId), title: form.title, description: form.description,
        mode: form.mode, patternType: form.patternType, prize: Number(form.prize),
        ballInterval: Number(form.ballInterval),
        scheduledAt: form.scheduledAt
          ? new Date(form.scheduledAt).toISOString()
          : undefined,
      };
      if (editGame) {
        await apiCall(`/api/games/${editGame.id}`, "PATCH", body);
        toast.success("Sorteo actualizado");
        setEditGame(null);
      } else {
        const created = await apiCall("/api/games", "POST", body);
        toast.success("Sorteo creado");
        setShowCreate(false);
        setForm(blankForm);
        if (form.mode === "live") navigate(`/admin/sorteos/${created.id}/live`);
      }
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este sorteo? Desaparecerá del lobby de jugadores y se borrarán sus datos.")) return;
    setDeletingId(id);
    try {
      await apiCall(`/api/games/${id}`, "DELETE");
      toast.success("Sorteo eliminado");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleControl = async (id: number, action: string) => {
    try {
      await apiCall(`/api/games/${id}/control`, "POST", { action });
      const labels: Record<string, string> = { start: "¡Sorteo iniciado!", pause: "Pausado", resume: "Reanudado", finish: "Finalizado", restart: "Reiniciado" };
      toast.success(labels[action] || "OK");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEdit = (g: any) => {
    setForm({
      title: g.title || "", description: g.description || "",
      roomId: String(g.roomId), mode: g.mode || "manual",
      patternType: g.patternType, prize: String(g.prize),
      ballInterval: String(g.ballInterval),
      scheduledAt: g.scheduledAt ? g.scheduledAt.slice(0, 16) : "",
    });
    setEditGame(g);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-white/40 hover:text-white"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Gestión de Sorteos</h1>
              <p className="text-white/40 text-sm">Crea, programa y controla todos los sorteos</p>
            </div>
          </div>
          <Button onClick={() => { setForm(blankForm); setShowCreate(true); }}
            className="bg-gradient-to-r from-primary to-accent text-black font-bold px-5 hover:scale-105 transition-transform">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Sorteo
          </Button>
        </div>

        {/* Filter tabs + Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${tab === t.key ? "bg-primary text-black border-primary" : "bg-card/30 text-white/60 border-white/10 hover:border-white/30"}`}>
                {t.label} <span className="ml-1 opacity-60">({t.count})</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <Input className="bg-black/40 border-white/10 text-white pl-9" placeholder="Buscar sorteo..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {filtered.map((game: any, i: number) => (
              <motion.div key={game.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}
                className="bg-card/50 backdrop-blur border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">

                  {/* Left: Game info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-bold text-white text-lg">{game.title || `Sorteo #${game.id}`}</h3>
                      <Badge className={STATUS_COLORS[game.status]}>{STATUS_LABELS[game.status]}</Badge>
                      <Badge className="bg-white/5 text-white/50 border-white/10 text-xs">
                        {MODE_OPTIONS.find(m => m.value === game.mode)?.label || game.mode}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-white/50">
                      <span>Sala #{game.roomId}</span>
                      <span className="text-accent font-bold">Premio: ${game.prize}</span>
                      <span>Patrón: {PATTERN_OPTIONS.find(p => p.value === game.patternType)?.label || game.patternType}</span>
                      {game.scheduledAt && (
                        <span className="text-yellow-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(game.scheduledAt), "d MMM yyyy, HH:mm", { locale: es })}
                          <span className="text-white/30">({formatDistanceToNow(new Date(game.scheduledAt), { locale: es, addSuffix: true })})</span>
                        </span>
                      )}
                      {game.startedAt && <span>Iniciado: {format(new Date(game.startedAt), "d MMM HH:mm", { locale: es })}</span>}
                      {game.finishedAt && <span>Finalizado: {format(new Date(game.finishedAt), "d MMM HH:mm", { locale: es })}</span>}
                    </div>
                    {game.description && <p className="text-white/40 text-sm mt-1">{game.description}</p>}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    {/* Live panel button */}
                    {game.status !== "finished" && (
                      <Link href={`/admin/sorteos/${game.id}/live`}>
                        <Button size="sm" className="bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black border border-green-500/30 font-bold">
                          <Radio className="w-3 h-3 mr-1" />Panel Live
                        </Button>
                      </Link>
                    )}

                    {/* Start */}
                    {game.status === "waiting" && (
                      <Button size="sm" onClick={() => handleControl(game.id, "start")}
                        className="bg-primary/20 text-primary hover:bg-primary hover:text-black border border-primary/30">
                        ▶ Iniciar
                      </Button>
                    )}

                    {/* Pause/Resume */}
                    {game.status === "playing" && (
                      <Button size="sm" variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                        onClick={() => handleControl(game.id, "pause")}>⏸ Pausar</Button>
                    )}
                    {game.status === "paused" && (
                      <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                        onClick={() => handleControl(game.id, "resume")}>▶ Reanudar</Button>
                    )}

                    {/* Restart */}
                    {(game.status === "finished" || game.status === "paused") && (
                      <Button size="sm" variant="ghost" className="text-white/40 hover:text-white"
                        onClick={() => handleControl(game.id, "restart")}>
                        <RotateCcw className="w-3 h-3 mr-1" />Reiniciar
                      </Button>
                    )}

                    {/* Edit */}
                    {game.status !== "playing" && (
                      <Button size="sm" variant="ghost" className="text-white/50 hover:text-white" onClick={() => openEdit(game)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}

                    {/* Delete */}
                    <Button size="sm" variant="ghost" className="text-red-400/50 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDelete(game.id)} disabled={deletingId === game.id}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-20 bg-card/20 rounded-2xl border border-white/5">
              <p className="text-white/30 text-lg mb-2">No hay sorteos {tab !== "all" ? `con estado "${STATUS_LABELS[tab]}"` : ""}</p>
              <Button onClick={() => setShowCreate(true)} className="mt-4 bg-primary text-black">
                <Plus className="w-4 h-4 mr-2" />Crear primero sorteo
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#0d0d0d] border-white/10 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Crear Nuevo Sorteo</DialogTitle>
          </DialogHeader>
          <SorteoFormPanel form={form} setForm={setForm} rooms={rooms} onSubmit={handleSave} saving={saving} isEdit={false} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editGame} onOpenChange={v => !v && setEditGame(null)}>
        <DialogContent className="bg-[#0d0d0d] border-white/10 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Editar Sorteo #{editGame?.id}</DialogTitle>
          </DialogHeader>
          <SorteoFormPanel form={form} setForm={setForm} rooms={rooms} onSubmit={handleSave} saving={saving} isEdit={true} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
