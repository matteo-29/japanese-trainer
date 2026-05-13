// HIER IHRE GOOGLE APPS SCRIPT WEB-APP-URL EINFÜGEN!
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweRvIaqV1cRumvWSeHErTdjMREcCr1s53AUX5ZcSfpPqF9yr67NRjTrB7qYdrHygipuQ/exec';

let vocabulary = [];
let currentIndex = 0;
let currentDirection = 'JA_DE'; 

async function loadVocabulary() {
    try {
        document.getElementById('loadingMsg').innerText = "Verbinde mit Google Sheets...";
        
        // Da 'file:///' blockiert wird, nutzen wir einen Trick für Google Scripts
        let response = await fetch(SCRIPT_URL, {
            method: 'GET',
            // Wichtig: 'redirect' muss fehlen oder auf 'follow' stehen (Standard).
            // Wir fügen keine eigenen Header (wie Content-Type) hinzu, da das bei CORS oft zu Problemen führt.
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Fehler! Status: ${response.status}`);
        }
        
        vocabulary = await response.json();
        
        if (vocabulary && vocabulary.length > 0) {
            document.getElementById('loadingMsg').style.display = 'none';
            document.getElementById('trainerApp').style.display = 'block';
            showNextWord();
        } else {
            throw new Error("Daten sind leer.");
        }
    } catch (error) {
        document.getElementById('loadingMsg').innerText = "Fehler beim Laden (siehe Konsole).";
        console.error("Detaillierter Fehler:", error);
    }
}

// 2. Nächstes Wort anzeigen und UI vorbereiten
function showNextWord() {
    if(vocabulary.length > 0) {
        let currentWord = vocabulary[currentIndex];
        
        // Zufällige Auswahl der Richtung (50/50 Chance)
        currentDirection = Math.random() > 0.5 ? 'JA_DE' : 'DE_JA';
        
        // UI zurücksetzen
        document.getElementById('feedback').innerText = '';
        document.getElementById('translation').value = '';
        document.getElementById('furigana').innerText = ''; 
        
        // Buttons auf Standard zurücksetzen
        document.getElementById('btnGewusst').style.display = 'none';
        document.getElementById('btnNichtGewusst').style.display = 'none';
        document.getElementById('btnCheck').style.display = 'inline-block';
        
        if (currentDirection === 'JA_DE') {
            // MODUS: Japanisch -> Deutsch (Antwort aufdecken)
            document.getElementById('kanji').innerText = currentWord['Kanji'];
            document.getElementById('translation').style.display = 'none'; 
            document.getElementById('btnFurigana').style.display = 'inline-block'; 
            document.getElementById('btnCheck').innerText = "Antwort aufdecken";
        } else {
            // MODUS: Deutsch -> Japanisch (Texteingabe)
            document.getElementById('kanji').innerText = currentWord['Deutsch'];
            document.getElementById('translation').style.display = 'block'; 
            document.getElementById('translation').placeholder = "Japanisch (Kanji/Kana) eingeben...";
            document.getElementById('btnFurigana').style.display = 'none'; 
            document.getElementById('btnCheck').innerText = "Check";
        }
    }
}

// 3. Fortschritt im Hintergrund an Google Sheets senden
function updateProgress(word, isCorrect) {
    let neuesFach = isCorrect ? Math.min(5, (word.Fach || 1) + 1) : 1; 
    let datum = new Date().toISOString().split('T')[0]; 
    
    let payload = {
        rowIndex: word.rowIndex,
        fach: neuesFach,
        naechsteAbfrage: datum
    };

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    }).catch(err => console.error("Fehler beim Speichern:", err));
}

// 4. Event Listener für Buttons
document.getElementById('btnCheck').addEventListener('click', function() {
    let currentWord = vocabulary[currentIndex];
    
    if (currentDirection === 'JA_DE') {
        // Japanisch -> Deutsch: Nur die Antwort aufdecken
        document.getElementById('feedback').innerText = "Lösung: " + currentWord['Deutsch'];
        document.getElementById('feedback').style.color = "#333";
        
        // Layout für Selbsteinschätzung umbauen
        document.getElementById('btnCheck').style.display = 'none';
        document.getElementById('btnFurigana').style.display = 'none';
        document.getElementById('btnGewusst').style.display = 'inline-block';
        document.getElementById('btnNichtGewusst').style.display = 'inline-block';
        
    } else {
        // Deutsch -> Japanisch: Texteingabe überprüfen
        let userInput = document.getElementById('translation').value.trim();
        let isCorrect = (userInput === currentWord['Kanji'] || userInput === currentWord['Furigana']);
        
        updateProgress(currentWord, isCorrect); 
        
        if(isCorrect) {
            document.getElementById('feedback').innerText = "Richtig!";
            document.getElementById('feedback').style.color = "green";
            setTimeout(() => {
                currentIndex = (currentIndex + 1) % vocabulary.length;
                showNextWord();
            }, 1500);
        } else {
            document.getElementById('feedback').innerText = `Falsch. Richtig wäre: ${currentWord['Kanji']} (${currentWord['Furigana']})`;
            document.getElementById('feedback').style.color = "red";
            setTimeout(() => {
                currentIndex = (currentIndex + 1) % vocabulary.length;
                showNextWord();
            }, 3000);
        }
    }
});

document.getElementById('btnGewusst').addEventListener('click', function() {
    updateProgress(vocabulary[currentIndex], true);
    currentIndex = (currentIndex + 1) % vocabulary.length;
    showNextWord();
});

document.getElementById('btnNichtGewusst').addEventListener('click', function() {
    updateProgress(vocabulary[currentIndex], false);
    currentIndex = (currentIndex + 1) % vocabulary.length;
    showNextWord();
});

document.getElementById('btnFurigana').addEventListener('click', function() {
    document.getElementById('furigana').innerText = vocabulary[currentIndex]['Furigana'];
});

// "Abbrechen/Überspringen" Button lädt das nächste Wort ohne Wertung
document.getElementById('btnCancel').addEventListener('click', function() {
    currentIndex = (currentIndex + 1) % vocabulary.length;
    showNextWord();
});

// App starten
loadVocabulary();