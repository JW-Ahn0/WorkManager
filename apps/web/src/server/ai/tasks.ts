import "server-only";

import { Agent } from "@cursor/sdk";
import { z } from "zod";

const ExtractedTaskSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

const ExtractTasksSchema = z.object({
  tasks: z.array(ExtractedTaskSchema).default([]),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

function buildPrompt(input: { rawText: string }) {
  return [
    "너는 한국어 메모에서 '업무(Task)'를 추출하는 도우미다.",
    "",
    "입력에는 번호(예: 1., 2., 3.)가 포함될 수 있고, 번호 단위가 각각 하나의 업무라고 가정한다.",
    "번호 아래 줄들은 해당 업무의 상세 설명(추가 조건/맥락)으로 합쳐라.",
    "",
    "출력은 JSON만 출력하라. (설명/마크다운/코드펜스 금지)",
    "",
    "규칙:",
    "- 번호가 명확한 항목만 tasks로 추출한다.",
    "- name은 짧게(한 줄), description은 필요하면 여러 문장을 합쳐도 된다. 없으면 null.",
    "- 번호가 없으면 tasks는 빈 배열로 둔다.",
    "",
    "출력 스키마:",
    JSON.stringify(
      {
        tasks: [{ name: "string", description: "string or null" }],
      },
      null,
      2,
    ),
    "",
    "메모 원문:",
    input.rawText,
  ].join("\n");
}

export async function extractTasksFromMemo(input: { rawText: string }) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) throw new Error("CURSOR_API_KEY가 설정되어 있지 않습니다.");

  const res = await Agent.prompt(buildPrompt(input), {
    apiKey,
    model: { id: "composer-2" },
    local: { cwd: process.cwd() },
  });

  if (res.status !== "finished") {
    throw new Error(`Cursor 실행 실패: status=${res.status}`);
  }

  const raw = typeof res.result === "string" ? res.result : JSON.stringify(res.result);
  const json = JSON.parse(raw);
  return ExtractTasksSchema.parse(json).tasks;
}

