/**
 * AgentFlow - LinkedIn Author URN Sanitizer & Validator
 * Decodes HTML entities safely, strips accidental Markdown characters,
 * trims whitespace, canonicalizes bare numeric IDs to urn:li:person:<id>,
 * and validates against ^urn:li:(person|organization):[0-9]+$.
 */

export function cleanAuthorUrnInput(raw) {
  if (!raw) return '';
  let text = String(raw).trim();

  // 1. Safely decode HTML entities (decimal, hex, and named entities)
  const decodeEntities = (str) => {
    return str
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  };

  for (let i = 0; i < 3; i++) {
    const prev = text;
    text = decodeEntities(text);
    if (text === prev) break;
  }

  text = text.trim();

  // 2. Strip HTML tags if any (e.g. <code>...</code>)
  text = text.replace(/<\/?[a-zA-Z0-9]+[^>]*>/g, '').trim();

  // 3. Remove accidental Markdown formatting (*, `, ~)
  text = text.replace(/[\*`~]/g, '').trim();

  // 4. Strip wrapping quotes, brackets, parentheses, angle brackets
  text = text.replace(/^["'()\[\]{}<>]+|["'()\[\]{}<>]+$/g, '').trim();
  text = text.replace(/^_+|_+$/g, '').trim();

  // 5. Canonicalize prefix & strip repeated prefixes
  if (text.startsWith('urn:li:') && !text.startsWith('urn:li:person:') && !text.startsWith('urn:li:organization:') && !text.startsWith('urn:li:member:')) {
    return text;
  }
  const isOrg = text.startsWith('urn:li:organization:');
  const idPart = text.replace(/^(urn:li:(person|organization|member):)+/g, '').replace(/^["'()\[\]{}<>*`~_]+|["'()\[\]{}<>*`~_]+$/g, '').trim();
  if (/^[0-9]+$/.test(idPart)) {
    return isOrg ? `urn:li:organization:${idPart}` : `urn:li:person:${idPart}`;
  }

  return text;
}

export function isValidAuthorUrn(urn) {
  if (!urn) return false;
  return /^urn:li:(person|organization):[0-9]+$/.test(urn);
}
