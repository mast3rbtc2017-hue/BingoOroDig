import { useState } from "react";
import { useListRooms, useDeleteRoom, useCreateRoom } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiJson } from "@/lib/api-fetch";
import { Plus, Play } from "lucide-react";

export default function AdminRooms() {
  const { data: rooms, refetch } = useListRooms({
    query: { queryKey: ["/api/rooms"] }
  });

  const deleteMutation = useDeleteRoom();
  const createRoomMutation = useCreateRoom();

  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [creatingGameForRoom, setCreatingGameForRoom] = useState<number | null>(null);
  const [roomForm, setRoomForm] = useState({
    name: "", description: "", type: "classic" as any,
    cardPrice: 10, maxPlayers: 100, ballInterval: 8, prize: 500, patternType: "line" as any,
  });

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta sala?")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => { toast.success("Sala eliminada"); refetch(); },
          onError: (e) => toast.error(e.message)
        }
      );
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    createRoomMutation.mutate(
      { data: roomForm },
      {
        onSuccess: () => {
          toast.success("¡Sala creada!");
          setShowCreateRoom(false);
          setRoomForm({ name: "", description: "", type: "classic", cardPrice: 10, maxPlayers: 100, ballInterval: 8, prize: 500, patternType: "line" });
          refetch();
        },
        onError: (e) => toast.error(e.message)
      }
    );
  };

  const handleCreateGame = async (roomId: number) => {
    setCreatingGameForRoom(roomId);
    try {
      await apiJson("/api/games", "POST", { roomId });
      toast.success("✅ Partida creada — ve a Sorteos o Control de Partidas para iniciarla");
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al crear partida");
    } finally {
      setCreatingGameForRoom(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Gestionar Salas</h1>
          <Button className="bg-primary text-black font-bold" onClick={() => setShowCreateRoom(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Sala
          </Button>
        </div>

        <div className="bg-card/50 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/60">ID</TableHead>
                <TableHead className="text-white/60">Nombre</TableHead>
                <TableHead className="text-white/60">Tipo</TableHead>
                <TableHead className="text-white/60">Estado</TableHead>
                <TableHead className="text-white/60">Premio</TableHead>
                <TableHead className="text-white/60 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms?.map((room) => (
                <TableRow key={room.id} className="border-white/10 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium text-white">{room.id}</TableCell>
                  <TableCell className="text-white font-medium">{room.name}</TableCell>
                  <TableCell className="text-primary capitalize">{room.type}</TableCell>
                  <TableCell>
                    <Badge className={room.currentGameId ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/10 text-white/60"}>
                      {room.currentGameId ? "Partida activa" : "Sin partida"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-accent font-bold">${room.prize}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        className="bg-primary/20 text-primary hover:bg-primary hover:text-black border border-primary/30"
                        onClick={() => handleCreateGame(room.id)}
                        disabled={creatingGameForRoom === room.id}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        {creatingGameForRoom === room.id ? "Creando..." : "Crear Partida"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        onClick={() => handleDelete(room.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rooms?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-white/40">No hay salas registradas</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create Room Dialog */}
        <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
          <DialogContent className="bg-card border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Nueva Sala</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRoom} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Nombre</Label>
                  <Input className="bg-black/40 border-white/10 text-white" value={roomForm.name}
                    onChange={e => setRoomForm(f => ({...f, name: e.target.value}))} placeholder="Sala Clásica" required />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Descripción</Label>
                  <Input className="bg-black/40 border-white/10 text-white" value={roomForm.description}
                    onChange={e => setRoomForm(f => ({...f, description: e.target.value}))} placeholder="Descripción opcional" />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <select className="w-full h-10 rounded-md bg-black/40 border border-white/10 text-white px-3"
                    value={roomForm.type} onChange={e => setRoomForm(f => ({...f, type: e.target.value as any}))}>
                    <option value="classic">Clásico</option>
                    <option value="fast">Rápido</option>
                    <option value="vip">VIP</option>
                    <option value="automatic">Automático</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Patrón</Label>
                  <select className="w-full h-10 rounded-md bg-black/40 border border-white/10 text-white px-3"
                    value={roomForm.patternType} onChange={e => setRoomForm(f => ({...f, patternType: e.target.value as any}))}>
                    <option value="line">Línea</option>
                    <option value="diagonal">Diagonal</option>
                    <option value="corners">Esquinas</option>
                    <option value="x">X</option>
                    <option value="fullCard">Cartón lleno</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Precio cartón ($)</Label>
                  <Input type="number" className="bg-black/40 border-white/10 text-white" value={roomForm.cardPrice}
                    onChange={e => setRoomForm(f => ({...f, cardPrice: Number(e.target.value)}))} min={1} />
                </div>
                <div className="space-y-1">
                  <Label>Premio ($)</Label>
                  <Input type="number" className="bg-black/40 border-white/10 text-white" value={roomForm.prize}
                    onChange={e => setRoomForm(f => ({...f, prize: Number(e.target.value)}))} min={1} />
                </div>
                <div className="space-y-1">
                  <Label>Intervalo bolas (seg)</Label>
                  <Input type="number" className="bg-black/40 border-white/10 text-white" value={roomForm.ballInterval}
                    onChange={e => setRoomForm(f => ({...f, ballInterval: Number(e.target.value)}))} min={2} />
                </div>
                <div className="space-y-1">
                  <Label>Máx. jugadores</Label>
                  <Input type="number" className="bg-black/40 border-white/10 text-white" value={roomForm.maxPlayers}
                    onChange={e => setRoomForm(f => ({...f, maxPlayers: Number(e.target.value)}))} min={2} />
                </div>
              </div>
              <Button type="submit" className="w-full bg-primary text-black font-bold" disabled={createRoomMutation.isPending}>
                {createRoomMutation.isPending ? "Creando..." : "Crear Sala"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
