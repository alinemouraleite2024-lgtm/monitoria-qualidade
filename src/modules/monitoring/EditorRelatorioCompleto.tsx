import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import OfficePaste from '@intevation/tiptap-extension-office-paste';
import { Bold, Heading1, Heading2, Highlighter, Italic, List, ListOrdered, Minus, Redo2, Table as TableIcon, Trash2, Underline, Undo2 } from 'lucide-react';
import { adaptarColagemDoWord, relatorioParaGravar } from './relatorioHtml';

// Carregado sob demanda: só a etapa 4 do formulário paga o peso do editor. Sem extensão de imagem:
// o que o editor não conhece não entra, e o conteúdo sai limpo a cada alteração.
function BarraFormatacao({ editor }: { editor: Editor }) {
  const ativo = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }), h2: e.isActive('heading', { level: 2 }), bold: e.isActive('bold'), italic: e.isActive('italic'),
      underline: e.isActive('underline'), highlight: e.isActive('highlight'), bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), table: e.isActive('table'),
    }),
  });
  const c = () => editor.chain().focus();
  const botoes = [
    { rotulo: 'Título', Icone: Heading1, on: ativo.h1, faz: () => c().toggleHeading({ level: 1 }).run() },
    { rotulo: 'Subtítulo', Icone: Heading2, on: ativo.h2, faz: () => c().toggleHeading({ level: 2 }).run() },
    { rotulo: 'Negrito', Icone: Bold, on: ativo.bold, faz: () => c().toggleBold().run() },
    { rotulo: 'Itálico', Icone: Italic, on: ativo.italic, faz: () => c().toggleItalic().run() },
    { rotulo: 'Sublinhado', Icone: Underline, on: ativo.underline, faz: () => c().toggleUnderline().run() },
    { rotulo: 'Destaque', Icone: Highlighter, on: ativo.highlight, faz: () => c().toggleHighlight().run() },
    { rotulo: 'Lista', Icone: List, on: ativo.bullet, faz: () => c().toggleBulletList().run() },
    { rotulo: 'Lista numerada', Icone: ListOrdered, on: ativo.ordered, faz: () => c().toggleOrderedList().run() },
    { rotulo: 'Linha divisória', Icone: Minus, on: false, faz: () => c().setHorizontalRule().run() },
    { rotulo: 'Tabela', Icone: TableIcon, on: ativo.table, faz: () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  ];
  return (
    <div className="relatorio-barra" role="toolbar" aria-label="Formatação do relatório">
      {botoes.map(({ rotulo, Icone, on, faz }) => (
        <button key={rotulo} type="button" title={rotulo} aria-label={rotulo} aria-pressed={on} className={on ? 'ativo' : ''} onClick={faz}><Icone size={16} /></button>
      ))}
      <span className="relatorio-barra-sep" />
      <button type="button" title="Desfazer" aria-label="Desfazer" onClick={() => c().undo().run()}><Undo2 size={16} /></button>
      <button type="button" title="Refazer" aria-label="Refazer" onClick={() => c().redo().run()}><Redo2 size={16} /></button>
      <button type="button" title="Limpar relatório" aria-label="Limpar relatório" onClick={() => c().clearContent(true).run()}><Trash2 size={16} /></button>
    </div>
  );
}

interface Props {
  valor: string;
  /** Recebe o HTML limpo a cada alteração. */
  aoMudar: (html: string) => void;
}

export default function EditorRelatorioCompleto({ valor, aoMudar }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: false } }),
      TableKit.configure({ table: { resizable: false } }),
      Highlight,
      OfficePaste,
    ],
    content: valor,
    editorProps: {
      attributes: { class: 'relatorio-conteudo relatorio-area', 'aria-label': 'Relatório Completo da Monitoria' },
      transformPastedHTML: adaptarColagemDoWord,
    },
    onUpdate: ({ editor: e }) => aoMudar(relatorioParaGravar(e.getHTML())),
  });
  if (!editor) return null;
  return (
    <div className="relatorio-caixa">
      <BarraFormatacao editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
