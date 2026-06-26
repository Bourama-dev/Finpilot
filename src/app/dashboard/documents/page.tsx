"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

const ACTIVITIES = [
  { key: "alternance", label: "Alternance", color: "#6366f1", emoji: "🎓" },
  { key: "cle_avenir", label: "CléAvenir",  color: "#f59e0b", emoji: "🏢" },
  { key: "hakily",     label: "Hakily",      color: "#10b981", emoji: "🤖" },
  { key: "personnel",  label: "Personnel",   color: "#ec4899", emoji: "🏠" },
  { key: "freelance",  label: "Freelance",   color: "#0ea5e9", emoji: "💼" },
];

const CATEGORY_SUGGESTIONS = [
  "Loyer", "Courses", "Transport", "Abonnements", "Restaurant", "Santé",
  "Logiciels", "Marketing", "Formation", "Matériel", "Comptabilité",
  "Salaire", "Freelance", "Remboursement", "Prime",
];

type Doc = {
  id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  activity: string | null;
  created_at: string;
};

type ExtractedTx = {
  type: "income" | "expense";
  amount: string;
  currency: string;
  category: string;
  description: string;
  date: string;
  is_recurring: boolean;
  confidence: "high" | "medium" | "low";
};

function fileIcon(type: string) {
  if (type.includes("pdf")) return "📄";
  if (type.includes("image")) return "🖼️";
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "📊";
  if (type.includes("word") || type.includes("document")) return "📝";
  return "📁";
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

const CONFIDENCE_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  high:   { label: "Confiance élevée",   bg: "var(--success-light)", color: "var(--success)" },
  medium: { label: "Confiance moyenne",  bg: "var(--warning-light, #fef3c7)", color: "#d97706" },
  low:    { label: "Confiance faible",   bg: "var(--danger-light)",  color: "var(--danger)"  },
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actFilter, setActFilter] = useState("all");
  const [selectedActivity, setSelectedActivity] = useState("personnel");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const invoiceRef = useRef<HTMLInputElement>(null);

  // Invoice analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedTx | null>(null);
  const [savingTx, setSavingTx] = useState(false);
  const [txSaved, setTxSaved] = useState(false);
  const [txActivity, setTxActivity] = useState("personnel");

  async function load() {
    const { data } = await supabase
      .from("documents")
      .select("id, name, type, size, storage_path, activity, created_at")
      .order("created_at", { ascending: false });
    if (data) setDocs(data as Doc[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function uploadFile(file: File) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadError("Non authentifié"); setUploading(false); return; }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    try {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: false });
      if (storageError) throw storageError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        name: file.name,
        type: file.type,
        size: file.size,
        storage_path: path,
        activity: selectedActivity as any,
      } as any);
      if (dbError) throw dbError;

      await load();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function analyzeInvoice(file: File) {
    setAnalyzing(true);
    setAnalyzeError(null);
    setExtracted(null);
    setTxSaved(false);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/analyze-invoice", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur analyse");
      const d = json.data as ExtractedTx;
      setExtracted({
        type: d.type ?? "expense",
        amount: String(d.amount ?? ""),
        currency: d.currency ?? "EUR",
        category: d.category ?? "",
        description: d.description ?? "",
        date: d.date ?? new Date().toISOString().slice(0, 10),
        is_recurring: false,
        confidence: d.confidence ?? "medium",
      });
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
    } finally {
      setAnalyzing(false);
      if (invoiceRef.current) invoiceRef.current.value = "";
    }
  }

  async function saveTx() {
    if (!extracted) return;
    setSavingTx(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingTx(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: extracted.type,
      activity: txActivity,
      amount: parseFloat(extracted.amount),
      currency: extracted.currency || "EUR",
      category: extracted.category,
      description: extracted.description || null,
      date: extracted.date,
      is_recurring: false,
      recurring_frequency: null,
    } as any);

    setSavingTx(false);
    if (!error) {
      setTxSaved(true);
    }
  }

  async function handleDownload(doc: Doc) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.name;
      a.click();
    }
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Supprimer "${doc.name}" ?`)) return;
    await supabase.storage.from("documents").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  const filtered = actFilter === "all" ? docs : docs.filter(d => d.activity === actFilter);
  const actMap = Object.fromEntries(ACTIVITIES.map(a => [a.key, a]));

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Documents</h1>

      {/* Invoice AI analyzer */}
      <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--accent)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: "var(--accent-light)" }}>🤖</div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Analyser une facture avec IA</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Importez une facture (PDF ou image) — Claude extrait automatiquement les données</p>
          </div>
          <button onClick={() => invoiceRef.current?.click()}
            disabled={analyzing}
            className="ml-auto px-4 py-2 rounded-xl text-white text-sm font-medium shrink-0 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}>
            {analyzing ? "Analyse…" : "Choisir une facture"}
          </button>
          <input ref={invoiceRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) analyzeInvoice(f); }} />
        </div>

        {analyzing && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
            <span className="animate-spin">⏳</span> Lecture de la facture en cours…
          </div>
        )}

        {analyzeError && (
          <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
            {analyzeError}
          </div>
        )}

        {extracted && !txSaved && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Données extraites — vérifiez et confirmez</p>
              {extracted.confidence && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: CONFIDENCE_STYLES[extracted.confidence].bg, color: CONFIDENCE_STYLES[extracted.confidence].color }}>
                  {CONFIDENCE_STYLES[extracted.confidence].label}
                </span>
              )}
            </div>

            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map(t => (
                <button key={t} type="button" onClick={() => setExtracted(ex => ex ? { ...ex, type: t } : ex)}
                  className="py-2 rounded-lg text-sm font-semibold"
                  style={extracted.type === t
                    ? { backgroundColor: t === "income" ? "var(--success)" : "var(--danger)", color: "#fff" }
                    : { ...inputStyle, color: "var(--text-secondary)" }}>
                  {t === "income" ? "↑ Revenu" : "↓ Dépense"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Amount */}
              <div className="relative">
                <input type="number" step="0.01" min="0.01" value={extracted.amount}
                  onChange={e => setExtracted(ex => ex ? { ...ex, amount: e.target.value } : ex)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>€</span>
              </div>
              {/* Date */}
              <input type="date" value={extracted.date}
                onChange={e => setExtracted(ex => ex ? { ...ex, date: e.target.value } : ex)}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Category */}
              <input type="text" list="cat-invoice" placeholder="Catégorie" value={extracted.category}
                onChange={e => setExtracted(ex => ex ? { ...ex, category: e.target.value } : ex)}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <datalist id="cat-invoice">{CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}</datalist>
              {/* Activity */}
              <select value={txActivity} onChange={e => setTxActivity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}>
                {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>)}
              </select>
            </div>

            {/* Description */}
            <input type="text" placeholder="Description" value={extracted.description}
              onChange={e => setExtracted(ex => ex ? { ...ex, description: e.target.value } : ex)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />

            <div className="flex gap-2">
              <button onClick={saveTx} disabled={savingTx || !extracted.amount || !extracted.category}
                className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}>
                {savingTx ? "Enregistrement…" : "✓ Enregistrer la transaction"}
              </button>
              <button onClick={() => setExtracted(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {txSaved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "var(--success-light)", color: "var(--success)" }}>
            ✓ Transaction enregistrée avec succès !
            <button onClick={() => { setExtracted(null); setTxSaved(false); }} className="ml-auto text-xs underline opacity-70">Analyser une autre</button>
          </div>
        )}
      </div>

      {/* Upload zone */}
      <div
        className="rounded-xl p-6 text-center border-2 border-dashed cursor-pointer transition-all"
        style={{
          borderColor: dragging ? "var(--accent)" : "var(--border)",
          backgroundColor: dragging ? "var(--accent-light)" : "var(--bg-secondary)",
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) uploadFile(file);
        }}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
        <div className="text-3xl mb-2">{uploading ? "⏳" : "📤"}</div>
        <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
          {uploading ? "Upload en cours…" : "Archiver un fichier — glissez ici ou cliquez"}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>PDF, images, Excel, Word…</p>
        {!uploading && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Activité :</span>
            <select
              value={selectedActivity}
              onChange={e => { e.stopPropagation(); setSelectedActivity(e.target.value); }}
              onClick={e => e.stopPropagation()}
              className="px-2 py-1 rounded-lg text-xs outline-none"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>)}
            </select>
          </div>
        )}
        {uploadError && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{uploadError}</p>}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setActFilter("all")} className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={actFilter === "all" ? { backgroundColor: "var(--accent)", color: "#fff" } : { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          Tous ({docs.length})
        </button>
        {ACTIVITIES.map(a => {
          const count = docs.filter(d => d.activity === a.key).length;
          if (count === 0) return null;
          return (
            <button key={a.key} onClick={() => setActFilter(a.key)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={actFilter === a.key ? { backgroundColor: a.color, color: "#fff" } : { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {a.emoji} {a.label} ({count})
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center">
          <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center space-y-2" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-4xl">📂</div>
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Aucun document</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Importez vos premiers fichiers ci-dessus.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {filtered.map((doc, i) => {
            const act = actMap[doc.activity ?? ""];
            const color = act?.color ?? "#888";
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5 group"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${color}1a` }}>
                  {fileIcon(doc.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{doc.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {act ? `${act.emoji} ${act.label} · ` : ""}{fileSize(doc.size)} · {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => handleDownload(doc)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "var(--accent)" }} title="Télécharger">⬇️</button>
                  <button onClick={() => handleDelete(doc)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "var(--danger)" }} title="Supprimer">🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
