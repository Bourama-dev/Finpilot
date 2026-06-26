export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="text-center space-y-4">
        <div className="text-5xl">🚧</div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Dashboard en construction
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Cette page sera disponible prochainement.
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 rounded-lg text-white font-medium mt-2"
          style={{ backgroundColor: "var(--accent)" }}
        >
          ← Retour
        </a>
      </div>
    </main>
  );
}
