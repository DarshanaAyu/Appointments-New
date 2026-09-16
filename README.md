# Darshana Ayurveda — Studio App

## Run locally
```
npm install
npm run dev
```

## Deploy on Vercel
1. Push this folder to a GitHub repo (root of the repo = this folder).
2. Go to vercel.com → **Add New Project** → import the repo.
3. Vercel auto-detects Vite. Leave build command as `vite build` and output
   directory as `dist` (these are the defaults — no changes needed).
4. Click **Deploy**.

## Notes
- Data (appointments, clients) is stored in the browser's `localStorage`,
  scoped per device/browser. It will NOT sync across devices. For that,
  you'd need a real backend (e.g. Supabase, Firebase).
- Fonts (Cormorant Garamond, Work Sans) load from Google Fonts at runtime —
  no local font files needed.
