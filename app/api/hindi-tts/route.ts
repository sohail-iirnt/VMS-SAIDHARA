import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const text = (request.nextUrl.searchParams.get("text") || "").trim();
  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }
  if (text.length > 180) {
    return NextResponse.json({ error: "Text is too long for one audio segment." }, { status: 413 });
  }

  try {
    const endpoint = new URL("https://translate.google.com/translate_tts");
    endpoint.searchParams.set("ie", "UTF-8");
    endpoint.searchParams.set("client", "tw-ob");
    endpoint.searchParams.set("tl", "hi");
    endpoint.searchParams.set("q", text);

    const upstream = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/",
        "Accept": "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.toLowerCase().includes("audio")) {
      return NextResponse.json({ error: "Hindi speech provider did not return audio." }, { status: 502 });
    }

    const audio = await upstream.arrayBuffer();
    if (!audio.byteLength) {
      return NextResponse.json({ error: "Hindi speech provider returned empty audio." }, { status: 502 });
    }

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, max-age=0",
        "Content-Length": String(audio.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Hindi TTS proxy error:", error);
    return NextResponse.json({ error: "Hindi narration is temporarily unavailable." }, { status: 502 });
  }
}
