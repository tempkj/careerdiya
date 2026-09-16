export default function CareerAsanaAccessGate({
  desiredRole,
}: {
  desiredRole?: string | null;
}) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <section className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-7 shadow-sm">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          CareerAsana · deeper execution
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Ready to turn the decision into a plan?
        </h1>
        <p className="text-sm leading-relaxed text-gray-600">
          Career Diya helps you decide whether a direction is worth pursuing. CareerAsana is the
          deeper layer that turns a chosen target{desiredRole ? ` — ${desiredRole}` : ''} into a
          personalized, sequenced preparation plan.
        </p>

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">What the deeper plan adds</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li>• Personalized gap diagnosis</li>
              <li>• AI-reasoned tasks grounded in your target role</li>
              <li>• Fastest, optimal and thorough preparation paths</li>
              <li>• Dependencies, effort estimates and an editable blueprint</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-4">
          <p className="text-sm font-medium text-gray-900">Paid access is being wired in.</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            The production gate is entitlement-based. During internal preview, this screen is
            bypassed with <code>CAREERASANA_ACCESS_MODE=preview</code>. No payment is implied by
            preview access.
          </p>
        </div>

        <a
          href="/"
          className="mt-6 block w-full rounded-lg border border-gray-300 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Career Diya
        </a>
      </section>
    </main>
  );
}
