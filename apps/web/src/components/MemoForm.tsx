"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ApiResponse = {
  memo: { id: string; createdAt: string; rawText: string; context: unknown | null };
  minutes: {
    id: string;
    createdAt: string;
    memoId: string;
    title: string;
    date: string | null;
    agenda: unknown;
    decisions: unknown;
    actionItems: unknown;
    notes: unknown;
    confidence: number | null;
  };
  worklog: { id: string; date: string; project: string; contentMd: string } | null;
  createdTasks:
    | { id: string; title: string; description: string; status: string; order: number }[]
    | null;
};

export function MemoForm() {
  const [rawText, setRawText] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const canSubmit = useMemo(() => rawText.trim().length > 0 && !busy, [rawText, busy]);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rawText,
          context: {
            date: date.trim() || undefined,
          },
          appendToWorklog: true,
          createTasks: true,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `요청 실패 (HTTP ${res.status})`);
      }

      const json = (await res.json()) as ApiResponse;
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 relative">
      {busy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <div
                className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"
                aria-hidden="true"
              />
              <div className="text-sm font-semibold text-zinc-900">
                Task 생성중입니다 잠시만 기다려주세요!
              </div>
            </div>
            <div className="mt-2 text-xs text-zinc-600">
              메모 정리와 작업 보드 반영까지 처리하고 있어요.
            </div>
          </div>
        </div>
      ) : null}

      <label className="grid gap-1">
        <span className="text-sm font-medium text-zinc-700">날짜</span>
        <input
          type="date"
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onPointerDown={(e) => {
            // 일부 브라우저는 showPicker() 호출 시 "user gesture" 제약이 있음.
            // 가능한 경우에만 시도하고, 거부되면 기본 동작(type="date")에 맡긴다.
            try {
              (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
            } catch {
              // ignore
            }
          }}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium text-zinc-700">날림 메모</span>
        <textarea
          className="min-h-40 w-full resize-y rounded-md border border-zinc-200 bg-white p-3 text-sm leading-6 outline-none focus:border-zinc-400"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={"예:\n- A안 vs B안 논의\n- 다음주까지 견적\n- 로그인 필요없음\n- 배포는 Netlify"}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "정리 중..." : "회의록/업무일지로 정리"}
        </button>
        <Link className="text-sm text-zinc-600 underline" href="/worklog">
          업무일지
        </Link>
        <Link className="text-sm text-zinc-600 underline" href="/">
          작업 보드
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4">
          {result.createdTasks ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
              <div className="font-semibold">
                작업 보드에 추가됨: {result.createdTasks.length}개 (Todo)
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                번호로 정리된 항목이 없으면 0개로 나올 수 있어요.{" "}
                <Link className="underline" href="/">
                  작업 보드 열기
                </Link>
              </div>
            </div>
          ) : null}
          <div className="grid gap-1">
            <div className="text-sm font-semibold">생성된 회의록(원본 JSON 저장됨)</div>
            <div className="text-xs text-zinc-500">
              memoId: {result.memo.id} / minutesId: {result.minutes.id}
            </div>
          </div>
          <pre className="overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
            {JSON.stringify(result.minutes, null, 2)}
          </pre>
          {result.worklog ? (
            <>
              <div className="text-sm font-semibold">업무일지 누적(Markdown)</div>
              <pre className="overflow-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-800">
                {result.worklog.contentMd}
              </pre>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

