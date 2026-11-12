// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalization } from '@egret/integrations/i18n';

const resources = {
    en: { 'room.label': 'Room', welcome: 'Hello, {{name}}', inventory_one: '{{count}} item', inventory_other: '{{count}} items' },
    'zh-CN': { 'room.label': '房间' },
};

test('language instances are isolated, copy catalogs and preserve fallback, plurals and plain text', async () => {
    const firstCatalogs = structuredClone(resources);
    const first = await createLocalization({ language: 'en', fallbackLanguage: 'en', resources: firstCatalogs });
    const second = await createLocalization({ language: 'en', fallbackLanguage: 'en', resources });
    firstCatalogs.en['room.label'] = 'Changed';
    assert.equal(first.t('room.label'), 'Room');
    assert.equal(first.t('welcome', { values: { name: 'A & B' } }), 'Hello, A & B');
    assert.equal(first.t('inventory', { count: 2 }), '2 items');
    await first.changeLanguage('zh-cn');
    assert.equal(first.language, 'zh-CN');
    assert.equal(first.t('room.label'), '房间');
    assert.equal(first.t('welcome', { values: { name: 'Egret' } }), 'Hello, Egret');
    assert.equal(second.t('room.label'), 'Room');
    first.dispose();
    first.dispose();
    assert.throws(() => first.t('room.label'), { code: 'disposed' });
    assert.equal(second.t('room.label'), 'Room');
});

test('report invalid and missing language selections predictably', async () => {
    await assert.rejects(createLocalization({ language: 'en_uk', fallbackLanguage: 'en', resources }), { code: 'invalid-input' });
    const instance = await createLocalization({ language: 'en', fallbackLanguage: 'en', resources });
    await assert.rejects(instance.changeLanguage('fr'), { code: 'invalid-input' });
    await assert.rejects(createLocalization({ language: 'cimode', fallbackLanguage: 'en', resources: { ...resources, cimode: {} } }),
        { code: 'invalid-input' });
    assert.equal(instance.t('missing'), 'missing');
});
