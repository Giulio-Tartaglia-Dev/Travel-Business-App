# 🌍 Digital Nomad Budget & Visa Planner

Una web application avanzata progettata per aiutare i nomadi digitali a pianificare i propri viaggi in base al budget mensile e ai requisiti di visto, incrociando dati in tempo reale da diverse fonti.

## 🚀 Live Demo
Visualizza il progetto dal vivo:[Prova l'applicazione qui](https://Giulio-Tartaglia-Dev.github.io/Travel-Business-App/) 

## 🛠️ Caratteristiche Tecniche
* **Integrazione API**: Recupero dinamico dei dati globali tramite l'API `restcountries.com` (valute, lingue, fusi orari).
* **Logica di Filtraggio**: Algoritmi JavaScript per il calcolo e il filtraggio delle destinazioni in base al budget inserito dall'utente.
* **Modern UI/UX**: Interfaccia realizzata con **TailwindCSS**, utilizzando effetti di "Glassmorphism" per un look pulito e professionale.
* **Sviluppo Modulare**: Utilizzo di classi JavaScript (ES6) per una gestione dello stato dell'applicazione pulita e manutenibile.

## 🧰 Stack Tecnologico
* **Frontend**: HTML5, TailwindCSS (via CDN).
* **Logic**: Vanilla JavaScript (ES6+), Fetch API.
* **Tooling**: Python (usato come server di sviluppo locale).

## 📂 Come Funziona
1. **Input**: L'utente inserisce il proprio paese d'origine e il budget mensile desiderato.
2. **Elaborazione**: L'app recupera i dati dei paesi e filtra le città/nazioni compatibili.
3. **Visualizzazione**: Viene generata una grid interattiva di card con i dettagli della destinazione e un link diretto a Google Maps.

## 🔧 Installazione Locale
Per testare il progetto sul tuo computer:
1. Clona la repository.
2. Assicurati di avere Python installato.
3. Esegui il comando: `npm start` (avvierà un server locale sulla porta 8000).

