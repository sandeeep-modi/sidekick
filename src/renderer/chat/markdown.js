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

function extractCodeBlocks(raw) {
  const blocks = [];

  const text = raw.replace(CODE_BLOCK, (_match, language, code) => {
    // Model-controlled language goes into an attribute; restrict to a bare word.
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

// Caps input length: the code-fence regex is O(n²) on an unterminated fence.
const MAX_RENDER_CHARS = 100_000;

export function renderMarkdown(raw) {
  const clean = raw.replace(/\0/g, ""); // strip NUL so output can't forge a \0BLK{n}\0 placeholder
  const input = clean.length > MAX_RENDER_CHARS ? clean.slice(0, MAX_RENDER_CHARS) : clean;
  const { text, blocks } = extractCodeBlocks(input);

  return renderLines(escapeHtml(text)).replace(/\0BLK(\d+)\0/g, (_match, i) => blocks[Number(i)]);
}
