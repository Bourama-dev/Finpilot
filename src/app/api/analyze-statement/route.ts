import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'extraction de données de relevés bancaires.
Analyse le document fourni (relevé de compte bancaire) et extrait TOUTES les opérations qui y figurent.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaires, sans texte avant ou après.`;

const USER_PROMPT = `Analyse ce relevé bancaire et extrait chaque opération (ligne de mouvement) qu'il contient.

Ignore les lignes qui ne sont pas des opérations (solde précédent, solde nouveau, totaux, en-têtes, numéro de compte...).

Retourne un objet JSON avec exactement ce format :
{
  "transactions": [
    {
      "type": "income" ou "expense",
      "amount": nombre positif (valeur absolue du montant en EUR),
      "category": catégorie courte en français (ex: "Loyer", "Courses", "Transport", "Abonnements", "Restaurant", "Santé", "Salaire", "Virement", "Autre"...),
      "description": libellé de l'opération, nettoyé et raccourci (commerçant / origine),
      "date": "YYYY-MM-DD"
    }
  ]
}

Règles :
- Un débit / retrait / paiement / prélèvement → "type": "expense".
- Un crédit / virement reçu / salaire / remboursement → "type": "income".
- "amount" est toujours positif, quel que soit le type.
- Si une date n'a pas d'année visible, déduis-la du contexte du relevé (période du relevé).
- Choisis une catégorie cohérente et réutilise la même catégorie pour des opérations similaires.
- N'invente aucune opération : n'extrait que ce qui est réellement visible sur le document.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY non configurée. Ajoutez-la dans votre fichier .env.local." },
      { status: 503 }
    );
  }

  const client = new OpenAI({ apiKey });

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentPart: any = isPDF
      ? { type: "input_file", filename: file.name || "releve.pdf", file_data: `data:application/pdf;base64,${base64}` }
      : { type: "input_image", image_url: `data:${file.type};base64,${base64}` };

    const response = await client.responses.create({
      model: "gpt-4o",
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [{ type: "input_text", text: USER_PROMPT }, contentPart] as any,
        },
      ],
      text: { format: { type: "json_object" } },
      max_output_tokens: 8000,
    });

    const raw = response.output_text.trim();

    let parsed: { transactions?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Réponse non structurée du modèle");
      parsed = JSON.parse(match[0]);
    }

    const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    return NextResponse.json({ ok: true, data: transactions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
