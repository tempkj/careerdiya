export default function CareerAsanaAccessGate({
  desiredRole,
}: {
  desiredRole?: string | null;
}) {
  return (
    <section className="ca-panel w-full max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          How CareerĀsanā helps
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">
          Career Diya helps you decide whether a direction is worth pursuing. CareerĀsanā is the
          deeper layer that turns a chosen target{desiredRole ? ` — ${desiredRole}` : ''} into a
          personalized, sequenced preparation plan.
        </p>

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-gray-200 bg-brand-soft/60 p-4">
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
          <p className="text-sm font-medium text-gray-900">Available on request during early access.</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Write to{' '}
            <a href="mailto:info@careerdiya.com" className="underline">
              info@careerdiya.com
            </a>{' '}
            and we will set up access for you.
          </p>
        </div>

        <a href="/dashboard.html" className="btn btn-secondary w-full mt-6">
          Back to Career Diya
        </a>
    </section>
  );
}
