// The property list macOS reads from the NSFilenamesPboardType pasteboard
// type: putting it there copies the file itself, so ⌘V attaches it in Slack,
// Mail, Finder… The path is escaped, since "&" or "<" would break the XML.
export function filenamesPlist(filePath: string): string {
  const escaped = filePath.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${escaped}</string></array></plist>`;
}
