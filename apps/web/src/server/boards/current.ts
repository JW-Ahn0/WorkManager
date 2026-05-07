import "server-only";

import { addDays } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/server/db/prisma";

const TZ = "Asia/Seoul";

function getWeekRangeKst(now = new Date()) {
  const zoned = toZonedTime(now, TZ);
  const day = zoned.getDay(); // 0=Sun ... 6=Sat in local (zoned) clock
  const start = addDays(zoned, -day);
  const end = addDays(start, 6);
  const weekStart = formatInTimeZone(start, TZ, "yyyy-MM-dd");
  const weekEnd = formatInTimeZone(end, TZ, "yyyy-MM-dd");
  return { weekStart, weekEnd };
}

export async function ensureCurrentBoard() {
  const { weekStart, weekEnd } = getWeekRangeKst();

  const existing = await prisma.boardWeek.findUnique({ where: { weekStart } });
  if (existing) return existing;

  // Find latest board (by createdAt) to roll over unfinished work.
  const latest = await prisma.boardWeek.findFirst({ orderBy: { createdAt: "desc" } });

  const created = await prisma.boardWeek.create({
    data: { weekStart, weekEnd },
  });

  // Roll over TODO/IN_PROGRESS from latest board to new board.
  if (latest && latest.id !== created.id) {
    const carry = await prisma.task.findMany({
      where: { boardId: latest.id, status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "asc" }],
      select: { id: true, status: true },
    });

    if (carry.length) {
      let todoOrder = 0;
      let inProgressOrder = 0;

      await prisma.$transaction(
        carry.map((t) => {
          const order =
            t.status === "TODO" ? ++todoOrder : t.status === "IN_PROGRESS" ? ++inProgressOrder : 0;
          return prisma.task.update({
            where: { id: t.id },
            data: { boardId: created.id, order },
          });
        }),
      );
    }
  }

  return created;
}

