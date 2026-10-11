
import { Amplify } from 'aws-amplify';
import {
  confirmSignUp,
  getCurrentUser,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';

const configuredPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim();
const configuredClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID?.trim();
// Public identifiers for AirExpo's existing Cognito pool, safe to ship in the
// browser. Override both together when using a different deployment's pool.
// Keep incomplete overrides unconfigured instead of mixing two pools' IDs.
const useDefaultPool = !configuredPoolId && !configuredClientId;
const userPoolId = useDefaultPool ? 'us-east-1_UOugaJlN8' : configuredPoolId;
const userPoolClientId = useDefaultPool ? '6rls971j2qq88nune9f74lukbc' : configuredClientId;

export const cognitoConfigured = Boolean(userPoolId && userPoolClientId);

if (cognitoConfigured) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId!,
        userPoolClientId: userPoolClientId!,
        loginWith: { email: true },
      },
    },
  });
}

function requireCognitoConfig() {
  if (!cognitoConfigured) {
    throw new Error('Cognito is not configured. Set the Cognito user pool environment variables and restart the app.');
  }
}

export async function signUpWithEmail(email: string, password: string, fullName: string) {
  requireCognitoConfig();
  const name = fullName.trim();
  if (!name || name.length > 100) throw new Error('Enter your full name (up to 100 characters).');
  return signUp({
    username: email.trim().toLowerCase(),
    password,
    options: { userAttributes: { email: email.trim().toLowerCase(), name } },
  });
}

export async function confirmEmailSignUp(email: string, code: string) {
  requireCognitoConfig();
  return confirmSignUp({ username: email.trim().toLowerCase(), confirmationCode: code.trim() });
}

export async function resendEmailConfirmation(email: string) {
  requireCognitoConfig();
  return resendSignUpCode({ username: email.trim().toLowerCase() });
}

export async function signInWithEmail(email: string, password: string) {
  requireCognitoConfig();
  return signIn({ username: email.trim().toLowerCase(), password });
}

export async function signOutFromCognito() {
  requireCognitoConfig();

  try { await signOut(); } finally { window.dispatchEvent(new Event('airexpo-signout')); }
}

export async function getCognitoCurrentUser() {
  if (!cognitoConfigured) return null;

  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

