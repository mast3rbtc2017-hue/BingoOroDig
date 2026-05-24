import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loginWithPassword } = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) setLocation("/lobby");
  }, [user, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    setPending(true);
    try {
      await loginWithPassword(data.username, data.password);
      toast({ title: "¡Bienvenido de vuelta!", description: "Sesión iniciada correctamente." });
      setLocation("/lobby");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Credenciales inválidas";
      toast({
        title: "Error al iniciar sesión",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground relative overflow-hidden">
      <Navbar />

      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent/10 blur-[100px] rounded-full pointer-events-none" />

      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-card/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl shadow-black/50">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-serif font-bold text-white mb-2">Bienvenido de Vuelta</h1>
              <p className="text-white/60">Ingresa tus datos para acceder a las salas exclusivas</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/80">Usuario</Label>
                <Input
                  id="username"
                  {...form.register("username")}
                  className="bg-black/40 border-white/10 text-white focus-visible:ring-primary h-12"
                  placeholder="Ingresa tu usuario"
                  autoComplete="username"
                />
                {form.formState.errors.username && (
                  <p className="text-destructive text-sm">{form.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  className="bg-black/40 border-white/10 text-white focus-visible:ring-primary h-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                {form.formState.errors.password && (
                  <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
                disabled={pending}
              >
                {pending ? "Ingresando..." : "Iniciar Sesión"}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm text-white/60">
              ¿No tienes cuenta?{" "}
              <Link href="/register" className="text-primary hover:text-accent font-medium transition-colors">
                Créala ahora
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
