// ==========================================
// CONFIGURAÇÕES GERAIS E BANCO DE DADOS
// ==========================================
let db;
let currentUser = null;
let osAtual = null; // Guarda a OS que está aberta na tela no momento

window.onload = async function() {
    if(typeof supabaseUrl === 'undefined' || typeof supabaseKey === 'undefined') { 
        alert("Erro crítico: arquivo config.js ausente. Crie o config.js com as chaves do Supabase!"); 
        return; 
    }
    db = window.supabase.createClient(supabaseUrl, supabaseKey);
    verificarSessao();
};

// ==========================================
// AUTENTICAÇÃO
// ==========================================
async function verificarSessao() { 
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        mostrarApp();
    } else {
        mostrarLogin();
    }
}

async function fazerLogin() { 
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value; 
    const msg = document.getElementById('auth-msg');
    
    msg.style.color = "var(--primary)";
    msg.innerText = "Conectando ao TechOS...";
    
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) { 
        msg.style.color = "var(--danger)"; 
        msg.innerText = "Usuário ou senha inválidos."; 
        return;
    }
    currentUser = data.user;
    mostrarApp();
}

async function fazerLogout() { 
    await db.auth.signOut();
    currentUser = null;
    mostrarLogin();
}

function mostrarApp() { 
    document.getElementById('auth-container').style.display = 'none'; 
    document.getElementById('app-container').style.display = 'block'; 
    mudarAba('view-dashboard');
}

function mostrarLogin() { 
    document.getElementById('auth-container').style.display = 'block'; 
    document.getElementById('app-container').style.display = 'none'; 
}

// ==========================================
// NAVEGAÇÃO E ATUALIZAÇÃO DE TELAS
// ==========================================
function mudarAba(viewId) {
    document.querySelectorAll('.page-view').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById(viewId).style.display = 'block';
    
    let navId = viewId.replace('view-', 'nav-');
    let navEl = document.getElementById(navId);
    if(navEl) navEl.classList.add('active');
    
    window.scrollTo(0, 0);

    // Atualiza os dados dependendo da aba clicada
    if(viewId === 'view-dashboard') carregarDashboard();
    if(viewId === 'view-clientes') carregarClientes();
    if(viewId === 'view-estoque') carregarEstoque();
    if(viewId === 'view-os') {
        carregarClientesSelect();
        carregarOS();
    }
}

// ==========================================
// 1. ABA: PAINEL (DASHBOARD)
// ==========================================
async function carregarDashboard() {
    if(!currentUser) return;
    document.getElementById('status-db').innerText = "Sincronizando...";
    
    const { data, error } = await db.from('ordens_servico').select('status').eq('user_id', currentUser.id);
    if (error) {
        document.getElementById('status-db').innerText = "Erro DB";
        document.getElementById('status-db').style.backgroundColor = "var(--danger)";
        return;
    }
    
    let osAbertas = 0;
    let osAguardando = 0;
    
    data.forEach(os => {
        if(os.status !== 'Entregue') osAbertas++;
        if(os.status === 'Orçamento Pendente' || os.status === 'Aguardando Aprovação') osAguardando++;
    });
    
    document.getElementById('dash-os-abertas').innerText = osAbertas;
    document.getElementById('dash-os-orcamento').innerText = osAguardando;
    
    document.getElementById('status-db').innerText = "Online";
    document.getElementById('status-db').style.backgroundColor = "var(--success)";
}

// ==========================================
// 2. ABA: CLIENTES
// ==========================================
async function salvarCliente() {
    const nome = document.getElementById('cliente-nome').value.trim();
    const whatsapp = document.getElementById('cliente-whatsapp').value.trim();
    
    if(!nome) return alert("O nome do cliente é obrigatório!");
    
    const { error } = await db.from('clientes').insert([{ 
        nome, whatsapp, user_id: currentUser.id 
    }]);
    
    if(error) return alert("Erro ao salvar: " + error.message);
    
    document.getElementById('cliente-nome').value = '';
    document.getElementById('cliente-whatsapp').value = '';
    carregarClientes();
}

async function carregarClientes() {
    const { data, error } = await db.from('clientes').select('*').eq('user_id', currentUser.id).order('nome', { ascending: true });
    const lista = document.getElementById('lista-clientes');
    
    if(error || !data || data.length === 0) {
        lista.innerHTML = "<p style='color: var(--text-muted); font-size: 14px;'>Nenhum cliente cadastrado.</p>";
        return;
    }
    
    let html = '';
    data.forEach(c => {
        html += `
        <div class="lista-item">
            <div class="item-info">
                <span class="item-title">${c.nome}</span>
                <span class="item-sub">WhatsApp: ${c.whatsapp || 'Não informado'}</span>
            </div>
        </div>`;
    });
    lista.innerHTML = html;
}

// ==========================================
// 3. ABA: ESTOQUE E SERVIÇOS
// ==========================================
async function salvarEstoque() {
    const nome = document.getElementById('estoque-nome').value.trim();
    const tipo = document.getElementById('estoque-tipo').value;
    const garantia = parseInt(document.getElementById('estoque-garantia').value) || 0;
    const custo = parseFloat(document.getElementById('estoque-custo').value) || 0;
    const valor_venda = parseFloat(document.getElementById('estoque-venda').value);
    
    if(!nome || isNaN(valor_venda)) return alert("Preencha o nome e o valor de venda!");
    
    const { error } = await db.from('estoque').insert([{ 
        nome, tipo, garantia_padrao_dias: garantia, custo, valor_venda, user_id: currentUser.id 
    }]);
    
    if(error) return alert("Erro ao salvar: " + error.message);
    
    document.getElementById('estoque-nome').value = '';
    document.getElementById('estoque-custo').value = '';
    document.getElementById('estoque-venda').value = '';
    carregarEstoque();
}

async function carregarEstoque() {
    const { data, error } = await db.from('estoque').select('*').eq('user_id', currentUser.id).order('nome', { ascending: true });
    const lista = document.getElementById('lista-estoque');
    
    if(error || !data || data.length === 0) {
        lista.innerHTML = "<p style='color: var(--text-muted); font-size: 14px;'>Estoque vazio.</p>";
        return;
    }
    
    let html = '';
    data.forEach(item => {
        html += `
        <div class="lista-item">
            <div class="item-info">
                <span class="item-title">${item.nome} <span class="badge-status" style="background:#e2e8f0; color:#333;">${item.tipo}</span></span>
                <span class="item-sub">Venda: R$ ${item.valor_venda.toFixed(2)} | Garantia: ${item.garantia_padrao_dias} dias</span>
            </div>
        </div>`;
    });
    lista.innerHTML = html;
}

// ==========================================
// 4. ABA: ORDENS DE SERVIÇO (OS)
// ==========================================
async function carregarClientesSelect() {
    const { data } = await db.from('clientes').select('id, nome').eq('user_id', currentUser.id).order('nome', { ascending: true });
    const select = document.getElementById('os-cliente');
    if(!data) return;
    
    let html = '<option value="">-- Selecione o Cliente --</option>';
    data.forEach(c => html += `<option value="${c.id}">${c.nome}</option>`);
    select.innerHTML = html;
}

async function abrirOS() {
    const cliente_id = document.getElementById('os-cliente').value;
    const aparelho = document.getElementById('os-aparelho').value.trim();
    const defeito_relatado = document.getElementById('os-defeito').value.trim();
    
    if(!cliente_id || !aparelho || !defeito_relatado) return alert("Preencha todos os campos da OS!");
    
    const { error } = await db.from('ordens_servico').insert([{ 
        cliente_id, aparelho, defeito_relatado, user_id: currentUser.id 
    }]);
    
    if(error) return alert("Erro ao gerar OS: " + error.message);
    
    document.getElementById('os-aparelho').value = '';
    document.getElementById('os-defeito').value = '';
    carregarOS();
}

async function carregarOS() {
    const lista = document.getElementById('lista-os');
    lista.innerHTML = "Carregando...";
    
    const { data, error } = await db.from('ordens_servico').select('*, clientes(nome, whatsapp)').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    
    if(error || !data || data.length === 0) {
        lista.innerHTML = "<p style='color: var(--text-muted); font-size: 14px;'>Nenhuma OS encontrada.</p>";
        return;
    }
    
    let html = '';
    data.forEach(os => {
        let statusColor = os.status === 'Concluído' || os.status === 'Entregue' ? 'status-concluido' : (os.status === 'Em Andamento' ? 'status-andamento' : 'status-pendente');
        
        html += `
        <div class="card" style="border-left: 4px solid var(--primary); margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <h3 style="margin:0; font-size: 16px;">${os.aparelho}</h3>
                <span class="badge-status ${statusColor}">${os.status}</span>
            </div>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: var(--text-muted);">👤 Cliente: <strong>${os.clientes.nome}</strong></p>
            <p style="margin: 0 0 15px 0; font-size: 13px; color: var(--text-muted);">⚠️ Defeito: ${os.defeito_relatado}</p>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="gerenciarOS('${os.id}')" style="background-color: var(--dark); padding: 10px;">🔧 Gerenciar OS</button>
            </div>
        </div>`;
    });
    
    // Área base da aba OS (Esconde a tela de detalhes se estiver aberta)
    lista.innerHTML = html;
}

// ==========================================
// 5. O CORAÇÃO: GERENCIAR UMA OS ESPECÍFICA
// ==========================================
async function gerenciarOS(osId) {
    const viewOs = document.getElementById('view-os');
    viewOs.innerHTML = `<h2 style="text-align:center;">Carregando detalhes...</h2>`;
    
    // Busca a OS, os dados do cliente e os itens já adicionados
    const { data: osData } = await db.from('ordens_servico').select('*, clientes(nome, whatsapp)').eq('id', osId).single();
    const { data: itensData } = await db.from('os_itens').select('*, estoque(nome, tipo, garantia_padrao_dias)').eq('os_id', osId);
    const { data: estoqueData } = await db.from('estoque').select('id, nome, valor_venda').eq('user_id', currentUser.id).order('nome', { ascending: true });
    
    osAtual = { ...osData, itens: itensData || [] };
    
    // Monta o Select de Peças
    let optionsEstoque = '<option value="">-- Selecione uma Peça/Serviço --</option>';
    if(estoqueData) {
        estoqueData.forEach(item => optionsEstoque += `<option value="${item.id}">+ ${item.nome} (R$ ${item.valor_venda.toFixed(2)})</option>`);
    }

    // Monta a Tabela de Itens
    let htmlItens = '';
    let maiorGarantia = 0;
    
    if(osAtual.itens.length === 0) {
        htmlItens = `<p style="font-size:13px; color:var(--text-muted);">Nenhuma peça ou serviço adicionado.</p>`;
    } else {
        osAtual.itens.forEach(item => {
            htmlItens += `
            <div class="lista-item" style="background: var(--light); border-radius: 8px; margin-bottom: 5px; padding: 10px;">
                <div class="item-info" style="width: 100%;">
                    <div style="display:flex; justify-content: space-between;">
                        <span class="item-title">${item.estoque.nome} (x${item.quantidade})</span>
                        <span style="font-weight: bold; color: var(--danger);" onclick="removerItemOS('${item.id}', '${osId}')">X Excluir</span>
                    </div>
                    <span class="item-sub">Subtotal: R$ ${item.subtotal.toFixed(2)}</span>
                </div>
            </div>`;
            if(item.estoque.garantia_padrao_dias > maiorGarantia) maiorGarantia = item.estoque.garantia_padrao_dias;
        });
    }

    // A Tela Dinâmica de Detalhes da OS
    viewOs.innerHTML = `
        <button onclick="mudarAba('view-os')" style="background: var(--text-muted); margin-bottom: 15px; padding: 10px; width: auto;">⬅ Voltar para Lista</button>
        
        <div class="card">
            <h2>OS: ${osAtual.aparelho}</h2>
            <p style="font-size: 14px; margin-bottom: 10px;"><strong>Cliente:</strong> ${osAtual.clientes.nome}</p>
            
            <label style="font-size: 12px; font-weight: bold;">Status da OS:</label>
            <select id="os-status-select" onchange="atualizarStatusOS('${osId}', this.value)" style="margin-bottom: 20px;">
                <option value="Orçamento Pendente" ${osAtual.status === 'Orçamento Pendente' ? 'selected' : ''}>Orçamento Pendente</option>
                <option value="Aguardando Aprovação" ${osAtual.status === 'Aguardando Aprovação' ? 'selected' : ''}>Aguardando Aprovação</option>
                <option value="Em Andamento" ${osAtual.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                <option value="Concluído" ${osAtual.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
                <option value="Entregue" ${osAtual.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
            </select>

            <h3 style="font-size: 15px; border-top: 1px solid var(--border); padding-top: 15px;">Adicionar Peça/Serviço</h3>
            <select id="add-item-id">${optionsEstoque}</select>
            <div class="linha-inputs">
                <input type="number" id="add-item-qtd" value="1" placeholder="Qtd" min="1">
                <button onclick="adicionarItemOS('${osId}')">Adicionar</button>
            </div>
            
            <h3 style="font-size: 15px; margin-top: 20px;">Itens no Orçamento</h3>
            ${htmlItens}
            
            <div style="background: #e8f6f3; padding: 15px; border-radius: 8px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 16px; font-weight: bold; color: var(--dark);">Total:</span>
                <span style="font-size: 20px; font-weight: 900; color: var(--success);">R$ ${osAtual.valor_total.toFixed(2)}</span>
            </div>
            
            <input type="text" id="os-garantia-final" value="${osAtual.garantia_final || (maiorGarantia > 0 ? maiorGarantia + ' dias' : 'Sem garantia')}" placeholder="Texto da Garantia (Ex: 90 dias)" onchange="salvarGarantia('${osId}', this.value)" style="margin-top: 15px;">

            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
                <button onclick="enviarWhatsApp()" style="background: var(--whatsapp);"><div class="nav-icon" style="display:inline; margin-right:5px;">💬</div> Enviar por WhatsApp</button>
                <button onclick="gerarPDF()" style="background: var(--dark);"><div class="nav-icon" style="display:inline; margin-right:5px;">📄</div> Exportar PDF</button>
            </div>
        </div>
    `;
}

async function atualizarStatusOS(osId, novoStatus) {
    await db.from('ordens_servico').update({ status: novoStatus }).eq('id', osId);
}

async function salvarGarantia(osId, textoGarantia) {
    await db.from('ordens_servico').update({ garantia_final: textoGarantia }).eq('id', osId);
    osAtual.garantia_final = textoGarantia;
}

async function adicionarItemOS(osId) {
    const estoque_id = document.getElementById('add-item-id').value;
    const quantidade = parseInt(document.getElementById('add-item-qtd').value);
    
    if(!estoque_id || quantidade < 1) return alert("Selecione um item e a quantidade!");
    
    // Puxa o valor atual da peça do banco
    const { data: peca } = await db.from('estoque').select('valor_venda').eq('id', estoque_id).single();
    const subtotal = peca.valor_venda * quantidade;
    
    // Insere o item na OS
    await db.from('os_itens').insert([{
        os_id: osId, estoque_id, quantidade, valor_unitario: peca.valor_venda, subtotal, user_id: currentUser.id
    }]);
    
    // Atualiza o valor total da OS
    const novoTotal = osAtual.valor_total + subtotal;
    await db.from('ordens_servico').update({ valor_total: novoTotal }).eq('id', osId);
    
    // Recarrega a tela de gerenciamento
    gerenciarOS(osId);
}

async function removerItemOS(itemId, osId) {
    if(!confirm("Remover este item do orçamento?")) return;
    
    const { data: itemData } = await db.from('os_itens').select('subtotal').eq('id', itemId).single();
    await db.from('os_itens').delete().eq('id', itemId);
    
    const novoTotal = osAtual.valor_total - itemData.subtotal;
    await db.from('ordens_servico').update({ valor_total: novoTotal }).eq('id', osId);
    
    gerenciarOS(osId);
}

// ==========================================
// 6. GERAÇÃO DE PDF E WHATSAPP
// ==========================================
function enviarWhatsApp() {
    if(!osAtual) return;
    
    let texto = `💻 *Orçamento Técnico - TechOS*\n\n`;
    texto += `*Cliente:* ${osAtual.clientes.nome}\n`;
    texto += `*Aparelho:* ${osAtual.aparelho}\n`;
    texto += `*Defeito:* ${osAtual.defeito_relatado}\n\n`;
    
    texto += `*🛠️ Serviços e Peças:*\n`;
    osAtual.itens.forEach(item => {
        texto += `- ${item.quantidade}x ${item.estoque.nome} (R$ ${item.subtotal.toFixed(2)})\n`;
    });
    
    texto += `\n💰 *Valor Total: R$ ${osAtual.valor_total.toFixed(2)}*\n`;
    texto += `🛡️ *Garantia:* ${osAtual.garantia_final || 'Consultar'}\n\n`;
    texto += `Podemos prosseguir com o serviço? Fico no aguardo da aprovação!`;
    
    let numeroFormatado = osAtual.clientes.whatsapp.replace(/\D/g,'');
    if(numeroFormatado.length === 11) numeroFormatado = "55" + numeroFormatado; // Adiciona DDI do Brasil se necessário
    
    let url = `https://api.whatsapp.com/send?phone=${numeroFormatado}&text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

function gerarPDF() {
    if(!osAtual) return;
    
    // 1. Preenche o molde oculto com os dados
    document.getElementById('pdf-os-numero').innerText = `Orçamento / OS #${osAtual.id.substring(0,6).toUpperCase()}`;
    document.getElementById('pdf-cliente').innerText = `${osAtual.clientes.nome} - ${osAtual.clientes.whatsapp || ''}`;
    document.getElementById('pdf-aparelho').innerText = osAtual.aparelho;
    document.getElementById('pdf-defeito').innerText = osAtual.defeito_relatado;
    
    let htmlTabela = '';
    osAtual.itens.forEach(item => {
        htmlTabela += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1;">${item.estoque.nome}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1;">${item.quantidade}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1;">R$ ${item.subtotal.toFixed(2)}</td>
            </tr>
        `;
    });
    document.getElementById('pdf-itens-tabela').innerHTML = htmlTabela;
    document.getElementById('pdf-total').innerText = `R$ ${osAtual.valor_total.toFixed(2)}`;
    document.getElementById('pdf-garantia').innerText = osAtual.garantia_final || 'Consultar';
    
    // 2. Prepara e gera o PDF
    const molde = document.getElementById('pdf-molde');
    const wrapper = molde.parentElement;
    
    wrapper.style.display = 'block'; // Mostra temporariamente para a biblioteca conseguir ler o tamanho
    
    let opt = {
      margin:       0,
      filename:     `Orcamento_${osAtual.clientes.nome.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(molde).save().then(() => {
        wrapper.style.display = 'none'; // Esconde o molde novamente após o download
    });
}
