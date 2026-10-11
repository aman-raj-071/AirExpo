import express from 'express';
import {exchangeCodeHandler} from './infra/lambda/exchangeCode.mjs';
export function registerCodeExchange(app:express.Express){
 const handler=async(req:express.Request,res:express.Response)=>{const result=await exchangeCodeHandler({rawPath:req.path,headers:{authorization:req.get('authorization')},body:JSON.stringify(req.body||{})});res.status(result.statusCode).set(result.headers).send(result.body);};
 app.post('/api/exchange-code',handler);
 app.get('/api/auth/me',handler);
}
