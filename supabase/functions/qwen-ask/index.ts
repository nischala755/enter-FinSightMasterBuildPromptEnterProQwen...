// FinSight — Qwen reasoning layer (backend function).
// The frontend sends pre-computed evidence/metrics; this function only explains
// them. It never computes financial numbers. If Qwen is unreachable the
// frontend falls back to deterministic templates — the app keeps working.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
};

const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_8b3dc5714976");
const AI_BASE_URL = "https://api.enter.pro";
const PROJECT_ID = "8b3dc57149764cacba7d467d15383b5a";
const MODEL = "alibaba/qwen-3.6-plus";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!AI_API_TOKEN) {
      throw new Error("AI_API_TOKEN is not configured");
    }

    const body = await req.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      return new Response(
        JSON.stringify({ error: { message: "question is required", type: "invalid_request_error" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const context = {
      question,
      metrics: Array.isArray(body.metrics) ? body.metrics.slice(0, 12) : [],
      evidence: Array.isArray(body.evidence) ? body.evidence.slice(0, 20) : [],
      state: typeof body.state === "object" && body.state ? body.state : {},
    };

    const system =
      "You are FinSight's senior financial analyst for Northstar Commerce (INR). " +
      "Answer the question using ONLY the supplied context. Rules: " +
      "1) Explain the numbers you are handed; never invent, estimate or round figures absent from the context. " +
      "2) Cite only the evidence IDs provided; never fabricate invoice/vendor/PO/loan IDs. " +
      "3) If the context is insufficient to answer, say so explicitly instead of guessing. " +
      "4) Keep the answer under 180 words, plain language, finance-terminal tone.";

    const upstream = await fetch(`${AI_BASE_URL}/code/api/v1/ai/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
        "X-Session-ID": crypto.randomUUID(),
        "X-Enter-Project-ID": PROJECT_ID,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(context, null, 2) },
        ],
        stream: false,
        temperature: 0.2,
        max_tokens: 900,
      }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      let message = "AI service error";
      try {
        const parsed = JSON.parse(text);
        message = parsed?.error?.message || message;
      } catch {
        // fall through with default
      }
      return new Response(
        JSON.stringify({ error: { message, type: "upstream" } }),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = JSON.parse(text);
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error("empty AI response");
    }

    return new Response(
      JSON.stringify({ ok: true, answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: error.message || "Service error", type: "api_error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
