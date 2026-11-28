// SPDX-License-Identifier: Apache-2.0
// Public Play tab semantics on the actual browser surface: selection is CSS-neutral
// state owned by the game, with native button actions, focus and role projection.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFloatingStickServer, route } from './verify-floating-stick.mjs';
import { readBrowserKeyboardFocus } from './keyboard-focus-probe.mjs';

export async function verifyViewTabs(page) {
  const fixture = await page.evaluateHandle(async () => {
    const { play } = await import('@egret/engine/play');
    const { createUiSemantics } = await import('@egret/engine/ui/semantics');
    const { createUiTester } = await import('@egret/engine/ui/testing');
    const { createBrowserSemantics } = await import('@egret/engine/web/semantics');
    const semantics = createUiSemantics(),
      tester = createUiTester({ semantics });
    const state = { page: 'offers', gearDisabled: false, ordinary: 0, hits: [] };
    const errors = [];
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0';
    document.body.append(host);
    const after = document.createElement('button');
    after.id = 'after-play';
    after.textContent = 'After Play';
    document.body.append(after);
    let view, projection, modal;
    const tab = (name, text, selected) => ({
      type: 'button',
      name,
      role: 'tab',
      text,
      width: 126,
      height: 52,
      ...(selected === undefined ? {} : { selected })
    });
    const tabs = layout => ({
      type: 'panel',
      name: 'marketTabs',
      label: 'Market pages',
      role: 'tablist',
      layout,
      gap: 8,
      width: 'fill',
      height: layout === 'row' ? 52 : 112,
      children: [tab('offers', 'Offers'), tab('gear', 'Relics')]
    });
    const staticTabs = {
      type: 'panel',
      name: 'staticTabs',
      role: 'tablist',
      label: 'Reference pages',
      layout: 'row',
      width: 'fill',
      height: 52,
      gap: 8,
      children: [tab('summary', 'Summary', true), tab('details', 'Details')]
    };
    const parts = layout => ({
      type: 'panel',
      name: 'market',
      layout: 'column',
      gap: 12,
      padding: 12,
      width: 'fill',
      height: 'fill',
      children: [
        tabs(layout),
        staticTabs,
        { type: 'button', name: 'ordinary', text: 'Ordinary', height: 44, width: 126 }
      ]
    });
    const bind = {
      offers: {
        selected: s => s.page === 'offers',
        tap: s => {
          s.page = 'offers';
          s.hits.push('offers');
        }
      },
      gear: {
        selected: s => s.page === 'gear',
        disabled: s => s.gearDisabled,
        tap: s => {
          s.page = 'gear';
          s.hits.push('gear');
        }
      },
      summary: { tap: () => {} },
      details: { tap: () => {} },
      ordinary: {
        tap: s => {
          s.ordinary++;
        }
      }
    };
    const game = await play({
      width: 640,
      height: 360,
      portrait: { width: 360, height: 640 },
      parent: host,
      fit: 'expand',
      backend: 'webgl2',
      pixelRatio: 1,
      audio: false,
      semantics,
      onError(error) {
        errors.push(error?.code ?? String(error));
      },
      setup(g) {
        view = g.show(
          {
            label: 'Market',
            root: parts('row'),
            portrait: parts('column'),
            tablet: parts('row'),
            tabletPortrait: parts('row')
          },
          { state, bind }
        );
      }
    });
    const mountProjection = () => {
      projection?.dispose();
      projection = createBrowserSemantics({
        semantics,
        canvas: game.canvas,
        width: game.screen.width,
        height: game.screen.height,
        onError(error) {
          errors.push(error?.code ?? String(error));
        }
      });
    };
    mountProjection();
    function inspect() {
      const snapshot = semantics.publish();
      projection.sync();
      const names = new Map(snapshot.nodes.map(node => [node.id, node.name]));
      const nodes = snapshot.nodes
        .filter(node => /:(marketTabs|staticTabs|offers|gear|summary|details|ordinary)$/.test(node.id))
        .map(node => {
          const element = projection.elementOf(node.id);
          return {
            part: node.id.split(':').at(-1),
            role: node.role,
            name: node.name,
            parent: names.get(node.parent),
            selected: node.selected,
            focused: node.focused,
            disabled: node.disabled,
            dom: {
              role: element?.getAttribute('role'),
              selected: element?.getAttribute('aria-selected'),
              disabled: element?.getAttribute('aria-disabled'),
              label: element?.getAttribute('aria-label')
            }
          };
        });
      return {
        nodes,
        state: { ...state, hits: [...state.hits] },
        variant: view.variant,
        errors: [...errors],
        rect: view.visibleRect('gear')
      };
    }
    return {
      inspect,
      press: name => tester.press(name),
      focus: name => view.focus(name),
      openFocusModal() {
        modal = game.show(
          {
            modal: true,
            label: 'Focus question',
            root: {
              type: 'panel',
              layout: 'column',
              width: 240,
              height: 120,
              anchor: 'center',
              gap: 6,
              children: [
                { type: 'button', name: 'answerFirst', text: 'First answer', height: 48 },
                { type: 'button', name: 'answerSecond', text: 'Second answer', height: 48 }
              ]
            }
          },
          { bind: { answerFirst: { tap: () => {} }, answerSecond: { tap: () => {} } }, dismiss: () => modal.close() }
        );
      },
      disabled(value) {
        state.gearDisabled = value;
        view.refresh();
      },
      choose(name) {
        state.page = name;
        view.refresh();
      },
      remount() {
        mountProjection();
      },
      point(name) {
        const r = view.visibleRect(name),
          box = game.canvas.getBoundingClientRect();
        // visibleRect returns clipped global stage coordinates, not the design area's shifted origin.
        return {
          x: box.x + ((r.x + r.width / 2) * box.width) / game.screen.width,
          y: box.y + ((r.y + r.height / 2) * box.height) / game.screen.height
        };
      },
      rejected() {
        const cases = [
          {
            description: { root: { type: 'button', name: 'plain', text: 'Plain' } },
            options: { bind: { plain: { selected: () => true } } }
          },
          {
            description: { root: { type: 'panel', name: 'list', role: 'tablist', children: [tab('p', 'P')] } },
            options: { bind: { list: { tap: () => {} }, p: { tap: () => {} } } }
          }
        ];
        return cases.map(({ description, options }) => {
          try {
            game.show(description, options).close();
            return null;
          } catch (error) {
            return error?.code;
          }
        });
      },
      async dispose() {
        projection.dispose();
        await game.dispose();
        semantics.dispose();
        host.remove();
        after.remove();
      }
    };
  });
  try {
    const read = () => fixture.evaluate(f => f.inspect());
    const node = (snapshot, part) => snapshot.nodes.find(n => n.part === part);
    const selected = (snapshot, part, value) => {
      const n = node(snapshot, part);
      assert.equal(n.role, 'tab');
      assert.equal(n.selected, value);
      assert.equal(n.dom.role, 'tab');
      assert.equal(n.dom.selected, String(value));
    };
    let snapshot = await read();
    assert.equal(node(snapshot, 'marketTabs').role, 'tablist');
    assert.equal(node(snapshot, 'marketTabs').dom.role, 'tablist');
    assert.equal(node(snapshot, 'offers').parent, 'Market pages');
    selected(snapshot, 'offers', true);
    selected(snapshot, 'gear', false);
    selected(snapshot, 'summary', true);
    selected(snapshot, 'details', false);
    assert.equal(node(snapshot, 'ordinary').role, 'button');
    assert.equal(node(snapshot, 'ordinary').dom.selected, null);
    assert.deepEqual(await fixture.evaluate(f => f.rejected()), ['UI_VIEW_BINDING_INVALID', 'UI_VIEW_BINDING_INVALID']);
    await fixture.evaluate(f => f.press('tab:Relics'));
    snapshot = await read();
    selected(snapshot, 'offers', false);
    selected(snapshot, 'gear', true);
    assert.equal(node(snapshot, 'gear').name, 'Relics', 'selection does not pollute the accessible name');
    const offer = await fixture.evaluate(f => f.point('offers'));
    await page.mouse.click(offer.x, offer.y);
    await page.waitForFunction(f => f.inspect().state.page === 'offers', fixture, { timeout: 3000 });
    snapshot = await read();
    selected(snapshot, 'offers', true);
    selected(snapshot, 'gear', false);
    // The canvas remains the DOM focus owner while the engine and ARIA
    // projection follow actual Tab/Shift+Tab. A test using activeElement alone
    // would incorrectly count this whole sequence as one control.
    const keyboardFocus = [];
    async function waitProjection(name) {
      await page.waitForFunction(
        label => {
          const owner = document.activeElement,
            id = owner?.getAttribute('aria-activedescendant');
          return (
            owner?.tagName === 'CANVAS' &&
            id !== null &&
            id !== undefined &&
            document.getElementById(id)?.getAttribute('aria-label') === label
          );
        },
        name,
        { timeout: 3000 }
      );
      const probe = await page.evaluate(readBrowserKeyboardFocus);
      assert.equal(probe.kind, 'active-descendant');
      assert.equal(probe.owner.tag, 'CANVAS');
      assert.equal(probe.owner.role, 'application');
      assert.equal(probe.target.name, name);
      assert.equal(probe.target.tabIndex, '-1');
      assert.ok(probe.visible);
      keyboardFocus.push(probe.target.id);
      return probe;
    }
    assert(await fixture.evaluate(f => f.focus('offers')));
    const offersFocus = await waitProjection('Offers');
    await page.keyboard.press('Tab');
    const relicsFocus = await waitProjection('Relics');
    assert.notEqual(relicsFocus.target.id, offersFocus.target.id);
    await page.keyboard.press('Shift+Tab');
    assert.equal((await waitProjection('Offers')).target.id, offersFocus.target.id);
    await fixture.evaluate(f => f.openFocusModal());
    const firstAnswer = await waitProjection('First answer');
    await page.keyboard.press('Tab');
    const secondAnswer = await waitProjection('Second answer');
    assert.notEqual(firstAnswer.target.id, secondAnswer.target.id);
    await page.keyboard.press('Tab');
    assert.equal((await waitProjection('First answer')).target.id, firstAnswer.target.id, 'modal focus cycles');
    await page.keyboard.press('Escape');
    assert.equal((await waitProjection('Offers')).target.id, offersFocus.target.id, 'focus returns to the opener');

    assert(await fixture.evaluate(f => f.focus('gear')));
    await page.keyboard.press('Enter');
    await page.waitForFunction(f => f.inspect().state.page === 'gear', fixture, { timeout: 3000 });
    snapshot = await read();
    selected(snapshot, 'gear', true);
    assert.equal(node(snapshot, 'gear').focused, true);
    await fixture.evaluate(f => f.disabled(true));
    snapshot = await read();
    assert.equal(node(snapshot, 'gear').disabled, true);
    assert.equal(node(snapshot, 'gear').dom.disabled, 'true');
    selected(snapshot, 'gear', true);
    await fixture.evaluate(f => f.disabled(false));
    await fixture.evaluate(f => f.choose('offers'));
    await fixture.evaluate(f => f.press('button:Ordinary'));
    snapshot = await read();
    assert.deepEqual(snapshot.state.hits, ['gear', 'offers', 'gear']);
    assert.equal(snapshot.state.ordinary, 1);
    const wideRect = snapshot.rect;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(f => f.inspect().variant === 'portrait', fixture);
    await fixture.evaluate(f => f.remount());
    snapshot = await read();
    assert.notDeepEqual(snapshot.rect, wideRect);
    selected(snapshot, 'offers', true);
    selected(snapshot, 'gear', false);
    const variants = ['landscape', snapshot.variant];
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForFunction(f => f.inspect().variant === 'tablet', fixture);
    await fixture.evaluate(f => f.remount());
    snapshot = await read();
    variants.push(snapshot.variant);
    selected(snapshot, 'offers', true);
    selected(snapshot, 'gear', false);
    await fixture.evaluate(f => f.press('tab:Relics'));
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForFunction(f => f.inspect().variant === 'tabletPortrait', fixture);
    await fixture.evaluate(f => f.remount());
    snapshot = await read();
    variants.push(snapshot.variant);
    selected(snapshot, 'offers', false);
    selected(snapshot, 'gear', true);
    assert.deepEqual(snapshot.errors, []);
    assert(await fixture.evaluate(f => f.focus('ordinary')));
    await waitProjection('Ordinary');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.id === 'after-play');
    const outside = await page.evaluate(readBrowserKeyboardFocus);
    assert.equal(outside.kind, 'dom');
    assert.equal(outside.target.id, 'after-play', 'the final stop of an embedded game releases Tab to the page');

    // Negative controls keep an invalid ARIA relation from being mistaken for
    // a second reachable control. The actual focus stays on the ordinary page button.
    await page.evaluate(() => document.activeElement.setAttribute('aria-activedescendant', 'missing-descendant'));
    assert.equal((await page.evaluate(readBrowserKeyboardFocus)).kind, 'invalid-active-descendant');
    await page.evaluate(id => document.activeElement.setAttribute('aria-activedescendant', id), keyboardFocus.at(-1));
    assert.equal(
      (await page.evaluate(readBrowserKeyboardFocus)).kind,
      'invalid-active-descendant',
      'foreign projection'
    );
    await page.evaluate(() => document.activeElement.removeAttribute('aria-activedescendant'));

    return {
      passing: true,
      variants,
      nodes: snapshot.nodes,
      state: snapshot.state,
      ordinaryRole: 'button',
      keyboardFocus: { activeDescendants: keyboardFocus, finalDomTarget: outside.target.id }
    };
  } finally {
    await fixture.evaluate(f => f.dispose());
    await fixture.dispose();
  }
}

async function main() {
  const [playwrightPath, outputArg, chromiumPath] = process.argv.slice(2);
  assert(
    playwrightPath && outputArg && chromiumPath,
    'Playwright index, fresh output directory, Chromium executable required'
  );
  const output = path.resolve(outputArg);
  await mkdir(output, { recursive: false });
  const { chromium } = await import(pathToFileURL(path.resolve(playwrightPath)).href);
  const { server, origin } = await createFloatingStickServer();
  let browser, context;
  const receipt = { passing: false };
  try {
    browser = await chromium.launch({
      executablePath: chromiumPath,
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    });
    receipt.browser = browser.version();
    context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const page = await context.newPage(),
      faults = [];
    page.on('pageerror', error => faults.push(error.message));
    await page.goto(origin + route);
    receipt.result = await verifyViewTabs(page);
    assert.deepEqual(faults, []);
    receipt.passing = true;
  } catch (error) {
    receipt.failure = String(error.stack ?? error);
    if (error.cause) receipt.cause = String(error.cause.stack ?? error.cause);
    process.exitCode = 1;
  } finally {
    await context?.close();
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    await writeFile(path.join(output, 'view-tabs.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(
    JSON.stringify({ passing: receipt.passing, browser: receipt.browser, failure: receipt.failure?.split('\n')[0] })
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
