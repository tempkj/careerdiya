import AuthForm from '@modules/identity/ui/AuthForm';
import CareerDiyaShell from '../_components/CareerDiyaShell';

export const metadata = { title: 'Sign in — Career Plan | Career Diya' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <CareerDiyaShell
      title="Sign in to plan your next move"
      intro="Use your Career Diya account to open your career plan."
    >
      <AuthForm redirectTo={next ?? '/activate'} />
    </CareerDiyaShell>
  );
}
