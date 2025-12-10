import { NextResponse } from "next/server";

export async function GET() {
  // Log in terminal to check if the API key is loaded
  console.log("🔑 OPENROUTER_API_KEY loaded?", process.env.OPENROUTER_API_KEY ? "✅ yes" : "❌ no");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000", // change to your deployed site if needed
        "X-Title": "Smart Medicine Box",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3.1:free",
        messages: [
          { role: "user", content: "Hello! Can you confirm my OpenRouter setup works?" }
        ],
      }),
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      reply: data.choices?.[0]?.message?.content || "No reply",
    });
  } catch (error) {
    console.error("❌ Test route error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
