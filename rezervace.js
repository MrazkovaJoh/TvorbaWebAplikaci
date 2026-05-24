let vybranaChatka = null;

function generateGuests() {
    const adults = parseInt(document.getElementById("adults").value) || 0;
    const children = parseInt(document.getElementById("children").value) || 0;
    const children3 = parseInt(document.getElementById("children3").value) || 0;
    
    const container = document.getElementById("guests");
    container.innerHTML = "";

    for (let i = 1; i <= (adults + children + children3); i++) {
       container.innerHTML += `
<div class="guest-row">
    <h4>Osoba č. ${i}</h4>

    <input type="text" class="guest-jmeno" placeholder="Jméno">
    <input type="text" class="guest-prijmeni" placeholder="Příjmení">
    <input type="date" class="guest-narozeni">
    <input type="text" class="guest-rc" placeholder="Rodné číslo">

    <select class="guest-typ">
        <option value="Dospělý">Dospělý</option>
        <option value="Dítě">Dítě</option>
        <option value="Dítě do 3 let">Dítě do 3 let</option>
    </select>
</div>
`;
    }
}

async function checkAvailability() {
    const od = document.getElementById("from").value;
    const doDatum = document.getElementById("to").value; 
    if (!od || !doDatum) return false;

    try {
        const response = await fetch(`http://localhost:3000/api/check-availability?od=${od}&do=${doDatum}`);
        const result = await response.json();
        if (result.available) {
            vybranaChatka = result.chatkaId;
            return true;
        }
        alert("Obsazeno!"); return false;
    } catch (err) { return false; }
}

document.getElementById("odeslat").addEventListener("click", async () => {
    // Ověření
    const OK = await checkAvailability();
    if (!OK) return;

    // Sběr dat
    const hlavniUdaje = {
        jmeno: document.getElementById("jmeno").value,
        prijmeni: document.getElementById("prijmeni").value,
        email: document.getElementById("email").value,
        telefon: document.getElementById("telefon").value,
        od: document.getElementById("from").value,
        do: document.getElementById("to").value,
        id_chatky: vybranaChatka,
        foodAdults: document.getElementById("adults").value,
        foodChildren: document.getElementById("children").value,
        foodChildren3: document.getElementById("children3").value,
       typStravy: document.getElementById("typStravy").value
    };

    const hoste = [];
    document.querySelectorAll(".guest-row").forEach(row => {
       hoste.push({
    jmeno: row.querySelector(".guest-jmeno").value,
    prijmeni: row.querySelector(".guest-prijmeni").value,
    datum_narozeni: row.querySelector(".guest-narozeni").value,
    rodne_cislo: row.querySelector(".guest-rc").value,
    typ_osoby: row.querySelector(".guest-typ").value
});
    });

    // Odeslání
    const strava = {
    typ: document.getElementById("typStravy").value
};
   const aktivity = [];

document.querySelectorAll(".aktivita").forEach(row => {
    aktivity.push({
        id_aktivity: parseInt(row.querySelector(".aktivita-select").value),
        pocet_hodin: parseInt(row.querySelector(".aktivita-hodiny").value)
    });
});
   try {
    const response = await fetch("http://localhost:3000/api/rezervace-komplet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            hlavniUdaje,
            hoste,
            aktivity,
            strava
        })
    });

        if (response.ok) alert("Hotovo!");
    } catch (err) { alert("Chyba spojení"); }
});

// Inicializace
document.getElementById("adults").addEventListener("change", generateGuests);
document.getElementById("children").addEventListener("change", generateGuests);
document.getElementById("children3").addEventListener("change", generateGuests);
generateGuests();
