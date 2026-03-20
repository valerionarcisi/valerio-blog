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
        "1 yogurt greco 0% bianco (150g) + 2 cucchiaini di miele + 3-4 mandorle/nocciole non pelate + 150g frutti di bosco o frutta di stagione / 30g biscotti secchi (es. 6 oro saiwa / 3 osvego) spezzettati",
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
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 2 cucchiaini miele o marmellata a ridotto tenore di zuccheri + 5g granella mandorle/nocciole",
      ],
      ["1 barretta proteica da circa 200 kcal"],
      [
        "1 dessert proteico (170-200g; es. Milk, Milbona, Stuffer) + 1 frutto fresco di stagione",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso di patè di olive",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso di patè di olive o hummus di ceci",
      ],
      [
        "1 yogurt kefyr bianco da bere (500g; es. Milk) + 15 mandorle/nocciole non pelate",
      ],
      ["1 dessert proteico (170-200g; es. Milk, Milbona, Dolciando, Stuffer)"],
      ["1 yogurt greco 0% alla frutta (150g; es. fage, pathos, delta)"],
    ],
  },
  {
    name: "Pomeriggio",
    options: [
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 50g affettato magro (crudo, cotto, fesa di tacchino/pollo, bresaola)",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso colmo crema 100% arachidi",
      ],
      [
        "1 pacchetto crackers magri (es. Magretti Galbusera) + 13 mandorle/nocciole non pelate",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 2 cucchiaini miele o marmellata a ridotto tenore di zuccheri + 5g granella mandorle/nocciole",
      ],
      ["1 barretta proteica da circa 200 kcal"],
      [
        "1 dessert proteico (170-200g; es. milk, milbona, stuffer) + 1 frutto fresco di stagione",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso di patè di olive",
      ],
      [
        "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa + 1 cucchiaio raso di patè di olive o hummus di ceci",
      ],
      [
        "1 yogurt kefyr bianco da bere (500g; es. Milk) + 15 mandorle/nocciole non pelate",
      ],
      ["1 dessert proteico (170-200g; es. Milk, Milbona, Dolciando, Stuffer)"],
      ["1 yogurt greco 0% alla frutta (150g; es. fage, pathos, delta)"],
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
              "2 fette pane integrale (60g) / 4 fette biscottate integrali + velo di yogurt greco 0% bianco spalmato al posto del burro + 4 cucchiaini marmellata a ridotto tenore di zuccheri + 5g granella mandorle/nocciole",
              "1 frutto fresco di stagione",
              "1 tazza di tisana/caffè d'orzo/caffè/tè",
            ],
          },
          {
            items: [
              "2 fette pane integrale (60g) + 1 cucchiaio raso crema 100% arachidi / 1 cucchiaio raso crema di nocciole (es. Novi, Rigoni di Asiago)",
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
              "120g riso basmati o pasta al dente o altro cereale (miglio, grano saraceno, quinoa, amaranto, sorgo, teff, cous cous) condito con verdure di stagione in abbondanza + circa 100g fonte proteica (es. 2 scatolette da 80g di tonno al naturale ben sgocciolate, macinata magra, legumi in scatola ben sciacquati)",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "240g ceci/lenticchie in scatola ben sciacquate condite con circa 100g di fonte proteica (es. macinata magra) + verdure a piacimento",
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
              "200g carne magra (coniglio, pollo, tacchino, struzzo, faraona) / 200g carne rossa magra (fesa, noce, scamone, girello di vitello, manzo magro, bufalo) / 250g pesce magro (merluzzo, platessa, spigola, sogliola, persico, cernia, orata, trota, rombo)",
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
            oil: "4 cucchiaini olio EVO a crudo",
            items: [
              "Insalatona con verdure a foglia verde (lattuga, indivia, scarola, iceberg, rucola, valeriana) + 3 scatolette da 80g di tonno al naturale ben sgocciolate / 150g petto di pollo alla piastra a striscioline + sedano/finocchio/valeriana + carote o pomodorini a piacimento + 1 cucchiaio di semi di lino/zucca/girasole",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "4 cucchiaini olio EVO a crudo",
            items: [
              "Insalata di patate e piselli: 250g patate (peso a crudo) bollite + 160g piselli + 3 scatolette da 80g di tonno al naturale ben sgocciolate",
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
              "3 uova intere alla coque o in camicia (più digeribili) o sode o all'occhio di bue o in frittata con verdure a piacimento",
              "Verdure a sazietà (prediligi i cucchiaini di olio sulla verdura)",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "2 cucchiaini olio EVO a crudo",
            items: [
              "Millefoglie di zucchine: zucchine qb + 100g mozzarella light (Galbani Santa Lucia o Granarolo da 100g) / 100g ricotta (Vallelata ricottina da 100g) + 100g cotto magro o fesa di tacchino + 1 cucchiaio di parmigiano grattugiato",
              "Verdure a sazietà (prediligi i cucchiaini di olio sulla verdura)",
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
              "2 fette pane integrale (60g) / 4 fette biscottate integrali + velo di yogurt greco 0% bianco spalmato al posto del burro + 4 cucchiaini marmellata a ridotto tenore di zuccheri + 5g granella mandorle/nocciole",
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
              "200g sgombro/salmone al naturale (es. Nixe, Ondina, Riomare cotto al vapore, circa 110g sgocciolato a confezione) o sgombro/salmone fresco bollito o al vapore o al forno + verdure a scelta (rucola, valeriana, lattuga, iceberg) + carote/pomodorini + 10g noci secche/pinoli",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Insalatona: verdura a foglia verde + 1 avocado grande a spicchi + 30g olive nere + 100g salmone affumicato + sedano/finocchio/pomodorini/carote/funghi a piacimento",
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
              "Hamburger di carne magra: 180g macinata magra o bianca magra, aggiunta al max di albume come amalgama + verdure (oppure dal macellaio di fiducia acquista 200g hamburgers di carne magra, meglio senza parmigiano o uovo, puoi prenderli anche con verdure o spezie o aromi aggiunti)",
              "Verdure a sazietà (es. zucchine alla piastra)",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "2 cucchiaini olio EVO a crudo",
            items: [
              "Caprese con 100g mozzarella light (Galbani Santa Lucia o Granarolo da 100g) + 2 scatolette da 80g di tonno al naturale ben sgocciolata + verdure a scelta",
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
              "2 fette pane integrale (60g) / 4 fette biscottate integrali + mezza banana a rondelle + 1 cucchiaino di cannella + 1 cucchiaino raso crema 100% arachidi / 1 cucchiaio raso crema di nocciole (es. Rigoni di Asiago / Novi)",
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
              "120g pasta al dente o riso basmati o altro cereale (farro, orzo, miglio, grano saraceno, quinoa, amaranto, sorgo, teff, cous cous) condito con verdure di stagione in abbondanza + circa 100g fonte proteica (es. 2 scatolette da 80g di tonno al naturale ben sgocciolate, affettato magro, salmone affumicato)",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "3 uova intere alla coque o in camicia (più digeribili) o sode o all'occhio di bue o in frittata con verdure a piacimento",
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
              "Pollo al curry: 200g petto di pollo a cubetti marinato con 3 cucchiaini di olio, 1 cucchiaio colmo di curry, succo di mezzo limone, pepe e sale. Lasciare in macera almeno un'ora. Rosolare in padella, sfumare con vino bianco secco, cuocere 10-15 min. Salsa: yogurt greco 0% bianco con cucchiaio di curry",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "2 cucchiaini olio EVO a crudo",
            items: [
              "200g carne magra (coniglio, pollo, tacchino, struzzo, faraona) / 200g carne rossa magra (fesa, noce, scamone, girello di vitello, manzo magro, bufalo) / 250g pesce magro (merluzzo, platessa, spigola, sogliola, persico, cernia, orata, trota, rombo)",
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
              "2 fette pane integrale o ai cereali (60g) + 1 cucchiaio raso crema 100% arachidi / 1 cucchiaio raso crema di nocciole (es. Novi, Rigoni di Asiago)",
              "1 frutto fresco di stagione",
              "1 tazza di tè/tisana/caffè/caffè d'orzo",
            ],
          },
          {
            items: [
              "2 fette pane integrale (60g) + 50g affettato magro (crudo, cotto magro, fesa di tacchino/pollo, bresaola)",
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
              "120g pasta al dente o riso basmati o altro cereale (orzo, miglio, grano saraceno, quinoa, amaranto, sorgo, teff, cous cous) condito con verdure di stagione in abbondanza + circa 100g fonte proteica (es. 2 scatolette da 80g di tonno al naturale ben sgocciolate, affettato magro, salmone affumicato)",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Piadina fatta in casa con 100g farina di avena o tipo 1 o tipo 2 o integrale o mix + olio + acqua qb per rendere l'impasto malleabile (oppure acquistane direttamente integrale da max 350 kcal); farcita con 100g fonte proteica (affettato magro, gamberetti, tonno al naturale) o crema di legumi con 80g legumi in scatola ben sciacquati + spezie/aromi + verdure di stagione o con mezzo avocado e yogurt greco 0%",
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
              "2 burger vegetali (es. Bio Appetì lupino agli spinaci, Valsoia burger vegetali, Ecor spinaci piselli ed avena, Kioene burger vegetale alle melanzane, Granarolo seitan e spinaci)",
              "Verdure a sazietà (da accompagnare ai burgers)",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            items: [
              "240g ceci in scatola ben sciacquati sopra ai finocchi cotti e consuma assieme (senza aggiungere ulteriore olio)",
              "Finocchi gratinati: 300g finocchi, 60g pan grattato, 1 cucchiaio di parmigiano grattugiato, 1 cucchiaio di olio. Tagliare i finocchi a fette, aggiungere spezie, parmigiano e pangrattato. Forno ventilato 190°C per 35-40 min",
              "2 fette pane integrale (60g) / 4 gallette / 4 fette wasa",
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
              "1 yogurt greco 0% bianco (150g) + 8 mandorle/nocciole non pelate / 10g cioccolato fondente >85% cacao + 2 cucchiaini miele + 20g fiocchi d'avena o frumento integrale / 20g biscotti integrali (es. Misura) spezzettati",
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
              "120g riso basmati o pasta al dente o altro cereale (miglio, grano saraceno, quinoa, amaranto, sorgo, teff, cous cous) condito con verdure di stagione in abbondanza + circa 100g fonte proteica (es. 2 scatolette da 80g di tonno al naturale ben sgocciolate, macinata magra, legumi in scatola ben sciacquati)",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "240g ceci/lenticchie in scatola ben sciacquate condite con circa 100g di fonte proteica (es. macinata magra) + verdure a piacimento",
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
              "100g salmone affumicato + 4 cucchiai di formaggio magro spalmabile (es. Exquisa Fitline / Philadelphia Protein) con una manciata di olive nere e valeriana/songino",
              "Verdure a sazietà",
              "3 fette pane integrale (90g) / 6 gallette / 6 fette wasa",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Polpette di broccoli: 250g broccoli, 40g pan grattato, 1 cucchiaio farina di ceci, 1 spicchio aglio tritato o mezzo cucchiaino in polvere, prezzemolo ed erbe a piacere, sale, pepe, 1 cucchiaio olio EVO. Cuocere broccoli al vapore 6-8 min, schiacciare grossolanamente, mescolare con gli ingredienti. Forno 190°C per 25-30 min o padella 3-4 min per lato",
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
              "200g petto di pollo o altra carne magra (tacchino, coniglio) / 200g carne rossa magra (fesa, noce, scamone, girello di bovino, manzo magro) / 250g pesce magro (merluzzo, platessa, spigola, sogliola, cernia, persico, orata)",
              "Verdure a sazietà",
            ],
          },
          {
            oil: "3 cucchiaini olio EVO a crudo",
            items: [
              "Insalatona con lattuga/indivia + rucola/radicchio + sedano/finocchio + 1 scatoletta da 80g tonno al naturale ben sgocciolata + 100g mozzarella light (es. Granarolo o Galbani Santa Lucia da 100g)",
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
