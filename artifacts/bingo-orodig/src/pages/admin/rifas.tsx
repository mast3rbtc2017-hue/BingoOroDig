import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Ticket,
  ImagePlus,
  Trash2,
  Play,
  Pause,
  Trophy,
  Upload,
  Loader2,
} from "lucide-react";
import { apiJson } from "@/lib/api-fetch";
import { formatCOP } from "@/lib/currency";
import { uploadRafflePrizeImage, localPreviewUrl } from "@/lib/storage";
import { datetimeLocalToColombiaISO, formatRaffleDrawColombia } from "@/lib/raffleTime";
import type { Raffle, RaffleStatus } from "@/lib/raffle-types";
import { motion } from "framer-motion";

const STATUS_COLORS: Record<RaffleStatus, string> = {
  draft: "bg-white/10 text-white/50 border-white/10",
  open: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  drawn: "bg-primary/20 text-primary border-primary/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<RaffleStatus, string> = {
  draft: "Borrador",
  open: "Activa",
  closed: "Cerrada",
  drawn: "Sorteada",
  cancelled: "Cancelada",
};

type FormState = {
  title: string;
  description: string;
  prizeTitle: string;
  prizeDescription: string;
  imageUrl: string;
  rules: string;
  ticketPrice: string;
  totalNumbers: string;
  scheduledAt: string;
  publishNow: boolean;
};

const blankForm: FormState = {
  title: "",
  description: "",
  prizeTitle: "",
  prizeDescription: "",
  imageUrl: "",
  rules: "",
  ticketPrice: "5000",
  totalNumbers: "100",
  scheduledAt: "",
  publishNow: true,
};

export default function AdminRifas() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: raffles, refetch } = useQuery({
    queryKey: ["/api/raffles/admin"],
    queryFn: () => apiJson<Raffle[]>("/api/raffles/admin", "GET"),
  });

  const apiCall = (path: string, method: string, body?: unknown) =>
    apiJson(path, method, body);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = localPreviewUrl(file);
    setPreviewUrl(localUrl);
    setUploading(true);

    try {
      const url = await uploadRafflePrizeImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
      setPreviewUrl(url);
      toast.success("Imagen subida correctamente");
    } catch (err: unknown) {
      setPreviewUrl(null);
      setForm((f) => ({ ...f, imageUrl: "" }));
      toast.error(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.title.trim() || !form.prizeTitle.trim()) {
      toast.error("Título y premio son obligatorios");
      return;
    }
    if (!form.scheduledAt) {
      toast.error("Indica fecha y hora del sorteo (Colombia)");
      return;
    }
    setSaving(true);
    try {
      await apiCall("/api/raffles", "POST", {
        title: form.title,
        description: form.description || undefined,
        prizeTitle: form.prizeTitle,
        prizeDescription: form.prizeDescription || undefined,
        imageUrl: form.imageUrl || null,
        rules: form.rules || undefined,
        ticketPrice: Number(form.ticketPrice),
        totalNumbers: Number(form.totalNumbers),
        scheduledDrawAt: datetimeLocalToColombiaISO(form.scheduledAt),
        publish: form.publishNow,
      });
      toast.success("Rifa creada");
      setShowCreate(false);
      setForm(blankForm);
      setPreviewUrl(null);
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleControl = async (id: number, action: string) => {
    try {
      await apiCall(`/api/raffles/${id}/control`, "POST", { action });
      toast.success("Actualizado");
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta rifa y todos sus números vendidos?")) return;
    try {
      await apiCall(`/api/raffles/${id}`, "DELETE");
      toast.success("Rifa eliminada");
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-white/40">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Ticket className="w-8 h-8 text-violet-400" />
                Rifas
              </h1>
              <p className="text-white/40 text-sm">
                Crea rifas con imagen, números y sorteo en hora Colombia
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              setForm(blankForm);
              setPreviewUrl(null);
              setShowCreate(true);
            }}
            className="bg-gradient-to-r from-violet-500 to-primary text-white font-bold"
          >
            <Plus className="w-4 h-4 mr-2" /> Nueva rifa
          </Button>
        </div>

        <div className="grid gap-4">
          {raffles?.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card/50 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4"
            >
              <div className="w-full md:w-36 h-28 rounded-xl overflow-hidden bg-black/40 shrink-0">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImagePlus className="w-8 h-8 text-white/20" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-white truncate">{r.title}</h3>
                  <Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </div>
                <p className="text-primary text-sm font-medium">{r.prizeTitle}</p>
                <p className="text-white/40 text-xs mt-1">
                  {formatCOP(r.ticketPrice)}/número · {r.soldCount}/{r.totalNumbers} vendidos ·{" "}
                  {formatRaffleDrawColombia(r.scheduledDrawAt)}
                </p>
                {r.status === "drawn" && r.winningNumber != null && (
                  <p className="text-accent text-sm mt-1 font-bold">
                    Ganador #{r.winningNumber} — {r.winnerUsername}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-start shrink-0">
                {r.status === "draft" && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-500 text-white"
                    onClick={() => handleControl(r.id, "publish")}
                  >
                    <Play className="w-3 h-3 mr-1" /> Publicar
                  </Button>
                )}
                {r.status === "open" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-500/40 text-orange-400"
                      onClick={() => handleControl(r.id, "close")}
                    >
                      <Pause className="w-3 h-3 mr-1" /> Cerrar venta
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary text-black font-bold"
                      onClick={() => handleControl(r.id, "draw")}
                    >
                      <Trophy className="w-3 h-3 mr-1" /> Sortear ya
                    </Button>
                  </>
                )}
                {r.status === "closed" && (
                  <Button
                    size="sm"
                    className="bg-primary text-black font-bold"
                    onClick={() => handleControl(r.id, "draw")}
                  >
                    <Trophy className="w-3 h-3 mr-1" /> Sortear
                  </Button>
                )}
                <Link href={`/rifas/${r.id}`}>
                  <Button size="sm" variant="outline" className="border-white/10 text-white">
                    Ver
                  </Button>
                </Link>
                {r.status !== "drawn" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
          {!raffles?.length && (
            <p className="text-center text-white/30 py-16">Aún no hay rifas creadas</p>
          )}
        </div>
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva rifa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Imagen del premio</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImagePick}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                className="relative aspect-video rounded-2xl border-2 border-dashed border-white/20 hover:border-primary/50 overflow-hidden cursor-pointer flex flex-col items-center justify-center bg-black/40 transition-colors"
              >
                {previewUrl || form.imageUrl ? (
                  <>
                    <img
                      src={previewUrl || form.imageUrl}
                      alt="Premio"
                      className="w-full h-full object-cover"
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      </div>
                    )}
                  </>
                ) : uploading ? (
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-white/30 mb-2" />
                    <p className="text-white/50 text-sm text-center px-4">
                      Toca para galería o cámara
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Título de la rifa</Label>
              <Input
                className="bg-black/40 border-white/10"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Rifa Moto Eléctrica Mayo"
              />
            </div>
            <div className="space-y-1">
              <Label>Nombre del premio</Label>
              <Input
                className="bg-black/40 border-white/10"
                value={form.prizeTitle}
                onChange={(e) => setForm((f) => ({ ...f, prizeTitle: e.target.value }))}
                placeholder="Ej: Moto eléctrica 2026"
              />
            </div>
            <div className="space-y-1">
              <Label>Descripción del premio</Label>
              <Input
                className="bg-black/40 border-white/10"
                value={form.prizeDescription}
                onChange={(e) => setForm((f) => ({ ...f, prizeDescription: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Descripción de la rifa (opcional)</Label>
              <Input
                className="bg-black/40 border-white/10"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Precio por número (COP)</Label>
                <Input
                  type="number"
                  className="bg-black/40 border-white/10"
                  value={form.ticketPrice}
                  onChange={(e) => setForm((f) => ({ ...f, ticketPrice: e.target.value }))}
                  min={1000}
                />
              </div>
              <div className="space-y-1">
                <Label>Cantidad de números</Label>
                <Input
                  type="number"
                  className="bg-black/40 border-white/10"
                  value={form.totalNumbers}
                  onChange={(e) => setForm((f) => ({ ...f, totalNumbers: e.target.value }))}
                  min={10}
                  max={500}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Sorteo — fecha y hora Colombia</Label>
              <Input
                type="datetime-local"
                className="bg-black/40 border-white/10"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
              <p className="text-white/30 text-xs">Zona horaria: America/Bogotá (UTC-5)</p>
            </div>
            <div className="space-y-1">
              <Label>Reglas (opcional)</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md bg-black/40 border border-white/10 text-white px-3 py-2 text-sm"
                value={form.rules}
                onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={form.publishNow}
                onChange={(e) => setForm((f) => ({ ...f, publishNow: e.target.checked }))}
              />
              Publicar de inmediato (visible en Rifas)
            </label>
            <Button
              type="submit"
              disabled={saving || uploading}
              className="w-full bg-gradient-to-r from-violet-500 to-primary text-white font-bold"
            >
              {saving ? "Creando..." : "Crear rifa"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
