export function filterCommentTokens(data: Uint32Array) {
  const filteredData: number[] = [];
  let accumulatedDeltaLine = 0;

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaStart = data[i + 1];
    const length = data[i + 2];
    const tokenType = data[i + 3];
    const modifiers = data[i + 4];

    if (tokenType === 10) {
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
