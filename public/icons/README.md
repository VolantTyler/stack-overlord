# Stack Overlord icon set

This directory keeps the labeled source exports for the vintage pixel-art icon system. Each icon has a text-based SVG source for review and a raster export for runtime previews.

| Label | SVG source | Raster export | Description |
| --- | --- | --- | --- |
| App icon | `app-icon.svg` | `app-icon.png` | Pipe-shaped `S` on a sky backdrop. |
| Tab icon | `tab-icon.svg` | `tab-icon.png` | `S` inside a pipe flange. |
| Favicon | `favicon.svg` | `favicon.png` | Piranha plant blockage with `SO` block. |

The request-time icon routes serve the production app icons by default and grayscale runtime variants on `localhost`, `127.0.0.1`, and `[::1]`. The runtime files live under `public/icons/runtime/production` and `public/icons/runtime/localhost`, respectively.
