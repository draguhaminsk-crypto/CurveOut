"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { createClient } from "../../lib/supabase/client";

type Profile = {
  id: string;
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

type Preferences = {
  discoverable: boolean;
  default_deck_public: boolean;
};

function formatAccountDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function SettingsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [accountCreatedAt, setAccountCreatedAt] =
    useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");

  const [discoverable, setDiscoverable] = useState(true);
  const [defaultDeckPublic, setDefaultDeckPublic] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(true);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, nickname, bio, avatar_url, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError || !profileData) {
        console.error("Erro ao carregar configurações:", profileError);
        setGlobalError("Não foi possível carregar suas configurações.");
        setLoading(false);
        return;
      }

      const { data: preferencesData, error: preferencesError } =
        await supabase
          .from("profiles")
          .select("discoverable, default_deck_public")
          .eq("id", user.id)
          .maybeSingle();

      if (cancelled) return;

      setUserId(user.id);
      setEmail(user.email ?? "");
      setNewEmail(user.email ?? "");
      setAccountCreatedAt(
        user.created_at ?? profileData.created_at ?? null
      );

      const loadedProfile = profileData as Profile;

      setProfile(loadedProfile);
      setNickname(loadedProfile.nickname ?? "");
      setBio(loadedProfile.bio ?? "");

      if (preferencesError || !preferencesData) {
        console.warn(
          "Preferências extras ainda não disponíveis:",
          preferencesError?.message
        );
        setPreferencesReady(false);
      } else {
        const loadedPreferences = preferencesData as Preferences;
        setDiscoverable(loadedPreferences.discoverable ?? true);
        setDefaultDeckPublic(
          loadedPreferences.default_deck_public ?? true
        );
      }

      setLoading(false);
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  async function saveProfile() {
    if (!userId || !profile || savingProfile) return;

    const cleanNickname = nickname.trim();
    const cleanBio = bio.trim();

    setProfileMessage("");
    setGlobalError("");

    if (cleanNickname.length < 2 || cleanNickname.length > 30) {
      setProfileMessage(
        "O nickname precisa ter entre 2 e 30 caracteres."
      );
      return;
    }

    setSavingProfile(true);

    const { data: existingProfiles, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("nickname", cleanNickname)
      .neq("id", userId)
      .limit(1);

    if (checkError) {
      setProfileMessage("Não foi possível validar o nickname.");
      setSavingProfile(false);
      return;
    }

    if ((existingProfiles ?? []).length > 0) {
      setProfileMessage("Esse nickname já está sendo usado.");
      setSavingProfile(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        nickname: cleanNickname,
        bio: cleanBio || null,
      })
      .eq("id", userId);

    if (error) {
      console.error("Erro ao salvar perfil:", error);
      setProfileMessage("Não foi possível salvar o perfil.");
      setSavingProfile(false);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            nickname: cleanNickname,
            bio: cleanBio || null,
          }
        : current
    );

    setNickname(cleanNickname);
    setBio(cleanBio);
    setProfileMessage("Perfil atualizado.");
    setSavingProfile(false);
    router.refresh();
  }

  async function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || !userId || uploadingAvatar) return;

    setProfileMessage("");

    if (!file.type.startsWith("image/")) {
      setProfileMessage("Escolha um arquivo de imagem.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage("A imagem deve ter no máximo 2 MB.");
      event.target.value = "";
      return;
    }

    setUploadingAvatar(true);

    const filePath = `${userId}/avatar`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Erro ao enviar avatar:", uploadError);
      setProfileMessage("Não foi possível enviar a foto.");
      setUploadingAvatar(false);
      event.target.value = "";
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);

    if (profileError) {
      setProfileMessage("A foto foi enviada, mas não pôde ser salva.");
      setUploadingAvatar(false);
      event.target.value = "";
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            avatar_url: avatarUrl,
          }
        : current
    );

    setProfileMessage("Foto atualizada.");
    setUploadingAvatar(false);
    event.target.value = "";
    router.refresh();
  }

  async function savePreferences() {
    if (!userId || savingPreferences) return;

    setPreferencesMessage("");

    if (!preferencesReady) {
      setPreferencesMessage(
        "Rode primeiro o SQL de configurações no Supabase."
      );
      return;
    }

    setSavingPreferences(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        discoverable,
        default_deck_public: defaultDeckPublic,
      })
      .eq("id", userId);

    if (error) {
      console.error("Erro ao salvar preferências:", error);
      setPreferencesMessage(
        "Não foi possível salvar as preferências."
      );
      setSavingPreferences(false);
      return;
    }

    setPreferencesMessage("Preferências salvas.");
    setSavingPreferences(false);
  }

  async function changeEmail() {
    const cleanEmail = newEmail.trim();

    if (!cleanEmail || savingEmail) return;

    setAccountMessage("");

    if (cleanEmail === email) {
      setAccountMessage("Esse já é o e-mail atual da conta.");
      return;
    }

    setSavingEmail(true);

    const { error } = await supabase.auth.updateUser({
      email: cleanEmail,
    });

    if (error) {
      console.error("Erro ao alterar e-mail:", error);
      setAccountMessage(error.message);
      setSavingEmail(false);
      return;
    }

    setAccountMessage(
      "Solicitação enviada. Confirme a alteração pelo e-mail recebido."
    );
    setSavingEmail(false);
  }

  async function changePassword() {
    if (savingPassword) return;

    setAccountMessage("");

    if (newPassword.length < 8) {
      setAccountMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setAccountMessage("As duas senhas não coincidem.");
      return;
    }

    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("Erro ao alterar senha:", error);
      setAccountMessage(error.message);
      setSavingPassword(false);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setAccountMessage("Senha alterada com sucesso.");
    setSavingPassword(false);
  }

  async function copyProfileLink() {
    if (!profile?.nickname) return;

    const url = `${window.location.origin}/perfil/${encodeURIComponent(
      profile.nickname
    )}`;

    try {
      await navigator.clipboard.writeText(url);
      setProfileMessage("Link do perfil copiado.");
    } catch {
      setProfileMessage("Não foi possível copiar o link.");
    }
  }

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setGlobalError("Não foi possível sair da conta.");
      setSigningOut(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] text-white/35">
        Carregando configurações...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6 text-center text-white/40">
        {globalError || "Não foi possível carregar sua conta."}
      </main>
    );
  }

  const initial =
    profile.nickname?.charAt(0).toUpperCase() || "?";

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-5 py-10 text-[#f4f1e8] md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/perfil"
          className="text-sm text-white/35 transition hover:text-white"
        >
          ← Perfil
        </Link>

        <div className="mt-10">
          <p className="text-xs uppercase tracking-[0.26em] text-[#c8b27a]/55">
            Conta CurveOut
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            Configurações
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/35">
            Gerencie seu perfil, sua conta e as preferências usadas
            pelo CurveOut.
          </p>
        </div>

        {globalError && (
          <p className="mt-6 rounded-xl border border-red-300/10 bg-red-300/[0.035] px-4 py-3 text-sm text-red-100/60">
            {globalError}
          </p>
        )}

        {!preferencesReady && (
          <p className="mt-6 rounded-xl border border-amber-300/10 bg-amber-300/[0.035] px-4 py-3 text-sm text-amber-100/55">
            As preferências novas ainda não existem no banco. Rode o
            arquivo SQL que acompanha esta página para ativá-las.
          </p>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <nav className="space-y-1">
              <SettingsNav href="#perfil">Perfil</SettingsNav>
              <SettingsNav href="#privacidade">Privacidade</SettingsNav>
              <SettingsNav href="#decks">Decks</SettingsNav>
              <SettingsNav href="#conta">Conta</SettingsNav>
              <SettingsNav href="#atalhos">Atalhos</SettingsNav>
              <SettingsNav href="#sessao">Sessão</SettingsNav>
            </nav>
          </aside>

          <div className="min-w-0 space-y-6">
            <SettingsSection
              id="perfil"
              eyebrow="Identidade"
              title="Perfil"
              description="Essas informações aparecem no seu perfil público."
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#f4f1e8] text-2xl font-semibold text-black transition hover:border-white/35"
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`Avatar de @${profile.nickname}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initial
                  )}

                  <span className="absolute inset-0 flex items-center justify-center bg-black/65 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                    {uploadingAvatar ? "Enviando..." : "Trocar"}
                  </span>
                </button>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />

                <div>
                  <p className="text-sm font-medium text-white/70">
                    Foto do perfil
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/25">
                    JPG, PNG ou WEBP. Máximo de 2 MB.
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-5">
                <Field
                  label="Nickname"
                  description="Também faz parte do endereço do seu perfil público."
                >
                  <input
                    type="text"
                    value={nickname}
                    maxLength={30}
                    onChange={(event) =>
                      setNickname(event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Bio"
                  description={`${bio.length}/220 caracteres`}
                >
                  <textarea
                    value={bio}
                    maxLength={220}
                    rows={4}
                    onChange={(event) => setBio(event.target.value)}
                    className={`${inputClass} resize-none leading-6`}
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={() => void saveProfile()}
                    className={primaryButtonClass}
                  >
                    {savingProfile
                      ? "Salvando..."
                      : "Salvar perfil"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyProfileLink()}
                    className={secondaryButtonClass}
                  >
                    Copiar link do perfil
                  </button>

                  <Link
                    href={`/perfil/${encodeURIComponent(
                      profile.nickname
                    )}`}
                    className={secondaryButtonClass}
                  >
                    Ver perfil público
                  </Link>
                </div>

                {profileMessage && (
                  <StatusMessage>{profileMessage}</StatusMessage>
                )}
              </div>
            </SettingsSection>

            <SettingsSection
              id="privacidade"
              eyebrow="Comunidade"
              title="Privacidade"
              description="Controle como outros jogadores encontram sua conta."
            >
              <SettingToggle
                title="Aparecer em Encontrar jogadores"
                description="Quando desligado, seu perfil deixa de aparecer na página de busca de usuários. Quem tiver seu link ainda poderá abrir o perfil."
                checked={discoverable}
                onChange={setDiscoverable}
                disabled={!preferencesReady}
              />

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  disabled={savingPreferences || !preferencesReady}
                  onClick={() => void savePreferences()}
                  className={primaryButtonClass}
                >
                  {savingPreferences
                    ? "Salvando..."
                    : "Salvar privacidade"}
                </button>
              </div>

              {preferencesMessage && (
                <StatusMessage>{preferencesMessage}</StatusMessage>
              )}
            </SettingsSection>

            <SettingsSection
              id="decks"
              eyebrow="Deckbuilding"
              title="Novos decks"
              description="Defina o comportamento padrão ao criar um deck."
            >
              <SettingToggle
                title="Criar decks como públicos"
                description={
                  defaultDeckPublic
                    ? "Novos decks começarão como públicos. Você ainda pode mudar isso durante a criação."
                    : "Novos decks começarão como privados. Você ainda pode mudar isso durante a criação."
                }
                checked={defaultDeckPublic}
                onChange={setDefaultDeckPublic}
                disabled={!preferencesReady}
              />

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  disabled={savingPreferences || !preferencesReady}
                  onClick={() => void savePreferences()}
                  className={primaryButtonClass}
                >
                  {savingPreferences
                    ? "Salvando..."
                    : "Salvar preferência"}
                </button>

                <Link
                  href="/decks/novo"
                  className={secondaryButtonClass}
                >
                  Criar deck
                </Link>
              </div>
            </SettingsSection>

            <SettingsSection
              id="conta"
              eyebrow="Segurança"
              title="Conta"
              description="Gerencie seu e-mail e sua senha de acesso."
            >
              <div className="grid gap-5">
                <Field
                  label="E-mail"
                  description={`E-mail atual: ${email || "—"}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(event) =>
                        setNewEmail(event.target.value)
                      }
                      className={`${inputClass} flex-1`}
                    />

                    <button
                      type="button"
                      disabled={savingEmail}
                      onClick={() => void changeEmail()}
                      className={secondaryButtonClass}
                    >
                      {savingEmail
                        ? "Enviando..."
                        : "Alterar e-mail"}
                    </button>
                  </div>
                </Field>

                <div className="border-t border-white/[0.07] pt-6">
                  <p className="text-sm font-medium text-white/65">
                    Alterar senha
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input
                      type="password"
                      value={newPassword}
                      autoComplete="new-password"
                      placeholder="Nova senha"
                      onChange={(event) =>
                        setNewPassword(event.target.value)
                      }
                      className={inputClass}
                    />

                    <input
                      type="password"
                      value={confirmPassword}
                      autoComplete="new-password"
                      placeholder="Repetir nova senha"
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      className={inputClass}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={savingPassword}
                    onClick={() => void changePassword()}
                    className={`mt-3 ${secondaryButtonClass}`}
                  >
                    {savingPassword
                      ? "Alterando..."
                      : "Alterar senha"}
                  </button>
                </div>

                <div className="border-t border-white/[0.07] pt-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoCard
                      label="Conta criada em"
                      value={formatAccountDate(accountCreatedAt)}
                    />
                    <InfoCard
                      label="ID da conta"
                      value={
                        userId
                          ? `${userId.slice(0, 8)}…${userId.slice(-4)}`
                          : "—"
                      }
                    />
                  </div>
                </div>

                {accountMessage && (
                  <StatusMessage>{accountMessage}</StatusMessage>
                )}
              </div>
            </SettingsSection>

            <SettingsSection
              id="atalhos"
              eyebrow="Gerenciar"
              title="Sua conta no CurveOut"
              description="Acesse rapidamente as áreas ligadas à sua conta."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ShortcutCard
                  href="/perfil/carta-favorita"
                  title="Carta favorita"
                  description="Escolher a carta que representa seu perfil."
                />
                <ShortcutCard
                  href="/usuarios"
                  title="Encontrar jogadores"
                  description="Buscar perfis e seguir outros jogadores."
                />
                <ShortcutCard
                  href="/meus-decks"
                  title="Meus decks"
                  description="Gerenciar seus decks e coleções de decks."
                />
                <ShortcutCard
                  href="/colecao"
                  title="Minha coleção"
                  description="Gerenciar cartas físicas e listas de desejos."
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="sessao"
              eyebrow="Sessão"
              title="Sair da conta"
              description="Encerra sua sessão atual neste navegador."
            >
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void signOut()}
                className="rounded-xl border border-red-300/15 px-4 py-2.5 text-sm text-red-100/55 transition hover:border-red-300/30 hover:bg-red-300/[0.04] hover:text-red-100/80 disabled:opacity-40"
              >
                {signingOut ? "Saindo..." : "Sair da conta"}
              </button>
            </SettingsSection>
          </div>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0d0d10] px-4 py-3 text-sm text-white/70 outline-none transition placeholder:text-white/18 focus:border-white/25";

const primaryButtonClass =
  "rounded-xl bg-[#f4f1e8] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-wait disabled:opacity-40";

const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/45 transition hover:border-white/25 hover:bg-white/[0.025] hover:text-white/70 disabled:cursor-wait disabled:opacity-40";

function SettingsNav({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="block rounded-lg px-3 py-2.5 text-sm text-white/35 transition hover:bg-white/[0.035] hover:text-white/70"
    >
      {children}
    </a>
  );
}

function SettingsSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 rounded-2xl border border-white/10 bg-white/[0.015] p-5 md:p-7"
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#c8b27a]/45">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/30">
        {description}
      </p>

      <div className="mt-7">{children}</div>
    </section>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <label className="text-sm font-medium text-white/60">
          {label}
        </label>

        {description && (
          <span className="text-[11px] text-white/20">
            {description}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-white/65">{title}</p>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-white/25">
          {description}
        </p>
      </div>

      <button
        type="button"
        disabled={disabled}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative h-6 w-11 shrink-0 rounded-full border transition
          disabled:cursor-not-allowed disabled:opacity-35
          ${
            checked
              ? "border-[#c8b27a]/35 bg-[#c8b27a]/25"
              : "border-white/10 bg-white/[0.04]"
          }
        `}
      >
        <span
          className={`
            absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition
            ${
              checked
                ? "left-[22px] bg-[#f4e7c5]"
                : "left-[3px] bg-white/35"
            }
          `}
        />
      </button>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/10 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/20">
        {label}
      </p>
      <p className="mt-2 truncate text-sm text-white/55">{value}</p>
    </div>
  );
}

function ShortcutCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-white/[0.07] bg-black/10 p-4 transition hover:border-white/15 hover:bg-white/[0.025]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white/60 transition group-hover:text-white/80">
          {title}
        </p>
        <span className="text-xs text-white/15 transition group-hover:text-white/45">
          →
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-white/25">
        {description}
      </p>
    </Link>
  );
}

function StatusMessage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="mt-4 text-xs text-white/35">{children}</p>
  );
}
