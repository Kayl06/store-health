import { z } from "zod";

export const storeCheckRequestSchema = z.object({
  url: z.string(),
});

export const storeCheckOutcomeSchema = z.enum([
  "ok",
  "password_protected",
  "http_error",
  "blocked_redirect",
  "too_many_redirects",
  "timeout",
  "unreachable",
]);

export const storeCheckRedirectSchema = z.object({
  from: z.string(),
  to: z.string(),
  statusCode: z.number().int(),
});

export const storeCheckResultSchema = z.object({
  origin: z.string(),
  outcome: storeCheckOutcomeSchema,
  statusCode: z.number().int().nullable(),
  finalUrl: z.string(),
  redirects: z.array(storeCheckRedirectSchema),
  isShopify: z.boolean(),
  responseTimeMs: z.number().int().nonnegative(),
  checkedAt: z.iso.datetime(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(["invalid_url", "invalid_request"]),
    message: z.string(),
  }),
});

export type StoreCheckRequest = z.infer<typeof storeCheckRequestSchema>;
export type StoreCheckOutcome = z.infer<typeof storeCheckOutcomeSchema>;
export type StoreCheckRedirect = z.infer<typeof storeCheckRedirectSchema>;
export type StoreCheckResult = z.infer<typeof storeCheckResultSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
