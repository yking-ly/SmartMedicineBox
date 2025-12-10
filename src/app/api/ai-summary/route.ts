import { NextResponse } from "next/server";

// Utility: normalize any date string into "2 September 2025"
function normalizeDate(dateStr: string) {
  let parsed: Date | null = null;

  // Try direct parse
  const tryDate = new Date(dateStr);
  if (!isNaN(tryDate.getTime())) {
    parsed = tryDate;
  } else {
    // If not ISO, try splitting manually (dd/mm/yyyy or mm/dd/yyyy)
    const parts = dateStr.split(/[\/\-]/).map(Number);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      // Assume yyyy-mm-dd if first part has 4 digits
      if (String(a).length === 4) parsed = new Date(a, b - 1, c);
      // Assume dd-mm-yyyy or dd/mm/yyyy
      else if (String(c).length === 4) parsed = new Date(c, b - 1, a);
    }
  }

  return parsed
    ? parsed.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : dateStr; // fallback to original if unparseable
}

export async function POST(req: Request) {
  const rawStats = await req.json();

  let patchedStats = { ...rawStats };

  if (rawStats.dailyBreakdown && typeof rawStats.dailyBreakdown === "object") {
    patchedStats.dailyBreakdown = Object.entries(rawStats.dailyBreakdown).map(
      ([date, counts]: [string, any]) => {
        const formattedDate = normalizeDate(date);
        return { date: formattedDate, ...counts };
      }
    );
  }

  console.log("📊 Patched stats being sent to OpenRouter:", patchedStats);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY3}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Smart Medicine Box",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "x-ai/grok-4.1-fast",
        messages: [
          {
            role: "system",
            content:
              "You are a medical assistant summarizing patient logs for doctors. Always keep the provided dates exactly as written.",
          },
          {
            role: "user",
            content: `Summarize this patient log data:\n${JSON.stringify(
              patchedStats,
              null,
              2
            )}`,
          },
        ],
      }),
    });

    const data = await response.json();

    return NextResponse.json({
      summary: data.choices?.[0]?.message?.content || "No summary generated.",
      patchedStats,
    });
  } catch (error) {
    console.error("AI Summary error:", error);
    return NextResponse.json(
      { summary: "Failed to fetch AI summary.", error: String(error), patchedStats },
      { status: 500 }
    );
  }
}
