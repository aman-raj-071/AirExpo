import { CognitoJwtVerifier } from 'aws-jwt-verify';
const output=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store','pragma':'no-cache'},body:JSON.stringify(body)});
function config(){return {pool:process.env.COGNITO_USER_POOL_ID||process.env.VITE_COGNITO_USER_POOL_ID,client:process.env.COGNITO_CLIENT_ID||process.env.VITE_COGNITO_USER_POOL_CLIENT_ID,domain:process.env.COGNITO_DOMAIN||process.env.VITE_COGNITO_DOMAIN,callback:process.env.COGNITO_REDIRECT_URI||process.env.VITE_COGNITO_REDIRECT_URI};}
const userFrom=p=>({userId:p.sub,username:p['cognito:username']||p.sub,signInDetails:{loginId:p.email||p['cognito:username']||p.sub},email:p.email||'',emailVerified:p.email_verified===true});
export async function exchangeCodeHandler(event){
 const c=config();if(!c.pool||!c.client||!c.domain||!c.callback)return output(503,{error:'Secure login is not configured on the backend.'});
 try{
  const verify=CognitoJwtVerifier.create({userPoolId:c.pool,clientId:c.client,tokenUse:'id'});
  if(event.rawPath==='/api/auth/me'){
   const token=(event.headers?.authorization||event.headers?.Authorization||'').replace(/^Bearer /i,'');
   if(!token)return output(401,{error:'Sign in is required.'});
   try{return output(200,{user:userFrom(await verify.verify(token))});}catch{return output(401,{error:'Your session has expired. Please sign in again.'});}
  }
  let input;try{input=JSON.parse(event.body||'{}');}catch{return output(400,{error:'Invalid login request.'});}
  if(typeof input.code!=='string'||!input.code||input.code.length>4096||typeof input.codeVerifier!=='string'||!/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier))return output(400,{error:'A valid authorization code and PKCE verifier are required.'});
  const domain=c.domain.replace(/^https?:\/\//,'').replace(/\/$/,'');
  const form=new URLSearchParams({grant_type:'authorization_code',client_id:c.client,redirect_uri:c.callback,code:input.code,code_verifier:input.codeVerifier});
  const response=await fetch(`https://${domain}/oauth2/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(15000)});
  const tokens=await response.json();
  if(!response.ok)return output(400,{error:'Cognito could not exchange this login code. Start sign-in again; check the client ID and exact callback URL if it repeats.'});
  const payload=await verify.verify(tokens.id_token);
  const accessVerifier=CognitoJwtVerifier.create({userPoolId:c.pool,clientId:c.client,tokenUse:'access'});await accessVerifier.verify(tokens.access_token);
  return output(200,{user:userFrom(payload),id_token:tokens.id_token,access_token:tokens.access_token,expires_at:payload.exp*1000});
 }catch{return output(502,{error:'Secure sign-in could not be verified. Check the configured user pool ID, backend connection and Cognito settings.'});}
}
