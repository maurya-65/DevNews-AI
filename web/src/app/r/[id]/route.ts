import { NextResponse, type NextRequest } from "next/server";
import { recordEvent } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { store } from "@/lib/store";

/** Outbound link: record the open, then send the reader on.
 *
 *  This is how opening an article becomes a reading signal, from the site and from the
 *  email alike. It only ever redirects to the URL stored for that article id, so it cannot
 *  be used as an open redirect to anywhere else.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const home = new URL("/", request.url);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.redirect(home);

  const found = await store().getArticle(id);
  const target = found?.article.url;
  if (!target || !/^https?:\/\//i.test(target)) return NextResponse.redirect(home);

  const user = await currentUser();
  if (user) {
    try {
      await recordEvent(user.id, id, "open");
    } catch {
      // The reader asked for the article, not for bookkeeping. Never block the redirect.
    }
  }

  const response = NextResponse.redirect(target, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
