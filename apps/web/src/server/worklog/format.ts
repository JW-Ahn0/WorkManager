import "server-only";

import { format } from "date-fns";
import type { Minutes } from "@/server/ai/minutes";

export function resolveWorklogDate(minutes: Minutes): string {
  const d = minutes.date?.trim();
  if (d) return d;
  return format(new Date(), "yyyy-MM-dd");
}

export function minutesToWorklogMarkdown(input: {
  minutes: Minutes;
  date: string;
  project?: string;
}) {
  const { minutes, date, project } = input;
  const heading = project ? `### ${date} / ${project}` : `### ${date}`;
  const lines: string[] = [heading];

  if (minutes.title) lines.push(`- **제목**: ${minutes.title}`);
  if (minutes.agenda.length) {
    lines.push(`- **안건**`);
    for (const a of minutes.agenda) lines.push(`  - ${a}`);
  }
  if (minutes.decisions.length) {
    lines.push(`- **결정**`);
    for (const d of minutes.decisions) {
      lines.push(`  - ${d.text}${d.rationale ? ` (근거: ${d.rationale})` : ""}`);
    }
  }
  if (minutes.actionItems.length) {
    lines.push(`- **할일**`);
    for (const a of minutes.actionItems) {
      const owner = a.owner?.trim() ? `[${a.owner.trim()}] ` : "";
      const due = a.due?.trim() ? ` (기한: ${a.due.trim()})` : "";
      lines.push(`  - ${owner}${a.task}${due}`);
    }
  }
  if (minutes.notes.length) {
    lines.push(`- **메모**`);
    for (const n of minutes.notes) lines.push(`  - ${n}`);
  }

  lines.push("");
  return lines.join("\n");
}

