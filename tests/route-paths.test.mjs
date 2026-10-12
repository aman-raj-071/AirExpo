import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRoutePath} from '../infra/lambda/routePaths.mjs';
import {routeApi} from '../infra/lambda/routeApi.mjs';
test('cloud-prefixed routing URLs reach route handlers without changing private cloud paths',async()=>{
 for(const path of ['/api/routes','/api/route-geocode','/api/route-air-quality']){
  assert.equal(normalizeRoutePath('/api/cloud'+path),path);
  assert.equal(normalizeRoutePath(path),path);
 }
 assert.equal(normalizeRoutePath('/api/cloud/profile'),'/api/cloud/profile');
 assert.equal(normalizeRoutePath('/api/cloud/api/unknown'),'/api/cloud/api/unknown');
 const response=await routeApi({rawPath:'/api/cloud/api/routes',body:'{}',requestContext:{http:{method:'POST'}}});
 assert.equal(response.statusCode,400);
 assert.match(JSON.parse(response.body).error,/Valid origin/);
});
