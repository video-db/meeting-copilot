import { z } from 'zod';

export const RegisterInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  apiKey: z.string().min(1, 'API key is required'),
});

export const RegisterOutputSchema = z.object({
  success: z.boolean(),
  accessToken: z.string().optional(),
  name: z.string().optional(),
  error: z.string().optional(),
});

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  apiKey: z.string(),
  accessToken: z.string(),
});

export const SessionTokenSchema = z.object({
  sessionToken: z.string(),
  expiresIn: z.number(),
  expiresAt: z.number(),
});

export const GenerateTokenInputSchema = z.object({
  userId: z.string().optional(),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type RegisterOutput = z.infer<typeof RegisterOutputSchema>;
export type User = z.infer<typeof UserSchema>;
export type SessionToken = z.infer<typeof SessionTokenSchema>;
export type GenerateTokenInput = z.infer<typeof GenerateTokenInputSchema>;
