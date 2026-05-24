import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { User } from "@workspace/api-client-react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import { auth, authEmailForUsername } from "./firebase";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  registerWithToken: (token: string, user: User) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

setAuthTokenGetter(async () => {
  const current = auth.currentUser;
  if (!current) return null;
  return current.getIdToken();
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasFirebaseUser, setHasFirebaseUser] = useState(!!auth.currentUser);

  const { data: me, isLoading: meLoading, error } = useGetMe({
    query: {
      queryKey: ["/api/auth/me"],
      enabled: authReady && hasFirebaseUser,
      retry: false,
    },
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setHasFirebaseUser(!!firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem("bingo_token");
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (me) {
      setUser(me);
    } else if (error && hasFirebaseUser) {
      void signOut(auth);
      setUser(null);
      localStorage.removeItem("bingo_token");
    }
  }, [me, error, hasFirebaseUser]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("bingo_token", newToken);
    setUser(newUser);
  };

  const loginWithPassword = useCallback(async (username: string, password: string) => {
    const cred = await signInWithEmailAndPassword(
      auth,
      authEmailForUsername(username),
      password,
    );
    const token = await cred.user.getIdToken();
    localStorage.setItem("bingo_token", token);
  }, []);

  const registerWithToken = useCallback(async (customToken: string, newUser: User) => {
    await signInWithCustomToken(auth, customToken);
    const token = await auth.currentUser?.getIdToken();
    if (token) localStorage.setItem("bingo_token", token);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("bingo_token");
    setUser(null);
    void signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: !authReady || (hasFirebaseUser && meLoading),
        login,
        loginWithPassword,
        registerWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
