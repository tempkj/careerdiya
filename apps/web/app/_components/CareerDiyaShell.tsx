import type { ReactNode } from 'react';
import SignOutButton from './SignOutButton';

// Career Diya page chrome for the CareerĀsanā routes (/activate, /blueprint, /login, …).
// The markup mirrors the static Career Diya pages (header, mural hero band, footer) and is
// styled by the same stylesheets (public/assets/site.css + design-system-v2.css, linked in
// app/layout.tsx), so CareerĀsanā reads as part of Career Diya rather than a separate app.

const NAV = [
  ['/explore.html', 'Explore Careers'],
  ['/paths.html', 'Career Paths'],
  ['/assessment.html', 'Assessment'],
  ['/counselling.html', 'Counselling'],
  ['/resources.html', 'Resources'],
  ['/courses.html', 'Courses & Training'],
] as const;

function initialOf(email?: string | null): string {
  const c = (email ?? '').trim().charAt(0);
  return c ? c.toUpperCase() : 'U';
}

export default function CareerDiyaShell({
  eyebrow = 'CareerĀsanā',
  title,
  intro,
  userEmail,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  /** Signed-in user's email; shows the profile avatar and Sign out. Omit on sign-in pages. */
  userEmail?: string | null;
  children: ReactNode;
}) {
  const signedIn = userEmail !== undefined;
  return (
    <>
      <header className="site-header">
        <div className="container nav">
          <a href="/index.html" aria-label="Career Diya home">
            <img className="logo" src="/assets/careerdiya-horizontal-lockup.svg" alt="Career Diya" />
          </a>
          <nav className="navlinks">
            {NAV.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          {signedIn ? (
            <div className="ca-header-actions">
              <SignOutButton />
              <a
                className="profile-menu"
                href="/dashboard.html"
                title={userEmail ? `My Career · ${userEmail}` : 'My Career'}
                aria-label="My Career"
              >
                <span className="profile-avatar">{initialOf(userEmail)}</span>
              </a>
            </div>
          ) : (
            <span className="ca-header-actions" />
          )}
        </div>
      </header>

      <section className="page-hero mural-band">
        <div className="cd2-mural-decor" aria-hidden="true">
          <span className="bloom bloom-navy" data-bloom="" />
          <span className="bloom bloom-gold" data-bloom="" />
          <span className="hatch" />
          <span className="scrim" />
          <span className="mural-shape square" />
          <span className="mural-shape circle" />
        </div>
        <div className="container">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </div>
      </section>

      <main className="ca-main">
        <div className="container">{children}</div>
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <img className="logo" src="/assets/careerdiya-horizontal-lockup-white.svg" alt="Career Diya" />
            <p style={{ color: '#aeb2c1', maxWidth: 320 }}>
              Career guidance that helps you make the next decision with more clarity.
            </p>
          </div>
          <div>
            <b>Explore</b>
            <a href="/explore.html">Career Explorer</a>
            <a href="/paths.html">Career Paths</a>
            <a href="/assessment.html">Assessment</a>
          </div>
          <div>
            <b>Guidance</b>
            <a href="/counselling.html">Counselling</a>
            <a href="/dashboard.html">My Career</a>
            <a href="/resources.html">Resources</a>
          </div>
          <div>
            <b>Ecosystem</b>
            <a href="/courses.html">Courses &amp; Training</a>
            <a href="https://careerdiya.edumilestones.com/">Deeper Assessment</a>
          </div>
        </div>
        <div className="container footer-legal">
          <span>© 2026 Career Diya. All rights reserved.</span>
          <span>
            <a href="/privacy.html">Privacy Policy</a>
            <a href="/terms.html">Terms of Use</a>
            <a href="mailto:info@careerdiya.com">info@careerdiya.com</a>
          </span>
        </div>
      </footer>
    </>
  );
}
