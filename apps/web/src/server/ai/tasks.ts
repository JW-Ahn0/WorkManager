import "server-only";

import { Agent } from "@cursor/sdk";
import { z } from "zod";
import { loadPromptText } from "@/server/ai/prompt";

const ExtractedTaskSchema = z.object({
  index: z.number().int().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

const ExtractTasksSchema = z.object({
  tasks: z.array(ExtractedTaskSchema).default([]),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

async function buildPrompt(input: { rawText: string }) {
  const schemaJson = JSON.stringify(
    {
      tasks: [{ index: 1, name: "string", description: "string or null" }],
    },
    null,
    2,
  );

  // 실제 서비스에서 파일을 읽어서 프롬프트로 사용
  const template = await loadPromptText("prompts/task-extraction.md");
  return template
    .replace("{{SCHEMA_JSON}}", schemaJson)
    .replace("{{RAW_TEXT}}", input.rawText);
}

function fallbackExtractFromBullets(rawText: string): ExtractedTask[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tasks: ExtractedTask[] = [];
  let current: { name: string; descLines: string[] } | null = null;

  function flush() {
    if (!current) return;
    const name = current.name.replace(/^\-+\s*/, "").trim();
    if (name.length) {
      const description = current.descLines.join("\n").trim();
      tasks.push({
        index: tasks.length + 1,
        name,
        description: description || null,
      });
    }
    current = null;
  }

  for (const line of lines) {
    const isBullet = /^[-*•]\s+/.test(line);
    const isNumbered = /^\d+\.\s+/.test(line);
    if (isBullet || isNumbered) {
      flush();
      current = { name: line.replace(/^\d+\.\s+/, "").trim(), descLines: [] };
      continue;
    }
    if (current) current.descLines.push(line);
  }
  flush();
  return tasks;
}

export async function extractTasksFromMemo(input: { rawText: string }) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) throw new Error("CURSOR_API_KEY가 설정되어 있지 않습니다.");

  const prompt = await buildPrompt(input);
  const res = await Agent.prompt(prompt, {
    apiKey,
    model: { id: "composer-2" },
    local: { cwd: process.cwd() },
  });

  if (res.status !== "finished") {
    throw new Error(`Cursor 실행 실패: status=${res.status}`);
  }

  const raw = typeof res.result === "string" ? res.result : JSON.stringify(res.result);
  const json = JSON.parse(raw);
  const tasks = ExtractTasksSchema.parse(json).tasks;
  if (tasks.length) return tasks;

  // Agent가 비웠을 때 최소 폴백(불릿 기반) 추출
  return fallbackExtractFromBullets(input.rawText);
}

