import {useState, type FormEvent} from 'react';
import {confirmSignIn, resetPassword, confirmResetPassword} from 'aws-amplify/auth';
import {cognitoConfigured, signInWithEmail, signUpWithEmail, confirmEmailSignUp, resendEmailConfirmation} from '../auth/amplify';

type Mode = 'signin' | 'signup' | 'verify' | 'forgot' | 'reset' | 'challenge';
export function AuthPage({onSuccess, onHome}: {onSuccess: () => Promise<void>; onHome: () => void}) {
  const [mode,setMode]=useState<Mode>('signin');
  const [fullName,setFullName]=useState('');
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [code,setCode]=useState('');
  const [busy,setBusy]=useState(false), [notice,setNotice]=useState(''), [error,setError]=useState(''), [challenge,setChallenge]=useState('');
  const change=(next:Mode)=>{setMode(next);setPassword('');setCode('');setError('');setNotice('');};
  async function nextSignIn(result: Awaited<ReturnType<typeof signInWithEmail>>) {
    if(result.isSignedIn){setPassword('');await onSuccess();return;}
    const step=result.nextStep.signInStep;
    if(step==='CONFIRM_SIGN_UP'){setMode('verify');setNotice('Confirm your email to finish creating your account.');}
    else if(step==='RESET_PASSWORD'){setMode('forgot');setNotice('Reset your password to continue.');}
    else if(['CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED','CONFIRM_SIGN_IN_WITH_SMS_CODE','CONFIRM_SIGN_IN_WITH_EMAIL_CODE','CONFIRM_SIGN_IN_WITH_TOTP_CODE'].includes(step)){setChallenge(step);setPassword('');setCode('');setMode('challenge');}
    else throw Error('This account requires an additional setup step. Contact the site administrator.');
  }
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');setNotice('');try{
    if(mode==='signin') await nextSignIn(await signInWithEmail(email,password));
    if(mode==='signup'){const result=await signUpWithEmail(email,password,fullName);setPassword('');if(result.nextStep.signUpStep==='CONFIRM_SIGN_UP'){setMode('verify');setNotice('Enter the verification code sent to your email.');}else{setMode('signin');setNotice('Account created. You can now sign in.');}}
    if(mode==='verify'){await confirmEmailSignUp(email,code);change('signin');setNotice('Email verified. Sign in to continue.');}
    if(mode==='forgot'){const result=await resetPassword({username:email.trim().toLowerCase()});if(result.nextStep.resetPasswordStep==='CONFIRM_RESET_PASSWORD_WITH_CODE'){setMode('reset');setNotice('Enter the reset code sent to your email.');}else{change('signin');}}
    if(mode==='reset'){await confirmResetPassword({username:email.trim().toLowerCase(),confirmationCode:code.trim(),newPassword:password});change('signin');setNotice('Password updated. Sign in to continue.');}
    if(mode==='challenge') await nextSignIn(await confirmSignIn({challengeResponse:challenge.includes('NEW_PASSWORD')?password:code.trim()}));
  }catch(e){if(e instanceof Error&&e.name==='UserNotConfirmedException'){setMode('verify');setNotice('Verify your email first. You can request a new code below.');}else setError(e instanceof Error?e.message:'Unable to complete this request. Please try again.');}finally{setBusy(false);}}
  const newPassword=mode==='signup'||mode==='reset'||(mode==='challenge'&&challenge.includes('NEW_PASSWORD'));
  const needsPassword=mode==='signin'||newPassword;
  const needsCode=mode==='verify'||mode==='reset'||(mode==='challenge'&&!needsPassword);
  const titles={signin:'Welcome back.',signup:'Create your account.',verify:'Verify your email.',forgot:'Forgot your password?',reset:'Choose a new password.',challenge:newPassword?'Set your password.':'Verify it’s you.'};
  return <main className="min-h-screen bg-background text-primary flex items-center justify-center p-6"><section className="w-full max-w-md border-2 border-primary bg-white p-7 sm:p-9 shadow-[8px_8px_0_#10162f]"><button onClick={onHome} className="font-bold mb-8">A/ AIREXPO</button><p className="font-mono text-xs uppercase mb-3">Your everyday air companion</p><h1 className="text-3xl font-bold mb-6">{titles[mode]}</h1>{(mode==='signin'||mode==='signup')&&<div className="flex border-2 border-primary mb-6">{(['signin','signup'] as const).map(value=><button key={value} disabled={busy} onClick={()=>change(value)} className={`flex-1 p-3 font-bold ${mode===value?'bg-secondary':'bg-white'}`}>{value==='signin'?'Sign in':'Sign up'}</button>)}</div>}
    <form onSubmit={submit} className="space-y-4">{mode==='signup'&&<label className="block text-sm font-semibold">Full name<input type="text" required maxLength={100} autoComplete="name" disabled={busy} value={fullName} onChange={e=>setFullName(e.target.value)} className="block w-full border-2 border-primary p-3 mt-2"/></label>}<label className="block text-sm font-semibold">Email<input type="email" required autoComplete="email" disabled={busy||mode==='challenge'} value={email} onChange={e=>setEmail(e.target.value)} className="block w-full border-2 border-primary p-3 mt-2"/></label>{needsPassword&&<label className="block text-sm font-semibold">{newPassword?'New password':'Password'}<input type="password" required autoComplete={newPassword?'new-password':'current-password'} disabled={busy} value={password} onChange={e=>setPassword(e.target.value)} className="block w-full border-2 border-primary p-3 mt-2"/></label>}{needsCode&&<label className="block text-sm font-semibold">Verification code<input required autoComplete="one-time-code" disabled={busy} value={code} onChange={e=>setCode(e.target.value)} className="block w-full border-2 border-primary p-3 mt-2"/></label>}{error&&<p role="alert" className="text-red-800 text-sm">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}<button disabled={busy||!cognitoConfigured} className="w-full bg-secondary border-2 border-primary p-3 font-bold disabled:opacity-50">{busy?'Please wait…':mode==='signin'?'Sign in':mode==='signup'?'Create account':mode==='forgot'?'Send reset code':'Continue'}</button></form>
    {mode==='signin'&&<button disabled={busy} onClick={()=>change('forgot')} className="underline text-sm mt-5">Forgot password?</button>}{mode==='verify'&&<button disabled={busy} className="underline text-sm mt-5" onClick={async()=>{setBusy(true);setError('');try{await resendEmailConfirmation(email);setNotice('A new verification code has been sent.');}catch(e){setError(e instanceof Error?e.message:'Could not send code.');}finally{setBusy(false);}}}>Resend verification code</button>}{!['signin','signup'].includes(mode)&&<button disabled={busy} className="block underline text-sm mt-5" onClick={()=>change('signin')}>Back to sign in</button>}{!cognitoConfigured&&<p role="alert" className="text-sm mt-4">Account service is not configured.</p>}</section></main>;
}
