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
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
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
          toast({ title: "Account created!", description: "Welcome to Bingo OroDig." });
          setLocation("/lobby");
        },
        onError: (error) => {
          toast({ 
            title: "Registration failed", 
            description: error.message || "Could not create account", 
            variant: "destructive" 
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-foreground relative overflow-hidden">
      <Navbar />
      
      {/* Background Decor */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 blur-[100px] rounded-full pointer-events-none" />

      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-card/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl shadow-black/50">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-serif font-bold text-white mb-2">Create Account</h1>
              <p className="text-white/60">Join the most exclusive bingo rooms</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/80">Username</Label>
                <Input 
                  id="username"
                  {...form.register("username")}
                  className="bg-black/40 border-white/10 text-white focus-visible:ring-primary h-12"
                  placeholder="Choose a username"
                />
                {form.formState.errors.username && (
                  <p className="text-destructive text-sm">{form.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-white/80">Display Name (Optional)</Label>
                <Input 
                  id="displayName"
                  {...form.register("displayName")}
                  className="bg-black/40 border-white/10 text-white focus-visible:ring-primary h-12"
                  placeholder="How you appear to others"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">Password</Label>
                <Input 
                  id="password"
                  type="password"
                  {...form.register("password")}
                  className="bg-black/40 border-white/10 text-white focus-visible:ring-primary h-12"
                  placeholder="••••••••"
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
                {registerMutation.isPending ? "Creating Account..." : "Sign Up"}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm text-white/60">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:text-accent font-medium transition-colors">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
