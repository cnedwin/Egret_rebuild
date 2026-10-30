import type { ContentGroup } from '@egret/engine/resources';
declare const group: ContentGroup;
group.getAtlasPage('atlas', 0);
group.getAtlasPages('atlas').push('new');
group.getAtlasPages('atlas', 'page');
