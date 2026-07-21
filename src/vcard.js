function unescape(v) {
  return v.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

export function parseVCard(raw) {
  raw = raw.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const cards = raw.split('BEGIN:VCARD').slice(1);
  const contacts = [];

  for (const card of cards) {
    const lines = card.split('\n').filter(l => l.trim() && l.includes(':'));
    const tel = [], email = [], adr = [], url = [];
    let fn = '', org = '', title = '', nGiven = '', nFamily = '';
    let photo = '', note = '';

    for (const line of lines) {
      if (line.startsWith('END:VCARD') || line.startsWith('VERSION') || line.startsWith('PRODID')) continue;
      const sep = line.indexOf(':');
      const keyPart = line.slice(0, sep);
      const value = line.slice(sep + 1);
      const keyUpper = keyPart.toUpperCase();
      const baseKey = keyUpper.split(';')[0].split('.').pop();

      if (baseKey === 'FN') {
        fn = unescape(value);
      } else if (baseKey === 'N') {
        const parts = value.split(';');
        if (parts.length >= 2) { nFamily = unescape(parts[0]); nGiven = unescape(parts[1]); }
      } else if (baseKey === 'ORG') {
        org = unescape(value.split(';')[0]);
      } else if (baseKey === 'TITLE') {
        title = unescape(value);
      } else if (baseKey === 'TEL') {
        let label = 'other';
        if (keyUpper.includes('CELL')) label = 'mobile';
        else if (keyUpper.includes('WORK') && keyUpper.includes('FAX')) label = 'work fax';
        else if (keyUpper.includes('HOME') && keyUpper.includes('FAX')) label = 'home fax';
        else if (keyUpper.includes('WORK')) label = 'work';
        else if (keyUpper.includes('HOME')) label = 'home';
        else if (keyUpper.includes('FAX')) label = 'fax';
        tel.push({ label, value: value.trim() });
      } else if (baseKey === 'EMAIL') {
        email.push(value.trim());
      } else if (baseKey === 'URL') {
        const label = keyUpper.includes('WORK') ? 'work' : (keyUpper.includes('HOME') ? 'home' : 'website');
        const v = unescape(value).trim();
        if (v) url.push({ label, value: v });
      } else if (baseKey === 'ADR') {
        const parts = value.split(';').map(unescape);
        while (parts.length < 7) parts.push('');
        const [, , street, city, state, zip] = parts;
        const label = keyUpper.includes('WORK') ? 'work' : (keyUpper.includes('HOME') ? 'home' : 'other');
        const line1 = street || '';
        let line2 = [city, state].filter(Boolean).join(' ');
        if (zip) line2 = (line2 + ' ' + zip).trim();
        const full = [line1, line2].filter(Boolean).join(', ');
        if (full) adr.push({ label, value: full });
      } else if (baseKey === 'NOTE') {
        note = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
      } else if (baseKey === 'PHOTO') {
        let type = 'jpeg';
        if (keyUpper.includes('PNG')) type = 'png';
        else if (keyUpper.includes('GIF')) type = 'gif';
        const data = value.trim();
        if (data) photo = `data:image/${type};base64,${data}`;
      }
    }

    let name = fn.trim() || `${nGiven} ${nFamily}`.trim();
    if (!name) continue;

    const dedupTel = [...new Map(tel.map(t => [t.value, t])).values()];
    const dedupEmail = [...new Set(email)];
    const dedupUrl = [...new Map(url.map(u => [u.value, u])).values()];

    contacts.push({ name, given: nGiven, family: nFamily, org, title, tel: dedupTel, email: dedupEmail, adr, url: dedupUrl, note, photo });
  }

  contacts.sort((a, b) => {
    const ka = (a.family || a.name).trim().toLowerCase();
    const kb = (b.family || b.name).trim().toLowerCase();
    return ka.localeCompare(kb);
  });

  return contacts;
}
