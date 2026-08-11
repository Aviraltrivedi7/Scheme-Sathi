import { COOKIE_NAME } from "@shared/const";
import { applicationStatuses } from "@shared/applicationTracker";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { assignReminderHeartbeat, cancelApplicationReminder, createApplicationReminder, getSchemeById, getUserSchemeProfile, listSavedSchemeIds, listSchemeCatalog, listTrackedApplications, saveUserSchemeProfile, toggleSavedScheme, trackSchemeApplication, updateTrackedApplication } from "./db";
import { buildReminderCron } from "./applicationReminder";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, deleteHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { rankSchemes } from "./schemeMatching";

const profileInput = z.object({
  age: z.number().int().min(0).max(120),
  state: z.string().min(1).max(96),
  caste: z.string().min(1).max(64),
  annualIncome: z.number().int().min(0).max(100000000),
  occupation: z.string().min(1).max(96),
  gender: z.string().min(1).max(32),
  isStudent: z.boolean(),
  isFarmer: z.boolean(),
  isDisabled: z.boolean(),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  schemes: router({
    list: publicProcedure.input(z.object({ category: z.string().optional(), level: z.enum(["Central", "State"]).optional(), state: z.string().optional(), deadline: z.enum(["announced", "closingSoon", "openEnded"]).optional(), sort: z.enum(["name", "category", "deadline", "reviewed"]).optional(), query: z.string().max(120).optional() }).optional()).query(async ({ input }) => ({ schemes: await listSchemeCatalog(input) })),
    byId: publicProcedure.input(z.object({ schemeId: z.string().min(1).max(96) })).query(async ({ input }) => ({ scheme: await getSchemeById(input.schemeId) ?? null })),
  }),
  matching: router({
    run: publicProcedure.input(profileInput).mutation(async ({ input }) => {
      const catalog = await listSchemeCatalog();
      return { matches: rankSchemes(input, catalog), generatedAt: Date.now() };
    }),
  }),
  profile: router({
    mine: protectedProcedure.query(async ({ ctx }) => ({ profile: await getUserSchemeProfile(ctx.user.id) })),
    save: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => ({ profile: await saveUserSchemeProfile(ctx.user.id, input) })),
  }),
  saved: router({
    list: protectedProcedure.query(async ({ ctx }) => ({ schemeIds: await listSavedSchemeIds(ctx.user.id) })),
    toggle: protectedProcedure.input(z.object({ schemeId: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => {
      const scheme = await getSchemeById(input.schemeId);
      if (!scheme) throw new Error("Scheme not found");
      return toggleSavedScheme(ctx.user.id, input.schemeId);
    }),
  }),
  applications: router({
    list: protectedProcedure.query(async ({ ctx }) => ({ applications: await listTrackedApplications(ctx.user.id) })),
    track: protectedProcedure.input(z.object({ schemeId: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => ({ application: await trackSchemeApplication(ctx.user.id, input.schemeId) })),
    update: protectedProcedure.input(z.object({ trackedApplicationId: z.number().int().positive(), status: z.enum(applicationStatuses).optional(), applicationReference: z.string().max(128).nullable().optional(), applicationDeadline: z.number().int().positive().nullable().optional(), deadlineLabel: z.string().max(255).nullable().optional(), notes: z.string().max(4000).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const { trackedApplicationId, ...patch } = input;
      return { application: await updateTrackedApplication(ctx.user.id, trackedApplicationId, patch) };
    }),
  }),
  reminders: router({
    create: protectedProcedure.input(z.object({ trackedApplicationId: z.number().int().positive(), remindAt: z.number().int().positive() }).refine((input) => input.remindAt > Date.now() + 60_000, { message: "Choose a reminder at least one minute from now." })).mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const reminder = await createApplicationReminder(ctx.user.id, input.trackedApplicationId, input.remindAt);
      try {
        const job = await createHeartbeatJob({ name: `scheme-sathi-reminder-${ctx.user.id}-${reminder.id}`, cron: buildReminderCron(input.remindAt), path: "/api/scheduled/application-reminder", payload: {}, description: `One-time Scheme Sathi application reminder ${reminder.id}` }, sessionToken);
        return { reminder: await assignReminderHeartbeat(ctx.user.id, reminder.id, job.taskUid), nextExecutionAt: job.nextExecutionAt ?? null };
      } catch (error) {
        await cancelApplicationReminder(ctx.user.id, reminder.id);
        throw error;
      }
    }),
    cancel: protectedProcedure.input(z.object({ reminderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const reminder = await cancelApplicationReminder(ctx.user.id, input.reminderId);
      if (reminder.scheduleCronTaskUid) await deleteHeartbeatJob(reminder.scheduleCronTaskUid, sessionToken);
      return { reminderId: input.reminderId, cancelled: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
