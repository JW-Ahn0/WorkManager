import Link from "next/link";

import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export default async function WorklogPage() {
  const entries = await prisma.worklogEntry.findMany({
    orderBy: { date: "desc" },
    take: 30,
  });

  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 font-sans">
      <main className="w-full max-w-3xl px-6 py-10">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">업무일지</h1>
            <p className="text-sm text-zinc-600">최근 30개 엔트리를 표시합니다.</p>
          </div>
          <Link className="text-sm text-zinc-700 underline" href="/">
            메모 입력으로
          </Link>
        </header>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            아직 업무일지가 없어요. 메모를 한 번 정리해보세요.
          </div>
        ) : (
          <div className="grid gap-4">
            {entries.map((e) => (
              <section key={e.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">
                    {e.date}
                    {e.project ? ` / ${e.project}` : ""}
                  </div>
                </div>
                <pre className="whitespace-pre-wrap break-words rounded-md bg-zinc-50 p-3 text-xs text-zinc-800">
                  {e.contentMd}
                </pre>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

