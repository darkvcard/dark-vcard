import { createMiddleware } from "@tanstack/react-start";

export const requireUser = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { verifyAccessToken } = await import("./require-user.server");
  const ctx = await verifyAccessToken();
  return next({ context: ctx });
});
