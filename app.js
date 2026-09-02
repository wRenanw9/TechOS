// INICIALIZAÇÃO
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
let currentUser = null;
let osAtual = null; // Armazena a OS que está aberta nos detalhes
let clienteEditId = null; // Controle de edição
let estoqueEditId = null; // Controle de edição

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
    carregarPerfilLoja(); // Carrega os dados da empresa pro PDF
    carregarDadosBase();
}

function mudarAba(idAba, elementoNav) {
    document.querySelectorAll('.page-view').forEach(aba => aba.classList.remove('active'));
    document.getElementById(idAba).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    if(elementoNav) elementoNav.classList.add('active');

    // Se mudar de aba e for a aba OS, garante que mostre a lista base e esconda os detalhes
    if(idAba === 'view-os') voltarListaOS();
}

async function carregarDadosBase() {
    await carregarClientes();
    await carregarEstoque();
    await carregarListaOS();
}

// ==========================================
// MÓDULO 1: CLIENTES (Com Busca e Edição)
// ==========================================
async function carregarClientes() {
    const { data, error } = await db.from('clientes').select('*').order('nome');
    if (error) return console.error(error);
    
    const lista = document.getElementById('lista-clientes');
    const selectOS = document.getElementById('os-cliente');
    
    lista.innerHTML = '';
    selectOS.innerHTML = '<option value="">Selecione o Cliente...</option>';

    data.forEach(cli => {
        // Lista
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
        
        // Select da OS
        selectOS.innerHTML += `<option value="${cli.id}">${cli.nome}</option>`;
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

// ==========================================
// MÓDULO 2: ESTOQUE (Com Busca e Edição)
// ==========================================
async function carregarEstoque() {
    const { data, error } = await db.from('estoque').select('*').order('nome');
    if (error) return console.error(error);
    
    const lista = document.getElementById('lista-estoque');
    const selectItemOS = document.getElementById('add-os-item');
    
    lista.innerHTML = '';
    selectItemOS.innerHTML = '<option value="">Selecione do Estoque...</option>';

    data.forEach(item => {
        lista.innerHTML += `
            <div class="list-item item-estoque">
                <div>
                    <strong>${item.nome}</strong><br>
                    <small>Venda: R$ ${item.preco.toFixed(2)} | Custo: R$ ${item.custo.toFixed(2)}</small>
                </div>
                <div class="item-actions">
                    <button class="btn-small btn-outline" onclick="prepararEdicaoEstoque('${item.id}', '${item.nome}', ${item.preco}, ${item.custo}, '${item.garantia || ''}')">✏️</button>
                    <button class="btn-small btn-danger" onclick="excluirEstoque('${item.id}')">X</button>
                </div>
            </div>`;
            
        selectItemOS.innerHTML += `<option value="${item.id}">${item.nome} - R$ ${item.preco.toFixed(2)}</option>`;
    });
}

function filtrarEstoque() {
    let termo = document.getElementById('busca-estoque').value.toLowerCase();
    document.querySelectorAll('.item-estoque').forEach(el => {
        let texto = el.innerText.toLowerCase();
        el.style.display = texto.includes(termo) ? 'flex' : 'none';
    });
}

function prepararEdicaoEstoque(id, nome, preco, custo, garantia) {
    estoqueEditId = id;
    document.getElementById('est-nome').value = nome;
    document.getElementById('est-preco').value = preco;
    document.getElementById('est-custo').value = custo;
    document.getElementById('est-garantia').value = garantia;
    
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
    
    document.getElementById('titulo-form-estoque').innerText = "Novo Item / Serviço";
    document.getElementById('btn-salvar-est').innerText = "Cadastrar Item";
    document.getElementById('btn-cancelar-est').style.display = "none";
}

async function salvarEstoque() {
    const nome = document.getElementById('est-nome').value;
    const preco = parseFloat(document.getElementById('est-preco').value) || 0;
    const custo = parseFloat(document.getElementById('est-custo').value) || 0;
    const garantia = document.getElementById('est-garantia').value;
    
    if (!nome || preco <= 0) return alert('Preencha nome e preço válido!');

    const btn = document.getElementById('btn-salvar-est');
    btn.disabled = true; btn.innerText = "Salvando...";

    if (estoqueEditId) {
        await db.from('estoque').update({ nome, preco, custo, garantia }).eq('id', estoqueEditId);
    } else {
        await db.from('estoque').insert([{ user_id: currentUser.id, nome, preco, custo, garantia }]);
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
    carregarListaOS(); // Atualiza a lista caso algo tenha mudado
}

async function abrirOS(id) {
    const { data, error } = await db.from('ordens_servico').select('*, clientes(nome, whatsapp)').eq('id', id).single();
    if (error) return;
    
    osAtual = data;
    
    // Troca as telas suavemente sem destruir o HTML base
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
    const { data } = await db.from('os_itens').select('*, estoque(nome)').eq('os_id', osAtual.id);
    
    const lista = document.getElementById('lista-itens-os');
    lista.innerHTML = '';
    
    let total = 0;
    osAtual.itens = data; // Guardamos na variável global para o PDF e Zap
    
    data.forEach(item => {
        total += item.subtotal;
        lista.innerHTML += `
            <div class="list-item" style="padding: 8px 0;">
                <div>
                    <strong style="font-size: 14px;">${item.estoque.nome}</strong><br>
                    <small>${item.quantidade}x R$ ${item.preco_unitario.toFixed(2)}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <strong>R$ ${item.subtotal.toFixed(2)}</strong>
                    <button class="btn-small btn-danger" onclick="removerItemOS('${item.id}')">X</button>
                </div>
            </div>
        `;
    });
    
    osAtual.valor_total = total;
    document.getElementById('det-os-total').innerText = total.toFixed(2);
    await db.from('ordens_servico').update({ valor_total: total }).eq('id', osAtual.id);
}

async function adicionarItemNaOS() {
    const estoque_id = document.getElementById('add-os-item').value;
    const quantidade = parseInt(document.getElementById('add-os-qtd').value);
    
    if (!estoque_id || quantidade < 1) return;
    
    const { data: itemEstoque } = await db.from('estoque').select('preco, garantia').eq('id', estoque_id).single();
    const subtotal = itemEstoque.preco * quantidade;
    
    await db.from('os_itens').insert([{ 
        os_id: osAtual.id, estoque_id, quantidade, preco_unitario: itemEstoque.preco, subtotal 
    }]);
    
    // Atualiza a garantia da OS baseada na última peça
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

function enviarWhatsApp() {
    if(!osAtual) return;
    const celular = osAtual.clientes.whatsapp;
    if(!celular) return alert("Cliente sem WhatsApp cadastrado!");
    
    let texto = `*Assistência Técnica*\nOlá ${osAtual.clientes.nome}!\n\nSeu orçamento para o aparelho *${osAtual.aparelho}* ficou pronto.\n\n*Valor Total: R$ ${osAtual.valor_total.toFixed(2)}*\n\nStatus: ${osAtual.status}`;
    window.open(`https://api.whatsapp.com/send?phone=55${celular.replace(/\D/g,'')}&text=${encodeURIComponent(texto)}`);
}

// ==========================================
// MÓDULO 4: PERFIL DA EMPRESA E PDF
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
    alert("✅ Perfil da Assistência salvo com sucesso! O cabeçalho dos seus orçamentos foi atualizado.");
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

function gerarPDF() {
    if(!osAtual) return;
    
    // 1. Aplica a marca da empresa
    prepararCabecalhoPDF();

    // 2. Preenche os dados da OS no molde oculto
    document.getElementById('pdf-os-numero').innerText = `Orçamento / OS #${osAtual.id.substring(0,6).toUpperCase()}`;
    document.getElementById('pdf-cliente').innerText = `${osAtual.clientes.nome} - ${osAtual.clientes.whatsapp || ''}`;
    document.getElementById('pdf-aparelho').innerText = osAtual.aparelho;
    document.getElementById('pdf-defeito').innerText = osAtual.defeito_relatado || 'Não informado';
    
    let htmlTabela = '';
    (osAtual.itens || []).forEach(item => {
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
    
    // 3. Prepara e gera o PDF (Com a correção de tela branca)
    const molde = document.getElementById('pdf-molde');
    const wrapper = document.getElementById('pdf-wrapper');
    
    wrapper.style.display = 'block'; // Mostra temporariamente
    
    let opt = {
      margin:       0,
      filename:     `Orcamento_${osAtual.clientes.nome.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, scrollY: 0 }, // scrollY: 0 corrige o erro de rolagem do celular
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Dá um respiro de 100ms para o navegador desenhar a tela e a logo antes de bater a foto
    setTimeout(() => {
        html2pdf().set(opt).from(molde).save().then(() => {
            wrapper.style.display = 'none'; // Esconde novamente
        });
    }, 100);
}
