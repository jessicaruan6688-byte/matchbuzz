# MatchBuzz Competition Notes

## Current Alignment With The Brief

- `AI x Global Expansion` positioning is now explicit in the product pages.
- The product has a default English interface and a separate full Chinese interface under `/zh/`.
- The workflow is framed as a complete execution path rather than simple Q&A:
  1. Pick match and target market
  2. Generate localized content
  3. Launch interaction
  4. Export campaign assets
- Target markets are clearly defined:
  - Indonesia / Southeast Asia
  - Spanish-speaking football markets
  - Global English creator and brand operators
- The backend is ready for `GMI Cloud Inference Engine` integration through `GMI_API_*` environment variables.

## What Still Needs To Be Completed

- Connect the real GMI Cloud API.
- Connect the real match data API.
- Add exact request/response adapters once the real API documentation is provided.
- Prepare final submission materials:
  - architecture screenshot
  - workflow explanation
  - target market explanation
  - third-party framework/version list
  - short demo video

## Suggested Demo Story

Use this order in the live demo:

1. Open the English homepage and show the overseas positioning.
2. Switch to Chinese with the language selector to show bilingual presentation.
3. Select a match and generate a campaign package.
4. Show the poll and support meter.
5. Export the share card.
6. Open Admin and show that GMI / match-data providers are ready to be connected.

## Deployment Recommendation

Recommended path:

- Push to GitHub
- Deploy from GitHub to Render or Railway
- Set `APP_HOST=0.0.0.0` in deployment
- Set `GMI_API_*` and `MATCH_DATA_API_*` in deployment environment variables
