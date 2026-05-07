import "server-only";

import { Agent } from "@cursor/sdk";
import { z } from "zod";

const MinutesSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1).optional().nullable(),
  agenda: z.array(z.string().min(1)).default([]),
  decisions: z
    .array(
      z.object({
        text: z.string().min(1),
        rationale: z.string().optional().nullable(),
      }),
    )
    .default([]),
  actionItems: z
    .array(
      z.object({
        owner: z.string().optional().nullable(),
        task: z.string().min(1),
        due: z.string().optional().nullable(),
      }),
    )
    .default([]),
  notes: z.array(z.string()).default([]),
  confidence: z
    .preprocess((v) => {
      if (v === null || v === undefined) return v;
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isNaN(n)) return v;
      const normalized = n > 1 ? n / 100 : n;
      return Math.max(0, Math.min(1, normalized));
    }, z.number().min(0).max(1))
    .optional()
    .nullable(),
});

export type Minutes = z.infer<typeof MinutesSchema>;

function buildPrompt(input: { rawText: string; context?: unknown }) {
  return [
    "너는 한국어 업무용 회의록 작성기다.",
    "",
    "아래 '메모 원문'은 날림 메모/단어 나열/불완전한 문장일 수 있다.",
    "이를 기반으로 회의록을 JSON으로만 출력하라. (설명/마크다운/코드펜스 금지)",
    "",
    "규칙:",
    "- 근거가 없으면 담당자(owner)와 기한(due)은 null로 둔다.",
    "- 할일(task)은 한 문장으로, 동사로 시작하고, 하나의 작업만 담는다.",
    "- 결정(decisions)은 '무엇을 하기로 했는지'가 명확해야 한다.",
    "- 날짜(date)는 메모/컨텍스트에 없으면 null로 둔다. (형식 YYYY-MM-DD)",
    "",
    "출력 스키마:",
    JSON.stringify(
      {
        title: "string",
        date: "YYYY-MM-DD or null",
        agenda: ["string"],
        decisions: [{ text: "string", rationale: "string or null" }],
        actionItems: [{ owner: "string or null", task: "string", due: "YYYY-MM-DD or null" }],
        notes: ["string"],
        confidence: 0.0,
      },
      null,
      2,
    ),
    "",
    "컨텍스트(JSON, 없으면 null):",
    JSON.stringify(input.context ?? null),
    "",
    "메모 원문:",
    input.rawText,
  ].join("\n");
}

export async function generateMinutesFromMemo(input: {
  rawText: string;
  context?: unknown;
}): Promise<Minutes> {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY가 설정되어 있지 않습니다. (.env 또는 Netlify 환경변수)");
  }

  const text = await Agent.prompt(buildPrompt(input), {
    apiKey,
    model: { id: "composer-2" },
    local: { cwd: process.cwd() },
  });

  if (text.status !== "finished") {
    throw new Error(`Cursor 실행 실패: status=${text.status}`);
  }

  const raw = typeof text.result === "string" ? text.result : JSON.stringify(text.result);
  const json = JSON.parse(raw);
  return MinutesSchema.parse(json);
}

