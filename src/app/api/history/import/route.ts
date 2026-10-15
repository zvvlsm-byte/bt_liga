import { NextResponse } from "next/server";
import { fetchHtml, parseHistoricProtocol, protocolIdFromUrl, protocolUrl } from "@/lib/history";
import { saveHistGame, writeHistoryFile } from "@/lib/historyDb";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Импорт одного старого протокола: body { url } или { id }.
 * writeFile=false — для пакетной загрузки (файл-резерв пишется в конце через PUT).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string; id?: number; writeFile?: boolean };
  const id = body.id ?? (body.url ? protocolIdFromUrl(body.url) : null);
  if (!id) return NextResponse.json({ error: "Укажите ссылку вида https://hockey.by/new-admin/games/11575/?print=protocol" }, { status: 400 });
  const url = protocolUrl(id);
  try {
    const html = await fetchHtml(url);
    const parsed = parseHistoricProtocol(html, id, url);
    if (!parsed.players.length) throw new Error("в протоколе нет составов");
    await saveHistGame(parsed, { writeFile: body.writeFile !== false });
    return NextResponse.json({
      ok: true,
      game: {
        extId: id, date: parsed.date, season: parsed.season, competition: parsed.competition,
        homeTeam: parsed.homeTeam, awayTeam: parsed.awayTeam, homeScore: parsed.homeScore, awayScore: parsed.awayScore,
        players: parsed.players.length, goalies: parsed.goalies.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, id, error: e instanceof Error ? e.message : "ошибка" });
  }
}

/** Записать файл-резерв data/history.json (после пакетной загрузки). */
export async function PUT() {
  await writeHistoryFile();
  return NextResponse.json({ ok: true });
}
