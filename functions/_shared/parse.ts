/** Strip markdown fences and extract JSON from Claude's response */
export function extractJSON(text: string): string {
  // Strip ```json ... ``` wrapping
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Otherwise assume raw JSON
  return text.trim();
}
