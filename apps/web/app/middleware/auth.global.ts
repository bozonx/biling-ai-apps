const PUBLIC_ROUTES = new Set(["/login"]);

/** Every page needs a session except the sign-in page. */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  await auth.resolve();
  if (PUBLIC_ROUTES.has(to.path))
    return auth.isSignedIn ? navigateTo("/") : undefined;
  if (!auth.isSignedIn)
    return navigateTo({
      path: "/login",
      query: to.fullPath !== "/" ? { redirect: to.fullPath } : {},
    });
});
