import Link from "next/link";

import { MemoForm } from "@/components/MemoForm";

export default function MemosPage() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 font-sans">
      <main className="w-full max-w-3xl px-6 py-10">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">메모 입력</h1>
            <p className="text-sm text-zinc-600">
              날림 메모를 회의록(안건/결정/할일)로 정리하고 업무일지에 누적합니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link className="text-sm text-zinc-700 underline" href="/">
              작업 보드
            </Link>
            <Link className="text-sm text-zinc-700 underline" href="/worklog">
              업무일지
            </Link>
          </div>
        </header>
        <MemoForm />
      </main>
    </div>
  );
}

