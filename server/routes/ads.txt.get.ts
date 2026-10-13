export default defineEventHandler(event => {
  const { adsenseClient } = useRuntimeConfig(event).public;
  if (!adsenseClient) throw createError({ statusCode: 404, statusMessage: "Not configured" });
  setHeader(event, "Content-Type", "text/plain; charset=utf-8");
  return `google.com, ${adsenseClient.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`;
});
