import { pickRandom, randomIntInclusive } from "./utils.js";

const CATEGORY_LABELS = {
  random: "Losowy chaos",
  story: "Historia chaosu",
  debate: "Debata chaosu",
  challenge: "Wyzwanie chaosu",
  prophecy: "Przepowiednia chaosu",
  glitch: "Glitch prompt",
};

const CHARACTERS = [
  "pingwin w garniturze",
  "lodowka z ambicjami politycznymi",
  "cien, ktory nie zgadza sie z wlascicielem",
  "goblin podatkowy",
  "automat z herbata",
  "zapomniany NPC",
  "kot z licencja na chaos",
  "latarnia morska na urlopie",
  "bibliotekarz od rzeczy niemozliwych",
  "parasolka po przejsciach",
  "kapitan windy",
  "zegarmistrz bez zegara",
  "kurier od snow",
  "duch niedokonczonego zadania",
  "kaktus z problemem zaufania",
  "czlowiek od przycisku, ktorego nie wolno klikac",
  "ryba znajaca haslo do routera",
  "krzeslo, ktore widzialo za duzo",
  "lis zbierajacy paragony",
  "chmura z syndromem glownego bohatera",
  "sowa od spraw losowych",
  "robot, ktory wierzy w przesady",
  "mrowka planujaca rewolucje",
  "magnes przyciagajacy tylko zle decyzje",
  "ksiezycowy praktykant",
  "waz w kamizelce odblaskowej",
  "dziadek od kodow QR",
  "pudelko, ktore odmawia bycia otwartym",
  "herbata przewidujaca pogode",
  "szachowy pionek z kompleksem krola",
  "winda z filozoficznym kryzysem",
  "zabojczo spokojny pingwin",
  "poczciwy demon od harmonogramow",
  "drzwi, ktore czekaja na zaproszenie",
  "plecak pelny niedziel",
  "zegarek dzialajacy tylko w srody",
  "lampka nocna od teorii spiskowych",
  "krowa z kontem premium",
  "duch starego mema",
  "konsultant od przypadkow",
];

const OBJECTS = [
  "klucz bez drzwi",
  "parasol bez deszczu",
  "zegar z dodatkowa godzina",
  "kubek, ktory pamieta rozmowy",
  "kostka lodu z planem kariery",
  "pilot bez baterii",
  "znak drogowy z opinia",
  "notatnik pelny cudzych mysli",
  "kamien z regulaminem",
  "widelec do podejmowania decyzji",
  "walizka z jednym slowem",
  "dywan udajacy portal",
  "latarka pokazujaca przyszle bledy",
  "mapa do miejsca, ktore nie istnieje",
  "dzwonek do drzwi bez domu",
  "szklanka pelna ciszy",
  "spinacz spinajacy watki fabularne",
  "moneta z trzema stronami",
  "ramka na niewidzialne zdjecie",
  "kompas wskazujacy humor",
  "radio odbierajace mysli roslin",
  "bilet do wczoraj",
  "kabel ladowania emocji",
  "instrukcja do przypadkowego zycia",
  "folder nazwany NIE OTWIERAC",
  "gwizdek do przywolywania pomyslow",
  "lupa pokazujaca intencje",
  "stempel zatwierdzajacy absurd",
  "swieca, ktora boi sie ciemnosci",
  "koszyk na alternatywne decyzje",
  "pioro piszace tylko pytania",
  "zamek bez tajemnicy",
  "reklamowka pelna poniedzialkow",
  "kostka do gry z litera X",
  "telefon, ktory dzwoni do siebie",
  "obraz patrzacy w druga strone",
  "zegarek cofajacy wymowki",
  "pilka odbijajaca tematy",
  "plakat z ostrzezeniem przed soba",
  "kanapka o zbyt wysokiej samoocenie",
];

const PLACES = [
  "poczekalnia snow",
  "miasto bez poniedzialkow",
  "muzeum bledow",
  "stacja koncowa internetu",
  "archiwum rzeczy niedopowiedzianych",
  "sklep z zapasowymi decyzjami",
  "las, ktory odpowiada echem z przyszlosci",
  "biblioteka pustych tytulow",
  "parking dla mysli",
  "tunel pod kalendarzem",
  "dworzec dla spoznionych pomyslow",
  "kuchnia na koncu mapy",
  "sala obrad przypadkow",
  "ogrod z zakazem logiki",
  "piwnica pelna dobrych intencji",
  "most miedzy dwoma zlymi wyborami",
  "kantyna dla duchow",
  "pustynia mokrych skarpet",
  "wieza kontrolna chaosu",
  "pokoj, w ktorym wszystko ma druga nazwe",
  "korytarz bocznych questow",
  "centrum dowodzenia cisza",
  "teatr niespodziewanych pauz",
  "hotel dla zgubionych odpowiedzi",
  "planetarium z jednym gwiazdozbiorem za duzo",
  "laboratorium pomylek",
  "wioska bez mapy",
  "magazyn rzeczy prawie waznych",
  "mostek kapitanow od niczego",
  "fontanna glupich przeczuc",
  "poczta do osob, ktore jeszcze nie istnieja",
  "rynek wymiany wymowek",
  "szkola latania bez latania",
  "komisariat niewyjasnionych zbiegow okolicznosci",
  "dwor krzesel obrotowych",
  "bar na granicy sensu",
  "metro jezdzace po watkach",
  "sala tronowa pilota bez baterii",
  "wyspa trzecich opcji",
  "serwerownia przeznaczenia",
];

const PROBLEMS = [
  "ktos ukradl kolor niebieski",
  "czas zaczal chodzic bokiem",
  "echo zaczelo klamac",
  "kazde pytanie zmienia odpowiedz",
  "nikt nie pamieta, kto zaczal rozmowe",
  "trzecia opcja zniknela z menu",
  "losowe przedmioty domagaja sie praw obywatelskich",
  "poniedzialek pojawil sie dwa razy",
  "mapa obraza sie na kierunek polnocny",
  "cisza zaczela zostawiac slady",
  "drzwi wpuszczaja tylko watpliwosci",
  "deszcz pada od dolu",
  "wszyscy mowia prawde, ale w zlej kolejnosci",
  "kompas wskazuje najgorszy pomysl",
  "najmniejszy problem zostal burmistrzem",
  "haslo do miasta sklada sie z westchnienia",
  "rzeczy przestaly miec cienie",
  "kazdy zegar pokazuje inna wymowke",
  "lustra zaczely dawac porady",
  "ostatnia strona ksiazki pojawila sie pierwsza",
  "ktos podmienil wszystkie odpowiedzi na pytania",
  "woda zapomniala, jak byc mokra",
  "sny zaczely naliczac oplaty",
  "glosowanie wygrala opcja, ktorej nie bylo",
  "kazdy znak ostrzegawczy ostrzega przed innym znakiem",
  "kalendarz poprosil o przerwe",
  "wiadomosci przychodza przed wyslaniem",
  "regulamin przepisuje sam siebie",
  "druga szansa domaga sie pierwszej szansy",
  "najlepszy argument ma tylko trzy kropki",
  "kazdy przedmiot twierdzi, ze jest metafora",
  "nikt nie moze znalezc poczatku watku",
  "spokoj stal sie podejrzany",
  "ostatni klucz pasuje do wszystkich drzwi oprocz wlasciwych",
  "przypadek zaczal prowadzic protokol",
  "najkrotsza droga prowadzi przez trzy pomylki",
  "kazde imie brzmi jak instrukcja",
  "internet poprosil o dowod osobisty",
  "wszystkie odpowiedzi maja ten sam zapach",
  "nagle zabraklo slowa na 'cos'",
];

const RULES = [
  "nikt nie moze uzyc litery R",
  "kazda decyzja wymaga rzutu moneta",
  "klamstwo jest legalne tylko w rymie",
  "mozna mowic tylko pytaniami",
  "kazdy plan musi miec dziure na srodku",
  "prawda liczy sie dopiero po zachodzie slonca",
  "najgorszy pomysl dostaje pierwszenstwo",
  "kazda odpowiedz musi zawierac kolor",
  "przedmioty maja prawo veta",
  "cisza trwa maksymalnie 4 sekundy",
  "kto powie 'normalnie', przegrywa ture",
  "argumenty dzialaja tylko od tylu",
  "kazdy bohater musi miec niepotrzebny rekwizyt",
  "nikt nie moze spojrzec w gore",
  "decyzje zatwierdza najbardziej podejrzany obiekt",
  "kazdy problem trzeba nazwac imieniem",
  "wazne zdania musza zaczynac sie od 'a co jesli'",
  "jedna osoba zna regule, ale nie wie, ze ja zna",
  "kazda trzecia mysl jest publiczna",
  "zakazane jest wyjasnianie rzeczy wprost",
  "najbardziej logiczna osoba musi milczec",
  "kazdy blad daje dodatkowy punkt",
  "odpowiedz bez przykladu nie istnieje",
  "ostatnie slowo decyduje o pogodzie",
  "czas mozna kupic tylko za wspomnienia",
  "wszystko, co czerwone, udaje wskazowke",
  "jezeli ktos sie zgodzi, zasada sie odwraca",
  "mozna wybrac tylko opcje, ktorej nikt nie rozumie",
  "kazdy musi udawac, ze zna ukryty wzor",
  "pytania moga odpowiadac same sobie",
  "przeprosiny dzialaja jak teleport",
  "liczba 7 ma immunitet",
  "najblizszy przedmiot zostaje sedzia",
  "kazdy dowod musi byc troche podejrzany",
  "odpowiedzi krotsze niz trzy slowa sa proroctwem",
  "nikt nie moze nazwac glownego problemu",
  "kazdy wybor tworzy maly efekt uboczny",
  "tylko absurdalne uzasadnienia sa przyjmowane",
  "regula zmienia sie, gdy ktos ja zrozumie",
  "koniec mozna oglosic tylko szeptem",
];

const TASKS = [
  "opisz pierwsza scene w trzech zdaniach",
  "wymysl rozwiazanie, ktore brzmi zle, ale dziala",
  "nazwij glownego przeciwnika",
  "napisz krotki manifest tej sytuacji",
  "stworz haslo reklamowe dla tego chaosu",
  "wyjasnij, kto ma racje i dlaczego nikt",
  "dopisz brakujacy element ukrytego wzoru",
  "zaproponuj pierwsze prawo tego swiata",
  "wymysl tytul filmu na podstawie tej sceny",
  "opisz, co poszlo nie tak",
  "napisz instrukcje przetrwania",
  "wskaz najbardziej podejrzany szczegol",
  "stworz nazwe tajnej organizacji",
  "opisz finalowy zwrot akcji",
  "napisz jedno zdanie, ktore wszystko komplikuje",
  "wybierz bohatera pobocznego i daj mu cel",
  "wymysl rytual powitalny",
  "opisz, co widzi kamera w pierwszej sekundzie",
  "stworz zasade punktowania",
  "dopisz morał, ale nieoczywisty",
  "napisz dialog dwoch swiadkow",
  "wyjasnij, czemu to ma sens",
  "wymysl ostrzezenie na tabliczce",
  "stworz najgorsza mozliwa porade",
  "opisz misje dla trzech osob",
  "wymysl nagrode za najlepsza odpowiedz",
  "stworz plan ucieczki",
  "napisz opis questa",
  "wybierz symbol tej historii",
  "wymysl absurdalny dowod",
  "stworz zasade, ktora ktos natychmiast zlamie",
  "napisz wiadomosc od bota z przyszlosci",
  "wymysl nazwe eventu",
  "opisz, czego nikt nie powinien dotykac",
  "stworz plot twist w jednym zdaniu",
  "wymysl powod, dla ktorego wszyscy milcza",
  "opisz najdziwniejsza konsekwencje",
  "stworz pytanie, ktore nalezy zadac",
  "napisz najkrotsza legende tego miejsca",
  "wybierz, kto powinien decydowac",
];

const TONES = [
  "jak trailer filmu klasy B",
  "jak notatka z tajnego zebrania",
  "jak legenda miejska",
  "jak ostrzezenie na starym plakacie",
  "jak rozmowa przy automacie z herbata",
  "jak raport po malym koncu swiata",
  "jak instrukcja do gry, ktorej nikt nie kupil",
  "jak przepowiednia z paragonu",
  "jak quest poboczny",
  "jak wpis z dziennika zepsutego bota",
  "jak debata dwoch osob, ktore maja za duzo racji",
  "jak opis eksponatu w muzeum bledow",
  "jak komunikat alarmowy bez alarmu",
  "jak plotka z alternatywnego poniedzialku",
  "jak opis snu po zbyt mocnej herbacie",
  "jak ogloszenie na dworcu dla pomyslow",
  "jak instrukcja BHP dla magii",
  "jak monolog czarnego charakteru bez budzetu",
  "jak recenzja przedmiotu, ktory nie istnieje",
  "jak wiadomosc zostawiona pod wycieraczka",
];

function chooseCategory(rawCategory) {
  const category = String(rawCategory || "random").trim().toLowerCase();
  if (category && category !== "random" && CATEGORY_LABELS[category]) {
    return category;
  }

  return pickRandom(["story", "debate", "challenge", "prophecy", "glitch"]);
}

function buildSeed() {
  return {
    character: pickRandom(CHARACTERS),
    object: pickRandom(OBJECTS),
    place: pickRandom(PLACES),
    problem: pickRandom(PROBLEMS),
    rule: pickRandom(RULES),
    task: pickRandom(TASKS),
    tone: pickRandom(TONES),
    number: randomIntInclusive(3, 99),
  };
}

function buildPromptBody(category, seed) {
  if (category === "debate") {
    return [
      `Czy **${seed.character}** ma moralne prawo uzyc przedmiotu: **${seed.object}**, jesli problemem jest to, ze **${seed.problem}**?`,
      `Zasada sporu: **${seed.rule}**.`,
      `Ton odpowiedzi: ${seed.tone}.`,
      `Zadanie: ${seed.task}.`,
    ];
  }

  if (category === "challenge") {
    return [
      `Wyzwanie: w miejscu **${seed.place}** pojawia sie **${seed.character}** z przedmiotem: **${seed.object}**.`,
      `Problem: **${seed.problem}**.`,
      `Ograniczenie: **${seed.rule}**.`,
      `Zadanie: ${seed.task}.`,
    ];
  }

  if (category === "prophecy") {
    return [
      `Przepowiednia nr ${seed.number}: gdy **${seed.object}** trafi do miejsca **${seed.place}**, **${seed.character}** odkryje, ze **${seed.problem}**.`,
      `Cena przepowiedni: **${seed.rule}**.`,
      `Zadanie: ${seed.task}.`,
    ];
  }

  if (category === "glitch") {
    return [
      `GLITCH_${seed.number}: \`${seed.character} -> ${seed.object} -> ${seed.place} -> ${seed.character} -> ?\``,
      `Blad systemu: **${seed.problem}**.`,
      `Regula ukryta w szumie: **${seed.rule}**.`,
      `Zadanie: ${seed.task}.`,
    ];
  }

  return [
    `W miejscu **${seed.place}** pojawia sie **${seed.character}** i znajduje **${seed.object}**.`,
    `Niestety: **${seed.problem}**.`,
    `Zasada swiata: **${seed.rule}**.`,
    `Styl: ${seed.tone}.`,
    `Zadanie: ${seed.task}.`,
  ];
}

function buildPromptFooter(category) {
  if (category === "debate") {
    return "_Odpowiedz pod ta wiadomoscia i obron swoje stanowisko tak, jakby mialo znaczenie dla losow wszechswiata._";
  }

  if (category === "challenge") {
    return "_Odpowiedz pod ta wiadomoscia i wykonaj wyzwanie w najdziwniejszy spojny sposob._";
  }

  if (category === "prophecy") {
    return "";
  }

  if (category === "glitch") {
    return "_Sprobuj odszyfrowac glitch albo dopisz brakujacy element sekwencji._";
  }

  return "_Odpowiedz pod ta wiadomoscia albo dopisz ciag dalszy tej sceny._";
}

export function buildChaosPrompt(rawCategory = "random") {
  const category = chooseCategory(rawCategory);
  const seed = buildSeed();
  const lines = [
    `**${CATEGORY_LABELS[category]}**`,
    "",
    ...buildPromptBody(category, seed),
  ];
  const footer = buildPromptFooter(category);
  if (footer) {
    lines.push("", footer);
  }

  return lines.join("\n");
}
  "ksiezycowy praktykant",
  "waz w kamizelce odblaskowej",
  "dziadek od kodow QR",
  "pudelko, ktore odmawia bycia otwartym",
  "herbata przewidujaca pogode",
  "szachowy pionek z kompleksem krola",
  "winda z filozoficznym kryzysem",
  "zabojczo spokojny pingwin",
  "poczciwy demon od harmonogramow",
  "drzwi, ktore czekaja na zaproszenie",
  "plecak pelny niedziel",
  "zegarek dzialajacy tylko w srody",
  "lampka nocna od teorii spiskowych",
  "krowa z kontem premium",
  "duch starego mema",
  "konsultant od przypadkow",
];

const OBJECTS = [
  "klucz bez drzwi",
  "parasol bez deszczu",
  "zegar z dodatkowa godzina",
  "kubek, ktory pamieta rozmowy",
  "kostka lodu z planem kariery",
  "pilot bez baterii",
  "znak drogowy z opinia",
  "notatnik pelny cudzych mysli",
  "kamien z regulaminem",
  "widelec do podejmowania decyzji",
  "walizka z jednym slowem",
  "dywan udajacy portal",
  "latarka pokazujaca przyszle bledy",
  "mapa do miejsca, ktore nie istnieje",
  "dzwonek do drzwi bez domu",
  "szklanka pelna ciszy",
  "spinacz spinajacy watki fabularne",
  "moneta z trzema stronami",
  "ramka na niewidzialne zdjecie",
  "kompas wskazujacy humor",
  "radio odbierajace mysli roslin",
  "bilet do wczoraj",
  "kabel ladowania emocji",
  "instrukcja do przypadkowego zycia",
  "folder nazwany NIE OTWIERAC",
  "gwizdek do przywolywania pomyslow",
  "lupa pokazujaca intencje",
  "stempel zatwierdzajacy absurd",
  "swieca, ktora boi sie ciemnosci",
  "koszyk na alternatywne decyzje",
  "pioro piszace tylko pytania",
  "zamek bez tajemnicy",
  "reklamowka pelna poniedzialkow",
  "kostka do gry z litera X",
  "telefon, ktory dzwoni do siebie",
  "obraz patrzacy w druga strone",
  "zegarek cofajacy wymowki",
  "pilka odbijajaca tematy",
  "plakat z ostrzezeniem przed soba",
  "kanapka o zbyt wysokiej samoocenie",
];

const PLACES = [
  "poczekalnia snow",
  "miasto bez poniedzialkow",
  "muzeum bledow",
  "stacja koncowa internetu",
  "archiwum rzeczy niedopowiedzianych",
  "sklep z zapasowymi decyzjami",
  "las, ktory odpowiada echem z przyszlosci",
  "biblioteka pustych tytulow",
  "parking dla mysli",
  "tunel pod kalendarzem",
  "dworzec dla spoznionych pomyslow",
  "kuchnia na koncu mapy",
  "sala obrad przypadkow",
  "ogrod z zakazem logiki",
  "piwnica pelna dobrych intencji",
  "most miedzy dwoma zlymi wyborami",
  "kantyna dla duchow",
  "pustynia mokrych skarpet",
  "wieza kontrolna chaosu",
  "pokoj, w ktorym wszystko ma druga nazwe",
  "korytarz bocznych questow",
  "centrum dowodzenia cisza",
  "teatr niespodziewanych pauz",
  "hotel dla zgubionych odpowiedzi",
  "planetarium z jednym gwiazdozbiorem za duzo",
  "laboratorium pomylek",
  "wioska bez mapy",
  "magazyn rzeczy prawie waznych",
  "mostek kapitanow od niczego",
  "fontanna glupich przeczuc",
  "poczta do osob, ktore jeszcze nie istnieja",
  "rynek wymiany wymowek",
  "szkola latania bez latania",
  "komisariat niewyjasnionych zbiegow okolicznosci",
  "dwor krzesel obrotowych",
  "bar na granicy sensu",
  "metro jezdzace po watkach",
  "sala tronowa pilota bez baterii",
  "wyspa trzecich opcji",
  "serwerownia przeznaczenia",
];

const PROBLEMS = [
  "ktos ukradl kolor niebieski",
  "czas zaczal chodzic bokiem",
  "echo zaczelo klamac",
  "kazde pytanie zmienia odpowiedz",
  "nikt nie pamieta, kto zaczal rozmowe",
  "trzecia opcja zniknela z menu",
  "losowe przedmioty domagaja sie praw obywatelskich",
  "poniedzialek pojawil sie dwa razy",
  "mapa obraza sie na kierunek polnocny",
  "cisza zaczela zostawiac slady",
  "drzwi wpuszczaja tylko watpliwosci",
  "deszcz pada od dolu",
  "wszyscy mowia prawde, ale w zlej kolejnosci",
  "kompas wskazuje najgorszy pomysl",
  "najmniejszy problem zostal burmistrzem",
  "haslo do miasta sklada sie z westchnienia",
  "rzeczy przestaly miec cienie",
  "kazdy zegar pokazuje inna wymowke",
  "lustra zaczely dawac porady",
  "ostatnia strona ksiazki pojawila sie pierwsza",
  "ktos podmienil wszystkie odpowiedzi na pytania",
  "woda zapomniala, jak byc mokra",
  "sny zaczely naliczac oplaty",
  "glosowanie wygrala opcja, ktorej nie bylo",
  "kazdy znak ostrzegawczy ostrzega przed innym znakiem",
  "kalendarz poprosil o przerwe",
  "wiadomosci przychodza przed wyslaniem",
  "regulamin przepisuje sam siebie",
  "druga szansa domaga sie pierwszej szansy",
  "najlepszy argument ma tylko trzy kropki",
  "kazdy przedmiot twierdzi, ze jest metafora",
  "nikt nie moze znalezc poczatku watku",
  "spokoj stal sie podejrzany",
  "ostatni klucz pasuje do wszystkich drzwi oprocz wlasciwych",
  "przypadek zaczal prowadzic protokol",
  "najkrotsza droga prowadzi przez trzy pomylki",
  "kazde imie brzmi jak instrukcja",
  "internet poprosil o dowod osobisty",
  "wszystkie odpowiedzi maja ten sam zapach",
  "nagle zabraklo slowa na 'cos'",
];

const RULES = [
  "nikt nie moze uzyc litery R",
  "kazda decyzja wymaga rzutu moneta",
  "klamstwo jest legalne tylko w rymie",
  "mozna mowic tylko pytaniami",
  "kazdy plan musi miec dziure na srodku",
  "prawda liczy sie dopiero po zachodzie slonca",
  "najgorszy pomysl dostaje pierwszenstwo",
  "kazda odpowiedz musi zawierac kolor",
  "przedmioty maja prawo veta",
  "cisza trwa maksymalnie 4 sekundy",
  "kto powie 'normalnie', przegrywa ture",
  "argumenty dzialaja tylko od tylu",
  "kazdy bohater musi miec niepotrzebny rekwizyt",
  "nikt nie moze spojrzec w gore",
  "decyzje zatwierdza najbardziej podejrzany obiekt",
  "kazdy problem trzeba nazwac imieniem",
  "wazne zdania musza zaczynac sie od 'a co jesli'",
  "jedna osoba zna regule, ale nie wie, ze ja zna",
  "kazda trzecia mysl jest publiczna",
  "zakazane jest wyjasnianie rzeczy wprost",
  "najbardziej logiczna osoba musi milczec",
  "kazdy blad daje dodatkowy punkt",
  "odpowiedz bez przykladu nie istnieje",
  "ostatnie slowo decyduje o pogodzie",
  "czas mozna kupic tylko za wspomnienia",
  "wszystko, co czerwone, udaje wskazowke",
  "jezeli ktos sie zgodzi, zasada sie odwraca",
  "mozna wybrac tylko opcje, ktorej nikt nie rozumie",
  "kazdy musi udawac, ze zna ukryty wzor",
  "pytania moga odpowiadac same sobie",
  "przeprosiny dzialaja jak teleport",
  "liczba 7 ma immunitet",
  "najblizszy przedmiot zostaje sedzia",
  "kazdy dowod musi byc troche podejrzany",
  "odpowiedzi krotsze niz trzy slowa sa proroctwem",
  "nikt nie moze nazwac glownego problemu",
  "kazdy wybor tworzy maly efekt uboczny",
  "tylko absurdalne uzasadnienia sa przyjmowane",
  "regula zmienia sie, gdy ktos ja zrozumie",
  "koniec mozna oglosic tylko szeptem",
];

const TASKS = [
  "opisz pierwsza scene w trzech zdaniach",
  "wymysl rozwiazanie, ktore brzmi zle, ale dziala",
  "nazwij glownego przeciwnika",
  "napisz krotki manifest tej sytuacji",
  "stworz haslo reklamowe dla tego chaosu",
  "wyjasnij, kto ma racje i dlaczego nikt",
  "dopisz brakujacy element ukrytego wzoru",
  "zaproponuj pierwsze prawo tego swiata",
  "wymysl tytul filmu na podstawie tej sceny",
  "opisz, co poszlo nie tak",
  "napisz instrukcje przetrwania",
  "wskaz najbardziej podejrzany szczegol",
  "stworz nazwe tajnej organizacji",
  "opisz finalowy zwrot akcji",
  "napisz jedno zdanie, ktore wszystko komplikuje",
  "wybierz bohatera pobocznego i daj mu cel",
  "wymysl rytual powitalny",
  "opisz, co widzi kamera w pierwszej sekundzie",
  "stworz zasade punktowania",
  "dopisz morał, ale nieoczywisty",
  "napisz dialog dwoch swiadkow",
  "wyjasnij, czemu to ma sens",
  "wymysl ostrzezenie na tabliczce",
  "stworz najgorsza mozliwa porade",
  "opisz misje dla trzech osob",
  "wymysl nagrode za najlepsza odpowiedz",
  "stworz plan ucieczki",
  "napisz opis questa",
  "wybierz symbol tej historii",
  "wymysl absurdalny dowod",
  "stworz zasade, ktora ktos natychmiast zlamie",
  "napisz wiadomosc od bota z przyszlosci",
  "wymysl nazwe eventu",
  "opisz, czego nikt nie powinien dotykac",
  "stworz plot twist w jednym zdaniu",
  "wymysl powod, dla ktorego wszyscy milcza",
  "opisz najdziwniejsza konsekwencje",
  "stworz pytanie, ktore nalezy zadac",
  "napisz najkrotsza legende tego miejsca",
  "wybierz, kto powinien decydowac",
];

const TONES = [
  "jak trailer filmu klasy B",
  "jak notatka z tajnego zebrania",
  "jak legenda miejska",
  "jak ostrzezenie na starym plakacie",
  "jak rozmowa przy automacie z herbata",
  "jak raport po malym koncu swiata",
  "jak instrukcja do gry, ktorej nikt nie kupil",
  "jak przepowiednia z paragonu",
  "jak quest poboczny",
  "jak wpis z dziennika zepsutego bota",
  "jak debata dwoch osob, ktore maja za duzo racji",
  "jak opis eksponatu w muzeum bledow",
  "jak komunikat alarmowy bez alarmu",
  "jak plotka z alternatywnego poniedzialku",
  "jak opis snu po zbyt mocnej herbacie",
  "jak ogloszenie na dworcu dla pomyslow",
  "jak instrukcja BHP dla magii",
  "jak monolog czarnego charakteru bez budzetu",
  "jak recenzja przedmiotu, ktory nie istnieje",
  "jak wiadomosc zostawiona pod wycieraczka",
];

function chooseCategory(rawCategory) {
  const category = String(rawCategory || "random").trim().toLowerCase();
  if (category && category !== "random" && CATEGORY_LABELS[category]) {
    return category;
  }

  return pickRandom(["story", "debate", "challenge", "prophecy", "glitch"]);
}

function buildSeed() {
  return {
    character: pickRandom(CHARACTERS),
    object: pickRandom(OBJECTS),
    place: pickRandom(PLACES),
    problem: pickRandom(PROBLEMS),
    rule: pickRandom(RULES),
    task: pickRandom(TASKS),
    tone: pickRandom(TONES),
    number: randomIntInclusive(3, 99),
  };
}

function buildPromptBody(category, seed) {
  if (category === "debate") {
    return [
      `Czy **${seed.character}** ma moralne prawo uzyc przedmiotu: **${seed.object}**, jesli problemem jest to, ze **${seed.problem}**?`,
      `Zasada sporu: **${seed.rule}**.`,
      `Ton odpowiedzi: ${seed.tone}.`,
      `Zadanie: ${seed.task}.`,
    ];
  }

  if (category === "challenge") {
    return [
      `Wyzwanie: w miejscu **${seed.place}** pojawia sie **${seed.character}** z przedmiotem: **${seed.object}**.`,
      `Problem: **${seed.problem}**.`,
      `Ograniczenie: **${seed.rule}**.`,
      `Zadanie: ${seed.task}.`,
    ];
  }

  if (category === "prophecy") {
    return [
      `Przepowiednia nr ${seed.number}: gdy **${seed.object}** trafi do miejsca **${seed.place}**, **${seed.character}** odkryje, ze **${seed.problem}**.`,
      `Cena przepowiedni: **${seed.rule}**.`,
      `Zadanie: ${seed.task}.`,
    ];
  }

  if (category === "glitch") {
    return [
      `GLITCH_${seed.number}: \`${seed.character} -> ${seed.object} -> ${seed.place} -> ${seed.character} -> ?\``,
      `Blad systemu: **${seed.problem}**.`,
      `Regula ukryta w szumie: **${seed.rule}**.`,
      `Zadanie: ${seed.task}.`,
    ];
  }

  return [
    `W miejscu **${seed.place}** pojawia sie **${seed.character}** i znajduje **${seed.object}**.`,
    `Niestety: **${seed.problem}**.`,
    `Zasada swiata: **${seed.rule}**.`,
    `Styl: ${seed.tone}.`,
    `Zadanie: ${seed.task}.`,
  ];
}

export function buildChaosPrompt(rawCategory = "random") {
  const category = chooseCategory(rawCategory);
  const seed = buildSeed();
  const lines = [
    `**${CATEGORY_LABELS[category]}**`,
    "",
    ...buildPromptBody(category, seed),
    "",
    "_Odpowiedz pod ta wiadomoscia. Najdziwniejsza spojna wersja wygrywa moralnie._",
  ];

  return lines.join("\n");
}

