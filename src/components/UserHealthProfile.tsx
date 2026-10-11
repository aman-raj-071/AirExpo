import React, { useEffect, useState } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';

export function UserHealthProfile({ onClose, onSignOut }: { onClose: () => void; onSignOut?: () => Promise<void> }) {
  const [account, setAccount] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetchUserAttributes()
      .then((value) => { if (active) setAccount(value); })
      .catch(() => { if (active) setError('Account details could not be loaded. Close your profile and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="fixed inset-0 z-[100] bg-primary/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Your account profile">
    <div className="bg-background border-2 border-primary shadow-[6px_6px_0_#10162f] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
      <div className="flex justify-between items-start gap-4"><div><span className="font-label-caps uppercase">Your AirExpo account</span><h2 className="text-2xl font-bold">Your profile</h2></div><button onClick={onClose} aria-label="Close profile" className="border border-primary px-3 py-1">✕</button></div>
      <section aria-label="Account details" className="space-y-4"><div><h3 className="text-xl font-bold">Personal details</h3><p className="text-sm mt-1">Your sign-in details and account information.</p></div>{loading ? <p role="status">Loading account details…</p> : error ? <p role="alert" className="text-sm text-red-800">{error}</p> : <dl className="grid sm:grid-cols-2 gap-3">{[['Full name', account.name || 'Not provided'], ['Email address', account.email || 'Not provided'], ['Email verification', account.email_verified === 'true' ? 'Verified' : 'Not verified'], ['Phone number', account.phone_number || 'Not provided']].map(([label, value]) => <div key={label} className="border border-primary bg-white p-4"><dt className="font-mono text-xs uppercase mb-2">{label}</dt><dd className="font-semibold break-words">{value}</dd></div>)}</dl>}</section>
      {onSignOut && <section aria-label="Sign out" className="border border-primary bg-white p-4 space-y-3"><h3 className="text-lg font-bold">Sign out</h3><p className="text-sm">Sign out of your AirExpo account on this device.</p><button type="button" disabled={signingOut} onClick={async () => { setSigningOut(true); try { await onSignOut(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign out.'); setSigningOut(false); } }} className="bg-primary text-white border border-primary px-5 py-2 font-semibold disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button></section>}
      <button onClick={onClose} className="text-sm underline">Continue to dashboard</button>
    </div>
  </div>;
}
