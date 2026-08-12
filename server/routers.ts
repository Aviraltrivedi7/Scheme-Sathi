import { COOKIE_NAME } from "@shared/const";
import { applicationStatuses } from "@shared/applicationTracker";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { approveApplicationDocumentOcr, approveBatchDocumentOcr, assignReminderHeartbeat, cancelApplicationReminder, createApplicationReminder, exportDocumentVerificationHistoryPdf, getApplicationDocumentPreview, getDocumentReminderSetting, getOcrPolicy, getSchemeById, getUserSchemeProfile, listDocumentExpiryNotifications, listDocumentVerificationHistory, listSavedSchemeIds, listSavedVerificationHistoryFilters, listSchemeCatalog, listTrackedApplications, markDocumentExpiryNotificationRead, removeApplicationDocument, removeSavedVerificationHistoryFilter, runApplicationDocumentOcr, runBatchDocumentOcr, saveDocumentReminderTask, saveUserSchemeProfile, saveVerificationHistoryFilter, toggleSavedScheme, trackSchemeApplication, updateApplicationDocumentExpiry, updateOcrPolicy, updateSchemeAdmin, updateTrackedApplication, uploadApplicationDocument } from "./db";
import { buildReminderCron } from "./applicationReminder";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, deleteHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
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
const timelineFilters = z.object({ startAt: z.number().int().positive().optional(), endAt: z.number().int().positive().optional(), sort: z.enum(["newest", "oldest"]).optional() }).refine((input) => !input.startAt || !input.endAt || input.startAt <= input.endAt, { message: "Start date must precede end date." });
const savedTimelineFilterInput = z.object({ name: z.string().trim().min(1).max(80), query: z.string().trim().max(120), startAt: z.number().int().positive().optional(), endAt: z.number().int().positive().optional(), sort: z.enum(["newest", "oldest"]) }).refine((input) => !input.startAt || !input.endAt || input.startAt <= input.endAt, { message: "Start date must precede end date." });

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
    list: protectedProcedure.query(async ({ ctx }) => ({ applications: await listTrackedApplications(ctx.user.id), ocrPolicy: await getOcrPolicy() })),
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
  documents: router({
    upload: protectedProcedure.input(z.object({ trackedApplicationId: z.number().int().positive(), documentName: z.string().min(1).max(255), fileName: z.string().min(1).max(180), mimeType: z.string().min(1).max(128), base64Data: z.string().min(1).max(8_000_000), expiresAt: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => ({ document: await uploadApplicationDocument(ctx.user.id, input.trackedApplicationId, input.documentName, input.fileName, input.mimeType, input.base64Data, input.expiresAt) })),
    remove: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await removeApplicationDocument(ctx.user.id, input.documentId); return { removed: true }; }),
    updateExpiry: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), expiresAt: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => { await updateApplicationDocumentExpiry(ctx.user.id, input.documentId, input.expiresAt); return { updated: true }; }),
    preview: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).query(async ({ ctx, input }) => ({ preview: await getApplicationDocumentPreview(ctx.user.id, input.documentId) })),
    extract: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ extraction: await runApplicationDocumentOcr(ctx.user.id, input.documentId) })),
    approveOcr: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await approveApplicationDocumentOcr(ctx.user.id, input.documentId); return { approved: true }; }),
    history: protectedProcedure.input(timelineFilters.optional()).query(async ({ ctx, input }) => ({ events: await listDocumentVerificationHistory(ctx.user.id, input) })),
    exportHistoryPdf: protectedProcedure.input(timelineFilters.optional()).mutation(async ({ ctx, input }) => exportDocumentVerificationHistoryPdf(ctx.user.id, input)),
    batchExtract: protectedProcedure.input(z.object({ documentIds: z.array(z.number().int().positive()).min(1).max(5) })).mutation(async ({ ctx, input }) => ({ outcomes: await runBatchDocumentOcr(ctx.user.id, Array.from(new Set(input.documentIds))) })),
    batchApproveOcr: protectedProcedure.input(z.object({ documentIds: z.array(z.number().int().positive()).min(1).max(10) })).mutation(async ({ ctx, input }) => ({ outcomes: await approveBatchDocumentOcr(ctx.user.id, Array.from(new Set(input.documentIds))) })),
    historyFilters: router({
      list: protectedProcedure.query(async ({ ctx }) => ({ filters: await listSavedVerificationHistoryFilters(ctx.user.id) })),
      save: protectedProcedure.input(savedTimelineFilterInput).mutation(async ({ ctx, input }) => ({ filter: await saveVerificationHistoryFilter(ctx.user.id, input) })),
      remove: protectedProcedure.input(z.object({ filterId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await removeSavedVerificationHistoryFilter(ctx.user.id, input.filterId); return { removed: true }; }),
    }),
    notifications: protectedProcedure.query(async ({ ctx }) => ({ notifications: await listDocumentExpiryNotifications(ctx.user.id) })),
    markNotificationRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await markDocumentExpiryNotificationRead(ctx.user.id, input.notificationId); return { marked: true }; }),
  }),
  admin: router({
    schemes: router({
      list: adminProcedure.query(async () => ({ schemes: await listSchemeCatalog({ sort: "name" }) })),
      update: adminProcedure.input(z.object({ schemeId: z.string().min(1).max(96), name: z.string().min(3).max(255).optional(), nameHindi: z.string().min(3).max(255).optional(), administeringBody: z.string().min(3).max(255).optional(), benefits: z.string().min(10).max(3000).optional(), benefitsHindi: z.string().min(10).max(3000).optional(), portalUrl: z.string().url().max(512).optional(), applicationDeadline: z.number().int().positive().nullable().optional(), deadlineLabel: z.string().max(255).nullable().optional(), reviewed: z.string().min(3).max(64).optional() })).mutation(async ({ input }) => {
        const { schemeId, ...patch } = input;
        return { scheme: await updateSchemeAdmin(schemeId, patch) };
      }),
    }),
    documentAutomation: router({
      status: adminProcedure.query(async () => ({ setting: await getDocumentReminderSetting() })),
      enable: adminProcedure.mutation(async ({ ctx }) => {
        const existing = await getDocumentReminderSetting();
        if (existing?.scheduleCronTaskUid) return { setting: existing, alreadyEnabled: true };
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const job = await createHeartbeatJob({ name: "scheme-sathi-document-expiry-daily", cron: "0 0 3 * * *", path: "/api/scheduled/document-expiry-reminders", payload: {}, description: "Daily scan for expiring or expired Scheme Sathi document uploads" }, sessionToken);
        return { setting: await saveDocumentReminderTask(job.taskUid), alreadyEnabled: false, nextExecutionAt: job.nextExecutionAt ?? null };
      }),
    }),
    ocrPolicy: router({
      get: adminProcedure.query(async () => ({ policy: await getOcrPolicy() })),
      update: adminProcedure.input(z.object({ minimumConfidence: z.enum(["low", "medium", "high"]) })).mutation(async ({ ctx, input }) => ({ policy: await updateOcrPolicy(ctx.user.id, input.minimumConfidence) })),
    }),
  }),
});

export type AppRouter = typeof appRouter;
