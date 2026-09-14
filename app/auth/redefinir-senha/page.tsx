"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function RedefinirSenhaPage() {
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function prepare() {
      try {
        const search = new URLSearchParams(window.location.search);
        const code = search.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão de recuperação não encontrada.");
        if (!cancelled) setReady(true);
      } catch (error) {
        console.error("Erro ao preparar redefinição:", error);
        if (!cancelled) setErrorMessage("Este link é inválido ou expirou. Solicite um novo link.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void prepare();
    return () => { cancelled = true; };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setErrorMessage("A nova senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirmPassword) return setErrorMessage("As duas senhas não são iguais.");
    setSaving(true); setErrorMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setErrorMessage("Não foi possível alterar sua senha."); setSaving(false); return; }
    setSuccess(true); setSaving(false);
  }

  if (checking) return <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-[#f4f1e8]"><p className="text-sm text-white/40">Verificando link...</p></main>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-[#f4f1e8]">
      <div className="w-full max-w-md">
        {success ? (
          <><h1 className="text-4xl font-semibold">Senha alterada</h1><p className="mt-3 text-white/45">Sua nova senha foi salva.</p><Link href="/auth/login" className="mt-8 flex w-full items-center justify-center rounded-lg bg-[#f4f1e8] px-5 py-4 font-semibold text-black">Ir para entrar</Link></>
        ) : ready ? (
          <><h1 className="text-4xl font-semibold">Nova senha</h1><p className="mt-2 text-sm text-white/45">Escolha uma nova senha para sua conta.</p><form onSubmit={handleSubmit} className="mt-9 space-y-5"><div><label htmlFor="password" className="text-sm text-white/65">Nova senha</label><input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#eef3ff] px-4 py-4 text-black outline-none" /></div><div><label htmlFor="confirm-password" className="text-sm text-white/65">Repetir nova senha</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#eef3ff] px-4 py-4 text-black outline-none" /></div>{errorMessage && <p className="text-sm text-red-300">{errorMessage}</p>}<button type="submit" disabled={saving} className="w-full rounded-lg bg-[#f4f1e8] px-5 py-4 font-semibold text-black disabled:opacity-50">{saving ? "Salvando..." : "Salvar nova senha"}</button></form></>
        ) : (
          <><h1 className="text-4xl font-semibold">Link inválido</h1><p className="mt-3 text-red-200/60">{errorMessage}</p><Link href="/auth/esqueci-senha" className="mt-8 inline-block text-sm underline underline-offset-4">Solicitar novo link</Link></>
        )}
      </div>
    </main>
  );
}
