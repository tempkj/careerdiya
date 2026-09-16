import AuthForm from '@modules/identity/ui/AuthForm';

export const metadata = { title: 'Sign in — CareerĀsanā' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <AuthForm redirectTo={next ?? '/activate'} />
    </main>
  );
}
