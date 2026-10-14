// SPDX-License-Identifier: Apache-2.0
import { DisplayObject, DisplayObjectContainer } from '@egret/engine';
// CGI-N01 no standalone root function
import { getChildIndex } from '@egret/engine';
const container = new DisplayObjectContainer(), child = new DisplayObject();
// CGI-N02 one child argument is required
container.getChildIndex();
// CGI-N03 null is not a display child
container.getChildIndex(null);
// CGI-N04 shape lookalikes are not public DisplayObject consumers
container.getChildIndex({ parent: container });
// CGI-N05 primitive number is not a child
container.getChildIndex(0);
// CGI-N06 primitive string is not a child
container.getChildIndex('child');
// CGI-N07 query result is not void
const wrongVoid: void = container.getChildIndex(child);
// CGI-N08 query result is not a string
const wrongString: string = container.getChildIndex(child);
// CGI-N09 no index or option argument
container.getChildIndex(child, 0);
// CGI-N10 a plain display leaf has no container member
child.getChildIndex(child);
// CGI-N11 DOM globals remain absent
void document;
// CGI-N12 Node globals remain absent
void process;
void [getChildIndex, wrongVoid, wrongString];
