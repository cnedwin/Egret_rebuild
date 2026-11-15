import type { TextEditState, TextEditSession, TextEditSample, TextEditResult } from '@egret/runtime/ui/editing';
import type { ParagraphTextGeometry } from '@egret/runtime/paragraph';
import type { UiRootAccess } from '../internal/uiRootState.js';
import type { UiRoot } from './types.js';
import type { UiTextEditor, UiTextEditorOptions, UiTextEditorStyle, UiTextEditorTarget } from './textEditorTypes.js';
export interface EditorLogicalBox {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export interface EditorPresentation {
    readonly contentRevision: number;
    readonly source: string;
    readonly style: UiTextEditorStyle;
    readonly geometry: ParagraphTextGeometry | undefined;
    readonly box: EditorLogicalBox;
    readonly clip: EditorLogicalBox;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly localWidth: number;
    readonly localHeight: number;
    readonly rowVisible: boolean;
}
interface HostHooks {
    changed(): void;
    dispose(): void;
    viewRetired(): void;
}
export interface TextEditorHostPort {
    readonly engine: object;
    readonly mode: UiTextEditor['mode'];
    readonly maxLength: number;
    snapshot(): ReturnType<TextEditState['snapshot']>;
    contentRevision(): number;
    style(): UiTextEditorStyle;
    begin(): TextEditSession;
    observe(session: TextEditSession, revision: number, sample: TextEditSample): TextEditResult;
    compositionStart(session: TextEditSession, revision: number): boolean;
    compositionUpdate(session: TextEditSession, revision: number, sample: TextEditSample): boolean;
    compositionEnd(session: TextEditSession, revision: number, sample: TextEditSample): TextEditResult;
    end(session: TextEditSession, revision: number, how: 'commit' | 'cancel', sample?: TextEditSample): TextEditResult;
    root(root: UiRoot): UiRootAccess;
    presentation(root: UiRootAccess, target: UiTextEditorTarget): EditorPresentation | undefined;
    showNative(value: boolean): void;
    setStyle(style: UiTextEditorStyle): void;
    release(): void;
}
/** Browser-only package alias; the public UI entry never exposes native session operations. */
export declare function bindTextEditorHost(editor: UiTextEditor, hooks: HostHooks): TextEditorHostPort;
export declare function createUiTextEditor(options: UiTextEditorOptions): UiTextEditor;
export { requireUiEngine as requireEditorEngine } from '../internal/uiFactoryState.js';
//# sourceMappingURL=textEditor.d.ts.map