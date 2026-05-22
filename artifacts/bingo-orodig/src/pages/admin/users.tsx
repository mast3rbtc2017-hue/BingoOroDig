import { useListUsers, useToggleBlockUser, useUpdateUserBalance } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function AdminUsers() {
  const { data: users, refetch } = useListUsers({
    query: { queryKey: ["/api/users"] }
  });

  const blockMutation = useToggleBlockUser();
  const balanceMutation = useUpdateUserBalance();

  const [balanceUser, setBalanceUser] = useState<any>(null);
  const [balanceAmount, setBalanceAmount] = useState("");

  const handleToggleBlock = (id: number, currentBlocked: boolean) => {
    blockMutation.mutate(
      { id, data: { isBlocked: !currentBlocked } },
      {
        onSuccess: () => {
          toast.success("Estado del usuario actualizado");
          refetch();
        },
        onError: (e) => toast.error(e.message)
      }
    );
  };

  const handleUpdateBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceUser || !balanceAmount) return;

    balanceMutation.mutate(
      { id: balanceUser.id, data: { amount: parseFloat(balanceAmount), reason: "Ajuste de administrador" } },
      {
        onSuccess: () => {
          toast.success("Saldo actualizado");
          setBalanceUser(null);
          setBalanceAmount("");
          refetch();
        },
        onError: (e) => toast.error(e.message)
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Gestionar Usuarios</h1>

        <div className="bg-card/50 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/60">ID</TableHead>
                <TableHead className="text-white/60">Usuario</TableHead>
                <TableHead className="text-white/60">Rol</TableHead>
                <TableHead className="text-white/60">Saldo</TableHead>
                <TableHead className="text-white/60">Estado</TableHead>
                <TableHead className="text-white/60 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.id} className="border-white/10 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium text-white">{u.id}</TableCell>
                  <TableCell className="text-white">{u.username}</TableCell>
                  <TableCell className="text-primary">{u.role === 'admin' ? 'Admin' : 'Jugador'}</TableCell>
                  <TableCell className="text-accent font-bold">${u.balance}</TableCell>
                  <TableCell>
                    {u.isBlocked ? (
                      <span className="text-red-400">Bloqueado</span>
                    ) : (
                      <span className="text-green-400">Activo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="outline" className="border-white/10 text-white" onClick={() => setBalanceUser(u)}>Saldo</Button>
                    <Button
                      variant="ghost"
                      className={u.isBlocked ? "text-green-400" : "text-red-400"}
                      onClick={() => handleToggleBlock(u.id, u.isBlocked)}
                    >
                      {u.isBlocked ? "Desbloquear" : "Bloquear"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!balanceUser} onOpenChange={(open) => !open && setBalanceUser(null)}>
          <DialogContent className="bg-card border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Actualizar Saldo de {balanceUser?.username}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateBalance} className="space-y-4 pt-4">
              <Input
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="Monto (ej. 100)"
                className="bg-black/40 border-white/10 text-white"
              />
              <Button type="submit" className="w-full bg-primary text-black" disabled={balanceMutation.isPending}>
                Actualizar Saldo
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
