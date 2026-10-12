import { fetchUserAttributes, updateUserAttributes, sendUserAttributeVerificationCode } from 'aws-amplify/auth';
export async function requestPhoneVerification(phone, auth = { fetchUserAttributes, updateUserAttributes, sendUserAttributeVerificationCode }) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw Error('Enter your mobile with country code, for example +919876543210.');
  const attributes = await auth.fetchUserAttributes();
  if (attributes.phone_number === phone && attributes.phone_number_verified === 'true') return { alreadyVerified: true };
  if (attributes.phone_number !== phone) {
    const updated = await auth.updateUserAttributes({ userAttributes: { phone_number: phone } });
    if (updated.phone_number?.nextStep?.updateAttributeStep === 'CONFIRM_ATTRIBUTE_WITH_CODE') return { alreadyVerified: false };
  }
  // DONE does not guarantee a verification code was requested.
  await auth.sendUserAttributeVerificationCode({ userAttributeKey: 'phone_number' });
  return { alreadyVerified: false };
}
