let rules = [];
let symptoms = {};
let dataLoaded = false;


async function loadData() {
  try {
    const [rulesRes, symRes] = await Promise.all([
      fetch("rules.json"),
      fetch("symptoms.json")
    ]);

    if (!rulesRes.ok || !symRes.ok) {
      throw new Error("Gagal memuat file JSON. Periksa path atau server.");
    }

    rules = await rulesRes.json();
    symptoms = await symRes.json();

    buildSymptomList();
    dataLoaded = true;
    document.getElementById("diagnose").disabled = false;
  } catch (err) {
    console.error(err);
    alert("Terjadi kesalahan saat memuat data: " + err.message);
  }
}

function buildSymptomList() {
  const symList = document.getElementById("symList");
  symList.innerHTML = "";

  Object.keys(symptoms).forEach(id => {
    const s = symptoms[id];
    const text = s.text || "(tidak ada deskripsi)";

    const el = document.createElement("div");
    el.className = "sym-item";
    el.innerHTML = `
      <div>
        <input type="checkbox" id="chk_${id}">
        <label for="chk_${id}"><b>${id}</b> - ${text}</label>
      </div>
      <div class="confidence-options" id="conf_${id}" style="display:none;">
        <label>Tingkat Keyakinan:
          <select id="opt_${id}">
            <option value="0.2">0.2 - Tidak yakin</option>
            <option value="0.4">0.4 - Sedikit yakin</option>
            <option value="0.6">0.6 - Cukup yakin</option>
            <option value="0.8">0.8 - Yakin</option>
            <option value="1.0" selected>1.0 - Sangat yakin</option>
          </select>
        </label>
      </div>
    `;
    symList.appendChild(el);

    document.getElementById(`chk_${id}`).addEventListener("change", e => {
      document.getElementById(`conf_${id}`).style.display = e.target.checked ? "block" : "none";
    });
  });

  document.getElementById("selectAll").onclick = () => {
    Object.keys(symptoms).forEach(id => {
      document.getElementById(`chk_${id}`).checked = true;
      document.getElementById(`conf_${id}`).style.display = "block";
    });
  };

  document.getElementById("clearAll").onclick = () => {
    Object.keys(symptoms).forEach(id => {
      document.getElementById(`chk_${id}`).checked = false;
      document.getElementById(`conf_${id}`).style.display = "none";
    });
    document.getElementById("output").innerHTML = "Belum ada diagnosa.";
  };

  document.getElementById("diagnose").onclick = diagnose;
}

function cf_basic(symId) {
  const s = symptoms[symId];
  if (!s) return 0;
  return (s.MB || 0) - (s.MD || 0);
}

function combineCF(cf1, cf2) {
  if (cf1 === null) return cf2;
  if (cf2 === null) return cf1;
  cf1 = Number(cf1);
  cf2 = Number(cf2);
  return cf1 + cf2 * (1 - cf1);
}

function diagnose() {
  if (!dataLoaded) {
    alert("Data belum dimuat sepenuhnya.");
    return;
  }

  const selected = {};
  Object.keys(symptoms).forEach(id => {
    const checkbox = document.getElementById(`chk_${id}`);
    const opt = document.getElementById(`opt_${id}`);
    if (checkbox && checkbox.checked) {
      selected[id] = Number(opt.value);
    }
  });

  const results = [];

  rules.forEach(rule => {
    let cfCombined = null;
    const matchedSymptoms = [];

    rule.if.forEach(symId => {
      if (selected[symId]) {
        const cfExpert = cf_basic(symId);
        const cfUser = selected[symId];
        const cfResult = cfExpert * cfUser;

        cfCombined = combineCF(cfCombined, cfResult);
        matchedSymptoms.push({
          id: symId,
          cfExpert: cfExpert.toFixed(2),
          cfUser: cfUser.toFixed(2),
          cfResult: cfResult.toFixed(2)
        });
      }
    });

    if (cfCombined !== null) {
      results.push({
        ruleId: rule.id,
        disease: rule.then,
        CF_final: cfCombined,
        symptoms: matchedSymptoms
      });
    }
  });

  const out = document.getElementById("output");
  if (!results.length) {
    out.innerHTML = "<i>Tidak ditemukan penyakit berdasarkan gejala yang dipilih.</i>";
    return;
  }

  results.sort((a, b) => b.CF_final - a.CF_final);

  let html = "<b>Hasil Diagnosis:</b><br><br>";
  results.forEach(r => {
    html += `
      <div class="disease">
        <b>${r.disease}</b> — 
        CF Akhir = ${(r.CF_final * 100).toFixed(2)}%
        <span class="small">(Total CF: ${r.CF_final.toFixed(4)})</span>
        <div class="small">Aturan: ${r.ruleId}</div>
        <ul>
          ${r.symptoms.map(s => `
            <li>${s.id} → CF pakar: ${s.cfExpert}, User: ${s.cfUser}, Hasil: ${s.cfResult}</li>
          `).join("")}
        </ul>
      </div>
    `;
  });

  const [bestDisease, bestCF] = [results[0].disease, results[0].CF_final];
  html += `
    <br><b>Diagnosis Akhir:</b> Kemungkinan terbesar adalah 
    <b>${bestDisease}</b> dengan tingkat keyakinan 
    <b>${(bestCF * 100).toFixed(2)}%</b>
    <span class="small">(Total CF: ${bestCF.toFixed(4)})</span>.
  `;

  out.innerHTML = html;
}

loadData();
