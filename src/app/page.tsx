import Link from "next/link";

export default function HomePage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="text-center space-y-6 sm:space-y-8 max-w-2xl w-full">

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
          style={{
            backgroundColor: "var(--accent-light)",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--accent)" }}
          />
          FinPilot Beta
        </div>

        {/* Titre */}
        <div className="space-y-2 sm:space-y-3">
          <h1
            className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-jakarta)" }}
          >
            Pilotez vos finances
          </h1>
          <h1
            className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight"
            style={{ color: "var(--accent)", fontFamily: "var(--font-jakarta)" }}
          >
            avec clarté
          </h1>
        </div>

        {/* Description */}
        <p
          className="text-base sm:text-lg max-w-md mx-auto leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Gérez Alternance, CléAvenir, Hakily et vos finances personnelles
          depuis un seul tableau de bord ultra-visuel.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/auth/register"
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 hover:shadow-lg text-center"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Créer un compte →
          </Link>
          <Link
            href="/auth/login"
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium transition-all hover:opacity-80 text-center"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
            }}
          >
            Se connecter
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[
            { emoji: "🎓", label: "Alternance", color: "#6366f1" },
            { emoji: "🏢", label: "CléAvenir",  color: "#f59e0b" },
            { emoji: "🤖", label: "Hakily",      color: "#10b981" },
            { emoji: "🏠", label: "Personnel",   color: "#ec4899" },
          ].map(({ emoji, label, color }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl"
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: `${color}18` }}
              >
                {emoji}
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {label}
              </span>
              <div
                className="w-full h-1 rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          ))}
        </div>

        {/* Footer link */}
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Déjà un compte ?{" "}
          <Link href="/auth/login" style={{ color: "var(--accent)" }}>
            Se connecter
          </Link>
        </p>

      </div>
    </main>
  );
}
