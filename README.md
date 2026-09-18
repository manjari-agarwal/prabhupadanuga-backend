# Prabhupadanuga Backend

Backend API for the Prabhupadanuga React Native app.

## Phase 1 scope

- International mobile OTP and email OTP
- Registration profile and unique Prabhupadanuga ID
- Global registration counter and countdown
- Download/share-ready Prabhupada Patra
- CMS-ready user list and audit trail
- Media foundations with a maximum of 2 videos and 2 stories per user

## Local setup

1. Install Node.js 20 LTS and create a MongoDB Atlas project/cluster.
2. Copy `.env.example` to `.env` and fill real values. Never commit `.env`.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `GET http://localhost:7000/api/v1/health`.

The application will not start until required secrets and `MONGODB_URI` are configured. This is intentional.

## Confirmed product decisions

- Registration UI: English in phase 1.
- Authentication: mobile OTP (international/E.164 format) plus email OTP.
- Required profile fields: name, mobile number, email address. Other fields: initiation name, city, state, country, profile image.
- Certificate: generated for in-app download/share; email delivery is not in phase 1.
- Connection Hub: each user may publish up to two videos and two written stories.
- Countdown: one standard UTC target and identical remaining duration worldwide.
- Feed: immediate publication outside production; admin approval in production.
- Story image: optional.
