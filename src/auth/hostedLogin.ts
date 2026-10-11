type HostedUser={userId:string;username:string;signInDetails:{loginId:string};email?:string};
type Session={user:HostedUser;id_token:string;access_token:string;expires_at:number};
const domain=import.meta.env.VITE_COGNITO_DOMAIN?.replace(/^https?:\/\//,'').replace(/\/$/,'');
const client=import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
const callback=import.meta.env.VITE_COGNITO_REDIRECT_URI || window.location.origin+'/auth/callback';
const api=import.meta.env.VITE_AUTH_API_URL?.replace(/\/$/,'') || '';
const sessionKey='airexpo-hosted-session',transactionKey='airexpo-oauth-transaction';
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function readHostedSession():Session|null{try{const session=JSON.parse(sessionStorage.getItem(sessionKey)||'null');if(!session||!session.id_token||session.expires_at<=Date.now()){sessionStorage.removeItem(sessionKey);return null;}return session;}catch{return null;}}
export function clearHostedSession(){sessionStorage.removeItem(sessionKey);sessionStorage.removeItem(transactionKey);}
export async function startHostedLogin(){
 if(!domain||!client)throw Error('Secure sign-in is not configured.');
 // PKCE state must be created on the same origin that receives the callback.
 if(new URL(callback).origin!==window.location.origin){window.location.assign(new URL('/signin',callback).href);return;}
 const verifier=base64url(crypto.getRandomValues(new Uint8Array(64))),state=base64url(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 sessionStorage.setItem(transactionKey,JSON.stringify({verifier,state,createdAt:Date.now()}));
 const url=new URL(`https://${domain}/oauth2/authorize`);url.search=new URLSearchParams({client_id:client,response_type:'code',scope:'openid email phone',redirect_uri:callback,state,code_challenge:challenge,code_challenge_method:'S256'}).toString();window.location.assign(url.href);
}
let exchange:Promise<HostedUser>|undefined;
export function completeHostedLogin(){return exchange??=(async()=>{
 const params=new URLSearchParams(window.location.search);
 const code=params.get('code'),state=params.get('state');
 let tx;try{tx=JSON.parse(sessionStorage.getItem(transactionKey)||'null');}catch{}
 window.history.replaceState({},'','/auth/callback');
 if(params.has('error'))throw Error('Sign-in was cancelled or rejected. Please try again.');
 if(!code||!tx||tx.state!==state||Date.now()-tx.createdAt>600000){sessionStorage.removeItem(transactionKey);throw Error('This login has expired or was started on another site. Start sign-in again from this site.');}
 sessionStorage.removeItem(transactionKey);
 const response=await fetch(api+'/api/exchange-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,codeVerifier:tx.verifier}),signal:AbortSignal.timeout(25000)});
 const result=await response.json().catch(()=>({error:'Login backend is unavailable. Check the deployed API URL.'}));if(!response.ok)throw Error(result.error||'Login failed.');
 if(!result.user?.userId||!result.id_token||!result.access_token||!Number.isFinite(result.expires_at))throw Error('Login backend returned an invalid session.');
 sessionStorage.setItem(sessionKey,JSON.stringify(result));return result.user as HostedUser;
 })();}
export async function getHostedUser(){const session=readHostedSession();if(!session)return null;try{const response=await fetch(api+'/api/auth/me',{headers:{Authorization:'Bearer '+session.id_token},signal:AbortSignal.timeout(15000)});if(response.status===401){clearHostedSession();return null;}if(!response.ok)return null;const result=await response.json();return result.user as HostedUser;}catch{return null;}}
