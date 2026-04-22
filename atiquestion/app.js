// Utilitário: Riscar alternativa (Tachar) e desmarcar se estiver selecionada
function toggleRisco(buttonElement) {
    const alternativaItem = buttonElement.closest('.alternativa-item');
    alternativaItem.classList.toggle('tachado');
    
    // Se a opção acabou de ser tachada, verifica se estava marcada e desmarca
    if (alternativaItem.classList.contains('tachado')) {
        const radio = alternativaItem.querySelector('input[type="radio"]');
        if (radio.checked) {
            radio.checked = false;
            radio.setAttribute('data-checked', 'false');
        }
    }
}

// Função para embaralhar um array (Fisher-Yates Shuffle)
function embaralharArray(array) {
    let arrayCopia = [...array]; // Cria uma cópia para não alterar o banco original
    for (let i = arrayCopia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arrayCopia[i], arrayCopia[j]] = [arrayCopia[j], arrayCopia[i]]; // Troca os elementos
    }
    return arrayCopia;
}

// Variável global para rastrear se o tempo acabou
let tempoEsgotado = false;

// Utilitário: Permitir desmarcar o input radio e rastrear tempo
function handleRadioClick(radio) {
    if (radio.getAttribute('data-checked') === 'true') {
        radio.checked = false;
        radio.setAttribute('data-checked', 'false');
        radio.removeAttribute('data-fora-tempo');
    } else {
        document.querySelectorAll(`input[name="${radio.name}"]`).forEach(r => {
            r.setAttribute('data-checked', 'false');
            r.removeAttribute('data-fora-tempo');
        });
        radio.setAttribute('data-checked', 'true');
        
        // Se o tempo esgotou e ele respondeu agora, marcamos a resposta
        if (tempoEsgotado) {
            radio.setAttribute('data-fora-tempo', 'true');
        }
    }
}

// ---- SISTEMA DE MEMÓRIA (LOCAL STORAGE) ----
let favoritos = JSON.parse(localStorage.getItem('ati_favoritos')) || [];
let estatisticas = JSON.parse(localStorage.getItem('ati_estatisticas')) || {};

// Utilitário: Renderizar HTML de uma questão
function gerarHTMLQuestao(q, modoSimulado = false) {
    let isFav = favoritos.includes(q.id);
    let favIcon = isFav ? '❤️' : '🤍'; // Coração cheio se for favorito

    let html = `
    <div class="card questao-card" id="q-${q.id}">
        <div class="questao-header" style="display:flex; justify-content:space-between; align-items:center;">
            
            <span>${q.especialidade} | ${q.tema} (${q.prova} - ${q.ano})</span>
            
            <div style="display:flex; align-items:center;">
                <span id="badge-${q.id}" class="badge-nota" style="display:none;"></span>
                <button class="btn-icon" onclick="toggleFavorito('${q.id}', this)" title="Adicionar/Remover do Caderno de Erros">${favIcon}</button>
            </div>
        </div>
        <div class="enunciado">${q.enunciado}</div>
        <ul class="alternativas">`;
    
    // Embaralha as alternativas antes de as desenhar
    let alternativasEmbaralhadas = embaralharArray(q.alternativas);
    const letras = ['A', 'B', 'C', 'D', 'E']; // Letras para manter a ordem visual bonita

    alternativasEmbaralhadas.forEach((alt, index) => {
        let letraAtual = letras[index]; // Força a ficar sempre A, B, C, D
        
        html += `
            <li class="alternativa-item" data-id="${alt.id}" data-correta="${alt.correta}">
                <button class="btn-riscar" onclick="toggleRisco(this)" title="Riscar/Descartar" type="button">✂️</button>
                <div style="flex-grow: 1;">
                    <label style="font-weight: normal; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                        <input type="radio" name="resposta-${q.id}" value="${alt.id}" onclick="handleRadioClick(this)">
                        <span class="alt-texto"><strong>${letraAtual})</strong> ${alt.texto}</span>
                    </label>
                    <div class="resolucao-alt" style="display:none; margin-top: 10px;">${alt.resolucao}</div>
                </div>
            </li>`;
    });

    html += `</ul>`;
    
    if (!modoSimulado) {
        html += `<button type="button" onclick="mostrarResolucao('${q.id}')" style="margin-top: 15px;" id="btn-resp-${q.id}">Responder</button>`;
    }

    html += `
        <div class="resolucao-container" id="res-${q.id}">
            <h4>Resolução Geral:</h4>
            <div class="resolucao-geral">${q.resolucaoGeral}</div>
        </div>
    </div>`;
    
    return html;
}

// Utilitário: Revelar resolução e pintar alternativas
function mostrarResolucao(questaoId) {
    const card = document.getElementById(`q-${questaoId}`);
    const resContainer = document.getElementById(`res-${questaoId}`);
    const itens = card.querySelectorAll('.alternativa-item');
    const questaoNoBanco = window.bancoDeQuestoes.find(q => q.id === questaoId);
    let acertou = false;
    let respondeu = false;
    
    itens.forEach(item => {
        const radio = item.querySelector('input[type="radio"]');
        if (item.getAttribute('data-correta') === 'true') {
            item.classList.add('alt-correta');
        } else {
            if (radio.checked) {
                item.classList.add('alt-errada');
            }
        }
        
        if (radio.checked) {
            respondeu = true;
            if (item.getAttribute('data-correta') === 'true') acertou = true;
        }

        item.querySelector('.resolucao-alt').style.display = 'block';
        radio.disabled = true; // Trava a opção
    });

    // Registra estatística APENAS se o usuário marcou uma opção
    if (respondeu) {
        salvarEstatistica(questaoNoBanco.especialidade, acertou);
    }
    
    // Esconde o botão de responder
    const btnResponder = document.getElementById(`btn-resp-${questaoId}`);
    if (btnResponder) btnResponder.style.display = 'none';

    resContainer.classList.add('ativa');
}

// ---- LÓGICA DO SIMULADO ----
let timerInterval;
let simuladoAtivo = false;

function iniciarSimulado() {
    const numQ = document.getElementById('num-questoes').value;
    const tempo = document.getElementById('tempo').value;
    const autoEncerra = document.getElementById('auto-encerra').checked;
    
    if (!numQ) { alert('Selecione o número de questões!'); return; }

    tempoEsgotado = false; 
    let questoesEmbaralhadas = [...window.bancoDeQuestoes].sort(() => 0.5 - Math.random());
    let selecionadas = questoesEmbaralhadas.slice(0, numQ);

    const container = document.getElementById('simulado-area');
    
    // Motor de Renderização Otimizado
    let htmlSimulado = '';
    selecionadas.forEach(q => {
        htmlSimulado += gerarHTMLQuestao(q, true);
    });

    htmlSimulado += `<button id="btn-finalizar-simulado" onclick="finalizarSimulado()" style="margin-top:20px; background:var(--secondary);">Finalizar Simulado</button>`;
    
    container.innerHTML = htmlSimulado;

    if (tempo > 0) {
        iniciarTimer(tempo * 60, autoEncerra);
    }
    document.getElementById('setup-simulado').style.display = 'none';
}

function iniciarTimer(segundosTotais, autoEncerra) {
    const timerDiv = document.createElement('div');
    timerDiv.className = 'timer-fixed';
    timerDiv.id = 'timer-display';
    document.body.appendChild(timerDiv);

    let tempoRestante = segundosTotais;
    
    timerInterval = setInterval(() => {
        let min = Math.floor(tempoRestante / 60);
        let seg = tempoRestante % 60;
        timerDiv.innerText = `${min}:${seg < 10 ? '0'+seg : seg}`;
        
        // Alerta de 5 minutos (300 segundos)
        if (tempoRestante <= 300 && tempoRestante > 0) {
            timerDiv.style.color = "#f59e0b"; 
            timerDiv.style.borderColor = "#f59e0b";
        }
        
        // Quando o tempo zera de fato
        if (tempoRestante <= 0) {
            clearInterval(timerInterval);
            timerDiv.innerText = "Tempo Esgotado!";
            timerDiv.style.color = "var(--wrong)"; // Fica vermelho
            timerDiv.style.borderColor = "var(--wrong)";
            tempoEsgotado = true;
            
            if (autoEncerra) {
                finalizarSimulado(true);
            }
        }
        tempoRestante--;
    }, 1000);
}

function finalizarSimulado(forcadoPeloTempo = false) {
    clearInterval(timerInterval);
    const questoes = document.querySelectorAll('.questao-card');
    let acertos = 0;

    questoes.forEach(card => {
        const qId = card.id.replace('q-', '');
        mostrarResolucao(qId);
        
        const selecionada = card.querySelector('input[type="radio"]:checked');
        const badge = document.getElementById(`badge-${qId}`);
        badge.style.display = 'inline-block';

        if (!selecionada) {
            badge.textContent = "Não respondida";
            badge.className = "badge-nota nota-neutra";
        } else {
            const isForaDeTempo = selecionada.getAttribute('data-fora-tempo') === 'true';
            const item = selecionada.closest('.alternativa-item');
            const isCorreta = item.getAttribute('data-correta') === 'true';

            if (isForaDeTempo) {
                badge.textContent = "Respondida fora de tempo";
                badge.className = "badge-nota nota-aviso";
            } else if (isCorreta) {
                badge.textContent = "1/1";
                badge.className = "badge-nota nota-correta";
                acertos++;
            } else {
                badge.textContent = "0/1";
                badge.className = "badge-nota nota-errada";
            }
        }
    });

    const percentual = Math.round((acertos / questoes.length) * 100);
    
    const painelResultado = document.createElement('div');
    painelResultado.className = 'card';
    painelResultado.style.textAlign = 'center';
    painelResultado.style.borderTop = '5px solid var(--primary)';
    painelResultado.innerHTML = `
        <h2 style="color: var(--primary);">Resultado do Simulado</h2>
        <p style="font-size: 1.2rem; margin-top: 10px;">Você acertou <strong>${acertos}</strong> de <strong>${questoes.length}</strong> questões.</p>
        <h1 style="font-size: 3rem; color: var(--text-main); margin: 10px 0;">${percentual}%</h1>
    `;
    const container = document.getElementById('simulado-area');
    container.insertBefore(painelResultado, container.firstChild);

    const btnFinalizar = document.getElementById('btn-finalizar-simulado');
    if (btnFinalizar) btnFinalizar.remove();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- LÓGICA DO BANCO DE QUESTÕES (SISTEMA DE TAGS E CASCATA) ----

let filtrosAtivos = {
    especialidade: [],
    tema: [],
    prova: [],
    ano: []
};

function popularFiltros() {
    if (!window.bancoDeQuestoes || window.bancoDeQuestoes.length === 0) return;

    const especialidades = [...new Set(window.bancoDeQuestoes.map(q => q.especialidade))].sort();
    const provas = [...new Set(window.bancoDeQuestoes.map(q => q.prova))].sort();
    const temas = [...new Set(window.bancoDeQuestoes.map(q => q.tema))].sort();

    preencherSelect('filtro-especialidade', especialidades);
    preencherSelect('filtro-prova', provas);
    preencherSelect('filtro-tema', temas);
}

function adicionarTag(tipo, valor) {
    if (valor === "") return; 

    if (!filtrosAtivos[tipo].includes(valor)) {
        filtrosAtivos[tipo].push(valor);
        renderizarTags();
        
        if (tipo === 'especialidade') atualizarFiltroTema();
        if (tipo === 'prova') atualizarFiltroAno();
    }
    
    const select = document.getElementById(`filtro-${tipo}`);
    if(select) select.value = "";
}

function removerTag(tipo, valor) {
    filtrosAtivos[tipo] = filtrosAtivos[tipo].filter(v => v !== valor);
    renderizarTags();
    
    if (tipo === 'especialidade') atualizarFiltroTema();
    if (tipo === 'prova') atualizarFiltroAno();
}

function renderizarTags() {
    const container = document.getElementById('tags-filtros');
    if (!container) return;
    
    container.innerHTML = '';
    const nomesTipos = { especialidade: 'Especialidade', tema: 'Tema', prova: 'Prova', ano: 'Ano' };

    Object.keys(filtrosAtivos).forEach(tipo => {
        filtrosAtivos[tipo].forEach(valor => {
            const tag = document.createElement('div');
            tag.className = 'filter-tag';
            tag.innerHTML = `${nomesTipos[tipo]}: ${valor} <span onclick="removerTag('${tipo}', '${valor}')" title="Remover filtro">✖</span>`;
            container.appendChild(tag);
        });
    });
}

function atualizarFiltroTema() {
    let temasFiltrados;
    if (filtrosAtivos.especialidade.length === 0) {
        temasFiltrados = [...new Set(window.bancoDeQuestoes.map(q => q.tema))].sort();
    } else {
        const questoesDaEsp = window.bancoDeQuestoes.filter(q => filtrosAtivos.especialidade.includes(q.especialidade));
        temasFiltrados = [...new Set(questoesDaEsp.map(q => q.tema))].sort();
    }
    preencherSelect('filtro-tema', temasFiltrados);
}

function atualizarFiltroAno() {
    const containerAno = document.getElementById('container-ano');
    if (!containerAno) return;

    if (filtrosAtivos.prova.length === 0) {
        containerAno.style.display = 'none';
        filtrosAtivos.ano = []; 
        renderizarTags(); 
    } else {
        containerAno.style.display = 'block';
        const questoesDaProva = window.bancoDeQuestoes.filter(q => filtrosAtivos.prova.includes(q.prova));
        const anosFiltrados = [...new Set(questoesDaProva.map(q => q.ano))].sort();
        preencherSelect('filtro-ano', anosFiltrados);
    }
}

function preencherSelect(id, arrayOpcoes) {
    const select = document.getElementById(id);
    if (!select) return;

    while (select.options.length > 1) {
        select.remove(1);
    }

    arrayOpcoes.forEach(opcao => {
        if(opcao) {
            let opt = document.createElement('option');
            opt.value = opcao;
            opt.innerHTML = opcao;
            select.appendChild(opt);
        }
    });
}

function pesquisarBanco() {
    const checkboxFav = document.getElementById('filtro-somente-fav');
    const apenasFav = checkboxFav ? checkboxFav.checked : false;

    const filtradas = window.bancoDeQuestoes.filter(q => {
        const bateEsp = filtrosAtivos.especialidade.length === 0 || filtrosAtivos.especialidade.includes(q.especialidade);
        const bateTema = filtrosAtivos.tema.length === 0 || filtrosAtivos.tema.includes(q.tema);
        const bateProva = filtrosAtivos.prova.length === 0 || filtrosAtivos.prova.includes(q.prova);
        const bateAno = filtrosAtivos.ano.length === 0 || filtrosAtivos.ano.includes(q.ano);
        const bateFav = !apenasFav || favoritos.includes(q.id);
        
        return bateEsp && bateTema && bateProva && bateAno && bateFav;
    });

    const container = document.getElementById('resultados-banco');
    if(!container) return; 

    // Motor de Renderização Otimizado
    let htmlFinal = `<p style="margin-bottom:15px; font-weight:bold; color: var(--primary);">Foram encontradas ${filtradas.length} questões.</p>`;
    
    filtradas.forEach(q => {
        htmlFinal += gerarHTMLQuestao(q, false);
    });

    container.innerHTML = htmlFinal;
}

// ---- LÓGICA DO RESUMO DINÂMICO ----

function carregarQuestoesPorTema(tema, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const questoesDoTema = window.bancoDeQuestoes.filter(q => q.tema.toUpperCase() === tema.toUpperCase());
    
    if (questoesDoTema.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: var(--text-muted);">Ainda não há questões cadastradas para este tema.</p>`;
        return;
    }

    // Motor de Renderização Otimizado
    let htmlTema = '';
    questoesDoTema.forEach(q => {
        htmlTema += gerarHTMLQuestao(q, false);
    });
    container.innerHTML = htmlTema;
}

// ---- NOVAS FUNCIONALIDADES (Favoritos, Estatísticas) ----

function toggleFavorito(id, btnElement) {
    if (favoritos.includes(id)) {
        favoritos = favoritos.filter(favId => favId !== id);
        btnElement.innerText = '🤍';
    } else {
        favoritos.push(id);
        btnElement.innerText = '❤️';
    }
    localStorage.setItem('ati_favoritos', JSON.stringify(favoritos));
}

function salvarEstatistica(especialidade, acertou) {
    if (!estatisticas[especialidade]) {
        estatisticas[especialidade] = { acertos: 0, total: 0 };
    }
    estatisticas[especialidade].total += 1;
    if (acertou) estatisticas[especialidade].acertos += 1;
    
    localStorage.setItem('ati_estatisticas', JSON.stringify(estatisticas));
    if (document.getElementById('stats-container')) atualizarDashboard();
}

// ==========================================
// DASHBOARD (ESTATÍSTICAS POR ESPECIALIDADE)
// ==========================================

function atualizarDashboard() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    let stats = {};
    try {
        stats = JSON.parse(localStorage.getItem('ati_estatisticas') || '{}');
    } catch (e) {
        stats = {};
    }

    container.innerHTML = '';

    const especialidadesComDados = Object.keys(stats).filter(esp => stats[esp].total > 0);

    if (especialidadesComDados.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-muted);">Você ainda não respondeu nenhuma questão. Resolva questões no Banco ou faça um Simulado para gerar seus gráficos!</p>`;
        return;
    }

    especialidadesComDados.sort().forEach(esp => {
        const d = stats[esp];
        const porcentagem = Math.round((d.acertos / d.total) * 100);
        
        let corTema = 'var(--wrong)'; 
        if (porcentagem >= 70) corTema = 'var(--correct)'; 
        else if (porcentagem >= 50) corTema = '#f59e0b'; 

        const card = document.createElement('div');
        card.className = 'card';
        card.style.width = '220px';      
        card.style.flex = '0 0 auto';    
        card.style.margin = '0';         
        card.style.padding = '15px';
        card.style.textAlign = 'center';
        card.innerHTML = `
            <h4 style="margin-bottom: 10px; color: var(--secondary); font-size: 0.9rem; min-height: 2.4rem; display: flex; align-items: center; justify-content: center;">${esp}</h4>
            <div style="font-size: 1.5rem; font-weight: bold; color: ${corTema};">${porcentagem}%</div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 5px;">${d.acertos} acertos em ${d.total} resolvidas</p>
            <div style="background: var(--border-color); height: 6px; border-radius: 3px; margin-top: 10px; overflow: hidden;">
                <div style="background: ${corTema}; width: ${porcentagem}%; height: 100%;"></div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ---- LÓGICA DO MODO ESCURO E INICIALIZAÇÃO DA PÁGINA ----

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. LÓGICA DO MODO ESCURO ---
    const temaSalvo = localStorage.getItem('ati_theme');
    const checkbox = document.getElementById('dark-mode-checkbox');

    if (temaSalvo === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        if (checkbox) checkbox.checked = true;
        if (typeof atualizarTextoBotaoTema === 'function') atualizarTextoBotaoTema(true);
    }

    if (checkbox) {
        checkbox.addEventListener('change', (evento) => {
            if (evento.target.checked) {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('ati_theme', 'dark');
                if (typeof atualizarTextoBotaoTema === 'function') atualizarTextoBotaoTema(true);
            } else {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('ati_theme', 'light');
                if (typeof atualizarTextoBotaoTema === 'function') atualizarTextoBotaoTema(false);
            }
        });
    }

    // --- 2. LÓGICA EXCLUSIVA DA PÁGINA INICIAL ---
    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
        atualizarDashboard(); 
    }

    // --- 3. LÓGICA DO BANCO DE QUESTÕES ---
    const areaBanco = document.getElementById('resultados-banco');
    if (areaBanco && document.getElementById('filtro-especialidade')) {
        popularFiltros(); 
        // Não chama pesquisarBanco() aqui para manter a tela limpa no início
    }

    // --- 4. LÓGICA DO SIMULADO ---
    const areaSimulado = document.getElementById('setup-simulado');
    if (areaSimulado) {
        // Inicialização do simulado
    }
});

function atualizarTextoBotaoTema(isDark) {
    const textoBotao = document.getElementById('texto-botao-tema');
    if (textoBotao) {
        textoBotao.innerHTML = isDark ? '☀️ Modo Claro' : '🌙 Modo Escuro';
    }
}

// ---- LIMPAR MEMÓRIA LOCAL ----
function limparMemoria() {
    const confirmacao = confirm("Tem a certeza que deseja apagar todo o seu Caderno de Erros e Estatísticas? Esta ação não pode ser desfeita.");
    
    if (confirmacao) {
        localStorage.removeItem('ati_favoritos');
        localStorage.removeItem('ati_estatisticas');
        favoritos = [];
        estatisticas = {};
        alert("Memória limpa com sucesso! Os seus dados foram apagados.");
        window.location.reload();
    }
}

// ---- LÓGICA DA SANFONA DOS RESUMOS ----
function toggleResumos(headerElement) {
    const cardClicado = headerElement.closest('.specialty-card');
    
    const todosCards = document.querySelectorAll('.specialty-card');
    todosCards.forEach(card => {
        if (card !== cardClicado) {
            card.classList.remove('open');
        }
    });

    cardClicado.classList.toggle('open');
}

// ---- RENDERIZAÇÃO DINÂMICA DO MENU (HEADER) ----
// (Função disponível, mas não acionada automaticamente para não duplicar o menu do HTML)
function renderizarMenu() {
    const headerHTML = `
    <nav class="navbar">
        <h1>AtiQuestion</h1>
        <div class="nav-links" style="display: flex; align-items: center;">
            <a href="index.html">Página Inicial</a>
            <a href="banco.html">Banco de Questões</a>
            <a href="simulado.html">Simulador</a>
            
            <label class="theme-toggle-btn" style="margin-left: 20px;">
                <input type="checkbox" id="dark-mode-checkbox">
                <span class="theme-toggle-content" id="texto-botao-tema">🌙 Modo Escuro</span>
            </label>
        </div>
    </nav>`;

    document.body.insertAdjacentHTML('afterbegin', headerHTML);
}