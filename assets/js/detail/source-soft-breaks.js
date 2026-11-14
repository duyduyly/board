const BLOCK =
  'p|h[1-6]|ul|ol|li|div|section|article|aside|header|footer|table|thead|tbody|tfoot|tr|pre|blockquote|figure|figcaption';
const CONTAINER =
  'ul|ol|div|section|article|aside|header|footer|table|thead|tbody|tfoot|tr|figure|blockquote';
// A closing block tag, an opening container tag or <hr>, directly followed by another tag.
const BREAK = new RegExp(
  '(?:</(?:' + BLOCK + ')>|<(?:' + CONTAINER + ')(?:\\s[^<>]*)?>|<hr[^<>]*>)(?=<)',
  'gi',
);

/**
 * Shows each block of single-line HTML on its own visual line without touching the source text:
 * inserting real newlines would add text nodes to the document.
 * @param {{ Decoration: any, ViewPlugin: any, WidgetType: any }} codeMirror
 */
export function softBreaks({ Decoration, ViewPlugin, WidgetType }) {
  class SoftBreak extends WidgetType {
    toDOM() {
      const element = document.createElement('span');
      element.className = 'cm-soft-break';
      return element;
    }
    eq() {
      return true;
    }
  }
  const widget = Decoration.widget({ widget: new SoftBreak(), side: 1 });
  const build = (view) => {
    const ranges = [];
    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      for (const match of text.matchAll(BREAK))
        ranges.push(widget.range(from + match.index + match[0].length));
    }
    return Decoration.set(ranges);
  };
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = build(view);
      }
      update(update) {
        if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
