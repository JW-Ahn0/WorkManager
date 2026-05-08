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

import { copyHtmlForWord, copyPlainText } from "@/lib/clipboard";

const CLICK_FEEL =
  "transition active:scale-[0.98] active:translate-y-[0.5px] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2";

type Status = "TODO" | "IN_PROGRESS" | "DONE";
type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  order: number;
  createdAt: string;
};
type Board = { id: string; weekStart: string; weekEnd: string };
type BoardWithTasks = { id: string; weekStart: string; weekEnd: string; tasks: Task[] };

const COLUMNS: { id: Status; title: string }[] = [
  { id: "TODO", title: "Todo" },
  { id: "IN_PROGRESS", title: "In Progress" },
  { id: "DONE", title: "Done" },
];

function byCreatedAtDesc(a: Task, b: Task) {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
  return b.order - a.order;
}

function statusTitle(status: Status) {
  return COLUMNS.find((c) => c.id === status)?.title ?? status;
}

function formatYmdCompact(input: string) {
  const t = Date.parse(input);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function TaskCard(props: {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { task } = props;
  const createdLabel = useMemo(() => {
    return formatYmdCompact(task.createdAt);
  }, [task.createdAt]);
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
      <div className="mb-2 flex items-start justify-between gap-3">
        <button
          type="button"
          className={`min-w-0 flex-1 text-left text-sm font-medium text-zinc-900 ${CLICK_FEEL}`}
          onClick={(e) => {
            e.stopPropagation();
            props.onOpen(task.id);
          }}
        >
          {task.title}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {task.status !== "DONE" ? (
            <button
              type="button"
              onClick={() => props.onComplete(task.id)}
              className={`h-8 cursor-pointer rounded-md bg-black px-3 text-xs font-medium text-white ${CLICK_FEEL}`}
            >
              완료
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => props.onDelete(task.id)}
            className={`h-8 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 ${CLICK_FEEL}`}
          >
            삭제
          </button>
        </div>
        {createdLabel ? (
          <div className="shrink-0 text-[11px] text-zinc-500">생성:{createdLabel}</div>
        ) : null}
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
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [worklogOpen, setWorklogOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskDate, setNewTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskContent, setNewTaskContent] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const grouped = useMemo(() => {
    const g: Record<Status, Task[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    for (const t of tasks) g[t.status].push(t);
    for (const k of Object.keys(g) as Status[]) g[k].sort(byCreatedAtDesc);
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

  function resetNewTaskModal() {
    setNewTaskDate(new Date().toISOString().slice(0, 10));
    setNewTaskName("");
    setNewTaskContent("");
  }

  async function createTaskFromModal() {
    const title = newTaskName.trim();
    if (!title) return;
    const content = newTaskContent.trim();
    const date = newTaskDate.trim();
    const description = [date ? `날짜: ${date}` : "", content].filter(Boolean).join("\n\n");
    setBusy(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      await refresh();
      setNewTaskOpen(false);
      resetNewTaskModal();
    } finally {
      setBusy(false);
    }
  }

  async function updateTaskFields(id: string, input: { title?: string; description?: string }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
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
      {toast ? (
        <div className="fixed inset-x-0 bottom-4 z-90 flex justify-center px-4">
          <div className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}
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
          <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
            <Link
              className={`inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white ${CLICK_FEEL}`}
              href="/memos"
            >
              메모 입력
            </Link>
            <button
              type="button"
              className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 ${CLICK_FEEL}`}
              onClick={() => setWorklogOpen(true)}
            >
              현재 기준 업무일지 생성
            </button>
            <button
              type="button"
              className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white disabled:opacity-40 ${CLICK_FEEL}`}
              onClick={() => setNewTaskOpen(true)}
              disabled={busy}
            >
              + New Task
            </button>
          </div>
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
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 p-4"
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
                className={`h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 ${CLICK_FEEL}`}
                onClick={() => setWorklogOpen(false)}
              >
                닫기
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`h-9 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white ${CLICK_FEEL}`}
                onClick={async () => {
                  try {
                    await copyPlainText(currentWorklog.markdown);
                    setToast("클립보드에 복사되었습니다.");
                  } catch {
                    alert("복사에 실패했습니다. HTTPS 또는 localhost 로 접속했는지 확인해 주세요.");
                  }
                }}
              >
                .md 형식으로 복사
              </button>
              <button
                type="button"
                className={`h-9 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white ${CLICK_FEEL}`}
                onClick={async () => {
                  try {
                    await copyPlainText(currentWorklog.text);
                    setToast("클립보드에 복사되었습니다.");
                  } catch {
                    alert("복사에 실패했습니다. HTTPS 또는 localhost 로 접속했는지 확인해 주세요.");
                  }
                }}
              >
                .txt 형식으로 복사
              </button>
              <button
                type="button"
                className={`h-9 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white ${CLICK_FEEL}`}
                onClick={async () => {
                  try {
                    await copyHtmlForWord(currentWorklog.html, currentWorklog.text);
                    setToast("클립보드에 복사되었습니다.");
                  } catch {
                    alert("복사에 실패했습니다. HTTPS 또는 localhost 로 접속했는지 확인해 주세요.");
                  }
                }}
              >
                .word 형식으로 복사
              </button>
              <button
                type="button"
                className={`h-9 cursor-pointer rounded-md bg-black px-3 text-xs font-medium text-white ${CLICK_FEEL}`}
                onClick={async () => {
                  try {
                    const res = await fetch("/api/worklog/docx");
                    if (!res.ok) throw new Error(await res.text());
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `업무일지_${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}.docx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    setToast("Word 파일을 다운로드했습니다.");
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "다운로드에 실패했습니다.");
                  }
                }}
              >
                양식에 자동작성
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

      {newTaskOpen ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={() => {
            setNewTaskOpen(false);
            resetNewTaskModal();
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-sm font-semibold text-zinc-900">새 작업 추가</div>
                <div className="text-xs text-zinc-500">Todo 컬럼에 추가됩니다.</div>
              </div>
              <button
                type="button"
                className={`h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 ${CLICK_FEEL}`}
                onClick={() => {
                  setNewTaskOpen(false);
                  resetNewTaskModal();
                }}
              >
                닫기
              </button>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-zinc-700">날짜</span>
                <input
                  type="date"
                  className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  onPointerDown={(e) => {
                    // 일부 브라우저는 showPicker() 호출 시 "user gesture" 제약이 있음.
                    // 가능한 경우에만 시도하고, 거부되면 기본 동작(type="date")에 맡긴다.
                    // mouse에서는 pointerdown에서 열어도 안정적.
                    if (e.pointerType && e.pointerType !== "mouse") return;
                    try {
                      (
                        e.currentTarget as HTMLInputElement & {
                          showPicker?: () => void;
                        }
                      ).showPicker?.();
                    } catch {
                      // ignore
                    }
                  }}
                  onClick={(e) => {
                    // 일부 모바일 브라우저는 입력칸 탭 시 피커가 안 뜨고 아이콘만 동작함.
                    // coarse pointer(터치) 환경에서는 click에서 showPicker를 시도한다.
                    if (!globalThis.matchMedia?.("(pointer: coarse)")?.matches) return;
                    try {
                      const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                      // click 내에서 즉시 호출이 닫힘을 유발하는 브라우저가 있어 한 프레임 뒤에 호출
                      requestAnimationFrame(() => {
                        try {
                          el.showPicker?.();
                        } catch {
                          // ignore
                        }
                      });
                    } catch {
                      // ignore
                    }
                  }}
                  disabled={busy}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-zinc-700">테스크 이름</span>
                <input
                  className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="예: 견적 요청 메일 보내기"
                  disabled={busy}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-zinc-700">테스크 내용</span>
                <textarea
                  className="min-h-28 w-full resize-y rounded-md border border-zinc-200 bg-white p-3 text-sm leading-6 outline-none focus:border-zinc-400"
                  value={newTaskContent}
                  onChange={(e) => setNewTaskContent(e.target.value)}
                  placeholder={"필요하면 상세 내용을 적어주세요.\n(비워도 됩니다)"}
                  disabled={busy}
                />
              </label>

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`h-10 cursor-pointer rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 ${CLICK_FEEL}`}
                  onClick={() => {
                    setNewTaskOpen(false);
                    resetNewTaskModal();
                  }}
                  disabled={busy}
                >
                  닫기
                </button>
                <button
                  type="button"
                  className={`h-10 cursor-pointer rounded-md bg-black px-4 text-sm font-medium text-white disabled:opacity-40 ${CLICK_FEEL}`}
                  onClick={() => void createTaskFromModal()}
                  disabled={busy || !newTaskName.trim()}
                >
                  추가
                </button>
              </div>
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
              for (const k of Object.keys(groupedHistory) as Status[]) groupedHistory[k].sort(byCreatedAtDesc);

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
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">제목</span>
                  <input
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400"
                    value={openTask.title ?? ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      setTasks((prev) =>
                        prev.map((t) => (t.id === openTask.id ? { ...t, title: next } : t)),
                      );
                    }}
                    placeholder="제목을 입력하세요."
                    disabled={busy}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                  <span>{statusTitle(openTask.status)}</span>
                  <span className="text-zinc-300">•</span>
                  <span>
                    생성:{" "}
                    {formatYmdCompact(openTask.createdAt) ?? "-"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 ${CLICK_FEEL}`}
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
                    className={`h-9 cursor-pointer rounded-md bg-black px-3 text-xs font-medium text-white ${CLICK_FEEL}`}
                    disabled={busy}
                  >
                    완료
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => requestDelete(openTask.id)}
                  className={`h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 ${CLICK_FEEL}`}
                  disabled={busy}
                >
                  삭제
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateTaskFields(openTask.id, {
                      title: openTask.title?.trim() || undefined,
                      description: openTask.description ?? "",
                    });
                    setOpenId(null);
                    setToast("저장되었습니다.");
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "저장에 실패했습니다.");
                  }
                }}
                className={`h-9 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white disabled:opacity-40 ${CLICK_FEEL}`}
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
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4"
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
                className={`h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 ${CLICK_FEEL}`}
                onClick={() => setConfirmDeleteId(null)}
                disabled={busy}
              >
                취소
              </button>
              <button
                type="button"
                className={`h-9 cursor-pointer rounded-md bg-red-600 px-3 text-xs font-medium text-white disabled:opacity-40 ${CLICK_FEEL}`}
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

