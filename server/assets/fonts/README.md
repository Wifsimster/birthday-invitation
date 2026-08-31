# Fonts bundled for the Open Graph card

`server/src/og-image.ts` rasterises the share card with resvg, which needs real
font files — it has no access to the webfonts the SPA loads from Google Fonts,
and the runtime image ships no system fonts.

Both files are [Baloo 2](https://github.com/EkType/Baloo2) (SIL Open Font
License 1.1, see `OFL.txt` — no Reserved Font Name), the same display face the
default *fiesta* theme uses in the browser. They were derived from the upstream
variable font `Baloo2[wght].ttf`:

```sh
# One static instance per weight: resvg matches font-weight across the faces of
# a family, but ignores the variable `wght` axis (a variable file renders only
# at its default instance).
python3 -m fontTools.varLib.instancer 'Baloo2[wght].ttf' wght=400 -o b400.ttf
python3 -m fontTools.varLib.instancer 'Baloo2[wght].ttf' wght=700 -o b700.ttf

# Subset to the characters a French invitation card can print, taking 683 KB
# down to ~43 KB per face.
RANGES=U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+00B7,U+20AC
python3 -m fontTools.subset b400.ttf --unicodes="$RANGES" --layout-features='*' \
  --output-file=Baloo2-Regular.ttf
python3 -m fontTools.subset b700.ttf --unicodes="$RANGES" --layout-features='*' \
  --output-file=Baloo2-Bold.ttf
```

Characters outside those ranges — emoji above all — have no glyph here, which is
why `og-image.ts` strips pictographs from event text before drawing it.
