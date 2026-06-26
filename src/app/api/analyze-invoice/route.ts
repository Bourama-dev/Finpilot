import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'extraction de données de factures et reçus financiers.
Analyse le document fourni et extrait les informations financières.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaires.`;

const USER_PROMPT = `Analyse cette facture/reçu et extrait les données financières.

Retourne un objet JSON avec exactement ces champs :
{
  "type": "income" ou "expense",
  "amount": nombre positif (montant TTC en EUR),
  "currency": "EUR" ou autre devise si visible,
  "category": catégorie courte (ex: "Loyer", "Courses", "Logiciels", "Transport", "Salaire", "Freelance"...),
  "description": description brève (fournisseur + objet),
  "date": "YYYY-MM-DD" (date de la facture, ou null si non visible),
  "is_recurring": false,
  "confidence": "high" | "medium" | "low"
}

Si le document est une facture de dépense (achat, abonnement, prestation reçue) → type = "expense".
Si c'est un reçu de paiement entrant, virement reçu, facture émise → type = "income".
Si le montant est ambigu, utilise le montant TTC total.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurée. Ajoutez-la dans votre fichier .env.local." },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const isPDF   = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");

    if (!isPDF && !isImage) {
      return NextResponse.json(
        { error: "Format non supporté. Utilisez une image (JPEG, PNG, WEBP) ou un PDF." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
      | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

    const content: ContentBlock[] = [];

    if (isPDF) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
    } else {
      const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    }

    content.push({ type: "text", text: USER_PROMPT });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: content as any }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Réponse non structurée de Claude");
      parsed = JSON.parse(match[0]);
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
