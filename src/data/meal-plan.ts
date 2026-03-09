export interface MealOption {
  items: string[];
  oil?: string;
}

export interface Meal {
  name: string;
  options: MealOption[];
}

export interface DayPlan {
  id: string;
  label: string;
  short: string;
  meals: Meal[];
}

export interface SnackSection {
  name: string;
  options: string[][];
}

export const snacks: SnackSection[] = [
  {
    name: "Pre-Allenamento",
    options: [
      ["1 banana + 15g cioccolato fondente >85% cacao"],
      [
        "1 fetta di pane tostato (circa 30g) + 1 cucchiaino di crema 100% arachidi + 2 cucchiaini di marmellata a ridotto tenore di zuccheri",
      ],
      [
        "1 fetta di pane tostato (circa 30g) + 1 cucchiaio raso di crema 100% arachidi",
        "1 yogurt bianco da bere (es. Actimel)",
      ],
    ],
  },
  {
    name: "Mattino Post-Allenamento",
    options: [
      [
        "80g pane integrale o ai cereali / 5 gallette di riso o altro cereale + 1 cucchiaio colmo di crema 100% arachidi",
      ],
      [
        "80g pane integrale o ai cereali / 5 gallette di riso o altro cereale + 2 cucchiaini di olio EVO a crudo + poco sale + origano",
      ],
      [
        "80g pane integrale o ai cereali / 5 gallette di riso o altro cereale + 30g parmigiano stagionato",
      ],
      [
        "1 yogurt greco 0% bianco (150g) + 2 cucchiaini di miele + 3-4 mandorle/nocciole non pelate + 150g frutti di bosco o frutta di stagione / 30g biscotti secchi spezzettati",
      ],
      [
        "80g pane integrale o ai cereali / 5 gallette di riso o altro cereale + 40g affettato magro (crudo, cotto, fesa di tacchino/pollo, bresaola, speck sgrassato)",
      ],
    ],
  },
  {
    name: "Mattino (no allenamento)",
    options: [
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 50g affettato magro",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso colmo crema 100% arachidi",
      ],
      [
        "1 pacchetto crackers magri (es. Magretti Galbusera) + 13 mandorle/nocciole non pelate",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 2 cucchiaini miele o marmellata + 5g granella mandorle/nocciole",
      ],
      ["1 barretta proteica da circa 200 kcal"],
      ["1 dessert proteico (170-200g) + 1 frutto fresco di stagione"],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso di patè di olive",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso di patè di olive o hummus di ceci",
      ],
      [
        "1 yogurt kefyr bianco da bere (500g; es. Milk) + 15 mandorle/nocciole non pelate",
      ],
      ["1 dessert proteico (170-200g)"],
      ["1 yogurt greco 0% alla frutta (150g)"],
    ],
  },
  {
    name: "Pomeriggio",
    options: [
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 50g affettato magro",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso colmo crema 100% arachidi",
      ],
      [
        "1 pacchetto crackers magri (es. Magretti Galbusera) + 13 mandorle/nocciole non pelate",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 2 cucchiaini miele o marmellata + 5g granella mandorle/nocciole",
      ],
      ["1 barretta proteica da circa 200 kcal"],
      ["1 dessert proteico (170-200g) + 1 frutto fresco di stagione"],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso di patè di olive",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso di patè di olive o hummus di ceci",
      ],
      [
        "1 yogurt kefyr bianco da bere (500g; es. Milk) + 15 mandorle/nocciole non pelate",
      ],
      ["1 dessert proteico (170-200g)"],
      ["1 yogurt greco 0% alla frutta (150g)"],
    ],
  },
];

export const days: DayPlan[] = [
  {
    id: "lun",
    label: "Lunedì",
    short: "Lun",
    meals: [
      {
        name: "Colazione",
        options: [
          {
            items: [
              "2 fette pane integrale (60g) / 4 fette biscottate integrali + velo di yogurt greco 0% bianco spalmato + 4 cucchiaini marmellata a ridotto tenore di zuccheri + 5g granella mandorle/nocciole",
              "1 frutto fresco di stagione",
              "1 tazza di tisana/caffè d'orzo/caffè/tè",
            ],
          },
          {
            items: [
              "2 fette pane integrale (60g) + 1 cucchiaio raso crema 100% arachidi / 1 cucchiaio crema di nocciole (es. Novi, Rigoni di Asiago)",
              "1 frutto fresco di stagione",
              "1 tazza di tisana/caffè d'orzo/caffè/tè",
            ],
          },
        ],
      },
      {
        name: "Pranzo",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "120g riso basmati o pasta al dente o altro cereale (miglio, grano saraceno, quinoa, amaranto, sorgo, teff, cous cous) condito con verdure di stagione in abbondanza + circa 100g fonte proteica (es. 2 scatolette da 80g di tonno al naturale, macinata magra, legumi in scatola)",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "240g ceci/lenticchie in scatola ben sciacquate + circa 100g fonte proteica (es. macinata magra) + verdure a piacimento",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
        ],
      },
      {
        name: "Cena",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "200g carne magra (coniglio, pollo, tacchino, struzzo, faraona) / 200g carne rossa magra (fesa, noce, scamone, girello di vitello, manzo magro) / 250g pesce magro (merluzzo, platessa, spigola, sogliola, orata, trota, rombo)",
              "Verdure a sazietà",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "250g pesce spada fresco / acciughe o aringhe fresche / 200g sgombro fresco / tonno fresco (anche al naturale, già cotti)",
              "Verdure a sazietà",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "mar",
    label: "Martedì",
    short: "Mar",
    meals: [
      {
        name: "Colazione",
        options: [
          {
            items: [
              "1 tazza di tisana/caffè d'orzo/caffè/tè",
              "2 fette di dolce fatto in casa (farina tipo 1/2, integrale, avena o mix) — peso totale circa 80g",
              "1 frutto fresco di stagione",
            ],
          },
          {
            items: [
              "2 fette pane integrale (60g) + velo di ricotta + pomodorini e spezie o aromi a scelta",
              "1 tazza di tisana/caffè d'orzo/caffè/tè",
            ],
          },
        ],
      },
      {
        name: "Pranzo",
        options: [
          {
            oil: "4 cucchiaini olio EVO a crudo o in cottura",
            items: [
              "2 piatti colmi di minestrone di legumi e verdure + 1 cucchiaino parmigiano a piatto",
              "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa",
            ],
          },
          {
            oil: "4 cucchiaini olio EVO a crudo",
            items: [
              "Insalata di patate e piselli: 250g patate (peso a crudo) bollite + 160g piselli + 3 scatolette da 80g di tonno al naturale sgocciolate",
              "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa",
            ],
          },
        ],
      },
      {
        name: "Cena",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "3 uova intere alla coque, in camicia, sode, all'occhio di bue o in frittata con verdure",
              "Verdure a sazietà (prediligi olio sulla verdura)",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "2 cucchiaini olio EVO a crudo",
            items: [
              "Millefoglie di zucchine: zucchine qb + 100g mozzarella light / 100g ricotta + 100g cotto magro o fesa di tacchino + 1 cucchiaio parmigiano grattugiato",
              "Verdure a sazietà (prediligi olio sulla verdura)",
              "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "mer",
    label: "Mercoledì",
    short: "Mer",
    meals: [
      {
        name: "Colazione",
        options: [
          {
            items: [
              "2 fette pane integrale (60g) / 4 fette biscottate integrali + velo di yogurt greco 0% bianco spalmato + 4 cucchiaini marmellata a ridotto tenore di zuccheri + 5g granella mandorle/nocciole",
              "1 frutto fresco di stagione",
              "1 tazza di tè/tisana/caffè/caffè d'orzo",
            ],
          },
          {
            items: [
              "1 tazza di tè/tisana/caffè/caffè d'orzo + 50g biscotti integrali (es. Misura)",
              "8 mandorle/nocciole non pelate + 1 frutto fresco di stagione",
            ],
          },
        ],
      },
      {
        name: "Pranzo",
        options: [
          {
            oil: "2 cucchiaini olio EVO a crudo",
            items: [
              "200g sgombro/salmone al naturale (o fresco bollito/al vapore/al forno) + verdure a scelta + carote/pomodorini + 10g noci secche/pinoli",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Insalatona: verdura a foglia verde + 1 avocado grande a spicchi + 30g olive nere + 100g salmone affumicato + sedano/finocchio/pomodorini/carote/funghi",
              "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa",
            ],
          },
        ],
      },
      {
        name: "Cena",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Hamburger di carne magra: 180g macinata magra (o 200g hamburger dal macellaio, senza parmigiano/uovo) + verdure",
              "Verdure a sazietà (es. zucchine alla piastra)",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "NO olio EVO",
            items: [
              "250g hummus di ceci (es. Fior di Natura, ~180kcal/100g)",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "gio",
    label: "Giovedì",
    short: "Gio",
    meals: [
      {
        name: "Colazione",
        options: [
          {
            items: [
              "1 tazza di tisana/caffè d'orzo",
              "2 fette di dolce fatto in casa (farina tipo 1/2, integrale, avena o mix) — peso totale circa 80g",
              "1 frutto fresco di stagione",
            ],
          },
          {
            items: [
              "1 tazza di tè/tisana/caffè/caffè d'orzo",
              "2 fette pane integrale (60g) / 4 fette biscottate integrali + mezza banana a rondelle + 1 cucchiaino cannella + 1 cucchiaino crema 100% arachidi / 1 cucchiaio crema nocciole",
              "1 frutto fresco di stagione",
            ],
          },
        ],
      },
      {
        name: "Pranzo",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "120g pasta al dente o riso basmati o altro cereale (farro, orzo, miglio, grano saraceno, quinoa, amaranto, sorgo, teff, cous cous) + verdure di stagione + circa 100g fonte proteica (tonno al naturale, affettato magro, salmone affumicato)",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "3 uova intere alla coque, in camicia, sode, all'occhio di bue o in frittata con verdure",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
        ],
      },
      {
        name: "Cena",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo o in cottura",
            items: [
              "Minestra con brodo vegetale o dado (senza glutammato monosodico) con 80g pasta o altro cereale + 60g legumi in scatola",
              "Verdure a sazietà",
            ],
          },
          {
            oil: "2 cucchiaini olio EVO a crudo",
            items: [
              "200g carne magra (coniglio, pollo, tacchino, struzzo, faraona) / 200g carne rossa magra / 250g pesce magro",
              "Verdure a sazietà",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "ven",
    label: "Venerdì",
    short: "Ven",
    meals: [
      {
        name: "Colazione",
        options: [
          {
            items: [
              "2 fette pane integrale (60g) + 1 cucchiaio raso crema 100% arachidi / 1 cucchiaio crema nocciole",
              "1 frutto fresco di stagione",
              "1 tazza di tè/tisana/caffè/caffè d'orzo",
            ],
          },
          {
            items: [
              "2 fette pane integrale (60g) + 50g affettato magro (crudo, cotto, fesa di tacchino/pollo, bresaola)",
              "1 frutto fresco di stagione",
              "1 tazza di tisana/caffè d'orzo/caffè/tè",
            ],
          },
        ],
      },
      {
        name: "Pranzo",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "120g pasta al dente o riso basmati o altro cereale (orzo, miglio, grano saraceno, quinoa, amaranto, sorgo, teff, cous cous) + verdure di stagione + circa 100g fonte proteica (tonno al naturale, affettato magro, salmone affumicato)",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Piadina fatta in casa (100g farina avena/tipo 1/tipo 2/integrale + olio + acqua, oppure integrale da max 350 kcal) farcita con 100g fonte proteica o crema di legumi (80g legumi) + spezie/aromi + verdure / mezzo avocado + yogurt greco 0%",
              "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + formaggio magro spalmabile (es. Exquisa Fitline / Philadelphia Protein)",
            ],
          },
        ],
      },
      {
        name: "Cena",
        options: [
          {
            oil: "2 cucchiaini olio EVO a crudo",
            items: [
              "2 burger vegetali (es. Bio Appetì, Valsoia, Ecor, Kioene, Granarolo seitan e spinaci)",
              "Verdure a sazietà",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "2 cucchiaini olio EVO a crudo",
            items: [
              "4 cotolette di legumi",
              "Verdure a sazietà (prediligi olio sulla verdura)",
              "1 fetta pane integrale (30g) / 2 gallette / 2 fette wasa",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sab",
    label: "Sabato",
    short: "Sab",
    meals: [
      {
        name: "Colazione",
        options: [
          {
            items: [
              "2 fette pane integrale (60g) + velo di ricotta + pomodorini e spezie o aromi a scelta",
              "1 tazza di tisana/caffè d'orzo/caffè/tè",
            ],
          },
          {
            items: [
              "1 tazza di tè/tisana/caffè/caffè d'orzo",
              "1 yogurt greco 0% bianco (150g) + 8 mandorle/nocciole non pelate / 10g cioccolato fondente >85% cacao + 2 cucchiaini miele + 20g fiocchi d'avena o frumento integrale / 20g biscotti integrali spezzettati",
              "1 frutto fresco di stagione",
            ],
          },
        ],
      },
      {
        name: "Pranzo",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "120g riso basmati o pasta al dente o altro cereale (miglio, grano saraceno, quinoa, amaranto, sorgo, teff, cous cous) + verdure di stagione + circa 100g fonte proteica (tonno al naturale, macinata magra, legumi in scatola)",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "240g ceci/lenticchie in scatola ben sciacquate + circa 100g fonte proteica (es. macinata magra) + verdure a piacimento",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
        ],
      },
      {
        name: "Cena",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Pollo al curry: 200g petto di pollo a cubetti marinato con 3 cucchiaini olio, 1 cucchiaio colmo di curry, succo di mezzo limone, pepe e sale. Rosolare in padella, sfumare con vino bianco secco, cuocere 10-15 min. Condire con salsa di yogurt greco 0% e curry",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "2 piatti colmi di vellutata o zuppa di verdure (~100-150 kcal/100g) + 250g gamberi o mazzancolle sgusciati cotti in padella o piastra",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "dom",
    label: "Domenica",
    short: "Dom",
    meals: [
      {
        name: "Colazione",
        options: [
          {
            items: ["Qualsiasi colazione tra quelle presenti nel piano"],
          },
        ],
      },
      {
        name: "Pranzo",
        options: [
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "200g petto di pollo o altra carne magra / 200g carne rossa magra / 250g pesce magro",
              "Verdure a sazietà",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Insalatona: lattuga/indivia + rucola/radicchio + sedano/finocchio + 1 scatoletta 80g tonno sgocciolata + 100g mozzarella light",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "150g fesa di tacchino o pollo / bresaola con rucola/valeriana/songino + carote/funghi",
            ],
          },
        ],
      },
      {
        name: "Spuntino",
        options: [
          {
            items: [
              "Evita lo spuntino a metà mattina",
              "1 frutto fresco di stagione / 150g carote crude / 2 fette biscottate ai cereali / 8 mandorle o nocciole non pelate",
            ],
          },
        ],
      },
      {
        name: "Cena (libera)",
        options: [
          {
            items: ["1 pizza + birra piccola"],
          },
          {
            items: [
              "Antipasti di carne/pesce + al max 1 fetta di pane",
              "Secondo di carne/pesce",
              "Verdure",
            ],
          },
        ],
      },
    ],
  },
];
