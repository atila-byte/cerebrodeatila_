// antropometria.js

// Define a data da consulta como o dia atual automaticamente ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    const visitInput = document.getElementById('ped-visit');
    if (visitInput) visitInput.valueAsDate = new Date();
});

function runCalculoZ() {
    if (typeof window.OMS_TABLES === 'undefined') {
        alert("Erro: Banco de dados OMS não carregado.");
        return;
    }
    const dob = new Date(document.getElementById('ped-dob').value);
    const visit = new Date(document.getElementById('ped-visit').value);
    const sex = document.getElementById('ped-sex').value;
    const w = parseFloat(document.getElementById('ped-w').value);
    const h = parseFloat(document.getElementById('ped-h').value);
    const hc = parseFloat(document.getElementById('ped-hc').value);

    if (dob >= visit) { alert("Data de nascimento inválida."); return; }

    const diffDays = Math.floor((visit - dob) / 86400000);
    const diffMonths = diffDays / 30.4375;
    const y = Math.floor(diffDays / 365.25);
    const m = Math.floor((diffDays % 365.25) / 30.4375);
    const d = Math.floor((diffDays % 365.25) % 30.4375);
    document.getElementById('ped-age-display').innerText = `${y} anos, ${m} meses e ${d} dias`;

    const isOver5 = diffDays > 1856;
    const getParams = (key, t) => {
        const tbl = window.OMS_TABLES[key];
        if(!tbl) return null;
        const k = Math.floor(t).toString();
        const d = tbl[k] || tbl[Object.keys(tbl).pop()];
        return {L:d[0], M:d[1], S:d[2]};
    };
    const calc = (val, p) => p ? ((Math.pow(val/p.M, p.L)-1)/(p.L*p.S)) : null;

    let html = "";
    const wTab = isOver5 ? `WFA_${sex}_5_10` : `WFA_${sex}`;
    html += zCard("Peso/Idade", calc(w, getParams(wTab, isOver5?diffMonths:diffDays)), 'wfa');
    
    const hTab = isOver5 ? `HFA_${sex}_5_19` : `LHFA_${sex}`;
    html += zCard("Estatura/Idade", calc(h, getParams(hTab, isOver5?diffMonths:diffDays)), 'hfa');
    
    const bmi = w/((h/100)**2);
    const bTab = isOver5 ? `BFA_${sex}_5_19` : `BFA_${sex}`;
    html += zCard("IMC/Idade", calc(bmi, getParams(bTab, isOver5?diffMonths:diffDays)), 'bmi');

    if(hc && !isOver5) html += zCard("Perímetro Cefálico", calc(hc, getParams(`HCFA_${sex}`, diffDays)), 'hc');

    document.getElementById('ped-zscore-results').innerHTML = html;
    document.getElementById('ped-res-area').style.display = 'block';
}

function zCard(t, z, type) {
    if(z===null || isNaN(z)) return "";
    let l="", c="c-green";
    if(type==='wfa'){ if(z<-3){l="Muito baixo peso";c="c-red"} else if(z<-2){l="Baixo peso";c="c-orange"} else if(z>2){l="Peso elevado";c="c-orange"} else l="Peso adequado"; }
    else if(type==='hfa'){ if(z<-3){l="Muito baixa est.";c="c-red"} else if(z<-2){l="Baixa est.";c="c-orange"} else l="Adequada"; }
    else if(type==='bmi'){ if(z<-3){l="Magreza acentuada";c="c-red"} else if(z<-2){l="Magreza";c="c-orange"} else if(z<=1) l="Eutrofia"; else if(z<=2){l="Risco sobrepeso";c="c-orange"} else if(z<=3){l="Sobrepeso";c="c-orange"} else {l="Obesidade";c="c-red"} }
    else { if(z<-2){l="Microcefalia";c="c-red"} else if(z>2){l="Macrocefalia";c="c-red"} else l="Adequado"; }
    return `<div class="z-result-card ${c}"><div class="z-info"><span class="z-title">${t}</span><span class="z-val">Z: ${z.toFixed(2)}</span></div><div class="z-tag">${l}</div></div>`;
}