"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const cleanEmail = email.trim();

    setErrorMessage("");

    if (!cleanEmail || !password) {
      setErrorMessage("Preencha o e-mail e a senha.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      console.error("Erro ao entrar:", error);

      setErrorMessage(
        error.message.toLowerCase().includes("invalid login credentials")
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Confira seus dados e tente novamente."
      );

      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-[#f4f1e8]">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight">
          Entrar
        </h1>

        <p className="mt-2 text-sm text-white/45">
          Entre na sua conta CurveOut.
        </p>

        <form onSubmit={handleSubmit} className="mt-9">
          <div>
            <label
              htmlFor="email"
              className="text-sm text-white/65"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              className="
                mt-2
                w-full
                rounded-lg
                border border-white/10
                bg-[#eef3ff]
                px-4 py-4
                text-black
                outline-none
                transition
                focus:border-white/30
                disabled:opacity-60
              "
            />
          </div>

          <div className="mt-6">
            <label
              htmlFor="password"
              className="text-sm text-white/65"
            >
              Senha
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              className="
                mt-2
                w-full
                rounded-lg
                border border-white/10
                bg-[#eef3ff]
                px-4 py-4
                text-black
                outline-none
                transition
                focus:border-white/30
                disabled:opacity-60
              "
            />

            <div className="mt-3 flex justify-end">
              <Link
                href="/auth/esqueci-senha"
                className="
                  text-sm
                  text-white/40
                  underline-offset-4
                  transition
                  hover:text-white
                  hover:underline
                "
              >
                Esqueci minha senha
              </Link>
            </div>
          </div>

          {errorMessage && (
            <p className="mt-4 text-sm text-red-300">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="
              mt-7
              w-full
              rounded-lg
              bg-[#f4f1e8]
              px-5 py-4
              font-semibold
              text-black
              transition
              hover:bg-white
              disabled:cursor-wait
              disabled:opacity-50
            "
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-8 text-sm text-white/40">
          Ainda não tem conta?{" "}
          <Link
            href="/auth/register"
            className="
              text-white
              underline
              underline-offset-4
              transition
              hover:text-white/75
            "
          >
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
