# SkyView Weather

SkyView Weather is a design-forward weather app built on live National Weather Service data.

The product goal is not just to show a forecast. It is to make weather feel calm, readable, and a little more alive. The interface adapts visually to current conditions, supports location search, and includes a lightweight subscription flow for daily forecast emails.

## What This Project Includes

- Live weather data from the National Weather Service
- Dynamic visual theming based on current conditions and time of day
- Location lookup and forecast switching
- Cached weather snapshots with graceful stale-data fallback
- Daily email forecast subscriptions
- Tests around core weather data logic

## Why Keep This Repo Public

This is not the centerpiece of Logan's AI positioning, but it is still useful proof:

- taste in consumer UI
- willingness to ship complete products
- product thinking beyond a prompt box
- ability to turn data + backend logic into a polished end-user experience

For someone evaluating Logan's work, this repo helps round out the picture. It shows shipping instincts and interface quality, even outside the core AI workflow category.

## Stack

- Next.js
- TypeScript
- National Weather Service API
- Vercel-friendly API routes
- Vitest

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- The UI defaults to a New York forecast but supports custom locations.
- The daily email flow uses the app's subscription and notification routes.
- This project is best understood as a polished product build, not just a coding exercise.
