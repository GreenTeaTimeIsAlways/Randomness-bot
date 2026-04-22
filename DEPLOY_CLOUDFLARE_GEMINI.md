# Discord bot na Cloudflare + Gemini

Ten projekt ma teraz nowy wariant bez odpalania bota na Twoim komputerze:

- backend dziala na `Cloudflare Workers`
- stan trzyma w `Cloudflare D1`
- AI robi `Gemini API`
- Discord dostaje interakcje po HTTP, bez zwyklego procesu 24/7

Najwazniejsze: **nie musisz uzywac `.env`**, jesli wdrazasz to przez Cloudflare. Wszystko wpisujesz w panelu `Variables and Secrets`.

## Co ten wariant robi

- losuje tryb wejscia:
  - `knowledge`
  - `absurd`
  - `bluff`
  - `reflex`
  - `paradox`
- zadaje najpierw pytanie o zainteresowanie
- potem generuje 3 kolejne pytania lub zadania
- wpuszcza po dobrej odpowiedzi
- daje druga szanse po sredniej odpowiedzi
- ma miesieczny system eventow:
  - `question_roulette`
  - `glitch_event`
  - `pattern_hunt`
- potrafi wygenerowac plan eventow na miesiac i publikowac je cronem

## Zanim zaczniesz

Poniewaz token bota byl juz wklejony do rozmowy, **zresetuj go**:

1. Wejdz do [Discord Developer Portal](https://discord.com/developers/applications)
2. Otworz swoja aplikacje
3. Wejdz w `Bot`
4. Kliknij `Reset Token`
5. Skopiuj nowy token i uzyj juz tylko jego

Bot token wedlug dokumentacji Discorda jest jak haslo i nie powinien byc publiczny.

## Krok 1. Wrzuc kod na GitHub

1. Zaloz nowe repo na GitHubie.
2. Wrzuć tam ten katalog projektu.
3. Upewnij sie, ze w repo sa te pliki:
   - `wrangler.toml`
   - `package.json`
   - `cloudflare-worker/schema.sql`
   - `cloudflare-worker/src/*.js`

Wazne:

- w `wrangler.toml` nazwa Workera jest ustawiona na `discord-verification-worker`
- przy tworzeniu projektu w Cloudflare najlepiej wpisz **dokladnie taka sama nazwe**

## Krok 2. Stworz bota w Discord Developer Portal

Portal deweloperski Discorda zwykle i tak jest po angielsku, nawet jesli sam Discord masz po polsku.

### 2A. Utworz aplikacje

1. Wejdz do [Discord Developer Portal](https://discord.com/developers/applications)
2. Kliknij `New Application`
3. Nadaj nazwe
4. Wejdz do zakladki `General Information`

### 2B. Skopiuj dane, ktore beda potrzebne

W `General Information` znajdziesz:

- `Application ID`
- `Public Key`

Zapisz je, bo za chwile wkleisz je do Cloudflare.

### 2C. Dodaj bota

1. Wejdz do zakladki `Bot`
2. Kliknij `Add Bot`
3. W tej samej zakladce kliknij `Reset Token` albo `Copy`, jesli masz swiezy token
4. Skopiuj `Bot Token`

W tym wariancie:

- `Message Content Intent` nie jest potrzebny
- `Server Members Intent` nie jest potrzebny

## Krok 3. Dodaj bota na serwer

1. W Developer Portal wejdz w `OAuth2`
2. Otworz `URL Generator`
3. Zaznacz scope:
   - `bot`
   - `applications.commands`
4. Zaznacz permissions:
   - `Manage Roles`
   - `View Channels`
   - `Send Messages`
   - `Read Message History`
   - `Embed Links`
5. Skopiuj wygenerowany link
6. Otworz go w przegladarce
7. Wybierz serwer i dodaj bota

Potem na serwerze ustaw role bota **wyzej** niz role:

- `Zweryfikowany`
- `Niezweryfikowany` jesli jej uzywasz

## Krok 4. Wlacz Tryb Dewelopera w Discordzie i skopiuj ID

To robisz juz w zwyklym Discordzie po polsku:

1. Kliknij kolko zebate przy swoim nicku
2. Wejdz w `Zaawansowane`
3. Wlacz `Tryb dewelopera`

Teraz skopiuj:

- `ID serwera`
  - prawy przycisk na nazwie serwera
  - `Kopiuj identyfikator`
- `ID kanalu weryfikacji`
  - prawy przycisk na kanale
  - `Kopiuj identyfikator`
- `ID kanalu eventow`
  - prawy przycisk na kanale
  - `Kopiuj identyfikator`
- `ID roli Zweryfikowany`
  - wejdz w `Ustawienia serwera` -> `Role`
  - znajdz role
  - menu z trzema kropkami
  - `Kopiuj identyfikator`
- `ID roli Niezweryfikowany`
  - tylko jesli chcesz jej uzywac

## Krok 5. Utworz Worker z GitHuba w Cloudflare

Zgodnie z dokumentacja Cloudflare:

1. Wejdz do [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Otworz `Workers & Pages`
3. Kliknij `Create application`
4. Przy `Import a repository` kliknij `Get started`
5. Podlacz konto GitHub, jesli trzeba
6. Wybierz repo z tym projektem
7. Przy nazwie projektu wpisz `discord-verification-worker`
8. Kliknij `Save and Deploy`

Po chwili dostaniesz adres w stylu:

```text
https://discord-verification-worker.twoj-subdomain.workers.dev
```

To bedzie Twoj publiczny adres Workera.

## Krok 6. Dodaj D1

### 6A. Stworz baze

1. W Cloudflare wejdz w `D1`
2. Kliknij `Create database`
3. Nadaj nazwe, np. `discord-verification-db`
4. Utworz baze

### 6B. Podepnij baze do Workera

1. Wejdz w swojego Workera
2. Wejdz w `Settings`
3. Wejdz w `Bindings`
4. Kliknij `Add binding`
5. Wybierz `D1 database`
6. Ustaw:
   - `Variable name`: `DB`
   - `Database`: wybierz nowo utworzona baze
7. Zapisz

### 6C. Wgraj schemat tabel

1. Otworz baze D1 w panelu
2. Wejdz do `Console` albo `SQL`
3. Otworz lokalny plik `cloudflare-worker/schema.sql`
4. Skopiuj cala zawartosc
5. Wklej do konsoli D1
6. Uruchom

## Krok 7. Uzupelnij Variables and Secrets w Cloudflare

Wejdz:

1. `Workers & Pages`
2. Twoj Worker
3. `Settings`
4. `Variables and Secrets`
5. `Add`

Dodaj te pola.

### Sekrety

Te ustaw jako `Secret`:

```text
DISCORD_BOT_TOKEN
GEMINI_API_KEY
ADMIN_API_SECRET
```

Co wpisac:

- `DISCORD_BOT_TOKEN`
  - z `Discord Developer Portal` -> `Bot` -> token bota
- `GEMINI_API_KEY`
  - z [Google AI Studio](https://aistudio.google.com/app/apikey)
- `ADMIN_API_SECRET`
  - wymysl swoje haslo techniczne, np. dlugi losowy ciag

### Zwykle Variables

Te ustaw jako zwykle `Variable`:

```text
DISCORD_APPLICATION_ID
DISCORD_PUBLIC_KEY
DISCORD_GUILD_ID
VERIFIED_ROLE_ID
UNVERIFIED_ROLE_ID
VERIFICATION_CHANNEL_ID
EVENT_CHANNEL_ID
ENABLE_VERIFICATION
ENABLE_MONTHLY_EVENTS
RESET_TIMEZONE
GEMINI_MODEL
PASSING_SCORE
SECOND_CHANCE_SCORE
MIN_QUESTION_SCORE
MAX_ATTEMPTS
COOLDOWN_MINUTES
ACTIVE_SESSION_TTL_MINUTES
DAILY_VERIFICATION_LIMIT
REFLEX_MIN_SECONDS
REFLEX_MAX_SECONDS
MONTHLY_EVENT_COUNT
EVENT_POST_HOUR_LOCAL
ENABLED_VERIFICATION_MODES
```

Startowy zestaw, ktory polecam:

```text
DISCORD_APPLICATION_ID=twoje Application ID
DISCORD_PUBLIC_KEY=twoj Public Key
DISCORD_GUILD_ID=id serwera
VERIFIED_ROLE_ID=id roli Zweryfikowany
UNVERIFIED_ROLE_ID=id roli Niezweryfikowany
VERIFICATION_CHANNEL_ID=id kanalu weryfikacji
EVENT_CHANNEL_ID=id kanalu eventow
ENABLE_VERIFICATION=true
ENABLE_MONTHLY_EVENTS=true
RESET_TIMEZONE=Europe/Warsaw
GEMINI_MODEL=gemini-2.5-flash-lite
PASSING_SCORE=72
SECOND_CHANCE_SCORE=55
MIN_QUESTION_SCORE=35
MAX_ATTEMPTS=2
COOLDOWN_MINUTES=30
ACTIVE_SESSION_TTL_MINUTES=120
DAILY_VERIFICATION_LIMIT=25
REFLEX_MIN_SECONDS=10
REFLEX_MAX_SECONDS=15
MONTHLY_EVENT_COUNT=12
EVENT_POST_HOUR_LOCAL=18
ENABLED_VERIFICATION_MODES=knowledge,absurd,bluff,reflex,paradox
```

Uwagi:

- jesli nie chcesz roli `Niezweryfikowany`, zostaw `UNVERIFIED_ROLE_ID` puste
- jesli chcesz tylko bot eventowy, ustaw:
  - `ENABLE_VERIFICATION=false`
  - `ENABLE_MONTHLY_EVENTS=true`
- jesli chcesz tylko bota weryfikacyjnego, ustaw:
  - `ENABLE_VERIFICATION=true`
  - `ENABLE_MONTHLY_EVENTS=false`

Po dodaniu zmiennych kliknij `Deploy`.

## Krok 8. Sprawdz health endpoint

Po deployu otworz w przegladarce:

```text
https://twoj-worker.workers.dev/health
```

Jesli wszystko jest dobrze, zobaczysz JSON z:

- `ok: true`

Jesli nie, w `missing` zobaczysz, czego jeszcze brakuje.

## Krok 9. Zarejestruj slash komendy

Uzyj adresu:

```text
https://twoj-worker.workers.dev/internal/register-commands?secret=TWOJ_ADMIN_API_SECRET
```

Jesli wpisales dobry `ADMIN_API_SECRET`, Worker zarejestruje komendy:

- `/post_verification_panel`
- `/reset_verification`
- `/generate_monthly_events`
- `/post_today_event`

## Krok 10. Ustaw Interaction Endpoint URL w Discordzie

1. Wroc do `Discord Developer Portal`
2. Otworz aplikacje
3. Wejdz w `General Information`
4. Znajdz pole `Interactions Endpoint URL`
5. Wklej:

```text
https://twoj-worker.workers.dev/
```

Wazne:

- wklejasz **glowny adres Workera**
- nie `/health`
- nie `/internal/...`

Kliknij `Save`.

Jesli zapis przejdzie, to znaczy, ze Discord poprawnie dostal `PING` i podpis interakcji dziala.

## Krok 11. Opublikuj panel weryfikacji

Najprosciej od razu przez przegladarke:

```text
https://twoj-worker.workers.dev/internal/post-panel?secret=TWOJ_ADMIN_API_SECRET&channelId=ID_KANALU_WERYFIKACJI
```

Mozesz tez potem uzyc slash komendy:

```text
/post_verification_panel
```

albo:

```text
/post_verification_panel channel:#weryfikacja
```

## Krok 12. Wygeneruj plan eventow i testowo wyslij dzisiejszy

### Wygenerowanie planu miesiecznego

```text
https://twoj-worker.workers.dev/internal/generate-monthly-events?secret=TWOJ_ADMIN_API_SECRET
```

### Reczne wyslanie eventu na dzis

```text
https://twoj-worker.workers.dev/internal/post-today-event?secret=TWOJ_ADMIN_API_SECRET
```

Potem Worker sam bedzie pilnowal tego cronem.

## Jak dziala cron

W `wrangler.toml` jest ustawione:

```toml
[triggers]
crons = ["*/15 * * * *"]
```

To znaczy:

- Worker budzi sie co 15 minut
- sprawdza, czy na ten miesiac istnieje plan eventow
- jesli nie, generuje go
- jesli jest pora publikacji i na dzis cos zaplanowano, wysyla event na serwer

Domyslna godzina publikacji:

```text
EVENT_POST_HOUR_LOCAL=18
```

czyli 18:00 wedlug:

```text
RESET_TIMEZONE=Europe/Warsaw
```

## Jak zrobic z tego 2 osobne boty

Da sie.

Najprostszy sposob:

1. Tworzysz druga aplikacje w Discord Developer Portal
2. Tworzysz drugi Worker w Cloudflare z tego samego repo
3. Ustawiasz inne sekrety i inne kanaly
4. W drugim Workerze ustawiasz:

```text
ENABLE_VERIFICATION=false
ENABLE_MONTHLY_EVENTS=true
```

W pierwszym Workerze ustawiasz:

```text
ENABLE_VERIFICATION=true
ENABLE_MONTHLY_EVENTS=false
```

Wtedy masz:

- jednego bota od wejscia
- drugiego bota od miesiecznych eventow

## Gdzie sa najwazniejsze pliki

- konfiguracja Workera: `wrangler.toml`
- baza danych: `cloudflare-worker/schema.sql`
- wejscie i eventy: `cloudflare-worker/src/index.js`
- logika weryfikacji: `cloudflare-worker/src/verification.js`
- logika eventow: `cloudflare-worker/src/events.js`
- Gemini: `cloudflare-worker/src/gemini.js`

## Najczestsze problemy

### 1. Build w Cloudflare nie startuje

Sprawdz, czy nazwa projektu w Cloudflare zgadza sie z `name =` w `wrangler.toml`.

### 2. Health pokazuje `missing`

Brakuje Ci jeszcze jakiejs zmiennej w `Variables and Secrets`.

### 3. Nie zapisuje sie `Interactions Endpoint URL`

Najczestsze przyczyny:

- Worker nie jest jeszcze wdrozony
- URL jest zly
- nie ustawiles `DISCORD_PUBLIC_KEY`
- podpis Discorda nie przechodzi walidacji

### 4. Bot nie nadaje roli

Sprawdz:

- czy bot ma `Manage Roles`
- czy rola bota jest wyzej od roli `Zweryfikowany`

### 5. Gemini nie generuje

Sprawdz:

- czy `GEMINI_API_KEY` jest poprawny
- czy model istnieje dla Twojego konta
- czy nie skonczyly sie limity Free Tier

## Przydatne linki

- Cloudflare Workers Builds: [docs](https://developers.cloudflare.com/workers/ci-cd/builds/)
- Cloudflare Secrets: [docs](https://developers.cloudflare.com/workers/configuration/secrets/)
- Cloudflare D1 binding: [docs](https://developers.cloudflare.com/d1/get-started/)
- Cloudflare D1 console / SQL: [docs](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- Discord interactions: [docs](https://docs.discord.com/developers/interactions/receiving-and-responding)
- Discord OAuth2 i bot token: [docs](https://docs.discord.com/developers/platform/oauth2-and-permissions)
- Gemini API reference: [docs](https://ai.google.dev/api)
- Gemini rate limits: [docs](https://ai.google.dev/gemini-api/docs/quota)
