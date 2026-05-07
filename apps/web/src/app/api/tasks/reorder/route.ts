import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { ensureCurrentBoard } from "@/server/boards/current";

const ReorderBody = z.object({
  updates: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
      order: z.number().int(),
    }),
  ),
});

export async function POST(req: Request) {
  const board = await ensureCurrentBoard();
  const body = ReorderBody.parse(await req.json());

  await prisma.$transaction(
    body.updates.map((u) =>
      prisma.task.updateMany({
        where: { id: u.id, boardId: board.id },
        data: { status: u.status, order: u.order },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}

