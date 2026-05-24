const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');
const { executeQuery } = require('./db'); 

const app = express();

app.use(cors());
app.use(express.json());
// Vypocet ceny
function spocitejPocetNoci(od, doDatum) {
    const d1 = new Date(od);
    const d2 = new Date(doDatum);
    return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}
// API pro kompletni rezervaci
app.post('/api/rezervace-komplet', async (req, res) => {
   const { hlavniUdaje, hoste, aktivity } = req.body;

    try {
        const sqlZakaznik = `
    INSERT INTO Zakaznik (id_zakaznika, jmeno, prijmeni, telefon, email)
    VALUES (zakaznik_seq.NEXTVAL, :jmeno, :prijmeni, :telefon, :email)
    RETURNING id_zakaznika INTO :id
`;

        const resZakaznik = await executeQuery(sqlZakaznik, {
            jmeno: hlavniUdaje.jmeno,
            prijmeni: hlavniUdaje.prijmeni,
            telefon: hlavniUdaje.telefon.replace(/\s+/g, ''), 
            email: hlavniUdaje.email,
            id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        });

        const idZak = resZakaznik.outBinds.id[0];

         const sqlChatka = `
    SELECT cena_za_noc_dospely, cena_za_noc_dite, cena_za_noc_dite_do_tri
    FROM Chatka
    WHERE id_chatky = :id`;

    const chatkaData = await executeQuery(sqlChatka, {
    id: hlavniUdaje.id_chatky
});
            const chatka = chatkaData.rows[0];

        const pocetNoci = spocitejPocetNoci(hlavniUdaje.od, hlavniUdaje.do);

const dospeli = parseInt(hlavniUdaje.foodAdults);
const deti = parseInt(hlavniUdaje.foodChildren);
const deti3 = parseInt(hlavniUdaje.foodChildren3);

let cenaUbytovani =
    pocetNoci * (
        dospeli * chatka.CENA_ZA_NOC_DOSPELY +
        deti * chatka.CENA_ZA_NOC_DITE +
        deti3 * chatka.CENA_ZA_NOC_DITE_DO_TRI
    );
    let cenaAktivity = 0;

for (const aktivita of aktivity) {
    const sql = `SELECT cena FROM Aktivita WHERE id_aktivity = :id`;

    const result = await executeQuery(sql, { id: aktivita.id_aktivity });
    
    const cena = result.rows[0].CENA;
    cenaAktivity += cena * aktivita.pocet_hodin;
}
const sqlStrava = `
    SELECT cena_den_dospely, cena_den_dite, cena_den_dite_do_tri
    FROM Typ_stravy
   WHERE id_typ_stravy = :typ
`;

const stravaData = await executeQuery(sqlStrava, {
    typ: hlavniUdaje.typStravy
});
const strava = stravaData.rows[0];

let cenaStrava =
    pocetNoci * (
        dospeli * strava.CENA_DEN_DOSPELY +
        deti * strava.CENA_DEN_DITE +
        deti3 * strava.CENA_DEN_DITE_DO_TRI
    );
    const celkovaCena = cenaUbytovani + cenaAktivity + cenaStrava;

    const sqlRezervace = `
    INSERT INTO RezervACE
    (
        id_rezervace,
        rezervovano_od,
        rezervovano_do,
        celkova_cena,
        stav_rezervace,
        datum_vytvoreni,
        Zakaznik_id_zakaznika,
        Chatka_id_chatky
    )
    VALUES
    (
        rezervace_seq.NEXTVAL,
        TO_DATE(:od, 'YYYY-MM-DD'),
        TO_DATE(:do, 'YYYY-MM-DD'),
        :cena,
        'Nová',
        SYSDATE,
        :id_zak,
        :id_chat
    )
    RETURNING id_rezervace INTO :id_rez
`;


        const resRezervace = await executeQuery(sqlRezervace, {
            od: hlavniUdaje.od,
            do: hlavniUdaje.do,
            cena: celkovaCena,
            id_zak: idZak,
            id_chat: hlavniUdaje.id_chatky,
            id_rez: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        });

        const idRez = resRezervace.outBinds.id_rez[0];



        for (const host of hoste) {
            const sqlOsoba = `
    INSERT INTO UBYTOVANA_OSOBA
    (
        id_osoba,
        jmeno,
        prijmeni,
        rodne_cislo,
        datum_narozeni,
        typ_osoby,
        Rezervace_id_rezervace
    )
    VALUES
    (
        osoba_seq.NEXTVAL,
        :jmeno,
        :prijmeni,
        :rc,
        TO_DATE(:narozeni, 'YYYY-MM-DD'),
        :typ_osoby,
        :id_rez
    )
`;
            await executeQuery(sqlOsoba, {
    jmeno: host.jmeno,
    prijmeni: host.prijmeni,
    rc: host.rodne_cislo,
    narozeni: host.datum_narozeni,
    typ_osoby: host.typ_osoby,
    id_rez: idRez
});
        }
        for (const aktivita of aktivity) {
    const sqlAktivita = `
    INSERT INTO REZERVACE_AKTIVITY
    (id_rezervace_aktivity, Rezervace_id_rezervace, AKTIVITA_id_aktivity, pocet_hodin)
    VALUES (rez_akt_seq.NEXTVAL, :id_rez, :id_akt, :hodiny)
`;

    await executeQuery(sqlAktivita, {
        id_rez: idRez,
        id_akt: aktivita.id_aktivity,
        hodiny: aktivita.pocet_hodin
    });
}

        res.status(201).json({ message: 'Rezervace a hosté byli úspěšně uloženi!' });

    } catch (err) {
        console.error("Chyba při ukládání rezervace:", err);
        res.status(500).json({ message: 'Chyba databáze', error: err.message });
    }
});

// API pro kontrolu dostupnosti chatek
app.get('/api/check-availability', async (req, res) => {
    const { od, do: doDatum } = req.query;

    if (!od || !doDatum) {
        return res.status(400).json({ message: "Chybí datum" });
    }

    try {
      const sql = `
    SELECT c.id_chatky
    FROM Chatka c
    WHERE NOT EXISTS (
        SELECT 1
        FROM Rezervace r
        WHERE r.Chatka_id_chatky = c.id_chatky
        AND TO_DATE(:od , 'YYYY-MM-DD') < r.rezervovano_do
        AND TO_DATE(:do, 'YYYY-MM-DD') > r.rezervovano_od
    )
`;

        const result = await executeQuery(sql, { od, do: doDatum });
         if (result.rows && result.rows.length > 0) {
            res.json({ 
                available: true, 
                chatkaId: result.rows[0].ID_CHATKY 
            });
        } else {
            res.json({ available: false });
        }
    } catch (err) {
        console.error("DETAIL CHYBY:", err);
        res.status(500).json({ message: "Chyba DB", error: err.message });
    }
});

// Spusteni serveru
app.listen(3000, () => console.log("Backend běží na portu 3000"));