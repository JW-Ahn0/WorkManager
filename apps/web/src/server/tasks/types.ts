import "server-only";

import { z } from "zod";

export const TaskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: TaskStatusSchema,
  order: z.number(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

