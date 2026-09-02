// INICIALIZAÇÃO E VARIÁVEIS GLOBAIS
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
let currentUser = null;
let osAtual = null; 
let clienteEditId = null; 
let estoqueEditId = null; 

let clientesGlobais = []; // Guarda clientes para busca rápida
let estoqueGlobal = [];   // Guarda estoque para orçamentos

// Estrutura do Orçamento Local Avulso
let orcamentoLocal = { itens: [], valor_total: 0 };

window.onload = async () => {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        iniciarApp();
    }
};

// AUTENTICAÇÃO
async function fazerLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('senha').value;
    const msg = document.getElementById('msg-login');
    
    msg.innerText = "Conectando ao TechOS...";
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    
    if (error) {
        msg.innerText = "Usuário ou senha inválidos.";
    } else {
        currentUser = data.user;
        iniciarApp();
    }
}

async function fazerLogout() {
    await db.auth.signOut();
    window.location.reload();
}

function iniciarApp() {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
    carregarPerfilLoja(); 
    carregarDadosBase();
}

function mudarAba(idAba, elementoNav) {
    document.querySelectorAll('.page-view').forEach(aba => aba.classList.remove('active'));
    document.getElementById(idAba).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    if(elementoNav) elementoNav.classList.add('active');

    if(idAba === 'view-os') voltarListaOS();
}

async function carregarDadosBase() {
    await carregarClientes();
    await carregarEstoque();
    await carregarListaOS();
}

// ==========================================
// MÓDULO 1: CLIENTES (Com Busca Rápida)
// ==========================================
async function carregarClientes() {
    const { data, error } = await db.from('clientes').select('*').order('nome');
    if (error) return console.error(error);
    
    clientesGlobais = data; 
    
    const lista = document.getElementById('lista-clientes');
    const selectOS = document.getElementById('os-cliente');
    const datalistOrc = document.getElementById('lista-clientes-datalist');
    
    lista.innerHTML = '';
    selectOS.innerHTML = '<option value="">Selecione o Cliente...</option>';
    datalistOrc.innerHTML = '';

    data.forEach(cli => {
        // Aba Clientes
        lista.innerHTML += `
            <div class="list-item item-cliente">
                <div>
                    <strong>${cli.nome}</strong><br>
                    <small style="color: var(--text);">${cli.whatsapp || 'Sem número'}</small>
                </div>
                <div class="item-actions">
                    <button class="btn-small btn-outline" onclick="prepararEdicaoCliente('${cli.id}', '${cli.nome}', '${cli.whatsapp || ''}')">✏️</button>
                    <button class="btn-small btn-danger" onclick="excluirCliente('${cli.id}')">X</button>
                </div>
            </div>`;
            
        // Dropdown OS
        selectOS.innerHTML += `<option value="${cli.id}">${cli.nome}</option>`;
        
        // Datalist Orçamento Avulso (Busca Inteligente)
        datalistOrc.innerHTML += `<option value="${cli.nome}">`;
    });
}

function filtrarClientes() {
    let termo = document.getElementById('busca-cliente').value.toLowerCase();
    document.querySelectorAll('.item-cliente').forEach(el => {
        let texto = el.innerText.toLowerCase();
        el.style.display = texto.includes(termo) ? 'flex' : 'none';
    });
}

function prepararEdicaoCliente(id, nome, whatsapp) {
    clienteEditId = id;
    document.getElementById('cli-nome').value = nome;
    document.getElementById('cli-zap').value = whatsapp;
    document.getElementById('titulo-form-cliente').innerText = "Editar Cliente";
    document.getElementById('btn-salvar-cli').innerText = "Atualizar Cliente";
    document.getElementById('btn-cancelar-cli').style.display = "inline-block";
    window.scrollTo(0,0);
}

function cancelarEdicaoCliente() {
    clienteEditId = null;
    document.getElementById('cli-nome').value = "";
    document.getElementById('cli-zap').value = "";
    document.getElementById('titulo-form-cliente').innerText = "Novo Cliente";
    document.getElementById('btn-salvar-cli').innerText = "Cadastrar Cliente";
    document.getElementById('btn-cancelar-cli').style.display = "none";
}

async function salvarCliente() {
    const nome = document.getElementById('cli-nome').value;
    const whatsapp = document.getElementById('cli-zap').value;
    if (!nome) return alert('Preencha o nome do cliente!');
    
    const btn = document.getElementById('btn-salvar-cli');
    btn.disabled = true; btn.innerText = "Salvando...";

    if (clienteEditId) {
        await db.from('clientes').update({ nome, whatsapp }).eq('id', clienteEditId);
    } else {
        await db.from('clientes').insert([{ user_id: currentUser.id, nome, whatsapp }]);
    }
    
    cancelarEdicaoCliente();
    await carregarClientes();
    btn.disabled = false;
}

async function excluirCliente(id) {
    if(!confirm("Apagar este cliente?")) return;
    await db.from('clientes').delete().eq('id', id);
    carregarClientes();
}

// Função de Busca e Cadastro Rápido de Cliente na Aba Orçamentos
function checarClienteOrc() {
    const termo = document.getElementById('orc-cliente').value;
    const zapInput = document.getElementById('orc-zap');
    const btnSalvar = document.getElementById('btn-salvar-cli-rapido');
    
    const clienteEncontrado = clientesGlobais.find(c => c.nome.toLowerCase() === termo.toLowerCase());
    
    if (clienteEncontrado) {
        zapInput.value = clienteEncontrado.whatsapp || '';
        btnSalvar.style.display = 'none'; // Já existe, esconde o botão
    } else if (termo.trim().length > 2) {
        btnSalvar.style.display = 'block'; // Não existe, mostra botão para salvar
    } else {
        btnSalvar.style.display = 'none';
    }
}

async function salvarClienteRapido() {
    const nome = document.getElementById('orc-cliente').value;
    const whatsapp = document.getElementById('orc-zap').value;
    if (!nome) return alert('Preencha o nome!');
    
    const btn = document.getElementById('btn-salvar-cli-rapido');
    btn.disabled = true; btn.innerText = "Salvando...";

    await db.from('clientes').insert([{ user_id: currentUser.id, nome, whatsapp }]);
    await carregarClientes(); // Atualiza a lista global
    
    btn.style.display = 'none';
    btn.disabled = false;
    btn.innerText = "💾 Salvar como Novo Cliente";
    alert("✅ Cliente salvo com sucesso no banco de dados!");
}


// ==========================================
// MÓDULO 2: ESTOQUE (Com Peça vs Serviço)
// ==========================================
async function carregarEstoque() {
    const { data, error } = await db.from('estoque').select('*').order('nome');
    if (error) return console.error(error);
    
    estoqueGlobal = data; 
    
    const lista = document.getElementById('lista-estoque');
    const selectItemOS = document.getElementById('add-os-item');
    
    // Selects do Orçamento Avulso (Separados)
    const selectOrcPeca = document.getElementById('add-orc-peca');
    const selectOrcServico = document.getElementById('add-orc-servico');
    
    lista.innerHTML = '';
    let optionsOS = '<option value="">Selecione do Estoque...</option>';
    let optionsPeca = '<option value="">Selecione a Peça...</option>';
    let optionsServico = '<option value="">Selecione o Serviço...</option>';

    data.forEach(item => {
        let precoFix = item.preco ? parseFloat(item.preco).toFixed(2) : '0.00';
        let custoFix = item.custo ? parseFloat(item.custo).toFixed(2) : '0.00';
        
        // Determina o tipo (Se não tiver, considera como Peça por padrão)
        let tipoItem = item.tipo === 'Serviço' ? 'Serviço' : 'Peça';
        let badgeTipo = tipoItem === 'Serviço' ? '<span class="badge badge-servico">🛠️ SERVIÇO</span>' : '<span class="badge badge-peca">📦 PEÇA</span>';
        
        lista.innerHTML += `
            <div class="list-item item-estoque">
                <div>
                    <div style="margin-bottom: 4px;">${badgeTipo}</div>
                    <strong>${item.nome}</strong><br>
                    <small>Venda: R$ ${precoFix} | Custo: R$ ${custoFix}</small>
                </div>
                <div class="item-actions">
                    <button class="btn-small btn-outline" onclick="prepararEdicaoEstoque('${item.id}', '${item.nome}', ${item.preco}, ${item.custo}, '${item.garantia || ''}', '${tipoItem}')">✏️</button>
                    <button class="btn-small btn-danger" onclick="excluirEstoque('${item.id}')">X</button>
                </div>
            </div>`;
            
        let optionStr = `<option value="${item.id}">${item.nome} - R$ ${precoFix}</option>`;
        optionsOS += optionStr;
        
        // Separação Inteligente na aba de orçamentos
        if (tipoItem === 'Serviço') {
            optionsServico += optionStr;
        } else {
            optionsPeca += optionStr;
        }
    });
    
    selectItemOS.innerHTML = optionsOS;
    selectOrcPeca.innerHTML = optionsPeca;
    selectOrcServico.innerHTML = optionsServico;
}

function filtrarEstoque() {
    let termo = document.getElementById('busca-estoque').value.toLowerCase();
    document.querySelectorAll('.item-estoque').forEach(el => {
        let texto = el.innerText.toLowerCase();
        el.style.display = texto.includes(termo) ? 'flex' : 'none';
    });
}

function prepararEdicaoEstoque(id, nome, preco, custo, garantia, tipo) {
    estoqueEditId = id;
    document.getElementById('est-nome').value = nome;
    document.getElementById('est-preco').value = preco;
    document.getElementById('est-custo').value = custo;
    document.getElementById('est-garantia').value = garantia;
    document.getElementById('est-tipo').value = tipo;
    
    document.getElementById('titulo-form-estoque').innerText = "Editar Item";
    document.getElementById('btn-salvar-est').innerText = "Atualizar Item";
    document.getElementById('btn-cancelar-est').style.display = "inline-block";
    window.scrollTo(0,0);
}

function cancelarEdicaoEstoque() {
    estoqueEditId = null;
    document.getElementById('est-nome').value = "";
    document.getElementById('est-preco').value = "";
    document.getElementById('est-custo').value = "";
    document.getElementById('est-garantia').value = "";
    document.getElementById('est-tipo').value = "Peça";
    
    document.getElementById('titulo-form-estoque').innerText = "Novo Item / Serviço";
    document.getElementById('btn-salvar-est').innerText = "Cadastrar Item";
    document.getElementById('btn-cancelar-est').style.display = "none";
}

async function salvarEstoque() {
    const nome = document.getElementById('est-nome').value;
    const preco = parseFloat(document.getElementById('est-preco').value) || 0;
    const custo = parseFloat(document.getElementById('est-custo').value) || 0;
    const garantia = document.getElementById('est-garantia').value;
    const tipo = document.getElementById('est-tipo').value;
    
    if (!nome || preco <= 0) return alert('Preencha nome e preço válido!');

    const btn = document.getElementById('btn-salvar-est');
    btn.disabled = true; btn.innerText = "Salvando...";

    if (estoqueEditId) {
        await db.from('estoque').update({ nome, preco, custo, garantia, tipo }).eq('id', estoqueEditId);
    } else {
        await db.from('estoque').insert([{ user_id: currentUser.id, nome, preco, custo, garantia, tipo }]);
    }
    
    cancelarEdicaoEstoque();
    await carregarEstoque();
    btn.disabled = false;
}

async function excluirEstoque(id) {
    if(!confirm("Apagar este item do estoque?")) return;
    await db.from('estoque').delete().eq('id', id);
    carregarEstoque();
}

// Cadastro Rápido de Peça via Aba Orçamentos
function mostrarCadastroPecaRapido() {
    document.getElementById('box-nova-peca').style.display = 'block';
}

async function salvarPecaRapida() {
    const nome = document.getElementById('rapido-peca-nome').value;
    const preco = parseFloat(document.getElementById('rapido-peca-preco').value) || 0;
    
    if (!nome || preco <= 0) return alert('Preencha nome e preço!');
    
    // Insere como Peça (sem custo ou garantia definidos, para jogo rápido)
    await db.from('estoque').insert([{ user_id: currentUser.id, nome, preco, custo: 0, garantia: '', tipo: 'Peça' }]);
    await carregarEstoque(); // Atualiza as listas
    
    document.getElementById('rapido-peca-nome').value = '';
    document.getElementById('rapido-peca-preco').value = '';
    document.getElementById('box-nova-peca').style.display = 'none';
    
    alert("✅ Peça cadastrada! Ela já está disponível na lista de seleção.");
}

// ==========================================
// MÓDULO 3: ORDENS DE SERVIÇO (OS)
// ==========================================
async function carregarListaOS() {
    const { data, error } = await db.from('ordens_servico').select('*, clientes(nome)').order('created_at', { ascending: false });
    if (error) return;
    
    const lista = document.getElementById('lista-os');
    lista.innerHTML = '';
    
    data.forEach(os => {
        let corStatus = os.status === 'Entregue' ? 'var(--success)' : (os.status === 'Pronto' ? 'var(--primary)' : 'var(--text)');
        lista.innerHTML += `
            <div class="list-item" style="flex-direction: column; align-items: flex-start; gap: 10px;">
                <div style="width: 100%; display: flex; justify-content: space-between;">
                    <strong>OS #${os.id.substring(0,6).toUpperCase()}</strong>
                    <span style="color: ${corStatus}; font-weight: bold; font-size: 12px;">${os.status}</span>
                </div>
                <div style="font-size: 14px;">
                    Cliente: ${os.clientes.nome}<br>
                    Aparelho: ${os.aparelho}
                </div>
                <button class="btn-outline" onclick="abrirOS('${os.id}')" style="width: 100%; padding: 8px;">🔧 Gerenciar OS</button>
            </div>
        `;
    });
}

async function gerarOS() {
    const cliente_id = document.getElementById('os-cliente').value;
    const aparelho = document.getElementById('os-aparelho').value;
    const defeito = document.getElementById('os-defeito').value;
    
    if (!cliente_id || !aparelho) return alert('Selecione cliente e aparelho!');
    
    await db.from('ordens_servico').insert([{ 
        user_id: currentUser.id, cliente_id, aparelho, defeito, status: 'Aguardando Avaliação', valor_total: 0 
    }]);
    
    document.getElementById('os-aparelho').value = '';
    document.getElementById('os-defeito').value = '';
    carregarListaOS();
}

function voltarListaOS() {
    osAtual = null;
    document.getElementById('os-detalhes-view').style.display = 'none';
    document.getElementById('os-base-view').style.display = 'block';
}

async function abrirOS(id) {
    const { data, error } = await db.from('ordens_servico').select('*, clientes(nome, whatsapp)').eq('id', id).single();
    if (error) return;
    osAtual = data;
    
    document.getElementById('os-base-view').style.display = 'none';
    document.getElementById('os-detalhes-view').style.display = 'block';
    
    document.getElementById('det-os-id').innerText = osAtual.id.substring(0,6).toUpperCase();
    document.getElementById('det-os-cliente').innerText = osAtual.clientes.nome;
    document.getElementById('det-os-aparelho').innerText = osAtual.aparelho;
    document.getElementById('det-os-status').value = osAtual.status;
    
    carregarItensOS();
}

async function atualizarStatusOS() {
    if(!osAtual) return;
    const status = document.getElementById('det-os-status').value;
    await db.from('ordens_servico').update({ status }).eq('id', osAtual.id);
}

async function carregarItensOS() {
    const { data } = await db.from('os_itens').select('*, estoque(*)').eq('os_id', osAtual.id);
    const lista = document.getElementById('lista-itens-os');
    lista.innerHTML = '';
    
    let total = 0;
    osAtual.itens = data; 
    
    data.forEach(item => {
        total += item.subtotal;
        let tipoItem = item.estoque.tipo === 'Serviço' ? 'Serviço' : 'Peça';
        let badgeTipo = tipoItem === 'Serviço' ? '<span class="badge badge-servico">🛠️</span>' : '<span class="badge badge-peca">📦</span>';
        
        lista.innerHTML += `
            <div class="list-item" style="padding: 8px 0;">
                <div>
                    <strong style="font-size: 14px;">${badgeTipo} ${item.estoque.nome}</strong><br>
                    <small>${item.quantidade}x R$ ${item.preco_unitario.toFixed(2)}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <strong>R$ ${item.subtotal.toFixed(2)}</strong>
                    <button class="btn-small btn-danger" onclick="removerItemOS('${item.id}')">X</button>
                </div>
            </div>`;
    });
    
    osAtual.valor_total = total;
    document.getElementById('det-os-total').innerText = total.toFixed(2);
    await db.from('ordens_servico').update({ valor_total: total }).eq('id', osAtual.id);
}

async function adicionarItemNaOS() {
    const estoque_id = document.getElementById('add-os-item').value;
    const quantidade = parseInt(document.getElementById('add-os-qtd').value);
    
    if (!estoque_id || quantidade < 1) return;
    
    const itemEstoque = estoqueGlobal.find(i => i.id === estoque_id);
    const subtotal = itemEstoque.preco * quantidade;
    
    await db.from('os_itens').insert([{ 
        os_id: osAtual.id, estoque_id, quantidade, preco_unitario: itemEstoque.preco, subtotal 
    }]);
    
    if(itemEstoque.garantia) {
        osAtual.garantia_final = itemEstoque.garantia;
        await db.from('ordens_servico').update({ garantia_final: itemEstoque.garantia }).eq('id', osAtual.id);
    }
    
    carregarItensOS();
}

async function removerItemOS(idItem) {
    await db.from('os_itens').delete().eq('id', idItem);
    carregarItensOS();
}

function enviarWhatsAppOS() {
    if(!osAtual) return;
    const celular = osAtual.clientes.whatsapp;
    if(!celular) return alert("Cliente sem WhatsApp cadastrado!");
    
    let texto = `*Assistência Técnica*\nOlá ${osAtual.clientes.nome}!\n\nSeu orçamento para o aparelho *${osAtual.aparelho}* ficou pronto.\n\n*Valor Total: R$ ${osAtual.valor_total.toFixed(2)}*\n\nStatus: ${osAtual.status}`;
    window.open(`https://api.whatsapp.com/send?phone=55${celular.replace(/\D/g,'')}&text=${encodeURIComponent(texto)}`);
}


// ==========================================
// MÓDULO 4: ORÇAMENTO AVULSO (COM SOMA AUTOMÁTICA)
// ==========================================
function adicionarItemOrcamentoLocal(modo) {
    let selectId = modo === 'Serviço' ? 'add-orc-servico' : 'add-orc-peca';
    let qtdId = modo === 'Serviço' ? null : 'add-orc-peca-qtd'; // Serviço geralmente é qtd 1, mas deixei fixo pra simplificar
    
    const estoque_id = document.getElementById(selectId).value;
    const quantidade = qtdId ? parseInt(document.getElementById(qtdId).value) : 1;
    
    if (!estoque_id || quantidade < 1) return alert("Selecione um item!");
    
    const itemEstoque = estoqueGlobal.find(i => i.id === estoque_id);
    
    orcamentoLocal.itens.push({
        nome: itemEstoque.nome,
        quantidade: quantidade,
        preco: parseFloat(itemEstoque.preco),
        subtotal: parseFloat(itemEstoque.preco) * quantidade,
        tipo: itemEstoque.tipo === 'Serviço' ? 'Serviço' : 'Peça'
    });
    
    atualizarUIOrcamentoLocal();
    document.getElementById(selectId).value = ''; // Limpa o select
    if(qtdId) document.getElementById(qtdId).value = 1;
}

function removerItemOrcamentoLocal(index) {
    orcamentoLocal.itens.splice(index, 1);
    atualizarUIOrcamentoLocal();
}

function atualizarUIOrcamentoLocal() {
    const lista = document.getElementById('lista-itens-orcamento');
    lista.innerHTML = '';
    
    let totalServicos = 0;
    let totalPecas = 0;
    
    orcamentoLocal.itens.forEach((item, index) => {
        if(item.tipo === 'Serviço') totalServicos += item.subtotal;
        else totalPecas += item.subtotal;
        
        let badgeTipo = item.tipo === 'Serviço' ? '<span class="badge badge-servico">🛠️</span>' : '<span class="badge badge-peca">📦</span>';
        
        lista.innerHTML += `
            <div class="list-item" style="padding: 8px 0;">
                <div>
                    <strong style="font-size: 14px;">${badgeTipo} ${item.nome}</strong><br>
                    <small>${item.quantidade}x R$ ${item.preco.toFixed(2)}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <strong>R$ ${item.subtotal.toFixed(2)}</strong>
                    <button class="btn-small btn-danger" onclick="removerItemOrcamentoLocal(${index})">X</button>
                </div>
            </div>`;
    });
    
    orcamentoLocal.valor_total = totalServicos + totalPecas;
    document.getElementById('orc-total').innerText = orcamentoLocal.valor_total.toFixed(2);
}

function limparOrcamentoLocal() {
    if(!confirm("Limpar todos os dados deste orçamento?")) return;
    orcamentoLocal = { itens: [], valor_total: 0 };
    document.getElementById('orc-cliente').value = '';
    document.getElementById('orc-zap').value = '';
    document.getElementById('orc-aparelho').value = '';
    document.getElementById('orc-validade').value = '';
    document.getElementById('orc-garantia-obs').value = '';
    document.getElementById('orc-pagamento').value = '';
    document.getElementById('btn-salvar-cli-rapido').style.display = 'none';
    atualizarUIOrcamentoLocal();
}

function enviarWhatsAppOrcamento() {
    const celular = document.getElementById('orc-zap').value;
    if(!celular) return alert("Digite o WhatsApp do cliente para enviar!");
    
    const cliente = document.getElementById('orc-cliente').value || 'Cliente';
    const aparelho = document.getElementById('orc-aparelho').value || 'Seu aparelho';
    
    let texto = `*Assistência Técnica*\nOlá ${cliente}!\n\nAqui está o orçamento solicitado para *${aparelho}*:\n\n`;
    
    orcamentoLocal.itens.forEach(item => {
        let icone = item.tipo === 'Serviço' ? '🛠️' : '📦';
        texto += `${icone} ${item.quantidade}x ${item.nome} (R$ ${item.subtotal.toFixed(2)})\n`;
    });
    
    texto += `\n*Valor Total: R$ ${orcamentoLocal.valor_total.toFixed(2)}*`;
    
    const obsValidade = document.getElementById('orc-validade').value;
    if(obsValidade) texto += `\nValidade: ${obsValidade}`;
    
    window.open(`https://api.whatsapp.com/send?phone=55${celular.replace(/\D/g,'')}&text=${encodeURIComponent(texto)}`);
}

// ==========================================
// MÓDULO 5: PERFIL DA EMPRESA E PDF
// ==========================================
function carregarLogo(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('preview-logo').src = e.target.result;
            document.getElementById('preview-logo').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function salvarPerfilLoja() {
    const perfil = {
        nome: document.getElementById('loja-nome').value,
        cnpj: document.getElementById('loja-cnpj').value,
        endereco: document.getElementById('loja-endereco').value,
        logo: document.getElementById('preview-logo').src
    };
    localStorage.setItem('techos_perfil', JSON.stringify(perfil));
    alert("✅ Perfil da Assistência salvo com sucesso!");
}

function carregarPerfilLoja() {
    const perfilSalvo = localStorage.getItem('techos_perfil');
    if (perfilSalvo) {
        const perfil = JSON.parse(perfilSalvo);
        document.getElementById('loja-nome').value = perfil.nome || '';
        document.getElementById('loja-cnpj').value = perfil.cnpj || '';
        document.getElementById('loja-endereco').value = perfil.endereco || '';
        
        if (perfil.logo && perfil.logo.startsWith('data:image')) {
            document.getElementById('preview-logo').src = perfil.logo;
            document.getElementById('preview-logo').style.display = 'block';
        }
    }
}

function prepararCabecalhoPDF() {
    const perfilSalvo = localStorage.getItem('techos_perfil');
    if (perfilSalvo) {
        const perfil = JSON.parse(perfilSalvo);
        document.getElementById('pdf-nome-empresa').innerText = perfil.nome || "TECH OS ASSISTÊNCIA";
        document.getElementById('pdf-cnpj-empresa').innerText = perfil.cnpj ? `CNPJ: ${perfil.cnpj}` : '';
        document.getElementById('pdf-endereco-empresa').innerText = perfil.endereco || '';
        
        const logoImg = document.getElementById('pdf-logo-empresa');
        if (perfil.logo && perfil.logo.startsWith('data:image')) {
            logoImg.src = perfil.logo;
            logoImg.style.display = 'block';
        } else {
            logoImg.style.display = 'none';
        }
    }
}

function gerarPDF(isOrcamentoRapido = false) {
    prepararCabecalhoPDF();

    let htmlTabela = '';
    let titulo_pdf, cliente_pdf, aparelho_pdf, defeito_pdf, total_pdf;
    let validade_pdf = 'Não informada';
    let garantia_pdf = 'Consultar condições';
    let pagamento_pdf = 'A combinar';
    let arquivo_nome = 'Orcamento.pdf';

    if (isOrcamentoRapido) {
        if(orcamentoLocal.itens.length === 0) return alert("Adicione peças ou serviços primeiro!");
        
        titulo_pdf = `Orçamento Comercial`;
        cliente_pdf = document.getElementById('orc-cliente').value || 'Não informado';
        aparelho_pdf = document.getElementById('orc-aparelho').value || 'Não informado';
        document.getElementById('linha-defeito').style.display = 'none'; 
        
        orcamentoLocal.itens.forEach(item => {
            let tipoTag = item.tipo === 'Serviço' ? 'Mão de Obra' : 'Peça';
            htmlTabela += `<tr>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1;">
                    <strong>${item.nome}</strong><br>
                    <span style="font-size: 11px; color: #64748b;">[${tipoTag}]</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1; text-align: center;">${item.quantidade}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1; text-align: right;">R$ ${item.subtotal.toFixed(2)}</td>
            </tr>`;
        });
        
        total_pdf = orcamentoLocal.valor_total;
        
        // Pega as observações customizadas
        validade_pdf = document.getElementById('orc-validade').value || validade_pdf;
        garantia_pdf = document.getElementById('orc-garantia-obs').value || garantia_pdf;
        pagamento_pdf = document.getElementById('orc-pagamento').value || pagamento_pdf;
        arquivo_nome = `Orcamento_${cliente_pdf.replace(/\s+/g, '_')}.pdf`;
        
    } else {
        if(!osAtual) return;
        
        titulo_pdf = `Orçamento / OS #${osAtual.id.substring(0,6).toUpperCase()}`;
        cliente_pdf = `${osAtual.clientes.nome} - ${osAtual.clientes.whatsapp || ''}`;
        aparelho_pdf = osAtual.aparelho;
        defeito_pdf = osAtual.defeito || 'Não informado';
        
        document.getElementById('linha-defeito').style.display = 'block';
        document.getElementById('pdf-defeito').innerText = defeito_pdf;
        
        (osAtual.itens || []).forEach(item => {
            let tipoTag = item.estoque.tipo === 'Serviço' ? 'Mão de Obra' : 'Peça';
            htmlTabela += `<tr>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1;">
                    <strong>${item.estoque.nome}</strong><br>
                    <span style="font-size: 11px; color: #64748b;">[${tipoTag}]</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1; text-align: center;">${item.quantidade}</td>
                <td style="padding: 10px; border-bottom: 1px solid #dcdde1; text-align: right;">R$ ${item.subtotal.toFixed(2)}</td>
            </tr>`;
        });
        
        total_pdf = osAtual.valor_total;
        garantia_pdf = osAtual.garantia_final || garantia_pdf;
        arquivo_nome = `OS_${osAtual.clientes.nome.replace(/\s+/g, '_')}.pdf`;
    }

    // Injeta tudo no molde do HTML
    document.getElementById('pdf-os-numero').innerText = titulo_pdf;
    document.getElementById('pdf-cliente').innerText = cliente_pdf;
    document.getElementById('pdf-aparelho').innerText = aparelho_pdf;
    document.getElementById('pdf-itens-tabela').innerHTML = htmlTabela;
    document.getElementById('pdf-total').innerText = `R$ ${total_pdf.toFixed(2)}`;
    
    // Injeta as observações do rodapé
    document.getElementById('pdf-garantia').innerText = garantia_pdf;
    document.getElementById('pdf-pagamento').innerText = pagamento_pdf;
    document.getElementById('pdf-validade').innerText = validade_pdf;
    
    // Configura e Tira a Foto (Gerar PDF)
    const molde = document.getElementById('pdf-molde');
    const wrapper = document.getElementById('pdf-wrapper');
    wrapper.style.display = 'block'; 
    
    let opt = {
      margin:       0.3, // Deu uma margem maior para ficar mais bonito
      filename:     arquivo_nome,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, scrollY: 0 }, 
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    setTimeout(() => {
        html2pdf().set(opt).from(molde).save().then(() => {
            wrapper.style.display = 'none'; 
        });
    }, 100);
}
