## O projektu

**Music Sharing Platform** je web aplikacija razvijena kao timski projekt, u suradnji s kolegom iz Poljske, u sklopu kolegija **Web Application Development (WAD)** na **Fakultetu organizacije i informatike (FOI)**, uz međunarodnu suradnju s **University of Lodz – Faculty of Mathematics and Computer Science (UL-FMCS)**. 

Cilj projekta bio je izraditi **Single Page Application (SPA)** koja pokriva potrebe različitih tipova korisnika, od standardnih korisničkih funkcionalnosti do administratorskih i menadžerskih mogućnosti. Sustav koristi role-based pristup kako bi se omogućile različite razine pristupa i upravljanja sadržajem.

### Moj doprinos:

Bio sam zadužen za izradu kompletnog backend dijela aplikacije (REST API) koristeći **Express.js** i **TypeScript**, uključujući izradu ER modela baze podataka i implementaciju rada sa **SQLite** bazom. Također sam pripremio REST dokumentaciju, testirao endpointove kroz Postman te integrirao ključne dijelove **Angular** frontenda s backend logikom.

## Tehnološki stog

- `TypeScript`
- `Angular`
- `SQLite`
- `HTML`
- `SCSS`
- `Express.js`  
- `Postman`

## Glavne funkcionalnosti

- Kreiranje, uređivanje i objavljivanje glazbenih playlista  
- Automatsko dohvaćanje metapodataka pjesama (naziv, izvođač i trajanje) putem YouTube poveznice  
- Označavanje playlista oznakom „sviđa mi se” te spremanje u favorite  
- Prikaz preporučenih playlista kroz sekcije Trending i New Releases  
- Evidentiranje aktivnosti kroz audit logove uz mogućnost izvoza u PDF format  
- Napredno filtriranje i pretraživanje playlista, pjesama i audit logova

## Što sam naučio


Tijekom razvoja ovog projekta stekao sam praktično iskustvo u izradi backend sustava, s posebnim naglaskom na rad sa sesijama, autorizacijom te sigurnosnim aspektima aplikacije. Kroz planiranje i implementaciju REST API-ja u **TypeScript/Express** okruženju dodatno sam unaprijedio razumijevanje dizajna API-ja koji je čitljiv, strukturiran i jednostavan za integraciju s frontend aplikacijom. Također sam se upoznao s korištenjem javno dostupnih API-ja za dohvat podataka, primjerice s automatskim preuzimanjem metapodataka pjesama putem YouTube poveznica.

Uz backend razvoj, stekao sam i osnovno iskustvo rada s **Angularom** te implementacijom komunikacije između frontenda i backenda putem API poziva. Dodatno sam razvio razumijevanje implementacije filtriranja i paginacije na backend strani kako bi dohvat podataka bio učinkovitiji i pregledniji. Radom s **SQLite** bazom podataka dodatno sam ojačao znanje relacijskog modeliranja i upravljanja podacima unutar aplikacije. Također sam naučio implementirati izvoz podataka u PDF format (npr. audit logova) korištenjem biblioteke **PDFKit**. Posebno vrijednim smatram iskustvo kontinuirane komunikacije na engleskom jeziku i koordinacije rada u suradnji s kolegom iz Poljske.

## Ideje za unapređenje

- Uređivanje profila korisnika (promjena podataka, lozinke, profilna slika)
- Komentari i recenzije playlista
- Kolaborativne playliste (više korisnika uređuje istu playlistu)
- Unapređenje obrade grešaka i korisničkih poruka na frontend strani
- Dashboard za autore playlista s prikazom statistika (pregledi, oznake „sviđa mi se” i favoriti kroz vrijeme)
- Optimizacija korisničkog sučelja za mobilne uređaje i manje ekrane
- Sustava privatnih poruka (chat) između korisnika

## Pokretanje / Demo

**Aplikacija**: http://spider.foi.hr:12160/  <br>
**Napomena**: Poveznica je prethodno bila u funkciji. Na dan 6. 2. došlo je do privremene nemogućnosti povezivanja s poslužiteljem zbog tehničkih poteškoća. Problem je u postupku rješavanja.

Test korisnici (username: password):

- **Običan korisnik** - user: User123
- **Administrator** - admin: Admin123
- **Menadžer** - manager: Manager123

![MusicSharingPlatform-demo-ezgif com-video-to-gif-converter](https://github.com/user-attachments/assets/10866125-d62e-43fa-8ea1-5e87a592d4ba)

Cijeli **demo video**: https://youtu.be/52lW_3txkx0
