"use client";

/* eslint-disable react-hooks/refs */

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Status = "TODO" | "IN_PROGRESS" | "DONE";
type Task = { id: string; title: string; description: string; status: Status; order: number };
type Board = { id: string; weekStart: string; weekEnd: string };
type BoardWithTasks = { id: string; weekStart: string; weekEnd: string; tasks: Task[] };

const COLUMNS: { id: Status; title: string }[] = [
  { id: "TODO", title: "Todo" },
  { id: "IN_PROGRESS", title: "In Progress" },
  { id: "DONE", title: "Done" },
];

function byOrder(a: Task, b: Task) {
  return a.order - b.order;
}

function statusTitle(status: Status) {
  return COLUMNS.find((c) => c.id === status)?.title ?? status;
}

function TaskCard(props: {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { task } = props;
  const sortable = useSortable({ id: task.id, data: { type: "task", task } });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
      className={[
        "touch-none rounded-lg border border-zinc-200 bg-white p-3 shadow-sm",
        sortable.isDragging ? "opacity-50" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="mb-2 w-full text-left text-sm font-medium text-zinc-900"
        onClick={(e) => {
          e.stopPropagation();
          props.onOpen(task.id);
        }}
      >
        {task.title}
      </button>
      <div className="flex items-center gap-2">
        {task.status !== "DONE" ? (
          <button
            type="button"
            onClick={() => props.onComplete(task.id)}
            className="h-8 cursor-pointer rounded-md bg-black px-3 text-xs font-medium text-white"
          >
            완료
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => props.onDelete(task.id)}
          className="h-8 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function Column(props: {
  status: Status;
  tasks: Task[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const ids = props.tasks.map((t) => t.id);
  const droppable = useDroppable({ id: props.status, data: { type: "column", status: props.status } });
  return (
    <section
      ref={droppable.setNodeRef}
      className={[
        "flex min-h-[360px] flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3",
        droppable.isOver ? "ring-2 ring-zinc-400" : "",
      ].join(" ")}
    >
      <header className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">
          {statusTitle(props.status)}
          <span className="ml-2 text-xs font-normal text-zinc-500">{props.tasks.length}</span>
        </div>
      </header>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid gap-3">
          {props.tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onComplete={props.onComplete}
              onDelete={props.onDelete}
              onOpen={props.onOpen}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

export function TaskBoard() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [history, setHistory] = useState<BoardWithTasks[]>([]);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [worklogOpen, setWorklogOpen] = useState(false);

  const grouped = useMemo(() => {
    const g: Record<Status, Task[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    for (const t of tasks) g[t.status].push(t);
    for (const k of Object.keys(g) as Status[]) g[k].sort(byOrder);
    return g;
  }, [tasks]);

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId) ?? null, [tasks, activeId]);
  const openTask = useMemo(() => tasks.find((t) => t.id === openId) ?? null, [tasks, openId]);
  const confirmDeleteTask = useMemo(
    () => tasks.find((t) => t.id === confirmDeleteId) ?? null,
    [tasks, confirmDeleteId],
  );

  const currentWorklog = useMemo(() => {
    const sections: { title: string; items: Task[] }[] = [
      { title: "진행 예정 Task", items: grouped.TODO },
      { title: "현재 진행중인 Task", items: grouped.IN_PROGRESS },
      { title: "완료된 Task", items: grouped.DONE },
    ];

    const mdLines: string[] = [];
    const txtLines: string[] = [];

    mdLines.push(`# 업무일지`);
    txtLines.push(`업무일지`);
    if (board) {
      mdLines.push(`- 기간: ${board.weekStart} ~ ${board.weekEnd} (일~토)`);
      mdLines.push("");
      txtLines.push(`기간: ${board.weekStart} ~ ${board.weekEnd} (일~토)`);
      txtLines.push("");
    } else {
      mdLines.push("");
      txtLines.push("");
    }

    for (const s of sections) {
      mdLines.push(`## ${s.title}`);
      txtLines.push(`${s.title}`);

      if (s.items.length === 0) {
        mdLines.push(`- (없음)`);
        txtLines.push(`- (없음)`);
      } else {
        for (const t of s.items) {
          mdLines.push(`- ${t.title}`);
          txtLines.push(`- ${t.title}`);
          if (t.description?.trim()) {
            mdLines.push(`  - ${t.description.trim().split("\n").join("\n  - ")}`);
            txtLines.push(`  - ${t.description.trim().split("\n").join("\n  - ")}`);
          }
        }
      }
      mdLines.push("");
      txtLines.push("");
    }

    const html = [
      `<h1>업무일지</h1>`,
      board ? `<p><b>기간:</b> ${board.weekStart} ~ ${board.weekEnd} (일~토)</p>` : "",
      ...sections.map((s) => {
        const lis =
          s.items.length === 0
            ? `<li>(없음)</li>`
            : s.items
                .map((t) => {
                  const desc = t.description?.trim()
                    ? `<br/><span style="color:#555;">${escapeHtml(
                        t.description.trim(),
                      ).replace(/\n/g, "<br/>")}</span>`
                    : "";
                  return `<li><b>${escapeHtml(t.title)}</b>${desc}</li>`;
                })
                .join("");
        return `<h2>${escapeHtml(s.title)}</h2><ul>${lis}</ul>`;
      }),
    ]
      .filter(Boolean)
      .join("\n");

    return {
      markdown: mdLines.join("\n").trim() + "\n",
      text: txtLines.join("\n").trim() + "\n",
      html,
    };
  }, [grouped, board]);

  function escapeHtml(s: string) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function refresh() {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `작업 목록 로딩 실패 (HTTP ${res.status})`);
      }
      const json = (await res.json()) as { board: Board; tasks: Task[] };
      setBoard(json.board);
      setTasks(json.tasks);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "작업 목록 로딩 중 오류");
    }
  }

  async function refreshHistory() {
    try {
      const res = await fetch("/api/boards?limit=8");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `지난 주 보드 로딩 실패 (HTTP ${res.status})`);
      }
      const json = (await res.json()) as { boards: BoardWithTasks[] };
      setHistory(json.boards);
    } catch (e) {
      setLoadError((prev) => prev ?? (e instanceof Error ? e.message : "보드 로딩 중 오류"));
    }
  }

  useEffect(() => {
    void refresh();
    void refreshHistory();
  }, []);

  async function createTask() {
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setNewTitle("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateDescription(id: string, description: string) {
    setBusy(true);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function completeTask(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(id: string) {
    setConfirmDeleteId(id);
  }

  function findContainerForTask(taskId: string): Status | null {
    const t = tasks.find((x) => x.id === taskId);
    return t?.status ?? null;
  }

  function resolveOverStatus(overId: string): Status | null {
    if (overId === "TODO" || overId === "IN_PROGRESS" || overId === "DONE") return overId;
    return findContainerForTask(overId);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function persistOrder(next: Record<Status, Task[]>) {
    const updates = (Object.keys(next) as Status[]).flatMap((status) =>
      next[status].map((t, idx) => ({ id: t.id, status, order: idx + 1 })),
    );
    await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updates }),
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    if (!over || active === over) return;

    const fromStatus = findContainerForTask(active);
    const toStatus = resolveOverStatus(over);
    if (!fromStatus || !toStatus) return;

    // Reorder within same column
    if (fromStatus === toStatus) {
      const col = grouped[fromStatus];
      const oldIndex = col.findIndex((t) => t.id === active);
      const newIndex = col.findIndex((t) => t.id === over);
      if (oldIndex === -1 || newIndex === -1) return;
      const moved = arrayMove(col, oldIndex, newIndex);

      const nextGrouped = { ...grouped, [fromStatus]: moved };
      const flattened = (Object.keys(nextGrouped) as Status[]).flatMap((s) => nextGrouped[s]);
      setTasks(flattened);
      await persistOrder(nextGrouped);
      await refresh();
      return;
    }

    // Move across columns: remove from source, insert into destination before "over"
    const source = grouped[fromStatus].filter((t) => t.id !== active);
    const moving = grouped[fromStatus].find((t) => t.id === active);
    if (!moving) return;
    const dest = [...grouped[toStatus]];
    const overIndex = dest.findIndex((t) => t.id === over);
    const insertAt =
      over === toStatus ? dest.length : overIndex >= 0 ? overIndex : dest.length;
    dest.splice(insertAt, 0, { ...moving, status: toStatus });

    const nextGrouped: Record<Status, Task[]> = {
      ...grouped,
      [fromStatus]: source,
      [toStatus]: dest,
    };

    const flattened = (Object.keys(nextGrouped) as Status[]).flatMap((s) => nextGrouped[s]);
    setTasks(flattened);
    await persistOrder(nextGrouped);
    await refresh();
  }

  return (
    <div className="grid gap-5">
      {loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">작업 보드</h1>
          <p className="text-sm text-zinc-600">
            완료/삭제 버튼과 Drag & Drop으로 상태를 관리합니다.
          </p>
          {board ? (
            <div className="text-xs text-zinc-500">
              이번 주: {board.weekStart} ~ {board.weekEnd} (일~토)
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <Link className="text-sm text-zinc-700 underline" href="/memos">
              메모 입력
            </Link>
            <button
              type="button"
              className="text-sm cursor-pointer text-zinc-700 underline"
              onClick={() => setWorklogOpen(true)}
            >
              현재 기준으로 업무일지 생성
            </button>
          </div>
          <input
            className="h-10 w-full min-w-[220px] lg:w-[360px] rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="새 작업 입력..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createTask();
            }}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => void createTask()}
            disabled={busy || !newTitle.trim()}
            className="h-10 whitespace-nowrap rounded-md bg-black px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            추가
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={(e) => void onDragEnd(e)}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((c) => (
            <Column
              key={c.id}
              status={c.id}
              tasks={grouped[c.id]}
              onComplete={(id) => void completeTask(id)}
              onDelete={(id) => requestDelete(id)}
              onOpen={(id) => setOpenId(id)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-[280px] rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="text-sm font-medium text-zinc-900">{activeTask.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {worklogOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={() => setWorklogOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-sm font-semibold text-zinc-900">현재 기준 업무일지</div>
                {board ? (
                  <div className="text-xs text-zinc-500">
                    {board.weekStart} ~ {board.weekEnd} (일~토)
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700"
                onClick={() => setWorklogOpen(false)}
              >
                닫기
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="h-9 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white"
                onClick={async () => {
                  await navigator.clipboard.writeText(currentWorklog.markdown);
                }}
              >
                .md 형식으로 복사
              </button>
              <button
                type="button"
                className="h-9 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white"
                onClick={async () => {
                  await navigator.clipboard.writeText(currentWorklog.text);
                }}
              >
                .txt 형식으로 복사
              </button>
              <button
                type="button"
                className="h-9 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white"
                onClick={async () => {
                  const html = currentWorklog.html;
                  const plain = currentWorklog.text;
                  // Word에 붙여넣기 용 (HTML clipboard)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const ClipboardItemCtor = (globalThis as any).ClipboardItem as
                    | undefined
                    | (new (items: Record<string, Blob>) => ClipboardItem);
                  if (ClipboardItemCtor && navigator.clipboard.write) {
                    const item = new ClipboardItemCtor({
                      "text/html": new Blob([html], { type: "text/html" }),
                      "text/plain": new Blob([plain], { type: "text/plain" }),
                    });
                    await navigator.clipboard.write([item]);
                  } else {
                    await navigator.clipboard.writeText(plain);
                  }
                }}
              >
                .word 형식으로 복사
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <div className="text-xs font-medium text-zinc-600">미리보기(Markdown)</div>
              <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-xs text-zinc-800">
                {currentWorklog.markdown}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {history.length ? (
        <section className="mt-2 grid gap-3">
          <div className="text-sm font-semibold text-zinc-900">지난 주 보드</div>
          <div className="grid gap-2">
            {history.map((b) => {
              const isOpen = !!openWeeks[b.weekStart];
              const groupedHistory: Record<Status, Task[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
              for (const t of b.tasks) groupedHistory[t.status].push(t);
              for (const k of Object.keys(groupedHistory) as Status[]) groupedHistory[k].sort(byOrder);

              return (
                <div key={b.id} className="rounded-xl border border-zinc-200 bg-white">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() =>
                      setOpenWeeks((prev) => ({ ...prev, [b.weekStart]: !prev[b.weekStart] }))
                    }
                  >
                    <div className="text-sm font-semibold text-zinc-900">
                      {b.weekStart} ~ {b.weekEnd}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {isOpen ? "접기" : "펼치기"} • 총 {b.tasks.length}개
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-zinc-200 bg-zinc-50 p-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        {COLUMNS.map((c) => (
                          <section
                            key={c.id}
                            className="flex min-h-[200px] flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3"
                          >
                            <div className="text-sm font-semibold text-zinc-900">
                              {c.title}
                              <span className="ml-2 text-xs font-normal text-zinc-500">
                                {groupedHistory[c.id].length}
                              </span>
                            </div>
                            <div className="grid gap-3">
                              {groupedHistory[c.id].map((t) => (
                                <div
                                  key={t.id}
                                  className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
                                >
                                  <div className="text-sm font-medium text-zinc-900">{t.title}</div>
                                  {t.description ? (
                                    <div className="mt-1 text-xs text-zinc-600 whitespace-pre-wrap">
                                      {t.description}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {openTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-sm font-semibold text-zinc-900">{openTask.title}</div>
                <div className="text-xs text-zinc-500">{statusTitle(openTask.status)}</div>
              </div>
              <button
                type="button"
                className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700"
                onClick={() => setOpenId(null)}
              >
                닫기
              </button>
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-zinc-600">설명</span>
              <textarea
                className="min-h-28 w-full resize-y rounded-md border border-zinc-200 bg-white p-3 text-sm leading-6 outline-none focus:border-zinc-400"
                value={openTask.description ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  setTasks((prev) =>
                    prev.map((t) => (t.id === openTask.id ? { ...t, description: next } : t)),
                  );
                }}
                placeholder="상세 내용을 적어두세요."
                disabled={busy}
              />
            </label>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {openTask.status !== "DONE" ? (
                  <button
                    type="button"
                    onClick={() => void completeTask(openTask.id)}
                    className="h-9 cursor-pointer rounded-md bg-black px-3 text-xs font-medium text-white"
                    disabled={busy}
                  >
                    완료
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => requestDelete(openTask.id)}
                  className="h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700"
                  disabled={busy}
                >
                  삭제
                </button>
              </div>

              <button
                type="button"
                onClick={() => void updateDescription(openTask.id, openTask.description ?? "")}
                className="h-9 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white disabled:opacity-40"
                disabled={busy}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteTask ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-zinc-900">진짜 삭제하시겠습니까?</div>
            <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
              {confirmDeleteTask.title}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700"
                onClick={() => setConfirmDeleteId(null)}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="button"
                className="h-9 cursor-pointer rounded-md bg-red-600 px-3 text-xs font-medium text-white disabled:opacity-40"
                onClick={async () => {
                  const id = confirmDeleteTask.id;
                  setConfirmDeleteId(null);
                  if (openId === id) setOpenId(null);
                  await deleteTask(id);
                }}
                disabled={busy}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

