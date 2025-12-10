import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages, stats } = await req.json();

    // ✅ Inject today's date
    const todayDate = new Date().toISOString().split("T")[0]; // e.g. "2025-09-02"

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY3}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Smart Medicine Box",
      },
      body: JSON.stringify({
        model: "x-ai/grok-4.1-fast",
        messages: [
          {
            role: "system",
            content: `You are a helpful doctor assistant analyzing patient logs. 
Today's date is ${todayDate}.
Always use this to interpret "today", "yesterday", "this week", and "this month". 
Never guess dates — only use available log data.

Here are the stats:
${JSON.stringify(stats, null, 2)}
            `,
          },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "⚠️ No response from AI.";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("AI Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
