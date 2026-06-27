import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!req.headers.get("Authorization")) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY non configurée dans les secrets Supabase" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { context } = await req.json();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message ?? "Erreur OpenAI");
    }

    const advice = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ advice }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
