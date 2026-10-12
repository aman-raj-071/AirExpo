import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPhoneVerification} from '../src/services/phoneVerification.mjs';
const phone='+12025550123';
test('DONE update explicitly requests verification; automatic delivery avoids duplicate OTPs',async()=>{
 let sends=0,step='DONE';
 const auth={fetchUserAttributes:async()=>({}),updateUserAttributes:async()=>({phone_number:{nextStep:{updateAttributeStep:step}}}),sendUserAttributeVerificationCode:async()=>{sends++;}};
 await requestPhoneVerification(phone,auth);assert.equal(sends,1);
 step='CONFIRM_ATTRIBUTE_WITH_CODE';await requestPhoneVerification(phone,auth);assert.equal(sends,1);
});
test('existing unverified phones resend; verified phones need no OTP',async()=>{
 let verified=false,sends=0;
 const auth={fetchUserAttributes:async()=>({phone_number:phone,phone_number_verified:String(verified)}),updateUserAttributes:async()=>assert.fail('unneeded update'),sendUserAttributeVerificationCode:async()=>{sends++;}};
 await requestPhoneVerification(phone,auth);verified=true;
 assert.equal((await requestPhoneVerification(phone,auth)).alreadyVerified,true);assert.equal(sends,1);
});
test('SMS errors propagate instead of claiming successful delivery',async()=>{
 await assert.rejects(requestPhoneVerification(phone,{fetchUserAttributes:async()=>({phone_number:phone}),sendUserAttributeVerificationCode:async()=>{throw Error('SMS sandbox rejection');}}),/sandbox/);
});
