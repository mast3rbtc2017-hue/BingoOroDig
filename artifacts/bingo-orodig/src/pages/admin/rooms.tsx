import { useListRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function AdminRooms() {
  const { data: rooms, refetch } = useListRooms({
    query: { queryKey: ["/api/rooms"] }
  });

  const deleteMutation = useDeleteRoom();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this room?")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            toast.success("Room deleted");
            refetch();
          },
          onError: (e) => toast.error(e.message)
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Manage Rooms</h1>
          <Button className="bg-primary text-black">Create Room</Button>
        </div>

        <div className="bg-card/50 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/60">ID</TableHead>
                <TableHead className="text-white/60">Name</TableHead>
                <TableHead className="text-white/60">Type</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Prize</TableHead>
                <TableHead className="text-white/60 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms?.map((room) => (
                <TableRow key={room.id} className="border-white/10 hover:bg-white/5 transition-colors">
                  <TableCell className="font-medium text-white">{room.id}</TableCell>
                  <TableCell className="text-white">{room.name}</TableCell>
                  <TableCell className="text-primary">{room.type}</TableCell>
                  <TableCell className="text-white">{room.status}</TableCell>
                  <TableCell className="text-accent font-bold">${room.prize}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleDelete(room.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
              {rooms?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-white/40">No rooms found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
