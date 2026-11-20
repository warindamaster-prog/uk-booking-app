import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
  password: z.string().min(10, "Use at least 10 characters").max(72, "Use 72 characters or fewer"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
  password: z.string().min(1, "Enter your password").max(72),
});

export const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
});

export const resetSchema = z.object({
  password: z.string().min(10, "Use at least 10 characters").max(72, "Use 72 characters or fewer"),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: "The two passwords don't match", path: ["confirm"] });
