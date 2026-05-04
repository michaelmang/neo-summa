export function formatQuestionTitle(rawTitle = '') {
  const lines = rawTitle
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const cleanLine = (line) => line.trim();

  if (lines.length > 1) {
    const headingLines = lines.slice(0, -1).map(cleanLine).filter(Boolean);

    return {
      heading: headingLines[0] || '',
      headingLines,
      title: cleanLine(lines[lines.length - 1])
    };
  }

  return {
    heading: '',
    headingLines: [],
    title: cleanLine(lines[0] || rawTitle)
  };
}
