import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          FinPilot Beta
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-white">
          Pilotez vos finances{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">
            avec clarté
          </span>
        </h1>

        <p className="text-lg text-gray-400">
          Gérez Alternance, CléAvenir, Hakily et vos finances personnelles
          depuis un seul tableau de bord ultra-visuel.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors"
          >
            Commencer
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl glass glass-hover text-gray-300 font-medium"
          >
            Dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}
