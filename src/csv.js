// Parses a contacts CSV (Outlook, Google Contacts, or similar) into the same
// contact shape produced by parseVCard, so the rest of the app stays identical.

function splitRows(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function telLabel(h) {
  if (/mobile|cell/.test(h)) return 'mobile';
  const fax = h.includes('fax');
  if (h.includes('work') || h.includes('business')) return fax ? 'work fax' : 'work';
  if (h.includes('home')) return fax ? 'home fax' : 'home';
  if (fax) return 'fax';
  return 'phone';
}

export function parseCSV(raw) {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = splitRows(text).filter(r => r.some(c => c && c.trim() !== ''));
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const contacts = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const at = i => (i >= 0 && i < cells.length ? (cells[i] || '').trim() : '');
    const valueOf = pred => at(headers.findIndex(pred));
    const siblingType = h => {
      const m = h.match(/^(.*) - value$/);
      if (!m) return '';
      return at(headers.indexOf(m[1] + ' - type'));
    };

    const displayName = valueOf(h => h === 'name' || h === 'display name' || h === 'full name');
    const given = valueOf(h => h === 'first name' || h === 'given name');
    const family = valueOf(h => h === 'last name' || h === 'family name' || h === 'surname');
    const middle = valueOf(h => h === 'middle name');
    const name = displayName || [given, middle, family].filter(Boolean).join(' ').trim();
    if (!name) continue;

    const org = valueOf(h => (h.includes('organization') && h.includes('name')))
      || valueOf(h => h === 'company' || h === 'organization' || h.includes('company'));
    const title = valueOf(h => h === 'title' || h === 'job title' || (h.includes('organization') && h.includes('title')));

    const tel = [], email = [], url = [], noteParts = [];

    headers.forEach((h, i) => {
      const v = at(i);
      if (!v) return;
      if ((h.includes('phone') || h.includes('fax')) && !h.includes('type') && !h.includes('display') && !h.includes('speed')) {
        let label = telLabel(h);
        if (label === 'phone') { const t = siblingType(h); if (t) label = t.toLowerCase(); }
        tel.push({ label, value: v });
      } else if (h.includes('mail') && (h.includes('value') || h.includes('address')) && !h.includes('display') && !h.includes('type')) {
        email.push(v);
      } else if ((h.includes('web') || h.includes('url')) && !h.includes('type') && !h.includes('display')) {
        let label = 'website';
        if (h.includes('work') || h.includes('business')) label = 'work';
        else if (h.includes('home') || h.includes('personal')) label = 'home';
        else { const t = siblingType(h); if (t) label = t.toLowerCase(); }
        url.push({ label, value: v });
      } else if (h.includes('note')) {
        noteParts.push(v);
      }
    });

    const adr = [];
    const formatted = valueOf(h => h.includes('address') && h.includes('formatted'));
    if (formatted) {
      adr.push({ label: 'address', value: formatted.replace(/\s*\n\s*/g, ', ').trim() });
    } else {
      for (const prefix of ['home', 'business', 'work', 'other']) {
        const street = valueOf(h => h.includes(prefix) && h.includes('street'));
        const city = valueOf(h => h.includes(prefix) && h.includes('city'));
        const state = valueOf(h => h.includes(prefix) && (h.includes('state') || h.includes('region')));
        const zip = valueOf(h => h.includes(prefix) && (h.includes('postal') || h.includes('zip')));
        if (!(street || city || state || zip)) continue;
        let line2 = [city, state].filter(Boolean).join(' ');
        if (zip) line2 = (line2 + ' ' + zip).trim();
        const full = [street, line2].filter(Boolean).join(', ');
        if (full) adr.push({ label: prefix === 'business' ? 'work' : prefix, value: full });
      }
    }

    const dedupTel = [...new Map(tel.map(t => [t.value, t])).values()];
    const dedupEmail = [...new Set(email)];
    const dedupUrl = [...new Map(url.map(u => [u.value, u])).values()];
    const note = noteParts.join('\n').trim();

    contacts.push({
      name, given, family, org, title,
      tel: dedupTel, email: dedupEmail, adr, url: dedupUrl, note, photo: ''
    });
  }

  contacts.sort((a, b) => {
    const ka = (a.family || a.name).trim().toLowerCase();
    const kb = (b.family || b.name).trim().toLowerCase();
    return ka.localeCompare(kb);
  });

  return contacts;
}
