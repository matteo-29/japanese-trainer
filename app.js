const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweRvIaqV1cRumvWSeHErTdjMREcCr1s53AUX5ZcSfpPqF9yr67NRjTrB7qYdrHygipuQ/exec';

let faelligeAufgaben = [];
let alleVokabeln = [];
let vokabelIndex = 0;
let aktuelleZeile = 0;
let richtung = 0;
let loesung = "";
let todayDone = 0;
let todayTotal = 0;

async function loadVocabulary() {
    try {
        let response = await fetch(SCRIPT_URL, { method: 'GET' });
        if (!response.ok) throw new Error("HTTP Fehler");
        alleVokabeln = await response.json();
        if (alleVokabeln.length > 0) vokabeltrainerStarten();
        else throw new Error("Daten sind leer.");
    } catch (error) {
        document.getElementById('loadingMsg').innerText = "Fehler beim Laden.";
    }
}

function updateDailyProgress() {
    const percent = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
    const text = document.getElementById('dailyProgressText');
    const fill = document.getElementById('dailyProgressFill');
    if (text) text.innerText = percent + '%';
    if (fill) fill.style.width = percent + '%';
}

function resetDailyProgress() {
    todayDone = 0;
    updateDailyProgress();
}

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

    todayTotal = faelligeAufgaben.length;
    resetDailyProgress();

    if (faelligeAufgaben.length === 0) {
        document.getElementById('loadingMsg').innerText = "Super! Du hast für heute alle fälligen Vokabeln erfolgreich gelernt.";
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
        document.getElementById('loadingMsg').innerText = "Du hast alle fälligen Aufgaben für heute gelernt!";
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
        document.getElementById('kanji').innerText = vok['Kanji'];
        loesung = vok['Deutsch'];
        document.getElementById('btnCheck').innerText = 'Antwort aufdecken';
        document.getElementById('btnFurigana').style.display = 'inline-block';
    } else {
        document.getElementById('kanji').innerText = vok['Deutsch'];
        loesung = vok['Kanji'];
        document.getElementById('translation').style.display = 'block';
        document.getElementById('translation').placeholder = 'Japanisch (Kana/Kanji) eingeben...';
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
            document.getElementById('feedback').innerText = `Falsch! Richtig ist:
${vok['Furigana']}
${loesung}`;
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

    fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(updates)
    });

    vokabelIndex++;
    naechsteVokabel();
}

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

document.getElementById('navLernen').addEventListener('click', () => {
    document.getElementById('viewLernen').style.display = 'block';
    document.getElementById('viewAdd').style.display = 'none';
    document.getElementById('navLernen').classList.add('active');
    document.getElementById('navAdd').classList.remove('active');
});

document.getElementById('navAdd').addEventListener('click', () => {
    document.getElementById('viewLernen').style.display = 'none';
    document.getElementById('viewAdd').style.display = 'block';
    document.getElementById('navAdd').classList.add('active');
    document.getElementById('navLernen').classList.remove('active');
});

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
    btn.innerText = 'Speichere in der Cloud...';
    btn.disabled = true;

    let payload = {
        action: 'addWord',
        kanji: kanji,
        furigana: furigana,
        deutsch: deutsch
    };

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
            loadVocabulary();
        }, 2000);
    }).catch(err => {
        document.getElementById('addFeedback').innerText = 'Fehler beim Speichern!';
        document.getElementById('addFeedback').style.color = 'red';
    }).finally(() => {
        btn.innerText = 'Zur Liste hinzufügen';
        btn.disabled = false;
    });
});

loadVocabulary();
