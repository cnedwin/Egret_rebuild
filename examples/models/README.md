# Model library

English | [简体中文](README.zh-CN.md)

Twenty-four models made in code with distance fields, each checked by looking at it from four sides: animals, people, buildings, plants and props. They are starting points. To make a model for a game, copy the nearest one, change its proportions, colours and parts, and look at it again. The comment at the top of each file says what parts it is made of and why.

## Run

Use Node.js 26.7.0 and pnpm 11.25.0 from the repository root:

    pnpm setup:dev
    pnpm example:browser

Open `http://127.0.0.1:4173/examples/models/index.html`. Every model is made when the page opens, in rows by kind. Drag to turn the view; tick "true sizes" to see them at their real sizes in metres.

## The models

| Kind | Models |
| --- | --- |
| Animals | fox, cat, dog, rabbit, chick, fish |
| People | villager, knight |
| Buildings | cottage, well, watchtower, pagoda |
| Plants | tree, pine, bush, flower, mushroom, cactus |
| Props | barrel, crate, chest, lantern, rock, signpost |

Every model stands on y = 0, faces +z (as a glTF model does), is centred on x and is in metres. Each module exports `about` (`name`, `zh`, `kind`), `meshOptions` for `createSdfGeometry3D`, and a default function that makes the shape from the exports of `@egret/engine/world3d`:

```js
import * as W from '@egret/engine/world3d';
import fox, { meshOptions } from './fox.mjs';

const mesh = new W.Mesh3D(W.createSdfGeometry3D(fox(W), meshOptions), W.createStandardMaterial3D({ vertexColors: true }));
```

In a `play3d` game, pass `Egret` for `W`.

## Change one and look at it

    node tools/model-preview.mjs <absolute Playwright index.mjs> examples/models/fox.mjs fox.png

draws the model from four sides into `fox.png` and prints its triangles, size and the time it took to make.

## What making them taught

- Paint a gradient on the part it belongs to before joining parts: a belly gradient painted on a whole animal paints its legs too.
- Eyes, noses, buttons and trims go in their own union with a `smooth` of a few millimetres, or they melt into what they sit on and their colour smears.
- A part must be at least two grid cells thick: at the default 64 cells along a 6 m tower a cell is about 10 cm, and a flagpole thinner than that vanishes. Raise `resolution` or thicken the part.
- A rounded lathe, a shell or a rounded box reaches its rounding beyond the shape: start profiles at that height, or the model sinks below the ground.
- Where one coloured part sinks into another, the line where it comes out is ragged: end it above, or let it sit on the surface.
- `edges` lights every place the surface turns sharply: good on boxes, barrels and armour, too much on a displaced rock.

Models are generated in a few hundred milliseconds each; make them while a level loads, or save them with `exportGlb3D`. The pictures used to check them were drawn with software rendering in a headless browser, not on devices.
