export function filterCommentTokens(data: Uint32Array, remove: number) {
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

    if (tokenType == remove) {
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
