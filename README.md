# Crossy Angel Road

A browser arcade game inspired by the lane-crossing genre, built with Vite + Three.js and ready for Vercel.

## Game rules

- Move forward, backward, left, or right one tile at a time.
- Hazards include:
  - cliffs / pits
  - normal rivers with moving logs
  - lava rivers with basalt stepping stones
  - train tracks with fast trains
- You begin with **3 lives**.
- A death rewinds you roughly **10 recorded steps** to the nearest safe row.
- After the first death you respawn as an **angel chicken** with halo, wings, glow, and a short grace period.
- Your score is your furthest forward distance.

## VFX / animation included

- hop arc + squash/stretch
- animated chicken legs and idle bob
- angel halo bob/spin and wing flapping
- bloom post-processing
- death particles per hazard
- water splash rings
- animated river ripples
- lava bubbles + emissive lava glow
- screen flashes
- camera shake
- synthesized WebAudio sound effects
- moving logs and trains
- dynamic infinite lane generation
- desktop keyboard controls, swipe, and mobile on-screen controls

## Controls

- **W / Up Arrow**: forward
- **S / Down Arrow**: backward
- **A / Left Arrow**: left
- **D / Right Arrow**: right
- Mobile: swipe or use the arrow pad.

## Run locally

```bash
npm install
npm run dev
```

## Deploy on Vercel

1. Create a new GitHub repository.
2. Upload this project to the repository root.
3. In Vercel, choose **Add New → Project**.
4. Import the GitHub repository.
5. Vercel will detect Vite automatically.
6. Deploy.

No environment variables are required.

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Notes

The game uses original primitive 3D geometry and synthesized audio, so there are no external game-art assets to manage. The Google Fonts import is optional; if unavailable, the UI falls back to system fonts.
