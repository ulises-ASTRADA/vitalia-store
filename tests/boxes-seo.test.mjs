import test from 'node:test';
import assert from 'node:assert/strict';
import {BOXES} from '../lib/boxes.js';
import {ZONE_GROUPS} from '../lib/envios.js';
import {BOXES_TITLE,BOXES_DESCRIPTION} from '../lib/boxes-seo.js';

test('/boxes: title y description nombran solo boxes que existen y zonas de /envios',()=>{
  for(const {name} of BOXES){assert.ok(BOXES_TITLE.includes(name),name);assert.ok(BOXES_DESCRIPTION.includes(name),name);}
  // El Box del mes todavía es «Próximamente»: no se ofrece como pedible.
  assert.doesNotMatch(`${BOXES_TITLE} ${BOXES_DESCRIPTION}`,/box del mes/i);
  assert.ok(BOXES_DESCRIPTION.includes('Sierras Chicas')&&ZONE_GROUPS.some(z=>z.title==='Sierras Chicas'));
  assert.ok(BOXES_DESCRIPTION.includes('zona norte')&&ZONE_GROUPS.some(z=>/zona norte/i.test(z.title)));
  assert.ok(BOXES_DESCRIPTION.length<=160,`${BOXES_DESCRIPTION.length}`);
});
