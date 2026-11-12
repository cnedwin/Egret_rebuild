// SPDX-License-Identifier: Apache-2.0
declare module 'sax' {
    interface StrictXmlParser {
        onopentag: (tag: {name: string; attributes: Record<string, string>}) => void;
        onclosetag: (name: string) => void;
        ontext: (text: string) => void;
        oncdata: (text: string) => void;
        ondoctype: (text: string) => void;
        onprocessinginstruction: (instruction: {name: string; body: string}) => void;
        onerror: (cause: Error) => void;
        write(text: string): StrictXmlParser;
        close(): StrictXmlParser;
    }
    const sax: {parser(strict: true, options?: {strictEntities: true}): StrictXmlParser};
    export default sax;
}

declare module 'tmx-parser' {
    interface LegacyTileLayer {
        tiles: readonly ({id: number; gid: number} | undefined)[];
        horizontalFlips: readonly boolean[];
        verticalFlips: readonly boolean[];
        diagonalFlips: readonly boolean[];
    }
    export interface LegacyTileMap {layers: readonly LegacyTileLayer[]}
    const tmx: {
        parse(xml: string, fileName: string, callback: (error: Error | null, map: LegacyTileMap) => void): void;
    };
    export default tmx;
}
