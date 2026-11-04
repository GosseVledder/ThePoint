// Copy text from a click handler. The Clipboard API first; the old execCommand route
// where the API is missing or refused (some embedded pages and older WebViews).
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // fall through to the textarea route
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy failed');
}
