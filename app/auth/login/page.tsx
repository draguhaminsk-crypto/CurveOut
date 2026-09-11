"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  
  // ✅ CORRIGIDO: Usar useRef para evitar recrear o cliente
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();

    // ✅ CORRIGIDO: Prevenir múltiplos cliques
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage("E-mail ou senha inválidos.");
        setLoading(false);
        return;
      }

      // ✅ CORRIGIDO: Esperar um pouco antes de redirecionar
      // Garante que o auth state é sincronizado
      await new Promise((resolve) => setTimeout(resolve, 500));

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Erro ao fazer login:", err);
      setMessage("Ocorreu um erro. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-[#f4f1e8]">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-4xl font-semibold">
          Entrar
        </h1>

        <p className="mb-8 text-white/50">
          Entre na sua conta CurveOut.
        </p>

        <form
          onSubmit={handleLogin}
          className="flex flex-col gap-5"
        >
          <div>
            <label className="mb-2 block text-sm text-white/60">
              E-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-white/30 disabled:opacity-50"
              placeholder="voce@email.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              Senha
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-white/30 disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-[#f4f1e8] px-5 py-3 font-semibold text-black transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {message && (
          <p className="mt-5 text-sm text-red-300">
            {message}
          </p>
        )}

        <p className="mt-8 text-sm text-white/45">
          Ainda não tem conta?{" "}
          <a
            href="/auth/register"
            className="text-[#f4f1e8] underline underline-offset-4"
          >
            Criar conta
          </a>
        </p>
      </div>
    </main>
  );
}