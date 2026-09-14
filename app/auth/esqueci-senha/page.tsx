"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function EsqueciSenhaPage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Digite seu e-mail.");
      return;
    }

    setSending(true);
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/auth/redefinir-senha`,
    });

    if (error) {
      console.error("Erro ao solicitar recuperação de senha:", error);
      setErrorMessage("Não foi possível enviar o e-mail de recuperação. Tente novamente.");
      setSending(false);
      return;
    }

    setMessage("Se existir uma conta com esse e-mail, você receberá um link para redefinir sua senha.");
    setSending(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-[#f4f1e8]">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-semibold">Recuperar senha</h1>
        <p className="mt-2 text-sm text-white/45">Digite o e-mail da sua conta CurveOut.</p>
        <form onSubmit={handleSubmit} className="mt-9">
          <label htmlFor="email" className="text-sm text-white/65">E-mail</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#eef3ff] px-4 py-4 text-black outline-none focus:border-white/30" />
          {errorMessage && <p className="mt-4 text-sm text-red-300">{errorMessage}</p>}
          {message && <p className="mt-4 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.04] px-4 py-3 text-sm leading-6 text-emerald-100/65">{message}</p>}
          <button type="submit" disabled={sending} className="mt-7 w-full rounded-lg bg-[#f4f1e8] px-5 py-4 font-semibold text-black transition hover:bg-white disabled:opacity-50">{sending ? "Enviando..." : "Enviar link de recuperação"}</button>
        </form>
        <p className="mt-8 text-sm text-white/40">Lembrou sua senha? <Link href="/auth/login" className="text-white underline underline-offset-4">Voltar para entrar</Link></p>
      </div>
    </main>
  );
}
