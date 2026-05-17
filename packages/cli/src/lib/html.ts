export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || undefined;
}

export function extractDescription(html: string): string | undefined {
  const match = html.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    ?? html.match(/<meta\s[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  return match?.[1]?.trim() || undefined;
}
