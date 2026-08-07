import { z } from "zod";

export const MessageSchema = z.object({
  message_id: z.string(),
  in_reply_to: z.string().nullable().optional(),
  references: z.array(z.string()).nullable().optional(),
  subject: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  sent_at: z.string(),
});

export const PageSchema = z.object({
  items: z.array(MessageSchema),
  next_cursor: z.string().nullable(),
});

export type ProviderMessage = z.infer<typeof MessageSchema>;
export type ProviderPage = z.infer<typeof PageSchema>;
