function splitTextToChunks(text, maxLen) {
  if (!text) {
    return [""];
  }

  if (text.length <= maxLen) {
    return [text];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxLen, text.length);

    if (end < text.length) {
      const lastNewLine = text.lastIndexOf("\n", end);
      const lastSpace = text.lastIndexOf(" ", end);
      const splitPoint = Math.max(lastNewLine, lastSpace);

      if (splitPoint > start + 500) {
        end = splitPoint;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start = end;
  }

  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

module.exports = {
  splitTextToChunks
};
