import express from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { cloudHandler } from './infra/lambda/cloud.mjs';
export function registerCloudStorage(app:express.Express){
  const configured=()=>Boolean(process.env.AWS_REGION&&(process.env.COGNITO_USER_POOL_ID||process.env.VITE_COGNITO_USER_POOL_ID)&&(process.env.COGNITO_CLIENT_ID||process.env.VITE_COGNITO_USER_POOL_CLIENT_ID));
  app.get('/api/cloud/status',(_req:express.Request,res:express.Response)=>{
    const identity=configured();
    const status={
      configured:identity&&Boolean(process.env.SETTINGS_TABLE&&process.env.REPORT_BUCKET),
      identityConfigured:identity,
      settingsConfigured:identity&&Boolean(process.env.SETTINGS_TABLE),
      profileConfigured:identity&&Boolean(process.env.SETTINGS_TABLE&&process.env.REPORT_BUCKET),
      journalConfigured:identity&&Boolean(process.env.SETTINGS_TABLE&&process.env.REPORT_BUCKET),
      documentsConfigured:identity&&Boolean(process.env.DOCUMENT_TABLE&&process.env.REPORT_BUCKET),
      assistantConfigured:identity&&Boolean(process.env.CONVERSATION_TABLE&&(process.env.GROQ_API_KEY||(process.env.AI_PROVIDER==='gemini'&&process.env.GEMINI_API_KEY))),
      documentsAnalyseConfigured:identity&&Boolean(process.env.DOCUMENT_TABLE&&process.env.GROQ_API_KEY),
      reminderConfigured:identity&&Boolean(process.env.REMINDER_TABLE),
    };
    return res.json(status);
  });
  let verifier:ReturnType<typeof CognitoJwtVerifier.create>|undefined;
  app.use('/api/cloud',async(req:express.Request,res:express.Response)=>{
    if(!configured())return res.status(503).json({error:'Account storage is not configured. Check the AWS region and Cognito settings.'});
    const token=req.get('authorization')?.replace(/^Bearer /i,'');if(!token)return res.status(401).json({error:'Sign in is required.'});
    let claims;
    try{verifier??=CognitoJwtVerifier.create({userPoolId:(process.env.COGNITO_USER_POOL_ID||process.env.VITE_COGNITO_USER_POOL_ID)!,clientId:(process.env.COGNITO_CLIENT_ID||process.env.VITE_COGNITO_USER_POOL_CLIENT_ID)!,tokenUse:'id'});claims=await verifier.verify(token);}catch{return res.status(401).json({error:'Your session expired or is invalid. Sign in again.'});}
    const result=await cloudHandler({rawPath:req.path,body:JSON.stringify(req.body||{}),queryStringParameters:req.query,requestContext:{http:{method:req.method},authorizer:{jwt:{claims:{sub:claims.sub}}}}});
    if(!result)return res.status(404).json({error:'Unknown cloud endpoint.'});res.status(result.statusCode).set(result.headers).send(result.body);
  });
}
