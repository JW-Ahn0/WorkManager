import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { generateMinutesFromMemo } from "@/server/ai/minutes";
import { extractTasksFromMemo } from "@/server/ai/tasks";
import { minutesToWorklogMarkdown, resolveWorklogDate } from "@/server/worklog/format";
import { ensureCurrentBoard } from "@/server/boards/current";

const CreateMemoBody = z.object({
  rawText: z.string().min(1),
  context: z
    .object({
      date: z.string().optional(),
      project: z.string().optional(),
      tags: z.array(z.string()).optional(),
      attendees: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
  createTasks: z.boolean().optional().default(true),
  generateMinutes: z.boolean().optional().default(false),
  appendToWorklog: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const json = await req.json();
  const body = CreateMemoBody.parse(json);

  const memo = await prisma.memo.create({
    data: {
      rawText: body.rawText,
      context: body.context
        ? (body.context as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });

  let minutesRow: {
    id: string;
    createdAt: Date;
    memoId: string;
    title: string;
    date: string | null;
    agenda: unknown;
    decisions: unknown;
    actionItems: unknown;
    notes: unknown;
    confidence: number | null;
  } | null = null;
  let minutes: Awaited<ReturnType<typeof generateMinutesFromMemo>> | null = null;

  let worklog: { id: string; date: string; project: string; contentMd: string } | null = null;
  let createdTasks:
    | { id: string; title: string; description: string; status: string; order: number }[]
    | null = null;

  if (body.generateMinutes || body.appendToWorklog) {
    minutes = await generateMinutesFromMemo({
      rawText: memo.rawText,
      context: body.context ?? undefined,
    });

    minutesRow = await prisma.minutes.create({
      data: {
        memoId: memo.id,
        title: minutes.title,
        date: minutes.date ?? null,
        agenda: minutes.agenda,
        decisions: minutes.decisions,
        actionItems: minutes.actionItems,
        notes: minutes.notes,
        confidence: minutes.confidence ?? null,
      },
    });

    if (body.appendToWorklog) {
      const date = body.context?.date?.trim() || resolveWorklogDate(minutes);
      const project = body.context?.project?.trim() || "";

      const appendMd = minutesToWorklogMarkdown({ minutes, date, project });

      const upserted = await prisma.$transaction(async (tx) => {
        const existing = await tx.worklogEntry.findUnique({
          where: { date_project: { date, project } },
        });

        if (!existing) {
          return await tx.worklogEntry.create({
            data: { date, project, contentMd: appendMd },
          });
        }

        const nextContent = existing.contentMd.trimEnd() + "\n\n" + appendMd.trimStart();
        return await tx.worklogEntry.update({
          where: { id: existing.id },
          data: { contentMd: nextContent },
        });
      });

      worklog = {
        id: upserted.id,
        date: upserted.date,
        project: upserted.project,
        contentMd: upserted.contentMd,
      };

      await prisma.minutes.update({
        where: { id: minutesRow.id },
        data: { appendedToWorklogAt: new Date() },
      });
    }
  }

  if (body.createTasks) {
    const board = await ensureCurrentBoard();
    const extracted = await extractTasksFromMemo({ rawText: memo.rawText });
    if (extracted.length) {
      const max = await prisma.task.aggregate({
        where: { boardId: board.id, status: "TODO" },
        _max: { order: true },
      });
      let nextOrder = (max._max.order ?? 0) + 1;

      createdTasks = await prisma.$transaction(
        extracted.map((t) =>
          prisma.task.create({
            data: {
              boardId: board.id,
              title: t.name.replace(/^\s*[-*•]+\s*/, "").replace(/^\s*\d+[\.\)]\s+/, "").trim(),
              description: t.description ?? "",
              status: "TODO",
              order: nextOrder++,
            },
            select: { id: true, title: true, description: true, status: true, order: true, createdAt: true },
          }),
        ),
      );
    } else {
      createdTasks = [];
    }
  }

  return NextResponse.json({
    memo,
    minutes: minutesRow,
    worklog,
    createdTasks,
  });
}

