const STUDIES_KEY = 'idmt_relay_studies';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STUDIES_KEY)) || [];
  } catch { return []; }
}

function writeAll(studies) {
  localStorage.setItem(STUDIES_KEY, JSON.stringify(studies));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function listStudies() {
  return readAll();
}

export function saveStudy(name, state, remarks) {
  const studies = readAll();
  const study = {
    id: uid(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: {
      tx: state.tx,
      faultPct: state.faultPct,
      relays: state.relays,
      remarks: remarks || '',
      overlays: state.overlays,
    },
  };
  studies.unshift(study);
  writeAll(studies);
  return study;
}

export function loadStudy(id) {
  const study = readAll().find(s => s.id === id);
  return study ? study.state : null;
}

export function deleteStudy(id) {
  const studies = readAll().filter(s => s.id !== id);
  writeAll(studies);
}

export function renameStudy(id, newName) {
  const studies = readAll();
  const study = studies.find(s => s.id === id);
  if (study) {
    study.name = newName;
    study.updatedAt = new Date().toISOString();
    writeAll(studies);
  }
}

export function exportStudyJSON(id) {
  const study = readAll().find(s => s.id === id);
  if (!study) return;
  downloadJSON(study, `study-${study.name.replace(/\s+/g, '-')}.json`);
}

export function exportAllStudiesJSON() {
  const studies = readAll();
  if (!studies.length) return;
  downloadJSON(studies, 'relay-studies.json');
}

export function importStudiesJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = Array.isArray(data) ? data : [data];
        const studies = readAll();
        const existingIds = new Set(studies.map(s => s.id));
        let added = 0;
        for (const s of incoming) {
          if (!s.id || !s.state || existingIds.has(s.id)) {
            // Assign new id for imports without one or duplicates
            s.id = uid();
          }
          if (s.state && s.state.relays) {
            studies.unshift(s);
            added++;
          }
        }
        writeAll(studies);
        resolve(added);
      } catch { reject(new Error('Invalid JSON file')); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
