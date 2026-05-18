// TRAGEN SIE HIER IHRE GOOGLE APPS SCRIPT URL EIN
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweRvIaqV1cRumvWSeHErTdjMREcCr1s53AUX5ZcSfpPqF9yr67NRjTrB7qYdrHygipuQ/exec';

let faelligeAufgaben = [];
let alleVokabeln = [];
let vokabelIndex = 0;
let aktuelleZeile = 0;
let richtung = 0;
let loesung = "";
let todayDone = 0;
let todayTotal = 0;

// --- NAVIGATION ---
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
    
    // Zurück-Button überall außer im Hauptmenü anzeigen
    btnBackToMenu.style.display = view === viewMenu ? 'none' : 'block';
}

btnBackToMenu.addEventListener('click', () => {
    showView(viewMenu);
});

document.getElementById('btnStartLernen').addEventListener('click', () => {
    showView(viewLernen);
    if (alleVokabeln.length === 0) {
        loadVocabulary();
    } else {
        vokabeltrainerStarten();
    }
});

document.getElementById('btnLernfortschritt').addEventListener('click', () => {
    showView(viewFortschritt);
    if (alleVokabeln.length === 0) {
        loadVocabulary().then(renderFortschrittChart);
    } else {
        renderFortschrittChart();
    }
});

document.getElementById('btnWorterverzeichnis').addEventListener('click', () => {
    showView(viewVerzeichnis);
    if (alleVokabeln.length === 0) {
        loadVocabulary().then(renderWorterverzeichnis);
    } else {
        renderWorterverzeichnis();
    }
});

// --- DATEN LADEN ---
async function loadVocabulary() {
    try {
        document.getElementById('loadingMsg').style.display = 'block';
        document.getElementById('trainerApp').style.display = 'none';
        
        let response = await fetch(SCRIPT_URL, { method: 'GET' });
        if (!response.ok) throw new Error("HTTP Fehler");
        
        alleVokabeln = await response.json();
        
        if (viewLernen.style.display === 'block') {
            vokabeltrainerStarten();
        }
    } catch (error) {
        document.getElementById('loadingMsg').innerHTML = "Fehler beim Laden der Daten.<br>Bitte überprüfen Sie Ihre Internetverbindung.";
    }
}

// --- LERNFORTSCHRITT (LOCAL STORAGE) ---
function updateDailyProgress() {
    const today = new Date().toISOString().split('T')[0];
    let savedProgress = JSON.parse(localStorage.getItem('japTrainerProgress')) || { date: '', done: 0, total: 0 };
    
    // Neuer Tag -> Reset
    if (savedProgress.date !== today) {
        savedProgress = { date: today, done: 0, total: todayTotal };
    }
    
    // Falls Session weitergeht, addiere Fortschritt
    if (todayDone > savedProgress.done) {
        savedProgress.done = todayDone;
        savedProgress.total = todayTotal;
        localStorage.setItem('japTrainerProgress', JSON.stringify(savedProgress));
    } else {
        todayDone = savedProgress.done;
    }

    const percent = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
    const text = document.getElementById('dailyProgressText');
    const fill = document.getElementById('dailyProgressFill');
    
    document.getElementById('dailyProgressContainer').style.display = 'block';
    if (text) text.innerText = percent + '%';
    if (fill) fill.style.width = percent + '%';
}

function resetDailyProgress() {
    const today = new Date().toISOString().split('T')[0];
    let savedProgress = JSON.parse(localStorage.getItem('japTrainerProgress')) || { date: '', done: 0 };
    
    if (savedProgress.date === today) {
        todayDone = savedProgress.done; // Lade Fortschritt von heute
    } else {
        todayDone = 0; // Neuer Tag
    }
    updateDailyProgress();
}

// --- LERNLOGIK ---
function vokabeltrainerStarten() {
    let heute = new Date();
    heute.setHours(0,0,0,0);
    faelligeAufgaben = [];

    alleVokabeln.forEach(vok => {
        let letztesTrainingStr = vok['Datum des letzten Trainings'] || vok['Letztes Training'];
        if (letztesTrainingStr) {
            let letzesDatum = new Date(letztesTrainingStr);
            if (letzesDatum < heute) {
                vok['Status JA-->DE'] = "";
                vok['Status DE-->JA'] = "";
                vok['Datum des letzten Trainings'] = "";
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

    todayTotal = faelligeAufgaben.length + todayDone; // Gesamtziel anpassen
    resetDailyProgress();

    if (faelligeAufgaben.length === 0) {
        document.getElementById('loadingMsg').innerHTML = "<b>Super!</b><br>Du hast für heute alle fälligen Vokabeln erfolgreich gelernt.";
        return;
    }

    // Mischen
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
        document.getElementById('loadingMsg').innerHTML = "<b>Fertig!</b><br>Du hast alle fälligen Aufgaben für heute gelernt!";
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
            document.getElementById('feedback').style.color = 'green';
            setTimeout(() => verarbeiteAntwort(true), 1000);
        } else {
            document.getElementById('feedback').innerText = `Falsch! Richtig ist:\n${vok['Furigana'] ? vok['Furigana'] : ''}\n${loesung}`;
            document.getElementById('feedback').style.color = 'red';
            document.getElementById('translation').disabled = true;
            this.innerText = 'Weiter';
        }
    }
});

document.getElementById('btnModalGewusst').addEventListener('click', function() {
    document.getElementById('modalAuswertung').style.display = 'none';
    verarbeiteAntwort(true);
});

document.getElementById('btnModalFalsch').addEventListener('click', function() {
    document.getElementById('modalAuswertung').style.display = 'none';
    verarbeiteAntwort(false);
});

document.getElementById('btnFurigana').addEventListener('click', function() {
    document.getElementById('furigana').innerText = faelligeAufgaben[vokabelIndex].data['Furigana'];
});

document.getElementById('btnCancel').addEventListener('click', function() {
    vokabelIndex++;
    naechsteVokabel();
});

document.getElementById('translation').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('btnCheck').click();
    }
});

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

    let updates = {
        rowIndex: aktuelleZeile,
        statusJA: stat0,
        statusDE: stat1,
        letztesTraining: vok['Datum des letzten Trainings']
    };

    if ((stat0 === 1 || stat0 === 3) && (stat1 === 1 || stat1 === 3)) {
        let fach = parseInt(vok['Fach']) || 1;
        if (stat0 === 1 && stat1 === 1) {
            if (fach < 5) fach++;
        } else {
            if (fach > 1) fach--;
        }
        let tage = [0, 1, 3, 7, 14, 30][fach];
        let neuesDatum = new Date();
        neuesDatum.setDate(neuesDatum.getDate() + tage);
        
        updates.fach = fach;
        updates.naechsteAbfrage = neuesDatum.toISOString().split('T')[0];
        updates.statusJA = '';
        updates.statusDE = '';
        updates.letztesTraining = '';
        
        vok['Fach'] = fach;
        vok['Naechste Abfrage'] = updates.naechsteAbfrage;
    }

    // Backend Update via POST
    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(updates)
    });

    vokabelIndex++;
    naechsteVokabel();
}

// --- DIAGRAMM LERNFORTSCHRITT ---
function renderFortschrittChart() {
    const chartContainer = document.getElementById('chartContainer');
    chartContainer.innerHTML = ''; 
    
    let levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let gesamt = alleVokabeln.length;
    
    alleVokabeln.forEach(vok => {
        let fach = parseInt(vok['Fach']) || 1;
        if (levelCounts[fach] !== undefined) {
            levelCounts[fach]++;
        }
    });
    
    const maxCount = Math.max(...Object.values(levelCounts), 1);
    
    for (let i = 1; i <= 5; i++) {
        let count = levelCounts[i];
        let heightPercent = (count / maxCount) * 100;
        let anteil = gesamt > 0 ? Math.round((count / gesamt) * 100) : 0;
        
        let barHtml = `
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="width: 60px; font-weight: bold;">Level ${i}</div>
                <div style="flex-grow: 1; background: #eee; height: 25px; border-radius: 5px; overflow: hidden; margin: 0 10px;">
                    <div style="width: ${heightPercent}%; background: var(--primary-color); height: 100%; transition: width 0.5s;"></div>
                </div>
                <div style="width: 40px; text-align: right; font-size: 14px; color: #666;">${count}</div>
            </div>
        `;
        chartContainer.innerHTML += barHtml;
    }
}

// --- WÖRTERVERZEICHNIS CRUD ---
document.getElementById('btnSubmitWord').addEventListener('click', function() {
    let kanji = document.getElementById('addKanji').value.trim();
    let furigana = document.getElementById('addFurigana').value.trim();
    let deutsch = document.getElementById('addDeutsch').value.trim();

    if (!deutsch || (!kanji && !furigana)) {
        document.getElementById('addFeedback').innerText = 'Bitte füllen Sie die Bedeutung und mindestens Kanji oder Kana aus!';
        document.getElementById('addFeedback').style.color = 'red';
        return;
    }

    let btn = document.getElementById('btnSubmitWord');
    btn.innerText = 'Speichere...';
    btn.disabled = true;

    let payload = { action: 'addWord', kanji: kanji, furigana: furigana, deutsch: deutsch };

    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }).then(() => {
        document.getElementById('addFeedback').innerText = 'Wort erfolgreich hinzugefügt!';
        document.getElementById('addFeedback').style.color = 'green';
        document.getElementById('addKanji').value = '';
        document.getElementById('addFurigana').value = '';
        document.getElementById('addDeutsch').value = '';
        setTimeout(() => {
            document.getElementById('addFeedback').innerText = '';
            loadVocabulary().then(renderWorterverzeichnis);
        }, 1500);
    }).catch(() => {
        document.getElementById('addFeedback').innerText = 'Fehler beim Speichern!';
        document.getElementById('addFeedback').style.color = 'red';
    }).finally(() => {
        btn.innerText = 'Zur Liste hinzufügen';
        btn.disabled = false;
    });
});

function renderWorterverzeichnis() {
    const container = document.getElementById('worterListe');
    container.innerHTML = ''; 

    [...alleVokabeln].reverse().forEach(vok => {
        let div = document.createElement('div');
        div.className = 'card';
        div.style.margin = '10px 0';
        div.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${vok['Deutsch'] || '-'}</div>
            <div style="color: #666; margin-bottom: 15px; font-size: 14px;">
                Kanji: ${vok['Kanji'] || '-'} | Kana: ${vok['Furigana'] || '-'}
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="openEditModal(${vok.rowIndex})" class="btn-secondary" style="margin: 0; padding: 10px;">✏️ Ändern</button>
                <button onclick="deleteWord(${vok.rowIndex})" class="btn-secondary" style="margin: 0; padding: 10px; background: #ffebee; color: #d32f2f;">🗑️ Löschen</button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.deleteWord = function(rowIndex) {
    if (!confirm("Möchten Sie dieses Wort wirklich dauerhaft löschen?")) return;
    
    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteWord', rowIndex: rowIndex })
    }).then(() => {
        loadVocabulary().then(renderWorterverzeichnis);
    });
};

window.openEditModal = function(rowIndex) {
    let vok = alleVokabeln.find(v => v.rowIndex === rowIndex);
    if (!vok) return;
    
    document.getElementById('editRowIndex').value = rowIndex;
    document.getElementById('editKanji').value = vok['Kanji'] || '';
    document.getElementById('editFurigana').value = vok['Furigana'] || '';
    document.getElementById('editDeutsch').value = vok['Deutsch'] || '';
    
    document.getElementById('modalEdit').style.display = 'block';
};

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
        deutsch: document.getElementById('editDeutsch').value.trim()
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

// App initial starten
loadVocabulary();