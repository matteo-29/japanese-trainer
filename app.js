const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweRvIaqV1cRumvWSeHErTdjMREcCr1s53AUX5ZcSfpPqF9yr67NRjTrB7qYdrHygipuQ/exec';

let faelligeAufgaben = []; // Entspricht Ihrem Array "FaelligeAufgaben"
let alleVokabeln = []; // Speichert die Rohdaten aus Google Sheets
let vokabelIndex = 0;
let aktuelleZeile = 0;
let richtung = 0; // 0 = JA->DE, 1 = DE->JA
let loesung = "";

// 1. Daten laden und aufbereiten
async function loadVocabulary() {
    try {
        let response = await fetch(SCRIPT_URL, { method: 'GET' });
        if (!response.ok) throw new Error("HTTP Fehler");
        
        alleVokabeln = await response.json();
        
        if (alleVokabeln.length > 0) {
            vokabeltrainerStarten();
        } else {
            throw new Error("Daten sind leer.");
        }
    } catch (error) {
        document.getElementById('loadingMsg').innerText = "Fehler beim Laden.";
    }
}

// 2. VBA "Sub VokabeltrainerStarten"
function vokabeltrainerStarten() {
    let heute = new Date();
    heute.setHours(0,0,0,0);
    
    faelligeAufgaben = [];

    alleVokabeln.forEach(vok => {
        // Tageswechsel prüfen: Wenn letztes Training < heute, Status löschen
        let letztesTrainingStr = vok['Datum des letzten Trainings'] || vok['Letztes Training'];
        if (letztesTrainingStr) {
            let letzesDatum = new Date(letztesTrainingStr);
            if (letzesDatum < heute) {
                vok['Status JA-->DE'] = "";
                vok['Status DE-->JA'] = "";
                vok['Datum des letzten Trainings'] = "";
            }
        }

        // Fällige Aufgaben filtern
        let abfrageDatumStr = vok['Naechste Abfrage'];
        if (abfrageDatumStr) {
            let abfrageDatum = new Date(abfrageDatumStr);
            abfrageDatum.setHours(0,0,0,0);
            
            if (abfrageDatum <= heute) {
                let stat0 = vok['Status JA-->DE'];
                let stat1 = vok['Status DE-->JA'];
                
                if (stat0 !== 1 && stat0 !== 3) {
                    faelligeAufgaben.push({ row: vok.rowIndex, dir: 0, data: vok });
                }
                if (stat1 !== 1 && stat1 !== 3) {
                    faelligeAufgaben.push({ row: vok.rowIndex, dir: 1, data: vok });
                }
            }
        }
    });

    if (faelligeAufgaben.length === 0) {
        document.getElementById('loadingMsg').innerText = "Super! Du hast für heute alle fälligen Vokabeln erfolgreich gelernt.";
        return;
    }

    // Mischen (Shuffle)
    for (let i = faelligeAufgaben.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [faelligeAufgaben[i], faelligeAufgaben[j]] = [faelligeAufgaben[j], faelligeAufgaben[i]];
    }

    document.getElementById('loadingMsg').style.display = 'none';
    document.getElementById('trainerApp').style.display = 'block';
    
    vokabelIndex = 0;
    naechsteVokabel();
}

// 3. VBA "Public Sub NaechsteVokabel"
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

    // UI zurücksetzen
    document.getElementById('feedback').innerText = '';
    document.getElementById('translation').value = '';
    document.getElementById('furigana').innerText = ''; 
    document.getElementById('translation').style.display = 'none';
    document.getElementById('btnFurigana').style.display = 'none';

    if (richtung === 0) {
        // JA -> DE
        document.getElementById('kanji').innerText = vok['Kanji'];
        loesung = vok['Deutsch'];
        document.getElementById('btnCheck').innerText = "Antwort aufdecken";
        document.getElementById('btnFurigana').style.display = 'inline-block';
    } else {
        // DE -> JA
        document.getElementById('kanji').innerText = vok['Deutsch'];
        loesung = vok['Kanji'];
        document.getElementById('translation').style.display = 'block';
        document.getElementById('translation').placeholder = "Japanisch (Kana/Kanji) eingeben...";
        document.getElementById('btnCheck').innerText = "Prüfen";
    }
}

// 4. Buttons (Aufdecken & Prüfen)
document.getElementById('btnCheck').addEventListener('click', function() {
    if (richtung === 0) {
        // JA -> DE Modal öffnen
        document.getElementById('modalLoesung').innerText = loesung;
        document.getElementById('modalAuswertung').style.display = 'block';
    } else {
        // DE -> JA Prüfen
        let eingabe = document.getElementById('translation').value.trim();
        if (eingabe === "") return;
        
        let vok = faelligeAufgaben[vokabelIndex].data;
        if (eingabe === loesung || eingabe === vok['Furigana']) {
            document.getElementById('feedback').innerText = "Richtig!";
            document.getElementById('feedback').style.color = "green";
            setTimeout(() => verarbeiteAntwort(true), 1000);
        } else {
            document.getElementById('feedback').innerText = `Falsch! Richtig ist:\n${vok['Furigana']}\n${loesung}`;
            document.getElementById('feedback').style.color = "red";
            setTimeout(() => verarbeiteAntwort(false), 3000);
        }
    }
});

// 5. Modal Buttons (JA -> DE)
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

// 6. VBA "Private Sub VerarbeiteAntwort"
function verarbeiteAntwort(warRichtig) {
    let aufgabe = faelligeAufgaben[vokabelIndex];
    let vok = aufgabe.data;
    
    let statusFeld = richtung === 0 ? 'Status JA-->DE' : 'Status DE-->JA';
    let aktuellerStatus = vok[statusFeld];

    if (warRichtig) {
        if (!aktuellerStatus) vok[statusFeld] = 1;
        else if (aktuellerStatus === 2) vok[statusFeld] = 3;
    } else {
        if (!aktuellerStatus) vok[statusFeld] = 2;
        // Falsche Vokabel wieder hinten anhängen
        faelligeAufgaben.push({ row: aktuelleZeile, dir: richtung, data: vok });
    }

    vok['Datum des letzten Trainings'] = new Date().toISOString().split('T')[0];

    // Prüfen, ob beide Richtungen fertig sind
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
        updates.statusJA = "";
        updates.statusDE = "";
        updates.letztesTraining = "";

        // Im lokalen Array aktualisieren
        vok['Fach'] = fach;
        vok['Naechste Abfrage'] = updates.naechsteAbfrage;
    }

    // Speichern in Google Sheets im Hintergrund
    fetch(SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
        'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(updates)
});

    vokabelIndex++;
    naechsteVokabel();
}

document.getElementById('btnCancel').addEventListener('click', function() {
    vokabelIndex++;
    naechsteVokabel();
});

loadVocabulary();