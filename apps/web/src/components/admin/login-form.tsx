"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Invalid password");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Login</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to manage kiosk events</p>
          </div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/login", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        if (!data.authenticated) {
          router.replace("/admin/login");
        } else {
          setReady(true);
        }
      })
      .catch(() => setError("Could not verify session. Check that the server is running."));
  }, [router]);

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  if (!ready) {
    return <div className="p-8 text-slate-500">Loading...</div>;
  }

  return <>{children}</>;
}
