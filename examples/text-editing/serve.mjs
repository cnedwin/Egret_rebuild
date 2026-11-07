// SPDX-License-Identifier: Apache-2.0
import {authorFontExample} from '../../tools/content/author-font-example.mjs';
import {createExampleServer} from '../../tools/serve-example.mjs';
const authored=await authorFontExample(),server=createExampleServer();
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(4173,'127.0.0.1',()=>console.log('Open http://127.0.0.1:4173/examples/text-editing/index.html?fontConfig='+encodeURIComponent(authored.configPath)+' (Ctrl+C to stop)'));
