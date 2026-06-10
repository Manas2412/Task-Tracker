import { redirect } from 'next/navigation';

/** /admin → Users (the only Phase 1 sub-section while Structure & hierarchy lands in Turn F). */
export default function AdminIndex() {
  redirect('/admin/users');
}
