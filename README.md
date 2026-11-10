# Open Matchday -- graphics

Deterministic SVG renderer, scene and template schemas, and golden-test harness for AC-8.1 graphic types.

Part of the [OpenMatchday](https://github.com/OpenMatchday) organization.

## Version

Graphics SemVer is `0.1.0` (`VERSION`, `package.json`). Pins protocol wire `0.1.0` for layout/scene shapes ([REPOS.md](https://github.com/OpenMatchday/docs) dependency direction).

## Scope

- Shipped templates: scorebug, clocks, lineups, lower_thirds, substitutions, summaries, sponsor_panels, social_cards
- Resolutions: 720p, 1080p, 4K for aspects 16:9, 9:16, 1:1 (ITU-R BT.2020 UHD 3840x2160 for 16:9 4K)
- Themes supply token values at render time; this repo does not ship theme packages
- Token contract: [`contracts/theme-tokens.v0.json`](contracts/theme-tokens.v0.json) (mirrored in `themes`; themes must not import this package)
- Output: deterministic SVG ([SVG 2](https://www.w3.org/TR/SVG2/))


## Commands

```bash
npm install
npm run check
npm test
npm run typecheck
npm run goldens:update
```

## License

MIT. See [LICENSE](LICENSE).
