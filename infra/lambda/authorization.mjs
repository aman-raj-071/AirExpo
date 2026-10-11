import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const cedar = require('@cedar-policy/cedar-wasm/nodejs');

// Identity and ownership are supplied by verified JWT claims and server storage paths.
// Never accept either value from the request body.
const policy = `permit (
  principal is AirExpo::User,
  action in [AirExpo::Action::"read", AirExpo::Action::"write"],
  resource is AirExpo::PrivateData
) when { resource.owner == principal };`;

export function canAccessPrivateData(userId, ownerId, method) {
  if (!userId || !ownerId || !['GET', 'POST', 'DELETE'].includes(method)) return false;
  const user = {type: 'AirExpo::User', id: userId};
  const resource = {type: 'AirExpo::PrivateData', id: ownerId};
  try {
    const result = cedar.isAuthorized({
      principal: user,
      action: {type: 'AirExpo::Action', id: method === 'GET' ? 'read' : 'write'},
      resource,
      context: {},
      policies: {staticPolicies: policy},
      entities: [{uid: resource, attrs: {owner: {__entity: {type: 'AirExpo::User', id: ownerId}}}, parents: []}],
    });
    return result.type === 'success' && result.response.decision === 'allow';
  } catch {
    return false;
  }
}
