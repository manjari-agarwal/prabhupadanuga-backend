import { env } from '../config/env.js';
const fail = (message,statusCode=502) => Object.assign(new Error(message),{statusCode});
export async function deliverOtp(destination,channel,code) {
  if (channel === 'email') {
    if (env.EMAIL_PROVIDER !== 'smtp') throw fail('Email OTP provider is not configured',503);
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) throw fail('SMTP configuration is incomplete',503);
    const {default:nodemailer} = await import('nodemailer');
    const transporter = nodemailer.createTransport({host:env.SMTP_HOST,port:env.SMTP_PORT,secure:env.SMTP_PORT===465,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS}});
    await transporter.sendMail({from:env.SMTP_FROM,to:destination,subject:'Your Prabhupada Janmabhumi verification code',text:`Your verification code is ${code}. It expires in ${Math.ceil(env.OTP_EXPIRES_SECONDS/60)} minutes. Do not share it.`,html:`<p>Your Prabhupada Janmabhumi verification code is <strong>${code}</strong>.</p><p>It expires in ${Math.ceil(env.OTP_EXPIRES_SECONDS/60)} minutes. Do not share this code.</p>`});
    return;
  }
  if (env.SMS_PROVIDER === '2factor') {
    if (!env.TWOFACTOR_API_KEY || !env.TWOFACTOR_OTP_TEMPLATE) throw fail('2Factor configuration is incomplete',503);
    // Manual OTP API: generate and hash OTP in our backend, provider only delivers it.
    // 2Factor accounts/templates may be restricted to Indian mobile destinations.
    const phone = destination.replace(/^\+/, '');
    const url = `https://2factor.in/API/V1/${encodeURIComponent(env.TWOFACTOR_API_KEY)}/SMS/${encodeURIComponent(phone)}/${encodeURIComponent(code)}/${encodeURIComponent(env.TWOFACTOR_OTP_TEMPLATE)}`;
    let response;
    try { response = await fetch(url,{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)}); }
    catch { throw fail('2Factor SMS service is temporarily unavailable'); }
    if (!response.ok) throw fail('2Factor SMS service rejected the request');
    let data;
    try { data = await response.json(); } catch { throw fail('Invalid response from 2Factor SMS service'); }
    if (String(data?.Status ?? data?.status).toLowerCase() !== 'success') throw fail('2Factor could not accept the OTP request');
    return;
  }
  if (env.SMS_PROVIDER !== 'twilio' || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) throw fail('SMS OTP provider is not configured',503);
  const url=`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`;
  const body = new URLSearchParams({To:destination,From:env.TWILIO_FROM,Body:`Prabhupada Janmabhumi OTP: ${code}. Expires in ${Math.ceil(env.OTP_EXPIRES_SECONDS/60)} minutes. Do not share.`});
  let response;
  try { response = await fetch(url,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)}); }
  catch { throw fail('SMS provider is temporarily unavailable'); }
  if (!response.ok) throw fail('SMS provider rejected the OTP request');
}
