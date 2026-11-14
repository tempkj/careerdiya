export default function CareerAsanaAccessGate({
  desiredRole,
}: {
  desiredRole?: string | null;
}) {
  return (
    <section className="ca-panel w-full max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          What a career plan gives you
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">
          Career Diya helps you decide whether a direction is worth pursuing. A career plan takes
          the role you chose{desiredRole ? ` — ${desiredRole}` : ''} and turns it into a
          step-by-step preparation plan made for you.
        </p>

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-gray-200 bg-brand-soft/60 p-4">
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li>• What you&apos;ll need for the role, and what you already have</li>
              <li>• Specific tasks for your situation, not a generic course list</li>
              <li>• A fast, a balanced and a thorough path to choose from</li>
              <li>• Time estimates and an order you can change</li>
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
