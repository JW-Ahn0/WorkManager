import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { ensureCurrentBoard } from "@/server/boards/current";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).optional().default(8),
});

export async function GET(req: Request) {
  try {
    const current = await ensureCurrentBoard();
    const { searchParams } = new URL(req.url);
    const query = QuerySchema.parse({ limit: searchParams.get("limit") ?? undefined });

    const boards = await prisma.boardWeek.findMany({
      where: { id: { not: current.id }, weekStart: { not: "legacy" } },
      orderBy: { weekStart: "desc" },
      take: query.limit,
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
      },
    });

    const tasksByBoard = await prisma.task.findMany({
      where: { boardId: { in: boards.map((b) => b.id) } },
      orderBy: [{ boardId: "asc" }, { status: "asc" }, { createdAt: "desc" }, { order: "asc" }],
      select: {
        id: true,
        boardId: true,
        title: true,
        description: true,
        status: true,
        order: true,
        createdAt: true,
      },
    });

    const map = new Map<string, typeof tasksByBoard>();
    for (const t of tasksByBoard) {
      const arr = map.get(t.boardId) ?? [];
      arr.push(t);
      map.set(t.boardId, arr);
    }

    return NextResponse.json({
      boards: boards.map((b) => ({
        ...b,
        tasks: map.get(b.id) ?? [],
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load boards" },
      { status: 500 },
    );
  }
}

