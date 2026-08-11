import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSchemeById, getUserSchemeProfile, listSavedSchemeIds, listSchemeCatalog, saveUserSchemeProfile, toggleSavedScheme } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
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
    list: publicProcedure.input(z.object({ category: z.string().optional(), level: z.enum(["Central", "State"]).optional(), query: z.string().max(120).optional() }).optional()).query(async ({ input }) => ({ schemes: await listSchemeCatalog(input) })),
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
});

export type AppRouter = typeof appRouter;
