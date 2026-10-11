import { fetchAuthSession } from 'aws-amplify/auth';
const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const base=import.meta.env.VITE_STORAGE_API_URL?.trim().replace(/\/+$/,'') || (isLocalHost ? '/api/cloud' : 'https://xsvjrx04tl.execute-api.us-east-1.amazonaws.com/api/cloud');
const localCloudApi = base === '/api/cloud' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const backendSetupMessage = localCloudApi
  ? 'The local cloud API returned a website page instead of JSON. Run npm run dev from the AirExpo folder and open http://localhost:3000. Vite preview serves only the frontend and cannot run cloud storage.'
  : 'The cloud API returned a non-JSON response. Check the deployed AirExpo backend, VITE_STORAGE_API_URL in Amplify Hosting, and any /api/cloud proxy routing. Rebuild the frontend after changing its API URL.';

async function readCloudResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    // A static host's SPA rewrite can return index.html with HTTP 200 for API
    // paths. Never treat that page as a successful cloud save or chat response.
    throw new Error(backendSetupMessage);
  }
  try {
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new Error('The cloud API returned an invalid response. Check the backend deployment and retry.');
  }
}

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
  const data = await readCloudResponse(response);
  if (!response.ok) throw new Error(data.error || 'Could not check cloud storage setup.');
  return data as CloudStorageStatus;
}

export async function cloudRequest(path:string,body?:unknown,method?:'GET'|'POST'|'DELETE'){
  const token=(await fetchAuthSession()).tokens?.idToken?.toString();
  if(!token)throw Error('Sign in before using cloud storage.');
  const requestMethod=method||(body===undefined?'GET':'POST');
  let response: Response;
  try {
    response=await fetch(base+path,{method:requestMethod,headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  } catch {
    throw new Error('Could not reach the cloud API. Check your connection, VITE_STORAGE_API_URL, and the backend CORS allowed origin for this website.');
  }
  const data=await readCloudResponse(response);
  if(!response.ok){
    const message=String(data.error||'Cloud storage request failed.');
    if(response.status===401) throw new Error('Your cloud session is invalid or expired. Sign in again. If this continues, check that the backend uses the same Cognito pool and app client as the frontend.');
    if(response.status===404&&/unknown cloud endpoint|route not found/i.test(message)){
      const local = base === '/api/cloud' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
      throw Error(local
        ? 'This local server is running an older API version. Stop the existing dev server, restart it from the AirExpo project folder, then refresh the page.'
        : 'The deployed backend does not expose this cloud endpoint. Check VITE_STORAGE_API_URL and deploy the latest AirExpo backend.');
    }
    throw Error(message);
  }
  return data;
}
