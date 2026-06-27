import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY non configurée dans .env.local" },
      { status: 503 },
    );
  }

  try {
    const { context } = await req.json();

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "Tu es un conseiller financier expert pour micro-entrepreneurs français (régime BNC). Tu fournis des conseils concrets, personnalisés et actionnables.",
        },
        {
          role: "user",
          content: `Voici la situation financière de l'utilisateur pour ${context.periode} :
${JSON.stringify(context, null, 2)}

Fournis 4 à 6 recommandations concrètes et personnalisées en français.
- Sois direct et basé sur les chiffres exacts fournis
- Titre court (une ligne) + explication de 1-2 phrases, séparés par ":"
- Priorise : trésorerie > créances > URSSAF > épargne > achats
- Adapte au profil micro-entrepreneur (cotisations URSSAF trimestrielles, facturation B2B, etc.)
- Ne répète pas les chiffres bruts dans l'intro, va directement aux conseils
- Utilise des tirets (- ) pour chaque recommandation`,
        },
      ],
    });

    const advice = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ advice });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
