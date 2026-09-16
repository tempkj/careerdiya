// Liveness probe. The only route handler in the skeleton; feature routes arrive per phase.
export function GET() {
  return Response.json({ status: 'ok', api: 'v1' });
}
