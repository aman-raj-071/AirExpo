import React, { useEffect, useState } from 'react';
import { fetchUserAttributes, confirmUserAttribute, fetchAuthSession } from 'aws-amplify/auth';
import { requestPhoneVerification } from '../services/phoneVerification.mjs';
import { cloudRequest } from '../services/cloudStorage';
import { DEFAULT_HEALTH_PROFILE } from '../services/localHealthStore';

export function UserHealthProfile({ onClose, onSignOut }: { onClose: () => void; onSignOut?: () => Promise<void> }) {
  const [account, setAccount] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [mobile, setMobile] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [mobileBusy, setMobileBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [mobileStatus, setMobileStatus] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [mobileReady, setMobileReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetchUserAttributes()
      .then((value) => { if (active) { setAccount(value); setMobile(current => current || value.phone_number || ''); } })
      .catch(() => { if (active) setError('Account details could not be loaded. Close your profile and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    cloudRequest('/profile').then(result => {
      if (!active) return;
      if (result.data?.mobileNumber) setMobile(result.data.mobileNumber);
      setSmsOptIn(result.data?.smsOptIn === true); setMobileReady(true);
    }).catch(() => { if (active) setMobileError('Could not load SMS settings. Close and reopen this profile to retry.'); });
    return () => { active = false; };
  }, []);

  const mobileAction = async (action: 'send' | 'verify' | 'save') => {
    setMobileBusy(true); setMobileError(''); setMobileStatus('');
    try {
      const phone = mobile.trim();
      if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw Error('Enter your mobile with country code, for example +919876543210.');
      if (action !== 'save' && !phone) throw Error('Enter your mobile number first.');
      if (action === 'send') {
        const result = await requestPhoneVerification(phone);
        setCodeSent(!result.alreadyVerified);
        if (result.alreadyVerified) { await fetchAuthSession({ forceRefresh: true }); setAccount(await fetchUserAttributes()); }
        setMobileStatus(result.alreadyVerified ? 'Mobile already verified. Save your SMS preferences.' : 'Cognito accepted the OTP request. If it does not arrive, check AWS SMS sandbox destination verification, spending limits and sender registration.');
      } else if (action === 'verify') {
        await confirmUserAttribute({ userAttributeKey: 'phone_number', confirmationCode: code.trim() });
        await fetchAuthSession({ forceRefresh: true });
        const attributes = await fetchUserAttributes();
        if (attributes.phone_number !== phone || attributes.phone_number_verified !== 'true') throw Error('Verification does not match this number. Request a new code.');
        setAccount(attributes); setCodeSent(false); setCode('');
        setMobileStatus('Mobile verified. Click Save mobile and SMS preferences to finish.');
      } else {
        if (smsOptIn && !phone) throw Error('Enter a mobile number before enabling SMS consent.');
        // Read the latest profile to preserve health fields when saving SMS preferences.
        const latest = await cloudRequest('/profile');
        const result = await cloudRequest('/profile', { ...DEFAULT_HEALTH_PROFILE, ...latest.data, mobileNumber: phone, smsOptIn });
        if (result.data?.mobileNumber !== phone || result.data?.smsOptIn !== smsOptIn) throw Error('The server did not confirm your SMS preferences. Retry.');
        window.dispatchEvent(new Event('airexpo-profile-updated'));
        setMobileStatus(smsOptIn ? 'Mobile and consent saved. Enable SMS in Air quality alerts after verification.' : 'SMS consent is off. No personal SMS notifications will be sent.');
      }
    } catch (e) { setMobileError(e instanceof Error ? e.message : 'Could not update mobile settings.'); }
    finally { setMobileBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] bg-primary/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Your account profile">
    <div className="bg-background border-2 border-primary shadow-[6px_6px_0_#10162f] w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-5">
      <div className="flex justify-between items-start gap-4"><div><span className="font-label-caps uppercase">Your AirExpo account</span><h2 className="text-2xl font-bold">Your profile</h2></div><button onClick={onClose} aria-label="Close profile" className="border border-primary px-3 py-1">✕</button></div>
      <section aria-label="Account details" className="space-y-4"><div><h3 className="text-xl font-bold">Personal details</h3><p className="text-sm mt-1">Your sign-in details and account information.</p></div>{loading ? <p role="status">Loading account details…</p> : error ? <p role="alert" className="text-sm text-red-800">{error}</p> : <dl className="grid sm:grid-cols-2 gap-3">{[['Full name', account.name || 'Not provided'], ['Email address', account.email || 'Not provided'], ['Email verification', account.email_verified === 'true' ? 'Verified' : 'Not verified'], ['Phone number', account.phone_number || 'Not provided']].map(([label, value]) => <div key={label} className="border border-primary bg-white p-4"><dt className="font-mono text-xs uppercase mb-2">{label}</dt><dd className="font-semibold break-words">{value}</dd></div>)}</dl>}</section>
      <section aria-label="Mobile number and SMS preferences" className="border border-primary bg-white p-4 space-y-3">
        <h3 className="text-lg font-bold">Mobile number and SMS notifications</h3>
        <label className="block text-sm font-semibold">Mobile number with country code
          <input type="tel" autoComplete="tel" maxLength={16} placeholder="+919876543210" value={mobile} disabled={loading || !mobileReady || mobileBusy} onChange={e => { setMobile(e.target.value); setCodeSent(false); setCode(''); setMobileStatus(''); }} className="block mt-2 w-full border border-primary p-3 disabled:opacity-50" />
        </label>
        <p className="text-sm">{account.phone_number_verified === 'true' && account.phone_number === mobile.trim() ? 'Mobile verified.' : 'Verify ownership before sending SMS notifications.'}</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={smsOptIn} disabled={!mobileReady || mobileBusy} onChange={e => setSmsOptIn(e.target.checked)} />I own this number and agree to receive AirExpo SMS notifications through AWS. SMS charges may apply. Uncheck and save to opt out.</label>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={loading || !mobileReady || mobileBusy || !mobile.trim()} onClick={() => void mobileAction('send')} className="border border-primary px-4 py-2 disabled:opacity-50">Send verification code</button>
          <button type="button" disabled={!mobileReady || mobileBusy} onClick={() => void mobileAction('save')} className="bg-primary text-white px-4 py-2 disabled:opacity-50">{mobileBusy ? 'Please wait...' : 'Save mobile and SMS preferences'}</button>
        </div>
        {codeSent && <div className="flex flex-wrap items-end gap-3"><label className="text-sm">SMS verification code<input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" className="block mt-1 border border-primary p-2" /></label><button type="button" disabled={mobileBusy || !code.trim()} onClick={() => void mobileAction('verify')} className="border border-primary px-4 py-2 disabled:opacity-50">Verify mobile</button></div>}
        {mobileError && <p role="alert" className="text-sm text-red-800">{mobileError}</p>}
        {mobileStatus && <p role="status" className="text-sm">{mobileStatus}</p>}
      </section>
      {onSignOut && <section aria-label="Sign out" className="border border-primary bg-white p-4 space-y-3"><h3 className="text-lg font-bold">Sign out</h3><p className="text-sm">Sign out of your AirExpo account on this device.</p><button type="button" disabled={signingOut} onClick={async () => { setSigningOut(true); try { await onSignOut(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign out.'); setSigningOut(false); } }} className="bg-primary text-white border border-primary px-5 py-2 font-semibold disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button></section>}
      <button onClick={onClose} className="text-sm underline">Continue to dashboard</button>
    </div>
  </div>;
}
