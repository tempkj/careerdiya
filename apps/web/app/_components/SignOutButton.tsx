'use client';

export default function SignOutButton() {
  async function handleSignOut() {
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    window.location.href = '/login';
  }
  return (
    <button type="button" className="nav-signin" onClick={() => void handleSignOut()}>
      Sign out
    </button>
  );
}
