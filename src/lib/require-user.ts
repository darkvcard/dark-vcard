import { createMiddleware } from "@tanstack/react-start";

export const requireUser = createMiddleware({ type: "function" }).server(async ({ next, data }) => {
  const { verifyAccessToken } = await import("./require-user.server");
  // The Authorization header is the canonical transport (the browser attaches
  // the freshly read session token to the request); a body token is accepted as
  // a fallback so older clients keep working.
  const bodyToken = (data as { accessToken?: unknown } | null | undefined)?.accessToken;
  const ctx = await verifyAccessToken(typeof bodyToken === "string" ? bodyToken : null);
  return next({ context: ctx });
});
