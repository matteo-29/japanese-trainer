// TRAGEN SIE HIER IHRE GOOGLE APPS SCRIPT URL EIN
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweRvIaqV1cRumvWSeHErTdjMREcCr1s53AUX5ZcSfpPqF9yr67NRjTrB7qYdrHygipuQ/exec';

const KATEGORIEN = ['Business/Arbeit','Reise','Zu Hause','Doktor','Familie','Essen','Schule','Freizeit','Alltag','Sonstiges'];

let faelligeAufgaben = [];
let alleVokabeln = [];
let vokabelIndex = 0;
let aktuelleZeile = 0;
let richtung = 0;
let loesung = "";
let todayDone = 0;
let todayTotal = 0;
let aktiveKategorie = null;

function normalizeKategorie(value) {
    const raw = (value || '').toString().trim();
    if (!raw) return 'Sonstiges';
    const lower = raw.toLowerCase();
    const map = {
        'business': 'Business/Arbeit',
        'arbeit': 'Business/Arbeit',
        'business/arbeit': 'Business/Arbeit',
        'reise': 'Reise',
        'zu hause': 'Zu Hause',
        'doktor': 'Doktor',
        'familie': 'Familie',
        'essen': 'Essen',
        'schule': 'Schule',
        'freizeit': 'Freizeit',
        'alltag': 'Alltag',
        'sonstiges': 'Sonstiges'
    };
    return map[lower] || raw;
}

function buildKategorieOptions(selected = 'Sonstiges') {
    return KATEGORIEN.map(k => `<option value="${k}" ${k === selected ? 'selected' : ''}>${k}</option>`).join('');
}

function fillKategorieSelects() {
    const addSelect = document.getElementById('addKategorie');
    const editSelect = document.getElementById('editKategorie');
    if (addSelect) addSelect.innerHTML = buildKategorieOptions('Sonstiges');
    if (editSelect) editSelect.innerHTML = buildKategorieOptions('Sonstiges');
}

function getKategorieCounts() {
    const counts = Object.fromEntries(KATEGORIEN.map(k => [k, 0]));
    alleVokabeln.forEach(vok => {
        const kat = normalizeKategorie(vok['Kategorie']);
        if (counts[kat] === undefined) counts[kat] = 0;
        counts[kat] += 1;
    });
    return counts;
}

function renderKategorieGrid() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;
    const counts = getKategorieCounts();
    grid.innerHTML = KATEGORIEN.map(k => `
        <button class="category-tile" data-kategorie="${k}" type="button">
            <div class="category-title">${k}</div>
            <div class="category-count">${counts[k] || 0} Wörter</div>
        </button>
    `).join('');

    grid.querySelectorAll('[data-kategorie]').forEach(btn => {
        btn.addEventListener('click', () => {
            aktiveKategorie = btn.dataset.kategorie;
            vokabeltrainerStarten();
        });
    });
}

function updateActiveCategoryLabel() {
    const label = document.getElementById('activeCategoryLabel');
    if (!label) return;
    if (!aktiveKategorie) {
        label.style.display = 'none';
        label.textContent = '';
        return;
    }
    label.style.display = 'block';
    label.textContent = `Aktive Kategorie: ${aktiveKategorie}`;
}

function prepareLearningStart() {
    const categorySelection = document.getElementById('categorySelection');
    const loadingMsg = document.getElementById('loadingMsg');
    const trainerApp = document.getElementById('trainerApp');
    if (trainerApp) trainerApp.style.display = 'none';
    if (loadingMsg) loadingMsg.style.display = 'none';
    if (alleVokabeln.length === 0) {
        if (loadingMsg) loadingMsg.style.display = 'block';
        loadVocabulary(true);
        return;
    }
    renderKategorieGrid();
    updateActiveCategoryLabel();
    if (categorySelection) categorySelection.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    let deferredPrompt;
    const installBtn = document.getElementById('btnInstall');

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch((err) => console.log('ServiceWorker fehlgeschlagen:', err));
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.style.display = 'block';
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
                installBtn.style.display = 'none';
            }
        });
    }

    window.addEventListener('appinstalled', () => {
        if (installBtn) installBtn.style.display = 'none';
        deferredPrompt = null;
    });

    const viewMenu = document.getElementById('viewMenu');
    const viewLernen = document.getElementById('viewLernen');
    const viewFortschritt = document.getElementById('viewFortschritt');
    const viewVerzeichnis = document.getElementById('viewVerzeichnis');
    const btnBackToMenu = document.getElementById('btnBackToMenu');

    function showView(view) {
        viewMenu.style.display = 'none';
        viewLernen.style.display = 'none';
        viewFortschritt.style.display = 'none';
        viewVerzeichnis.style.display = 'none';
        view.style.display = 'block';
        btnBackToMenu.style.display = view === viewMenu ? 'none' : 'block';
    }

    btnBackToMenu.addEventListener('click', () => {
        aktiveKategorie = null;
        updateActiveCategoryLabel();
        showView(viewMenu);
    });

    document.getElementById('btnStartLernen').addEventListener('click', () => {
        showView(viewLernen);
        prepareLearningStart();
    });

    document.getElementById('btnLernfortschritt').addEventListener('click', () => {
        showView(viewFortschritt);
        if (alleVokabeln.length === 0) loadVocabulary().then(renderFortschrittChart);
        else renderFortschrittChart();
    });

    document.getElementById('btnWorterverzeichnis').addEventListener('click', () => {
        showView(viewVerzeichnis);
        if (alleVokabeln.length === 0) loadVocabulary().then(renderWorterverzeichnis);
        else renderWorterverzeichnis();
    });

    let startY = 0;
    let ptrContainer = document.getElementById('ptr');
    let isPulling = false;

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
            isPulling = true;
            ptrContainer.style.transition = 'none';
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        let y = e.touches[0].clientY;
        let deltaY = y - startY;

        if (deltaY > 0 && window.scrollY === 0) {
            if (e.cancelable) e.preventDefault();
            let height = Math.min(deltaY * 0.4, 80);
            ptrContainer.style.height = height + 'px';
            ptrContainer.innerHTML = height > 50 ? '🔄 Loslassen zum Aktualisieren' : '⬇️ Zum Aktualisieren ziehen...';
        }
    }, { passive: false });

    window.addEventListener('touchend', () => {
        if (!isPulling) return;
        isPulling = false;
        ptrContainer.style.transition = 'height 0.3s ease';
        let currentHeight = parseInt(ptrContainer.style.height || '0');

        if (currentHeight > 50) {
            ptrContainer.style.height = '50px';
            ptrContainer.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:3px;margin:0 10px 0 0;"></div> Daten laden...';
            loadVocabulary().then(() => {
                if (document.getElementById('viewVerzeichnis').style.display === 'block') {
                    renderWorterverzeichnis();
                } else if (document.getElementById('viewFortschritt').style.display === 'block') {
                    renderFortschrittChart();
                } else if (document.getElementById('viewLernen').style.display === 'block') {
                    prepareLearningStart();
                }
                setTimeout(() => { ptrContainer.style.height = '0px'; }, 500);
            });
        } else {
            ptrContainer.style.height = '0px';
        }
    });

    document.getElementById('btnCheck').addEventListener('click', function() {
        if (richtung === 0) {
            document.getElementById('modalLoesung').innerText = loesung;
            document.getElementById('modalAuswertung').style.display = 'block';
        } else {
            if (this.innerText === 'Weiter') {
                this.innerText = 'Prüfen';
                document.getElementById('translation').disabled = false;
                verarbeiteAntwort(false);
                return;
            }
            let eingabe = document.getElementById('translation').value.trim();
            if (eingabe === '') return;

            let vok = faelligeAufgaben[vokabelIndex].data;
            if (eingabe === loesung || eingabe === vok['Furigana']) {
                document.getElementById('feedback').innerText = 'Richtig!';
                document.getElementById('feedback').style.color = 'var(--success)';
                setTimeout(() => verarbeiteAntwort(true), 1000);
            } else {
                document.getElementById('feedback').innerText = `Falsch! Richtig ist:
${vok['Furigana'] ? vok['Furigana'] : ''}
${loesung}`;
                document.getElementById('feedback').style.color = 'var(--danger)';
                document.getElementById('translation').disabled = true;
                this.innerText = 'Weiter';
            }
        }
    });

    document.getElementById('btnModalGewusst').addEventListener('click', () => {
        document.getElementById('modalAuswertung').style.display = 'none';
        verarbeiteAntwort(true);
    });

    document.getElementById('btnModalFalsch').addEventListener('click', () => {
        document.getElementById('modalAuswertung').style.display = 'none';
        verarbeiteAntwort(false);
    });

    document.getElementById('btnFurigana').addEventListener('click', () => {
        document.getElementById('furigana').innerText = faelligeAufgaben[vokabelIndex].data['Furigana'];
    });

    document.getElementById('btnCancel').addEventListener('click', () => {
        vokabelIndex++;
        naechsteVokabel();
    });

    document.getElementById('translation').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('btnCheck').click();
        }
    });

    document.getElementById('btnSubmitWord').addEventListener('click', () => {
        let kanji = document.getElementById('addKanji').value.trim();
        let furigana = document.getElementById('addFurigana').value.trim();
        let deutsch = document.getElementById('addDeutsch').value.trim();
        let kategorie = normalizeKategorie(document.getElementById('addKategorie').value);

        if (!deutsch || (!kanji && !furigana)) {
            document.getElementById('addFeedback').innerText = 'Bitte füllen Sie die Bedeutung und mindestens Kanji/Kana aus!';
            document.getElementById('addFeedback').style.color = 'var(--danger)';
            return;
        }

        let btn = document.getElementById('btnSubmitWord');
        btn.innerText = 'Speichere...';
        btn.disabled = true;

        fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'addWord', kanji, furigana, deutsch, kategorie })
        }).then(() => {
            document.getElementById('addFeedback').innerText = 'Erfolgreich hinzugefügt!';
            document.getElementById('addFeedback').style.color = 'var(--success)';
            document.getElementById('addKanji').value = '';
            document.getElementById('addFurigana').value = '';
            document.getElementById('addDeutsch').value = '';
            document.getElementById('addKategorie').value = 'Sonstiges';
            setTimeout(() => {
                document.getElementById('addFeedback').innerText = '';
                loadVocabulary().then(renderWorterverzeichnis);
            }, 1500);
        }).finally(() => {
            btn.innerText = 'Zur Liste hinzufügen';
            btn.disabled = false;
        });
    });

    document.getElementById('btnCancelEdit').addEventListener('click', () => {
        document.getElementById('modalEdit').style.display = 'none';
    });

    document.getElementById('btnSaveEdit').addEventListener('click', () => {
        let rowIndex = document.getElementById('editRowIndex').value;
        let payload = {
            action: 'editWord',
            rowIndex: rowIndex,
            kanji: document.getElementById('editKanji').value.trim(),
            furigana: document.getElementById('editFurigana').value.trim(),
            deutsch: document.getElementById('editDeutsch').value.trim(),
            kategorie: normalizeKategorie(document.getElementById('editKategorie').value)
        };

        document.getElementById('btnSaveEdit').innerText = 'Speichere...';

        fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        }).then(() => {
            document.getElementById('modalEdit').style.display = 'none';
            document.getElementById('btnSaveEdit').innerText = 'Speichern';
            loadVocabulary().then(renderWorterverzeichnis);
        });
    });

    window.deleteWord = function(rowIndex) {
        if (!confirm('Wort wirklich dauerhaft löschen?')) return;
        fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteWord', rowIndex: rowIndex })
        }).then(() => loadVocabulary().then(renderWorterverzeichnis));
    };

    window.openEditModal = function(rowIndex) {
        let vok = alleVokabeln.find(v => v.rowIndex === rowIndex);
        if (!vok) return;
        document.getElementById('editRowIndex').value = rowIndex;
        document.getElementById('editKanji').value = vok['Kanji'] || '';
        document.getElementById('editFurigana').value = vok['Furigana'] || '';
        document.getElementById('editDeutsch').value = vok['Deutsch'] || '';
        document.getElementById('editKategorie').innerHTML = buildKategorieOptions(normalizeKategorie(vok['Kategorie']));
        document.getElementById('modalEdit').style.display = 'block';
    };

    fillKategorieSelects();
    loadVocabulary();
});

async function loadVocabulary(forLearning = false) {
    try {
        const loadingMsg = document.getElementById('loadingMsg');
        const trainerApp = document.getElementById('trainerApp');
        const categorySelection = document.getElementById('categorySelection');
        if (loadingMsg) loadingMsg.style.display = 'block';
        if (trainerApp) trainerApp.style.display = 'none';
        if (categorySelection) categorySelection.style.display = 'none';

        let response = await fetch(SCRIPT_URL, { method: 'GET' });
        if (!response.ok) throw new Error('HTTP Fehler');

        alleVokabeln = await response.json();
        alleVokabeln = alleVokabeln.map(vok => ({ ...vok, Kategorie: normalizeKategorie(vok['Kategorie']) }));
        fillKategorieSelects();

        if (forLearning || document.getElementById('viewLernen').style.display === 'block') {
            renderKategorieGrid();
            updateActiveCategoryLabel();
            if (categorySelection) categorySelection.style.display = 'block';
            if (loadingMsg) loadingMsg.style.display = 'none';
        }
    } catch (error) {
        document.getElementById('loadingMsg').innerHTML = 'Fehler beim Laden der Daten.';
    }
}

function updateDailyProgress() {
    const today = new Date().toISOString().split('T')[0];
    let savedProgress = JSON.parse(localStorage.getItem('japTrainerProgress')) || { date: '', done: 0, total: 0, kategorie: '' };
    const categoryKey = aktiveKategorie || 'alle';

    if (savedProgress.date !== today || savedProgress.kategorie !== categoryKey) {
        savedProgress = { date: today, done: 0, total: todayTotal, kategorie: categoryKey };
    }

    if (todayDone > savedProgress.done) {
        savedProgress.done = todayDone;
        savedProgress.total = todayTotal;
        localStorage.setItem('japTrainerProgress', JSON.stringify(savedProgress));
    } else {
        todayDone = savedProgress.done;
    }

    const percent = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
    document.getElementById('dailyProgressContainer').style.display = 'block';
    document.getElementById('dailyProgressText').innerText = percent + '%';
    document.getElementById('dailyProgressFill').style.width = percent + '%';
}

function resetDailyProgress() {
    const today = new Date().toISOString().split('T')[0];
    const categoryKey = aktiveKategorie || 'alle';
    let savedProgress = JSON.parse(localStorage.getItem('japTrainerProgress')) || { date: '', done: 0, kategorie: '' };
    todayDone = (savedProgress.date === today && savedProgress.kategorie === categoryKey) ? savedProgress.done : 0;
    updateDailyProgress();
}

function vokabeltrainerStarten() {
    let heute = new Date();
    heute.setHours(0,0,0,0);
    faelligeAufgaben = [];

    alleVokabeln.forEach(vok => {
        if (aktiveKategorie && normalizeKategorie(vok['Kategorie']) !== aktiveKategorie) return;

        let letztesTrainingStr = vok['Datum des letzten Trainings'] || vok['Letztes Training'];
        if (letztesTrainingStr) {
            if (new Date(letztesTrainingStr) < heute) {
                vok['Status JA-->DE'] = '';
                vok['Status DE-->JA'] = '';
                vok['Datum des letzten Trainings'] = '';
            }
        }
        let abfrageDatumStr = vok['Naechste Abfrage'];
        if (abfrageDatumStr) {
            let abfrageDatum = new Date(abfrageDatumStr);
            abfrageDatum.setHours(0,0,0,0);
            if (abfrageDatum <= heute) {
                let stat0 = vok['Status JA-->DE'];
                let stat1 = vok['Status DE-->JA'];
                if (stat0 !== 1 && stat0 !== 3) faelligeAufgaben.push({ row: vok.rowIndex, dir: 0, data: vok });
                if (stat1 !== 1 && stat1 !== 3) faelligeAufgaben.push({ row: vok.rowIndex, dir: 1, data: vok });
            }
        }
    });

    todayTotal = faelligeAufgaben.length + todayDone;
    resetDailyProgress();

    document.getElementById('categorySelection').style.display = 'none';
    updateActiveCategoryLabel();

    if (faelligeAufgaben.length === 0) {
        document.getElementById('trainerApp').style.display = 'none';
        document.getElementById('loadingMsg').style.display = 'block';
        document.getElementById('loadingMsg').innerHTML = `<b>Keine fälligen Wörter</b><br>In der Kategorie ${aktiveKategorie} ist heute nichts offen.`;
        return;
    }

    for (let i = faelligeAufgaben.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [faelligeAufgaben[i], faelligeAufgaben[j]] = [faelligeAufgaben[j], faelligeAufgaben[i]];
    }

    document.getElementById('loadingMsg').style.display = 'none';
    document.getElementById('trainerApp').style.display = 'block';
    vokabelIndex = 0;
    naechsteVokabel();
}

function naechsteVokabel() {
    if (vokabelIndex >= faelligeAufgaben.length) {
        document.getElementById('trainerApp').style.display = 'none';
        document.getElementById('loadingMsg').style.display = 'block';
        document.getElementById('loadingMsg').innerHTML = `<b>Fertig!</b><br>Alle fälligen Aufgaben in ${aktiveKategorie} gelernt!`;
        return;
    }

    let aufgabe = faelligeAufgaben[vokabelIndex];
    aktuelleZeile = aufgabe.row;
    richtung = aufgabe.dir;
    let vok = aufgabe.data;

    document.getElementById('feedback').innerText = '';
    document.getElementById('translation').value = '';
    document.getElementById('furigana').innerText = '';
    document.getElementById('translation').style.display = 'none';
    document.getElementById('translation').disabled = false;
    document.getElementById('btnFurigana').style.display = 'none';
    document.getElementById('btnCheck').innerText = 'Prüfen';

    if (richtung === 0) {
        document.getElementById('kanji').innerText = vok['Kanji'] || vok['Furigana'];
        loesung = vok['Deutsch'];
        document.getElementById('btnCheck').innerText = 'Antwort aufdecken';
        document.getElementById('btnFurigana').style.display = vok['Kanji'] && vok['Furigana'] ? 'inline-block' : 'none';
    } else {
        document.getElementById('kanji').innerText = vok['Deutsch'];
        loesung = vok['Kanji'] || vok['Furigana'];
        document.getElementById('translation').style.display = 'block';
        document.getElementById('translation').placeholder = 'Japanisch eingeben...';
    }
}

function verarbeiteAntwort(warRichtig) {
    let aufgabe = faelligeAufgaben[vokabelIndex];
    let vok = aufgabe.data;
    let statusFeld = richtung === 0 ? 'Status JA-->DE' : 'Status DE-->JA';
    let aktuellerStatus = vok[statusFeld];

    if (warRichtig) {
        if (!aktuellerStatus) vok[statusFeld] = 1;
        else if (aktuellerStatus === 2) vok[statusFeld] = 3;
        todayDone++;
        updateDailyProgress();
    } else {
        if (!aktuellerStatus) vok[statusFeld] = 2;
        faelligeAufgaben.push({ row: aktuelleZeile, dir: richtung, data: vok });
    }

    vok['Datum des letzten Trainings'] = new Date().toISOString().split('T')[0];
    let stat0 = vok['Status JA-->DE'];
    let stat1 = vok['Status DE-->JA'];
    let updates = { rowIndex: aktuelleZeile, statusJA: stat0, statusDE: stat1, letztesTraining: vok['Datum des letzten Trainings'] };

    if ((stat0 === 1 || stat0 === 3) && (stat1 === 1 || stat1 === 3)) {
        let fach = parseInt(vok['Fach']) || 1;
        if (stat0 === 1 && stat1 === 1) { if (fach < 5) fach++; }
        else { if (fach > 1) fach--; }

        let tage = [0, 1, 3, 7, 14, 30][fach];
        let neuesDatum = new Date();
        neuesDatum.setDate(neuesDatum.getDate() + tage);

        updates.fach = fach;
        updates.naechsteAbfrage = neuesDatum.toISOString().split('T')[0];
        updates.statusJA = '';
        updates.statusDE = '';
        updates.letztesTraining = '';
    }

    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(updates)
    });

    vokabelIndex++;
    naechsteVokabel();
}

function renderFortschrittChart() {
    const chartContainer = document.getElementById('chartContainer');
    chartContainer.innerHTML = '';
    let levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    alleVokabeln.forEach(vok => {
        let fach = parseInt(vok['Fach']) || 1;
        if (levelCounts[fach] !== undefined) levelCounts[fach]++;
    });

    const maxCount = Math.max(...Object.values(levelCounts), 1);

    for (let i = 1; i <= 5; i++) {
        let count = levelCounts[i];
        let heightPercent = (count / maxCount) * 100;
        chartContainer.innerHTML += `
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="width: 60px; font-weight: bold;">Level ${i}</div>
                <div style="flex-grow: 1; background: #E5E7EB; height: 25px; border-radius: 5px; overflow: hidden; margin: 0 10px;">
                    <div style="width: ${heightPercent}%; background: var(--primary); height: 100%; transition: width 0.5s;"></div>
                </div>
                <div style="width: 40px; text-align: right; font-size: 14px; color: var(--text-muted);">${count}</div>
            </div>`;
    }
}

function renderWorterverzeichnis() {
    const container = document.getElementById('worterListe');
    const loadingSpinner = document.getElementById('loadingVerzeichnis');

    container.style.display = 'none';
    if (loadingSpinner) loadingSpinner.style.display = 'block';
    container.innerHTML = '';

    setTimeout(() => {
        [...alleVokabeln].reverse().forEach(vok => {
            let div = document.createElement('div');
            div.className = 'card';
            div.style.margin = '10px 0';
            div.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${vok['Deutsch'] || '-'}</div>
                <div style="color: var(--text-muted); margin-bottom: 8px; font-size: 14px;">
                    Kanji: ${vok['Kanji'] || '-'} | Kana: ${vok['Furigana'] || '-'}
                </div>
                <div style="color: var(--text-muted); margin-bottom: 15px; font-size: 14px;">Kategorie: ${normalizeKategorie(vok['Kategorie'])}</div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="openEditModal(${vok.rowIndex})" class="btn-secondary" style="margin: 0; padding: 10px;">✏️ Ändern</button>
                    <button onclick="deleteWord(${vok.rowIndex})" class="btn-secondary" style="margin: 0; padding: 10px; background: #FEE2E2; color: var(--danger);">🗑️ Löschen</button>
                </div>
            `;
            container.appendChild(div);
        });

        if (loadingSpinner) loadingSpinner.style.display = 'none';
        container.style.display = 'block';
    }, 50);
}
