// Token type 10 (:comment) as defined in clojure-lsp's token-types vector
const COMMENT_TOKEN_TYPE = 10;

export function filterCommentTokens(data: Uint32Array) {
  const filteredData: number[] = [];
  let accumulatedDeltaLine = 0;

  for (let i = 0; i < data.length; i += 5) {
    const [deltaLine, deltaStart, length, tokenType, modifiers] = [
      data[i],
      data[i + 1],
      data[i + 2],
      data[i + 3],
      data[i + 4],
    ];

    if (tokenType === COMMENT_TOKEN_TYPE) {
      accumulatedDeltaLine += deltaLine;
      continue;
    }

    filteredData.push(
      filteredData.length === 0 ? deltaLine : deltaLine + accumulatedDeltaLine,
      deltaStart,
      length,
      tokenType,
      modifiers
    );
    accumulatedDeltaLine = 0;
  }

  return filteredData;
}
