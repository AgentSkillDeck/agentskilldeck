export function toMarkdown({ kind, query, results, warnings }) {
  const lines = [];
  if (!results.length) {
    lines.push(`No match for ${kind} "${query}". Try a broader or different term (e.g. a category, a mood, or an object name).`);
  } else {
    lines.push(`${results.length} ${kind} result${results.length > 1 ? 's' : ''} for "${query}":`, '');
    results.forEach((r, i) => {
      lines.push(`${i + 1}. **${r.name}** (${r.source})`);
      lines.push(`   Preview: ${r.previewUrl}`);
      lines.push(`   License: ${r.license.id} (${r.license.url})`);
      lines.push(`   Install: ${r.install}`);
      if (r.notes) lines.push(`   Notes: ${r.notes}`);
    });
    lines.push('', 'Verify the license fits this project before use. Nothing was installed.');
  }
  for (const w of warnings) lines.push(`Warning: ${w}`);
  return lines.join('\n') + '\n';
}
