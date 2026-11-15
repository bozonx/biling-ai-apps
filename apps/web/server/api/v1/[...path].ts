// Same-origin proxy to the billing API, so the browser never needs CORS.
export default defineEventHandler((event) => {
  const { apiUrl } = useRuntimeConfig(event);
  return proxyRequest(
    event,
    `${String(apiUrl).replace(/\/+$/, "")}${event.path}`,
  );
});
