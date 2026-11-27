// SPDX-License-Identifier: Apache-2.0
export const scoreProfile = {
  width: 160,
  height: 90,
  projectId: 'p_bitmap_score',
  theme: { skins: {}, exmls: [] },
  resources: {
    configUrl: 'score-res.json',
    root: '',
    resources: [{ name: 'digits', type: 'font', url: 'score.fnt' }],
    groups: [{ name: 'board', keys: ['digits'] }]
  }
};
