// SPDX-License-Identifier: Apache-2.0
// An original small cover and a letterboxed stage exercise the browser-host contract.
import assert from 'node:assert/strict';

export async function verifyPlayUiHost(page) {
  await page.setViewportSize({ width: 920, height: 700 });
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createBrowserSemantics } = await import('@egret/engine/web/semantics');
    const host = document.createElement('div');
    host.style.cssText =
      'position:absolute;left:80px;top:40px;width:640px;height:480px;transform:scale(1.25);transform-origin:0 0';
    document.body.append(host);
    const semantics = createUiSemantics();
    let pressed = 0;
    const viewImageErrors = [];
    const game = await play({
      parent: host,
      width: 640,
      height: 360,
      fit: 'contain',
      backend: 'webgl2',
      audio: false,
      pixelRatio: 0.5,
      semantics,
      onError(error) {
        viewImageErrors.push([error.code, error.cause?.code, error.cause?.cause?.code]);
      },
      setup(game) {
        game.show(
          {
            label: 'Building plans',
            root: {
              type: 'panel',
              x: 16,
              y: 20,
              width: 160,
              height: 80,
              children: [{ type: 'button', text: 'Build workshop', name: 'build', x: 8, y: 12, width: 134, height: 48 }]
            }
          },
          { bind: { build: { tap: () => pressed++ } } }
        );
      }
    });
    const source = document.createElement('canvas');
    source.width = 12;
    source.height = 8;
    const paint = source.getContext('2d');
    paint.fillStyle = '#cc7a53';
    paint.fillRect(0, 0, 12, 8);
    const cover = source.toDataURL('image/webp');
    let adapter;
    const observed = { isWebp: cover.startsWith('data:image/webp;') };
    const png = await game.image(source.toDataURL(), { x: 320, y: 220, width: 36, layer: 'ui' });
    observed.png = [png.getBounds().width, png.getBounds().height];
    try {
      await game.image('data:image/png;base64,iVBORw0KGgo=');
    } catch (error) {
      observed.invalidPng = [error.code, error.cause?.code];
    }
    // The original four-job budget includes reads. Use controlled fetches so it cannot pass by timing.
    const normalFetch = globalThis.fetch;
    const pending = [];
    globalThis.fetch = (url, options) => {
      if (!String(url).startsWith('/wait-for-game-image-')) return normalFetch(url, options);
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        pending.push(resolve);
      });
    };
    const loads = Array.from({ length: 4 }, (_, i) => game.image('/wait-for-game-image-' + i));
    try {
      const rejected = await Promise.race([
        game.image('/wait-for-game-image-4'),
        new Promise(resolve => setTimeout(() => resolve('unexpected admission'), 500))
      ]);
      observed.imageJobLimit = rejected;
    } catch (error) {
      observed.imageJobLimit = [error.code, error.cause?.code];
    }
    observed.admittedImageReads = pending.length;
    const pngBytes = await normalFetch(source.toDataURL()).then(response => response.arrayBuffer());
    for (const resolve of pending) resolve(new Response(pngBytes));
    await Promise.all(loads);
    const oversized = '/oversized-game-cover';
    globalThis.fetch = (url, options) =>
      url === oversized
        ? Promise.resolve(
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new Uint8Array(8 * 1024 * 1024));
                  controller.enqueue(new Uint8Array(1));
                  controller.close();
                }
              })
            )
          )
        : normalFetch(url, options);
    try {
      await game.image(oversized);
    } catch (error) {
      observed.imageByteLimit = [error.code, error.cause?.code];
    }
    globalThis.fetch = normalFetch;
    const retryAddress = '/retry-game-cover.png';
    const retryBytes = await normalFetch(cover).then(response => response.arrayBuffer());
    let retryReads = 0;
    globalThis.fetch = (url, options) => {
      if (url !== retryAddress) return normalFetch(url, options);
      return Promise.resolve(
        ++retryReads === 1
          ? new Response(null, { status: 404 })
          : new Response(retryBytes, { headers: { 'content-type': 'image/png' } })
      );
    };
    try {
      await game.image(retryAddress).catch(error => {
        observed.httpFailure = [error.code, error.cause?.code, error.cause?.cause?.code];
      });
      const retried = await game.image(retryAddress, { width: 48, layer: 'ui' });
      observed.retry = [retryReads, retried.getBounds().width, retried.getBounds().height];
    } finally {
      globalThis.fetch = normalFetch;
    }
    try {
      const node = await game.image(cover, { x: 320, y: 170, width: 60, layer: 'ui' });
      const { width, height } = node.getBounds();
      observed.cover = [width, height];
    } catch (error) {
      observed.coverError = [error.code, error.cause?.code];
    }
    try {
      adapter = createBrowserSemantics({ semantics, canvas: game.canvas, width: 640, height: 360 });
    } catch (error) {
      observed.projectionError = error.code;
    }
    const imageViews = new Map();
    return {
      webp() {
        return cover.slice(cover.indexOf(',') + 1);
      },
      openImageView(key, names) {
        const view = game.show({
          label: key,
          root: {
            type: 'panel',
            x: 180,
            y: imageViews.size * 40,
            width: 240,
            height: 40,
            children: names.map((name, index) => ({
              type: 'image',
              name,
              x: index * 40,
              y: 0,
              width: 40,
              height: 40,
              src: '/cold-play-view-images/' + name + '.webp'
            }))
          }
        });
        imageViews.set(key, { view, names });
      },
      closeImageView(key) {
        imageViews.get(key).view.close();
        imageViews.delete(key);
      },
      viewImages() {
        const bounds = [...imageViews.values()].flatMap(({ view, names }) =>
          names.map(name => {
            const part = view.get(name);
            if (part.numChildren !== 1) return null;
            const { width, height } = part.getChildAt(0).getBounds();
            return [width, height];
          })
        );
        return { bounds, errors: [...viewImageErrors] };
      },
      current() {
        const bounds = game.canvas.getBoundingClientRect();
        const button = semantics.snapshot.nodes.find(node => node.name === 'Build workshop');
        const projected = button && adapter?.elementOf(button.id)?.getBoundingClientRect();
        const geometry = rect => [rect.left, rect.top, rect.width, rect.height];
        return {
          ...observed,
          dimensions: [game.canvas.width, game.canvas.height],
          cssCanvas: geometry(bounds),
          buttonBounds: button?.bounds,
          projected: projected && geometry(projected),
          pointer: [bounds.left + (90 * bounds.width) / 640, bounds.top + (55 * bounds.height) / 360],
          pressed
        };
      },
      async dispose() {
        adapter?.dispose();
        let started,
          aborted = false;
        const fetched = new Promise(resolve => {
          started = resolve;
        });
        globalThis.fetch = (url, options) => {
          if (url !== '/close-cancels-cover') return normalFetch(url, options);
          return new Promise((_resolve, reject) => {
            options.signal.addEventListener(
              'abort',
              () => {
                aborted = true;
                reject(options.signal.reason);
              },
              { once: true }
            );
            started();
          });
        };
        try {
          const pending = game.image('/close-cancels-cover').then(
            () => 'attached',
            error => error.code
          );
          await fetched;
          await game.dispose();
          return { aborted, error: await pending };
        } finally {
          globalThis.fetch = normalFetch;
          semantics.dispose();
          host.remove();
        }
      }
    };
  });
  let closed = false;
  try {
    await page.waitForFunction(handle => handle.current().buttonBounds !== undefined, fixture);
    const before = await fixture.evaluate(handle => handle.current());
    await page.mouse.click(...before.pointer);
    const after = await fixture.evaluate(handle => handle.current());
    const cases = {
      isWebp: true,
      png: [36, 24],
      invalidPng: ['ASSET_LOAD_FAILED', 'WEB_PNG_STRUCTURE_INVALID'],
      imageJobLimit: ['ASSET_LOAD_FAILED', 'WEB_PNG_JOB_LIMIT'],
      imageByteLimit: ['ASSET_LOAD_FAILED', 'WEB_PNG_INPUT_LIMIT'],
      admittedImageReads: 4,
      httpFailure: ['ASSET_LOAD_FAILED', 'WEB_PNG_READ_FAILED', 'BROWSER_GAME_IMAGE_FAILED'],
      retry: [2, 48, 32],
      cover: [60, 40],
      dimensions: [320, 180],
      cssCanvas: [80, 115, 800, 450],
      projected: [110, 155, 167.5, 60],
      pressed: 1
    };
    for (const [key, expected] of Object.entries(cases))
      assert.deepEqual(after[key], expected, key + ': ' + JSON.stringify(after));
    after.imageQueue = await verifyViewImages(page, fixture);
    after.cancel = await fixture.evaluate(handle => handle.dispose());
    closed = true;
    assert.equal(after.cancel.aborted, true);
    assert.notEqual(after.cancel.error, 'attached');
    after.renderAdmission = await verifyRenderAdmission(page);
    const sample = new URL('/examples/play/index.html?game=semantic-letterbox', page.url());
    await page.goto(sample.href);
    const button = page.getByRole('button', { name: 'Place workshop' });
    await button.waitFor();
    await button.dispatchEvent('click');
    await page.locator('[aria-label="Placed: 1"],div:text-is("Placed: 1")').first().waitFor();
    after.publicExample = {
      pressed: 1,
      canvas: await page.locator('canvas').evaluate(canvas => [canvas.width, canvas.height])
    };
    assert.deepEqual(after.publicExample.canvas, [480, 270]);
    return after;
  } finally {
    if (!closed) await fixture.evaluate(handle => handle.dispose());
    await fixture.dispose();
  }
}

async function verifyViewImages(page, fixture) {
  const pattern = '**/cold-play-view-images/*.webp';
  const webp = Buffer.from(await fixture.evaluate(handle => handle.webp()), 'base64');
  const started = [];
  let active = 0;
  let peak = 0;
  const { promise: releaseReads, resolve: release } = Promise.withResolvers();
  const serveImage = async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1).slice(0, -5);
    started.push(name);
    active++;
    peak = Math.max(peak, active);
    await releaseReads;
    active--;
    await route.fulfill(
      name === 'missing'
        ? { status: 404 }
        : { status: 200, contentType: 'image/webp', body: webp, headers: { 'cache-control': 'no-store' } }
    );
  };

  await page.route(pattern, serveImage);
  try {
    // Keep all four browser jobs occupied while the other views open.
    const first = ['one', 'two', 'three', 'four'];
    const readsStarted = Promise.all(
      first.map(name =>
        page.waitForRequest(request => request.url().endsWith('/cold-play-view-images/' + name + '.webp'))
      )
    );
    await Promise.all([
      readsStarted,
      fixture.evaluate((handle, names) => handle.openImageView('First shelf', names), first)
    ]);
    await fixture.evaluate(handle => {
      handle.openImageView('Retired shelf', ['retired']);
      handle.closeImageView('Retired shelf');
      handle.openImageView('Second shelf', ['five', 'six']);
    });
    release();
    await page.waitForFunction(handle => {
      const { bounds, errors } = handle.viewImages();
      return errors.length > 0 || (bounds.length === 6 && bounds.every(Boolean));
    }, fixture);
    const result = await fixture.evaluate(handle => handle.viewImages());
    assert.deepEqual(result.errors, [], 'current declarative images wait for an image job instead of failing');
    assert.deepEqual(
      result.bounds,
      Array.from({ length: 6 }, () => [12, 8])
    );
    assert.deepEqual(
      [...started].sort(),
      [...first, 'five', 'six'].sort(),
      'a retired view never starts a queued read'
    );
    assert.ok(peak <= 4, 'declarative image reads respect the browser job limit');

    await fixture.evaluate(handle => handle.openImageView('Broken shelf', ['missing']));
    await page.waitForFunction(handle => handle.viewImages().errors.length > 0, fixture);
    result.genuineFailure = (await fixture.evaluate(handle => handle.viewImages())).errors;
    assert.deepEqual(result.genuineFailure, [
      ['ASSET_LOAD_FAILED', 'WEB_PNG_READ_FAILED', 'BROWSER_GAME_IMAGE_FAILED']
    ]);
    return { ...result, peak, started };
  } finally {
    release();
    await page.unroute(pattern, serveImage);
  }
}

async function verifyRenderAdmission(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0';
    document.body.append(host);
    let prepared = 0,
      decisions = 0,
      updates = 0;
    const errors = [];
    const game = await play({
      parent: host,
      width: 320,
      height: 180,
      backend: 'webgl2',
      audio: false,
      renderMode: 'on-demand',
      update() {
        updates++;
      },
      beforeRender() {
        prepared++;
      },
      renderRetry: {
        maxConsecutive: 1,
        shouldRetry() {
          decisions++;
          return false;
        }
      },
      onError: e => errors.push(e.code)
    });
    return {
      inspect() {
        return { prepared, decisions, updates, errors: [...errors], loop: game.browser.loop.snapshot() };
      },
      invalidate() {
        game.invalidate();
      },
      async dispose() {
        await game.dispose();
        host.remove();
      }
    };
  });
  try {
    await page.waitForFunction(f => f.inspect().prepared >= 1, fixture);
    const first = await fixture.evaluate(f => f.inspect());
    await page.waitForFunction(({ f, n }) => f.inspect().updates >= n + 6, { f: fixture, n: first.updates });
    const quiet = await fixture.evaluate(f => f.inspect());
    assert.equal(quiet.prepared, first.prepared);
    assert.equal(quiet.loop.recoveredRenderFailures, 0);
    assert.equal(quiet.decisions, 0);
    await fixture.evaluate(f => f.invalidate());
    await page.waitForFunction(({ f, n }) => f.inspect().prepared >= n + 1, { f: fixture, n: quiet.prepared });
    const after = await fixture.evaluate(f => f.inspect());
    assert.equal(after.prepared, quiet.prepared + 1);
    assert.deepEqual(after.errors, []);
    assert.equal(after.loop.state, 'running');
    return {
      firstPrepared: first.prepared,
      quietUpdates: quiet.updates - first.updates,
      afterPrepared: after.prepared,
      recovered: after.loop.recoveredRenderFailures
    };
  } finally {
    await fixture.evaluate(f => f.dispose());
    await fixture.dispose();
  }
}
