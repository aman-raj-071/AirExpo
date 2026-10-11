import { fetchAuthSession } from 'aws-amplify/auth';
const base=import.meta.env.VITE_STORAGE_API_URL?.replace(/\/$/,'') || '/api/cloud';

export type CloudStorageStatus = {
  configured: boolean;
  identityConfigured?: boolean;
  settingsConfigured: boolean;
  profileConfigured: boolean;
  journalConfigured: boolean;
  documentsConfigured: boolean;
  assistantConfigured: boolean;
  documentsAnalyseConfigured?: boolean;
  reminderConfigured?: boolean;
};

export async function getCloudStorageStatus(): Promise<CloudStorageStatus | null> {
  // The local Express server exposes this unauthenticated, non-sensitive
  // readiness check. A separately deployed API may not expose /status.
  if (base !== '/api/cloud') return null;
  const response = await fetch(`${base}/status`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not check cloud storage setup.');
  return data as CloudStorageStatus;
}

export async function cloudRequest(path:string,body?:unknown,method?:'GET'|'POST'|'DELETE'){
  const token=(await fetchAuthSession()).tokens?.idToken?.toString();
  if(!token)throw Error('Sign in before using cloud storage.');
  const requestMethod=method||(body===undefined?'GET':'POST');
  const response=await fetch(base+path,{method:requestMethod,headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=String(data.error||'Cloud storage request failed.');
    if(response.status===404&&/unknown cloud endpoint|route not found/i.test(message)){
      throw Error('This local server is running an older API version. Stop the existing dev server, restart it from the AirExpo project folder, then refresh the page.');
    }
    throw Error(message);
  }
  return data;
}
