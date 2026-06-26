"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
          data: { full_name: fullName },
        },
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur avec Google. Réessayez.");
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-1">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-white text-xl font-bold mb-2"
            style={{ backgroundColor: "var(--accent)" }}
          >
            F
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            FinPilot
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Créez votre compte gratuitement
          </p>
        </div>

        {sent ? (
          <div
            className="rounded-xl p-6 text-center space-y-3"
            style={{
              backgroundColor: "var(--success-light)",
              border: "1px solid var(--success)",
            }}
          >
            <p className="text-2xl">✉️</p>
            <p className="font-semibold" style={{ color: "var(--success)" }}>
              Lien envoyé !
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Vérifiez <strong>{email}</strong> et cliquez sur le lien pour activer votre compte.
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Pensez à vérifier vos spams.
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl p-6 space-y-4"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h2 className="text-base font-semibold text-center" style={{ color: "var(--text-primary)" }}>
              Créer un compte
            </h2>

            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm text-center"
                style={{
                  backgroundColor: "var(--danger-light)",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleMagicLink} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Prénom et nom
                </label>
                <input
                  type="text"
                  placeholder="Jean Dupont"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-50 mt-1"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {loading ? "Envoi en cours…" : "Créer mon compte →"}
              </button>
            </form>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>ou</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuer avec Google
            </button>

            <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
              Déjà un compte ?{" "}
              <Link href="/auth/login" style={{ color: "var(--accent)" }}>
                Se connecter
              </Link>
            </p>
          </div>
        )}

        <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/" style={{ color: "var(--accent)" }}>← Retour à l&apos;accueil</Link>
        </p>
      </div>
    </main>
  );
}
