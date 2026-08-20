import { COOKIE_NAME } from "@shared/const";
import { applicationStatuses } from "@shared/applicationTracker";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  approveApplicationDocumentOcr,
  approveBatchDocumentOcr,
  assignDocumentReviewer,
  assignDocumentReviewDueReminderTask,
  assignDocumentReviewSnoozeTask,
  assignReminderHeartbeat,
  cancelApplicationReminder,
  cancelDocumentReviewDueReminder,
  createApplicationReminder,
  createPilotCohortInvite,
  createPilotFeedbackSubmission,
  deleteComparisonExportPreset,
  deletePilotDashboardView,
  deleteDocumentPdfAnnotation,
  deleteDocumentReviewEscalationTemplate,
  deleteSchemeNote,
  exportDocumentVerificationHistoryCsv,
  exportDocumentVerificationHistoryPdf,
  getApplicationDocumentPreview,
  getDocumentReminderSetting,
  getDocumentReviewerAlertPreferences,
  getMyDocumentReviewWorkload,
  getOcrPolicy,
  getPublicPilotCohortInvite,
  getSchemeCatalogFilterOptions,
  getSchemeById,
  getSchemeNote,
  getUserSchemeProfile,
  listDocumentExpiryNotifications,
  listDocumentPdfAnnotations,
  listDocumentReviewAssignmentNotifications,
  listDocumentReviewAssignments,
  listDocumentReviewAudit,
  listDocumentReviewEscalationTemplates,
  listDocumentVerificationHistory,
  listComparisonExportPresets,
  listFamilyFilterInvitationNotifications,
  listMyDocumentReviewAssignments,
  listOwnerOverdueDocumentReviews,
  listPilotCohortInvites,
  listPilotCohortConversionStats,
  listPilotCohortMonthlyConversionTrend,
  listPilotDashboardViews,
  listPilotFeedbackForAdmin,
  listReceivedVerificationHistoryFilterInvites,
  listReceivedVerificationHistoryFilters,
  listSavedSchemeIds,
  listSavedSchemeNotes,
  listVerificationHistoryFilterShares,
  listSavedVerificationHistoryFilters,
  listSchemeCatalog,
  listTrackedApplications,
  markDocumentExpiryNotificationRead,
  markDocumentReviewAssignmentNotificationRead,
  markFamilyFilterInvitationNotificationRead,
  movePilotDashboardViewsToFolder,
  renamePilotDashboardViewFolder,
  removeApplicationDocument,
  removeSavedVerificationHistoryFilter,
  respondToVerificationHistoryFilterInvite,
  revokeDocumentReviewer,
  revokePilotCohortInvite,
  revokeVerificationHistoryFilterShare,
  recordPilotCohortSignup,
  recordPilotCohortVisit,
  reorderPinnedPilotDashboardViews,
  runApplicationDocumentOcr,
  runBatchDocumentOcr,
  saveComparisonExportPreset,
  savePilotDashboardView,
  saveDocumentPdfAnnotation,
  saveDocumentReminderTask,
  saveDocumentReviewerAlertPreferences,
  saveDocumentReviewEscalationTemplate,
  saveUserSchemeProfile,
  saveVerificationHistoryFilter,
  setApplicationDocumentReviewState,
  setPilotDashboardViewPinned,
  setDefaultVerificationHistoryFilter,
  setDocumentReviewAssignmentDueDate,
  setDocumentReviewEscalation,
  shareVerificationHistoryFilter,
  snoozeDocumentReviewDueReminder,
  toggleSavedScheme,
  trackSchemeApplication,
  updateApplicationDocumentExpiry,
  updateMyDocumentReviewAssignment,
  updateOcrPolicy,
  updatePilotFeedbackForAdmin,
  updateSchemeAdmin,
  updateTrackedApplication,
  uploadApplicationDocument,
  upsertSchemeNote,
} from "./db";
import { buildReminderCron } from "./applicationReminder";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, deleteHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { consumePilotFeedbackQuota } from "./pilotFeedback";
import { rankScholarshipSchemes, rankSchemes } from "./schemeMatching";

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
const scholarshipProfileInput = z.object({
  age: z.number().int().min(10).max(45),
  state: z.string().trim().min(1).max(96),
  caste: z.string().trim().min(1).max(64),
  annualIncome: z.number().int().min(0).max(100000000),
  gender: z.string().trim().min(1).max(32),
  isDisabled: z.boolean(),
});
const pilotDashboardViewFiltersInput = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    segment: z.enum(["all", "college", "ngo"]),
    view: z.enum(["month", "quarter"]),
  })
  .refine(input => !input.from || !input.to || input.from <= input.to, {
    message: "Dashboard view start date must be before the end date.",
  });
const pilotFeedbackInput = z
  .object({
    role: z.enum(["student", "parent", "collegeStaff", "ngoStaff", "other"]),
    state: z.string().trim().min(2).max(96),
    journeyStage: z.enum([
      "searching",
      "preparing",
      "applying",
      "missedDeadline",
      "other",
    ]),
    biggestBlocker: z.string().trim().min(4).max(500),
    helpfulToday: z.string().trim().min(4).max(500),
    contactEmail: z.string().trim().email().max(320).optional(),
    contactConsent: z.boolean(),
    cohortCode: z.string().trim().min(8).max(32).optional(),
  })
  .refine(input => !input.contactConsent || Boolean(input.contactEmail), {
    message: "Add an email only if you want pilot follow-up.",
  })
  .refine(input => input.contactConsent || !input.contactEmail, {
    message: "Confirm permission before sharing an email address.",
  });
const timelineFilters = z
  .object({
    startAt: z.number().int().positive().optional(),
    endAt: z.number().int().positive().optional(),
    sort: z.enum(["newest", "oldest"]).optional(),
    query: z.string().trim().max(120).optional(),
  })
  .refine(
    input => !input.startAt || !input.endAt || input.startAt <= input.endAt,
    { message: "Start date must precede end date." }
  );
const savedTimelineFilterInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    query: z.string().trim().max(120),
    startAt: z.number().int().positive().optional(),
    endAt: z.number().int().positive().optional(),
    sort: z.enum(["newest", "oldest"]),
  })
  .refine(
    input => !input.startAt || !input.endAt || input.startAt <= input.endAt,
    { message: "Start date must precede end date." }
  );
const reviewAuditStatuses = [
  "assigned",
  "started",
  "completed",
  "revoked",
  "noteCreated",
  "noteUpdated",
  "noteDeleted",
  "dueReminderSent",
  "reminderSnoozed",
  "escalated",
  "escalationResolved",
] as const;
const reviewAuditFilters = z
  .object({
    documentId: z.number().int().positive(),
    startAt: z.number().int().positive().optional(),
    endAt: z.number().int().positive().optional(),
    statuses: z
      .array(z.enum(reviewAuditStatuses))
      .max(reviewAuditStatuses.length)
      .optional(),
  })
  .refine(
    input => !input.startAt || !input.endAt || input.startAt <= input.endAt,
    { message: "Start date must precede end date." }
  );
const reviewerAlertPreferenceInput = z.object({
  assignmentAlertsEnabled: z.boolean(),
  dueDateRemindersEnabled: z.boolean(),
  defaultReminderLeadHours: z.number().int().min(1).max(168),
  maxActiveAssignments: z.number().int().min(1).max(50),
});
const reviewerDueDateInput = z
  .object({
    assignmentId: z.number().int().positive(),
    dueAt: z.number().int().positive().nullable(),
    reminderAt: z.number().int().positive().nullable(),
  })
  .refine(input => !input.reminderAt || Boolean(input.dueAt), {
    message: "Choose a review due date before scheduling a reminder.",
  })
  .refine(
    input =>
      !input.dueAt || !input.reminderAt || input.reminderAt < input.dueAt,
    { message: "The reminder must be before the review due date." }
  )
  .refine(
    input => !input.reminderAt || input.reminderAt > Date.now() + 60_000,
    { message: "Choose a reminder at least one minute in the future." }
  );
const reviewEscalationInput = z.object({
  assignmentId: z.number().int().positive(),
  action: z.enum(["escalate", "resolve"]),
  note: z.string().trim().max(500).optional(),
});
const reviewSnoozeInput = z
  .object({
    assignmentId: z.number().int().positive(),
    snoozeUntil: z.number().int().positive(),
  })
  .refine(input => input.snoozeUntil > Date.now() + 60_000, {
    message: "Choose a snooze time at least one minute in the future.",
  });
const escalationTemplateInput = z.object({
  templateId: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(500),
});
const schemeNoteInput = z.object({
  schemeId: z.string().min(1).max(96),
  note: z.string().trim().min(1).max(4000),
});
const comparisonExportFieldInput = z.enum([
  "matchScore",
  "benefit",
  "eligibility",
  "documents",
  "steps",
  "officialPortal",
]);
const comparisonExportPresetInput = z
  .object({
    name: z.string().trim().min(1).max(60),
    fields: z.array(comparisonExportFieldInput).min(1).max(6),
  })
  .refine(input => new Set(input.fields).size === input.fields.length, {
    message: "Choose each export field only once.",
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
    list: publicProcedure
      .input(
        z
          .object({
            category: z.string().optional(),
            level: z.enum(["Central", "State"]).optional(),
            state: z.string().optional(),
            deadline: z
              .enum(["announced", "closingSoon", "openEnded"])
              .optional(),
            administeringBody: z.string().trim().min(1).max(255).optional(),
            verificationStatus: z
              .enum(["officialDirectory", "eligibilityVerified"])
              .optional(),
            sort: z
              .enum(["name", "category", "deadline", "reviewed", "provider"])
              .optional(),
            query: z.string().max(120).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => ({
        schemes: await listSchemeCatalog(input),
      })),
    filterOptions: publicProcedure.query(async () =>
      getSchemeCatalogFilterOptions()
    ),
    byId: publicProcedure
      .input(z.object({ schemeId: z.string().min(1).max(96) }))
      .query(async ({ input }) => ({
        scheme: (await getSchemeById(input.schemeId)) ?? null,
      })),
  }),
  matching: router({
    run: publicProcedure.input(profileInput).mutation(async ({ input }) => {
      const catalog = await listSchemeCatalog();
      return { matches: rankSchemes(input, catalog), generatedAt: Date.now() };
    }),
  }),
  scholarships: router({
    checkEligibility: publicProcedure
      .input(scholarshipProfileInput)
      .mutation(async ({ input }) => {
        const catalog = await listSchemeCatalog({ category: "Education" });
        const profile = {
          ...input,
          occupation: "Student",
          isStudent: true,
          isFarmer: false,
        };
        return {
          matches: rankScholarshipSchemes(profile, catalog),
          checkedAt: Date.now(),
          disclaimer:
            "Potential matches only. Verify current eligibility, documents, and deadlines on the official portal before applying.",
        };
      }),
  }),
  pilot: router({
    cohort: publicProcedure
      .input(z.object({ code: z.string().trim().min(8).max(32) }))
      .query(async ({ input }) => ({
        invite: await getPublicPilotCohortInvite(input.code),
      })),
    trackCohortVisit: publicProcedure
      .input(
        z.object({
          code: z.string().trim().min(8).max(32),
          visitorToken: z.string().uuid(),
        })
      )
      .mutation(async ({ input }) =>
        recordPilotCohortVisit(input.code, input.visitorToken)
      ),
    recordCohortSignup: protectedProcedure
      .input(z.object({ code: z.string().trim().min(8).max(32) }))
      .mutation(async ({ ctx, input }) =>
        recordPilotCohortSignup(ctx.user.id, input.code)
      ),
    submitFeedback: publicProcedure
      .input(pilotFeedbackInput)
      .mutation(async ({ ctx, input }) => {
        if (!consumePilotFeedbackQuota(ctx.req.ip || "unknown")) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Thanks — please wait a few minutes before sending another response.",
          });
        }
        return {
          submission: await createPilotFeedbackSubmission(input),
        };
      }),
  }),
  profile: router({
    mine: protectedProcedure.query(async ({ ctx }) => ({
      profile: await getUserSchemeProfile(ctx.user.id),
    })),
    save: protectedProcedure
      .input(profileInput)
      .mutation(async ({ ctx, input }) => ({
        profile: await saveUserSchemeProfile(ctx.user.id, input),
      })),
  }),
  saved: router({
    list: protectedProcedure.query(async ({ ctx }) => ({
      schemeIds: await listSavedSchemeIds(ctx.user.id),
    })),
    notes: protectedProcedure
      .input(z.object({ query: z.string().trim().max(120).optional() }).optional())
      .query(async ({ ctx, input }) => ({
        notes: await listSavedSchemeNotes(ctx.user.id, input?.query),
      })),
    toggle: protectedProcedure
      .input(z.object({ schemeId: z.string().min(1).max(96) }))
      .mutation(async ({ ctx, input }) => {
        const scheme = await getSchemeById(input.schemeId);
        if (!scheme) throw new Error("Scheme not found");
        return toggleSavedScheme(ctx.user.id, input.schemeId);
      }),
    getNote: protectedProcedure
      .input(z.object({ schemeId: z.string().min(1).max(96) }))
      .query(async ({ ctx, input }) => ({
        note: await getSchemeNote(ctx.user.id, input.schemeId),
      })),
    upsertNote: protectedProcedure
      .input(schemeNoteInput)
      .mutation(async ({ ctx, input }) => ({
        note: await upsertSchemeNote(ctx.user.id, input.schemeId, input.note),
      })),
    deleteNote: protectedProcedure
      .input(z.object({ schemeId: z.string().min(1).max(96) }))
      .mutation(async ({ ctx, input }) => {
        await deleteSchemeNote(ctx.user.id, input.schemeId);
        return { deleted: true };
      }),
  }),
  comparisonExports: router({
    listPresets: protectedProcedure.query(async ({ ctx }) => ({
      presets: await listComparisonExportPresets(ctx.user.id),
    })),
    savePreset: protectedProcedure
      .input(comparisonExportPresetInput)
      .mutation(async ({ ctx, input }) => ({
        preset: await saveComparisonExportPreset(
          ctx.user.id,
          input.name,
          input.fields
        ),
      })),
    deletePreset: protectedProcedure
      .input(z.object({ presetId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteComparisonExportPreset(ctx.user.id, input.presetId);
        return { deleted: true };
      }),
  }),
  applications: router({
    list: protectedProcedure.query(async ({ ctx }) => ({
      applications: await listTrackedApplications(ctx.user.id),
      ocrPolicy: await getOcrPolicy(),
    })),
    track: protectedProcedure
      .input(z.object({ schemeId: z.string().min(1).max(96) }))
      .mutation(async ({ ctx, input }) => ({
        application: await trackSchemeApplication(ctx.user.id, input.schemeId),
      })),
    update: protectedProcedure
      .input(
        z.object({
          trackedApplicationId: z.number().int().positive(),
          status: z.enum(applicationStatuses).optional(),
          applicationReference: z.string().max(128).nullable().optional(),
          applicationDeadline: z
            .number()
            .int()
            .positive()
            .nullable()
            .optional(),
          deadlineLabel: z.string().max(255).nullable().optional(),
          notes: z.string().max(4000).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { trackedApplicationId, ...patch } = input;
        return {
          application: await updateTrackedApplication(
            ctx.user.id,
            trackedApplicationId,
            patch
          ),
        };
      }),
  }),
  reminders: router({
    create: protectedProcedure
      .input(
        z
          .object({
            trackedApplicationId: z.number().int().positive(),
            remindAt: z.number().int().positive(),
          })
          .refine(input => input.remindAt > Date.now() + 60_000, {
            message: "Choose a reminder at least one minute from now.",
          })
      )
      .mutation(async ({ ctx, input }) => {
        const sessionToken =
          parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const reminder = await createApplicationReminder(
          ctx.user.id,
          input.trackedApplicationId,
          input.remindAt
        );
        try {
          const job = await createHeartbeatJob(
            {
              name: `scheme-sathi-reminder-${ctx.user.id}-${reminder.id}`,
              cron: buildReminderCron(input.remindAt),
              path: "/api/scheduled/application-reminder",
              payload: {},
              description: `One-time Scheme Sathi application reminder ${reminder.id}`,
            },
            sessionToken
          );
          return {
            reminder: await assignReminderHeartbeat(
              ctx.user.id,
              reminder.id,
              job.taskUid
            ),
            nextExecutionAt: job.nextExecutionAt ?? null,
          };
        } catch (error) {
          await cancelApplicationReminder(ctx.user.id, reminder.id);
          throw error;
        }
      }),
    cancel: protectedProcedure
      .input(z.object({ reminderId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const sessionToken =
          parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const reminder = await cancelApplicationReminder(
          ctx.user.id,
          input.reminderId
        );
        if (reminder.scheduleCronTaskUid)
          await deleteHeartbeatJob(reminder.scheduleCronTaskUid, sessionToken);
        return { reminderId: input.reminderId, cancelled: true };
      }),
  }),
  documents: router({
    upload: protectedProcedure
      .input(
        z.object({
          trackedApplicationId: z.number().int().positive(),
          documentName: z.string().min(1).max(255),
          fileName: z.string().min(1).max(180),
          mimeType: z.string().min(1).max(128),
          base64Data: z.string().min(1).max(8_000_000),
          expiresAt: z.number().int().positive().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const document = await uploadApplicationDocument(
          ctx.user.id,
          input.trackedApplicationId,
          input.documentName,
          input.fileName,
          input.mimeType,
          input.base64Data,
          input.expiresAt
        );
        return {
          document: {
            id: document.id,
            documentName: document.documentName,
            fileName: document.fileName,
            mimeType: document.mimeType,
            expiresAt: document.expiresAt?.getTime() ?? null,
          },
        };
      }),
    remove: protectedProcedure
      .input(z.object({ documentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await removeApplicationDocument(ctx.user.id, input.documentId);
        return { removed: true };
      }),
    updateExpiry: protectedProcedure
      .input(
        z.object({
          documentId: z.number().int().positive(),
          expiresAt: z.number().int().positive().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateApplicationDocumentExpiry(
          ctx.user.id,
          input.documentId,
          input.expiresAt
        );
        return { updated: true };
      }),
    preview: protectedProcedure
      .input(z.object({ documentId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => ({
        preview: await getApplicationDocumentPreview(
          ctx.user.id,
          input.documentId
        ),
      })),
    extract: protectedProcedure
      .input(z.object({ documentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({
        extraction: await runApplicationDocumentOcr(
          ctx.user.id,
          input.documentId
        ),
      })),
    approveOcr: protectedProcedure
      .input(z.object({ documentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await approveApplicationDocumentOcr(ctx.user.id, input.documentId);
        return { approved: true };
      }),
    setReviewState: protectedProcedure
      .input(
        z.object({
          documentId: z.number().int().positive(),
          reviewState: z.enum(["reviewed", "flagged", "unreviewed"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await setApplicationDocumentReviewState(
          ctx.user.id,
          input.documentId,
          input.reviewState
        );
        return { updated: true };
      }),
    reviewers: router({
      list: protectedProcedure
        .input(z.object({ documentId: z.number().int().positive() }))
        .query(async ({ ctx, input }) => ({
          assignments: await listDocumentReviewAssignments(
            ctx.user.id,
            input.documentId
          ),
        })),
      assign: protectedProcedure
        .input(
          z.object({
            documentId: z.number().int().positive(),
            reviewerEmail: z.string().trim().email().max(320),
          })
        )
        .mutation(async ({ ctx, input }) => ({
          assignments: await assignDocumentReviewer(
            ctx.user.id,
            input.documentId,
            input.reviewerEmail
          ),
        })),
      revoke: protectedProcedure
        .input(z.object({ assignmentId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          const result = await revokeDocumentReviewer(
            ctx.user.id,
            input.assignmentId
          );
          const sessionToken =
            parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
          if (result.previousTaskUid)
            await deleteHeartbeatJob(
              result.previousTaskUid,
              sessionToken
            ).catch(() => undefined);
          return { revoked: true };
        }),
      mine: protectedProcedure.query(async ({ ctx }) => ({
        assignments: await listMyDocumentReviewAssignments(ctx.user.id),
      })),
      updateMine: protectedProcedure
        .input(
          z.object({
            assignmentId: z.number().int().positive(),
            status: z.enum(["inReview", "completed"]),
          })
        )
        .mutation(async ({ ctx, input }) => {
          await updateMyDocumentReviewAssignment(
            ctx.user.id,
            input.assignmentId,
            input.status
          );
          return { updated: true };
        }),
      audit: protectedProcedure
        .input(reviewAuditFilters)
        .query(async ({ ctx, input }) => ({
          events: await listDocumentReviewAudit(ctx.user.id, input.documentId, {
            startAt: input.startAt,
            endAt: input.endAt,
            kinds: input.statuses,
          }),
        })),
      notifications: protectedProcedure.query(async ({ ctx }) => ({
        notifications: await listDocumentReviewAssignmentNotifications(
          ctx.user.id
        ),
      })),
      markNotificationRead: protectedProcedure
        .input(z.object({ notificationId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          await markDocumentReviewAssignmentNotificationRead(
            ctx.user.id,
            input.notificationId
          );
          return { marked: true };
        }),
      preferences: router({
        get: protectedProcedure.query(async ({ ctx }) => ({
          preferences: await getDocumentReviewerAlertPreferences(ctx.user.id),
        })),
        save: protectedProcedure
          .input(reviewerAlertPreferenceInput)
          .mutation(async ({ ctx, input }) => ({
            preferences: await saveDocumentReviewerAlertPreferences(
              ctx.user.id,
              input
            ),
          })),
      }),
      dueDates: router({
        set: protectedProcedure
          .input(reviewerDueDateInput)
          .mutation(async ({ ctx, input }) => {
            const result = await setDocumentReviewAssignmentDueDate(
              ctx.user.id,
              input.assignmentId,
              input.dueAt,
              input.reminderAt
            );
            const sessionToken =
              parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
            if (result.previousTaskUid)
              await deleteHeartbeatJob(
                result.previousTaskUid,
                sessionToken
              ).catch(() => undefined);
            if (!input.reminderAt) return { scheduled: false, deferred: false };
            if (process.env.NODE_ENV !== "production")
              return { scheduled: false, deferred: true };
            const job = await createHeartbeatJob(
              {
                name: `scheme-sathi-review-due-${input.assignmentId}-${Date.now()}`,
                cron: buildReminderCron(input.reminderAt),
                path: "/api/scheduled/document-review-due-reminder",
                payload: {},
                description: `One-time reviewer due-date reminder for assignment ${input.assignmentId}`,
              },
              sessionToken
            );
            await assignDocumentReviewDueReminderTask(
              ctx.user.id,
              input.assignmentId,
              job.taskUid
            );
            return {
              scheduled: true,
              deferred: false,
              nextExecutionAt: job.nextExecutionAt ?? null,
            };
          }),
        cancel: protectedProcedure
          .input(z.object({ assignmentId: z.number().int().positive() }))
          .mutation(async ({ ctx, input }) => {
            const result = await cancelDocumentReviewDueReminder(
              ctx.user.id,
              input.assignmentId
            );
            const sessionToken =
              parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
            if (result.previousTaskUid)
              await deleteHeartbeatJob(
                result.previousTaskUid,
                sessionToken
              ).catch(() => undefined);
            return { cancelled: true };
          }),
      }),
      workload: protectedProcedure.query(async ({ ctx }) =>
        getMyDocumentReviewWorkload(ctx.user.id)
      ),
      overdue: protectedProcedure.query(async ({ ctx }) => ({
        reviews: await listOwnerOverdueDocumentReviews(ctx.user.id),
      })),
      escalation: protectedProcedure
        .input(reviewEscalationInput)
        .mutation(async ({ ctx, input }) => {
          await setDocumentReviewEscalation(ctx.user.id, input.assignmentId, {
            action: input.action,
            note: input.note,
          });
          return { updated: true };
        }),
      escalationTemplates: router({
        list: protectedProcedure.query(async ({ ctx }) => ({
          templates: await listDocumentReviewEscalationTemplates(ctx.user.id),
        })),
        save: protectedProcedure
          .input(escalationTemplateInput)
          .mutation(async ({ ctx, input }) => ({
            templateId: await saveDocumentReviewEscalationTemplate(
              ctx.user.id,
              input
            ),
          })),
        remove: protectedProcedure
          .input(z.object({ templateId: z.number().int().positive() }))
          .mutation(async ({ ctx, input }) => {
            await deleteDocumentReviewEscalationTemplate(
              ctx.user.id,
              input.templateId
            );
            return { removed: true };
          }),
      }),
      snooze: protectedProcedure
        .input(reviewSnoozeInput)
        .mutation(async ({ ctx, input }) => {
          const result = await snoozeDocumentReviewDueReminder(
            ctx.user.id,
            input.assignmentId,
            input.snoozeUntil
          );
          const sessionToken =
            parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
          if (result.previousTaskUid)
            await deleteHeartbeatJob(
              result.previousTaskUid,
              sessionToken
            ).catch(() => undefined);
          if (process.env.NODE_ENV !== "production")
            return { scheduled: false, deferred: true };
          const job = await createHeartbeatJob(
            {
              name: `scheme-sathi-review-snooze-${input.assignmentId}-${Date.now()}`,
              cron: buildReminderCron(input.snoozeUntil),
              path: "/api/scheduled/document-review-due-reminder",
              payload: {},
              description: `One-time reviewer reminder snooze for assignment ${input.assignmentId}`,
            },
            sessionToken
          );
          await assignDocumentReviewSnoozeTask(
            ctx.user.id,
            input.assignmentId,
            job.taskUid
          );
          return {
            scheduled: true,
            deferred: false,
            nextExecutionAt: job.nextExecutionAt ?? null,
          };
        }),
    }),
    annotations: router({
      list: protectedProcedure
        .input(z.object({ documentId: z.number().int().positive() }))
        .query(async ({ ctx, input }) => ({
          annotations: await listDocumentPdfAnnotations(
            ctx.user.id,
            input.documentId
          ),
        })),
      save: protectedProcedure
        .input(
          z.object({
            documentId: z.number().int().positive(),
            annotationId: z.number().int().positive().optional(),
            pageNumber: z.number().int().positive().max(2000),
            note: z.string().trim().min(1).max(4000),
          })
        )
        .mutation(async ({ ctx, input }) => ({
          annotationId: await saveDocumentPdfAnnotation(ctx.user.id, input),
        })),
      remove: protectedProcedure
        .input(z.object({ annotationId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          await deleteDocumentPdfAnnotation(ctx.user.id, input.annotationId);
          return { removed: true };
        }),
    }),
    history: protectedProcedure
      .input(timelineFilters.optional())
      .query(async ({ ctx, input }) => ({
        events: await listDocumentVerificationHistory(ctx.user.id, input),
      })),
    exportHistoryPdf: protectedProcedure
      .input(timelineFilters.optional())
      .mutation(async ({ ctx, input }) =>
        exportDocumentVerificationHistoryPdf(ctx.user.id, input)
      ),
    exportHistoryCsv: protectedProcedure
      .input(timelineFilters.optional())
      .mutation(async ({ ctx, input }) =>
        exportDocumentVerificationHistoryCsv(ctx.user.id, input)
      ),
    batchExtract: protectedProcedure
      .input(
        z.object({
          documentIds: z.array(z.number().int().positive()).min(1).max(5),
        })
      )
      .mutation(async ({ ctx, input }) => ({
        outcomes: await runBatchDocumentOcr(
          ctx.user.id,
          Array.from(new Set(input.documentIds))
        ),
      })),
    batchApproveOcr: protectedProcedure
      .input(
        z.object({
          documentIds: z.array(z.number().int().positive()).min(1).max(10),
        })
      )
      .mutation(async ({ ctx, input }) => ({
        outcomes: await approveBatchDocumentOcr(
          ctx.user.id,
          Array.from(new Set(input.documentIds))
        ),
      })),
    historyFilters: router({
      list: protectedProcedure.query(async ({ ctx }) => ({
        filters: await listSavedVerificationHistoryFilters(ctx.user.id),
        shares: await listVerificationHistoryFilterShares(ctx.user.id),
        received: await listReceivedVerificationHistoryFilters(ctx.user.id),
        invitations: await listReceivedVerificationHistoryFilterInvites(
          ctx.user.id
        ),
      })),
      save: protectedProcedure
        .input(savedTimelineFilterInput)
        .mutation(async ({ ctx, input }) => ({
          filter: await saveVerificationHistoryFilter(ctx.user.id, input),
        })),
      remove: protectedProcedure
        .input(z.object({ filterId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          await removeSavedVerificationHistoryFilter(
            ctx.user.id,
            input.filterId
          );
          return { removed: true };
        }),
      setDefault: protectedProcedure
        .input(z.object({ filterId: z.number().int().positive().nullable() }))
        .mutation(async ({ ctx, input }) => ({
          filters: await setDefaultVerificationHistoryFilter(
            ctx.user.id,
            input.filterId
          ),
        })),
      share: protectedProcedure
        .input(
          z.object({
            filterId: z.number().int().positive(),
            recipientEmail: z.string().trim().email().max(320),
          })
        )
        .mutation(async ({ ctx, input }) => ({
          shares: await shareVerificationHistoryFilter(
            ctx.user.id,
            input.filterId,
            input.recipientEmail
          ),
        })),
      revokeShare: protectedProcedure
        .input(z.object({ shareId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          await revokeVerificationHistoryFilterShare(
            ctx.user.id,
            input.shareId
          );
          return { revoked: true };
        }),
      respondToInvite: protectedProcedure
        .input(
          z.object({
            shareId: z.number().int().positive(),
            decision: z.enum(["accepted", "declined"]),
          })
        )
        .mutation(async ({ ctx, input }) => ({
          invitation: await respondToVerificationHistoryFilterInvite(
            ctx.user.id,
            input.shareId,
            input.decision
          ),
        })),
      notifications: protectedProcedure.query(async ({ ctx }) => ({
        notifications: await listFamilyFilterInvitationNotifications(
          ctx.user.id
        ),
      })),
      markNotificationRead: protectedProcedure
        .input(z.object({ notificationId: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
          await markFamilyFilterInvitationNotificationRead(
            ctx.user.id,
            input.notificationId
          );
          return { marked: true };
        }),
    }),
    notifications: protectedProcedure.query(async ({ ctx }) => ({
      notifications: await listDocumentExpiryNotifications(ctx.user.id),
    })),
    markNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await markDocumentExpiryNotificationRead(
          ctx.user.id,
          input.notificationId
        );
        return { marked: true };
      }),
  }),
  admin: router({
    schemes: router({
      list: adminProcedure.query(async () => ({
        schemes: await listSchemeCatalog({ sort: "name" }),
      })),
      update: adminProcedure
        .input(
          z.object({
            schemeId: z.string().min(1).max(96),
            name: z.string().min(3).max(255).optional(),
            nameHindi: z.string().min(3).max(255).optional(),
            administeringBody: z.string().min(3).max(255).optional(),
            benefits: z.string().min(10).max(3000).optional(),
            benefitsHindi: z.string().min(10).max(3000).optional(),
            portalUrl: z.string().url().max(512).optional(),
            applicationDeadline: z
              .number()
              .int()
              .positive()
              .nullable()
              .optional(),
            deadlineLabel: z.string().max(255).nullable().optional(),
            reviewed: z.string().min(3).max(64).optional(),
          })
        )
        .mutation(async ({ input }) => {
          const { schemeId, ...patch } = input;
          return { scheme: await updateSchemeAdmin(schemeId, patch) };
        }),
    }),
    documentAutomation: router({
      status: adminProcedure.query(async () => ({
        setting: await getDocumentReminderSetting(),
      })),
      enable: adminProcedure.mutation(async ({ ctx }) => {
        const existing = await getDocumentReminderSetting();
        if (existing?.scheduleCronTaskUid)
          return { setting: existing, alreadyEnabled: true };
        const sessionToken =
          parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const job = await createHeartbeatJob(
          {
            name: "scheme-sathi-document-expiry-daily",
            cron: "0 0 3 * * *",
            path: "/api/scheduled/document-expiry-reminders",
            payload: {},
            description:
              "Daily scan for expiring or expired Scheme Sathi document uploads",
          },
          sessionToken
        );
        return {
          setting: await saveDocumentReminderTask(job.taskUid),
          alreadyEnabled: false,
          nextExecutionAt: job.nextExecutionAt ?? null,
        };
      }),
    }),
    ocrPolicy: router({
      get: adminProcedure.query(async () => ({ policy: await getOcrPolicy() })),
      update: adminProcedure
        .input(
          z.object({ minimumConfidence: z.enum(["low", "medium", "high"]) })
        )
        .mutation(async ({ ctx, input }) => ({
          policy: await updateOcrPolicy(ctx.user.id, input.minimumConfidence),
        })),
    }),
    pilot: router({
      feedback: router({
        list: adminProcedure
          .input(
            z
              .object({
                status: z
                  .enum(["new", "reviewed", "followUp", "archived"])
                  .optional(),
                cohortInviteId: z.number().int().positive().optional(),
                query: z.string().trim().max(120).optional(),
              })
              .optional()
          )
          .query(async ({ input }) => ({
            feedback: await listPilotFeedbackForAdmin(input),
          })),
        update: adminProcedure
          .input(
            z.object({
              feedbackId: z.number().int().positive(),
              status: z.enum(["new", "reviewed", "followUp", "archived"]),
              adminNote: z.string().trim().max(1000).nullable().optional(),
            })
          )
          .mutation(async ({ input }) => {
            await updatePilotFeedbackForAdmin(input.feedbackId, input);
            return { updated: true };
          }),
      }),
      cohorts: router({
        list: adminProcedure.query(async () => ({
          invites: await listPilotCohortInvites(),
        })),
        conversionStats: adminProcedure
          .input(
            z
              .object({
                startAt: z.number().int().positive().optional(),
                endAt: z.number().int().positive().optional(),
                cohortType: z.enum(["college", "ngo"]).optional(),
              })
              .optional()
              .refine(
                input => !input?.startAt || !input?.endAt || input.startAt <= input.endAt,
                { message: "Report start date must be before the end date." }
              )
          )
          .query(async ({ input }) => ({
            cohorts: await listPilotCohortConversionStats(input),
          })),
        monthlyTrend: adminProcedure
          .input(
            z
              .object({
                startAt: z.number().int().positive().optional(),
                endAt: z.number().int().positive().optional(),
                cohortType: z.enum(["college", "ngo"]).optional(),
                period: z.enum(["month", "quarter"]).optional(),
              })
              .optional()
              .refine(
                input => !input?.startAt || !input?.endAt || input.startAt <= input.endAt,
                { message: "Report start date must be before the end date." }
              )
          )
          .query(async ({ input }) => ({
            months: await listPilotCohortMonthlyConversionTrend(input),
          })),
        create: adminProcedure
          .input(
            z
              .object({
                cohortName: z.string().trim().min(2).max(120),
                cohortType: z.enum(["college", "ngo"]),
                maxUses: z.number().int().min(1).max(500),
                expiresAt: z.number().int().positive().nullable().optional(),
              })
              .refine(
                input => !input.expiresAt || input.expiresAt > Date.now() + 60_000,
                { message: "Choose an invite expiry at least one minute in the future." }
              )
          )
          .mutation(async ({ ctx, input }) => ({
            invite: await createPilotCohortInvite(ctx.user.id, input),
          })),
        revoke: adminProcedure
          .input(z.object({ inviteId: z.number().int().positive() }))
          .mutation(async ({ input }) => {
            await revokePilotCohortInvite(input.inviteId);
            return { revoked: true };
          }),
      }),
      views: router({
        list: adminProcedure.query(async ({ ctx }) => ({
          views: await listPilotDashboardViews(ctx.user.id),
        })),
        save: adminProcedure
          .input(z.object({ name: z.string().trim().min(1).max(60), filters: pilotDashboardViewFiltersInput, folder: z.string().trim().max(40).nullable().optional() }))
          .mutation(async ({ ctx, input }) => ({
            view: await savePilotDashboardView(ctx.user.id, input.name, input.filters, input.folder),
          })),
        setPinned: adminProcedure
          .input(z.object({ viewId: z.number().int().positive(), isPinned: z.boolean() }))
          .mutation(async ({ ctx, input }) => {
            await setPilotDashboardViewPinned(ctx.user.id, input.viewId, input.isPinned);
            return { updated: true };
          }),
        reorderPinned: adminProcedure
          .input(z.object({ viewIds: z.array(z.number().int().positive()).max(20) }))
          .mutation(async ({ ctx, input }) => {
            await reorderPinnedPilotDashboardViews(ctx.user.id, input.viewIds);
            return { reordered: true };
          }),
        renameFolder: adminProcedure
          .input(z.object({ fromFolder: z.string().trim().min(1).max(40), toFolder: z.string().trim().min(1).max(40) }))
          .mutation(async ({ ctx, input }) => {
            await renamePilotDashboardViewFolder(ctx.user.id, input.fromFolder, input.toFolder);
            return { renamed: true };
          }),
        moveToFolder: adminProcedure
          .input(z.object({ viewIds: z.array(z.number().int().positive()).min(1).max(20), folder: z.string().trim().max(40).nullable().optional() }))
          .mutation(async ({ ctx, input }) => {
            await movePilotDashboardViewsToFolder(ctx.user.id, input.viewIds, input.folder);
            return { moved: true };
          }),
        delete: adminProcedure
          .input(z.object({ viewId: z.number().int().positive() }))
          .mutation(async ({ ctx, input }) => {
            await deletePilotDashboardView(ctx.user.id, input.viewId);
            return { deleted: true };
          }),
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
