/*
  Warnings:

  - Added the required column `boardId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Task_status_order_idx";

-- CreateTable
CREATE TABLE "BoardWeek" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekStart" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,

    CONSTRAINT "BoardWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardWeek_weekStart_key" ON "BoardWeek"("weekStart");

-- CreateIndex
CREATE INDEX "BoardWeek_weekStart_idx" ON "BoardWeek"("weekStart");

-- Seed a legacy board for existing tasks (development only)
INSERT INTO "BoardWeek" ("id", "weekStart", "weekEnd")
VALUES ('bw_legacy', 'legacy', 'legacy')
ON CONFLICT ("weekStart") DO NOTHING;

-- AlterTable (nullable first to backfill existing rows)
ALTER TABLE "Task" ADD COLUMN "boardId" TEXT;

UPDATE "Task" SET "boardId" = 'bw_legacy' WHERE "boardId" IS NULL;

ALTER TABLE "Task" ALTER COLUMN "boardId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Task_boardId_status_order_idx" ON "Task"("boardId", "status", "order");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "BoardWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
