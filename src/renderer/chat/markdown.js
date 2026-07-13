// A small markdown renderer for AI replies.
//
// The input is model output, which we do not trust: it lands in innerHTML in a
// window that can talk to main. So everything is HTML-escaped before a single
// markdown pattern is applied, and the only HTML in the result is HTML this file
// generated itself.

const CODE_BLOCK = /```([^\n]*)\n?([\s\S]*?)```/g;
const PLACEHOLDER = /^\0BLK(\d+)\0$/;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/**
 * Pull fenced code blocks out first, leaving a one-line placeholder behind.
 * They must not go through the line loop below: a "- x" line inside a code block
 * is code, not a list item.
 */
function extractCodeBlocks(raw) {
  const blocks = [];

  const text = raw.replace(CODE_BLOCK, (_match, language, code) => {
    // The language is model-controlled and ends up in an attribute — a bare word only.
    const tag = language.trim();
    const safeTag = /^[\w+#.-]+$/.test(tag) ? tag : "";
    const attr = safeTag ? ` class="lang-${safeTag}"` : "";

    blocks.push(`<pre><code${attr}>${escapeHtml(code.trimEnd())}</code></pre>`);
    return `\0BLK${blocks.length - 1}\0`;
  });

  return { text, blocks };
}

function renderLines(text) {
  const out = [];
  let inList = false;

  const closeList = () => {
    if (inList) out.push("</ul>");
    inList = false;
  };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    if (PLACEHOLDER.test(trimmed)) {
      closeList();
      out.push(trimmed);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeList();
      out.push("<hr>");
      continue;
    }

    const heading = line.match(/^(#{1,3}) (.+)/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const item = line.match(/^[*-] (.+)/) || line.match(/^\d+\. (.+)/);
    if (item) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(item[1])}</li>`);
      continue;
    }

    closeList();
    if (trimmed) out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return out.join("");
}

// The lazy code-fence regex is O(n²) on a very long reply with an unterminated
// fence. Gemini replies are token-capped well under this, so anything larger is
// pathological — cap it rather than risk freezing the UI.
const MAX_RENDER_CHARS = 100_000;

/** @returns {string} HTML safe to assign to innerHTML. */
export function renderMarkdown(raw) {
  const input = raw.length > MAX_RENDER_CHARS ? raw.slice(0, MAX_RENDER_CHARS) : raw;
  const { text, blocks } = extractCodeBlocks(input);

  return renderLines(escapeHtml(text)).replace(/\0BLK(\d+)\0/g, (_match, i) => blocks[Number(i)]);
}
