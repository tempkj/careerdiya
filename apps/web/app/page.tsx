import type { Route } from 'next';
import { redirect } from 'next/navigation';

export default function Home() {
  // /index.html is a static file in public/, which typed routes doesn't know about.
  redirect('/index.html' as Route);
}
