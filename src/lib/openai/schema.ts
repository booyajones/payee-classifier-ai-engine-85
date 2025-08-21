import { z } from 'zod';

export const classificationResponseSchema = z.array(
  z.object({
    name: z.string(),
    classification: z.enum(['Business', 'Individual']),
    confidence: z.number().min(0).max(100),
    reasoning: z.string()
  })
);

export type ClassificationResponse = z.infer<typeof classificationResponseSchema>;
