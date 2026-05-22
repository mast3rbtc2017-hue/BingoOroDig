import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  displayName: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { login: setAuthContext } = useAuth();
  const { toast } = useToast();

  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", password: "", displayName: "" },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(
      { data },
      {
        onSuccess: (response) => {
          setAuthContext(response.token, response.user);
          toast({ title: "¡Cuenta creada!", description: "Bienvenido a Bingo OroDig." });
          setLocation("/lobby");
        },
        onError: (error) => {
          toast({
            title: "Error al registrarse",
            description: error.message || "No se pudo crear la cuenta",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground relative overflow-hidden">
      <Navbar />

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 blur-[100px] rounded-full pointer-events-none" />

      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-card/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl shadow-black/50">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-serif font-bold text-white mb-2">Crear Cuenta</h1>
              <p className="text-white/60">Únete a las salas de bingo más exclusivas</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/80">Usuario</Label>
                <Input
                  id="username"
                  {...form.register("username")}
                  className="bg-black/40 border-white/10 text-white focus-visible:ring-primary h-12"
                  placeholder="Elige un nombre de usuario"
                  autoComplete="username"
                />
                {form.formState.errors.username && (
                  <p className="text-destructive text-sm">{form.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-white/80">Nombre para mostrar (opcional)</Label>
                <Input
                  id="displayName"
                  {...form.register("displayName")}
                  className="bg-black/40 border-white/10 text-white focus-visible:ring-primary h-12"
                  placeholder="Cómo te ven los demás"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  className="bg-black/40 border-white/10 text-white focus-visible:ring-primary h-12"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {form.formState.errors.password && (
                  <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creando cuenta..." : "Registrarme"}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm text-white/60">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-primary hover:text-accent font-medium transition-colors">
                Inicia sesión
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
