"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [nicknameMessage, setNicknameMessage] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function normalizeNickname(value: string) {
    return value
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  async function checkNickname() {
    const normalizedNickname = normalizeNickname(nickname);

    if (normalizedNickname.length < 3) {
      setNicknameMessage("Use pelo menos 3 caracteres.");
      return false;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", normalizedNickname)
      .maybeSingle();

    if (error) {
      setNicknameMessage("Não foi possível verificar o nickname.");
      return false;
    }

    if (data) {
      setNicknameMessage("Esse nickname já está em uso.");
      return false;
    }

    setNicknameMessage("Nickname disponível.");
    return true;
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const normalizedNickname = normalizeNickname(nickname);

    const nicknameAvailable = await checkNickname();

    if (!nicknameAvailable) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nickname: normalizedNickname,
        },
        emailRedirectTo: `${window.location.origin}/auth/login`,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "Conta criada. Confira seu e-mail para confirmar o cadastro."
    );

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-[#f4f1e8]">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-4xl font-semibold">
          Criar conta
        </h1>

        <p className="mb-8 text-white/50">
          Escolha seu nome no CurveOut e crie sua conta.
        </p>

        <form
          onSubmit={handleRegister}
          className="flex flex-col gap-5"
        >
          <div>
            <label className="mb-2 block text-sm text-white/60">
              Nickname
            </label>

            <input
              type="text"
              value={nickname}
              onChange={(event) => {
                const value = normalizeNickname(event.target.value);

                setNickname(value);
                setNicknameMessage("");
              }}
              onBlur={checkNickname}
              required
              minLength={3}
              maxLength={20}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-white/30"
              placeholder="seu_nickname"
            />

            <p className="mt-2 text-xs text-white/40">
              3 a 20 caracteres. Letras, números e _.
            </p>

            {nicknameMessage && (
              <p
                className={`mt-2 text-sm ${
                  nicknameMessage === "Nickname disponível."
                    ? "text-green-300"
                    : "text-red-300"
                }`}
              >
                {nicknameMessage}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/60">
              E-mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-white/30"
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
              minLength={6}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-white/30"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-[#f4f1e8] px-5 py-3 font-semibold text-black transition hover:bg-white disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        {message && (
          <p className="mt-5 text-sm text-white/60">
            {message}
          </p>
        )}

        <p className="mt-8 text-sm text-white/45">
          Já tem uma conta?{" "}
          <a
            href="/auth/login"
            className="text-[#f4f1e8] underline underline-offset-4"
          >
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}