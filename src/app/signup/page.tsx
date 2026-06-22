import { redirect } from 'next/navigation';

/** Dedicated sign-up entry — login page opens in create-account mode. */
export default function SignupPage() {
  redirect('/login?mode=signup');
}
