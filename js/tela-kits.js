// Importa o banco de dados e utilitários
import { supabase } from './supabase-client.js';
import { mostrarNotificacao } from './utils.js';

// ==========================================
// MÓDULO: KITS (TIPOS, RECEITAS E FÍSICOS)
// ==========================================

export async function carregarDadosTelaKits() {
  const selectMed = document.getElementById('select_medicamento');
  if (selectMed) {
    const { data: medicamentos, error: errMed } = await supabase
      .from('medicamentos')
      .select('id, nome, principio_ativo')
      .order('nome', { ascending: true });

    if (!errMed && medicamentos) {
      selectMed.innerHTML = '<option value="">Selecione o medicamento...</option>' + 
        medicamentos.map(m => `<option value="${m.id}">${m.nome} (${m.principio_ativo || 'Sem princípio'})</option>`).join('');
    }
  }

  const selectKitReceita = document.getElementById('select_tipo_kit_receita');
  const selectKitFisico = document.getElementById('select_tipo_kit_fisico'); 
  
  if (selectKitReceita || selectKitFisico) {
    const { data: tiposKit, error: errKit } = await supabase
      .from('tipos_kit')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (!errKit && tiposKit) {
      const optionsHtml = '<option value="">Selecione o tipo de kit...</option>' + 
        tiposKit.map(k => `<option value="${k.id}">${k.nome}</option>`).join('');
        
      if (selectKitReceita) selectKitReceita.innerHTML = optionsHtml;
      if (selectKitFisico) selectKitFisico.innerHTML = optionsHtml;
    }
  }
}

export async function salvarTipoKit(event) {
  event.preventDefault();

  const btnSubmit = event.target.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.innerText = 'Salvando...';

  const nome = document.getElementById('nome_kit').value.trim();
  const descricao = document.getElementById('descricao_kit').value.trim();

  const { error } = await supabase
    .from('tipos_kit')
    .insert([{ nome, descricao }]);

  btnSubmit.disabled = false;
  btnSubmit.innerText = 'Salvar Definição';

  if (error) {
    console.error('Erro ao salvar tipo de kit:', error);
    if (error.code === '23505') {
      mostrarNotificacao('Já existe um tipo de kit cadastrado com este nome!', 'warning');
    } else {
      mostrarNotificacao('Erro ao salvar o Kit. Tente novamente.', 'error');
    }
    return;
  }

  mostrarNotificacao('Tipo de Kit cadastrado com sucesso!', 'success');
  document.getElementById('form-tipo-kit').reset();
  carregarDadosTelaKits(); 
  carregarTabelaTiposKit();
}

export async function salvarItemDaReceita(event) {
  event.preventDefault();

  const btnSubmit = event.target.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.innerText = 'Vinculando...';

  const kit_id = document.getElementById('select_tipo_kit_receita').value;
  const medicamento_id = document.getElementById('select_medicamento').value;
  const quantidade_padrao = parseInt(document.getElementById('quantidade_padrao').value);

  const { error } = await supabase
    .from('kit_itens')
    .insert([{ kit_id, medicamento_id, quantidade_padrao }]);

  btnSubmit.disabled = false;
  btnSubmit.innerText = 'Vincular Item à Receita';

  if (error) {
    console.error('Erro ao vincular medicamento ao kit:', error);
    mostrarNotificacao('Erro ao vincular. Verifique se o item já não está no kit.', 'error');
    return;
  }

  mostrarNotificacao('Medicamento adicionado à receita com sucesso!', 'success');
  document.getElementById('select_medicamento').value = '';
  document.getElementById('quantidade_padrao').value = '1';
}

// -----------------------------------------------------
// FUNÇÕES DA ABA 2: KITS FÍSICOS (MALETAS E LACRES)
// -----------------------------------------------------

export async function carregarLocalizacoesKits() {
  const selectLoc = document.getElementById('select_localizacao');
  if (!selectLoc) return;

  const { data: locs, error } = await supabase
    .from('localizacoes')
    .select('id, nome, eh_kit')
    .order('nome', { ascending: true });

  if (!error && locs) {
    selectLoc.innerHTML = '<option value="">Selecione onde será guardado...</option>' + 
      locs.map(l => {
        const tipo = l.eh_kit ? '🚑 Viatura/Satélite' : '🏢 Base/Estoque Fixo';
        return `<option value="${l.id}">${l.nome} (${tipo})</option>`;
      }).join('');
  }
}

export async function salvarKitFisico(event) {
  event.preventDefault();
  
  const btnSubmit = event.target.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.innerText = 'Registrando...';

  const tipo_kit_id = document.getElementById('select_tipo_kit_fisico').value;
  const numero_lacre = document.getElementById('numero_lacre').value;
  const localizacao_id = document.getElementById('select_localizacao').value;

  const { error } = await supabase
    .from('kits_fisicos')
    .insert([{ tipo_kit_id, numero_lacre, localizacao_id, status: 'DISPONÍVEL' }]);

  btnSubmit.disabled = false;
  btnSubmit.innerText = 'Registrar Maleta';

  if (error) {
    console.error('Erro ao registrar maleta:', error);
    mostrarNotificacao('Erro ao registrar. Verifique se este Lacre já existe.', 'error');
    return;
  }

  mostrarNotificacao('Maleta (Lacre) registrada com sucesso!', 'success');
  document.getElementById('form-kit-fisico').reset();
  carregarTabelaKitsFisicos();
}

export async function carregarTabelaKitsFisicos() {
  const tbody = document.getElementById('tabela-kits-fisicos');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Carregando maletas...</td></tr>';

  const { data, error } = await supabase
    .from('kits_fisicos')
    .select(`
      id, 
      numero_lacre, 
      status, 
      tipos_kit (nome), 
      localizacoes (nome)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar maletas:', error);
    tbody.innerHTML = '<tr><td colspan="4" class="status-critico text-center">Erro ao carregar dados.</td></tr>';
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted);">Nenhuma maleta registrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(kit => {
    let classeStatus = 'status-disponivel';
    if (kit.status !== 'DISPONÍVEL') classeStatus = 'status-em-uso';

    return `
      <tr>
        <td><strong>${kit.numero_lacre}</strong></td>
        <td>${kit.tipos_kit?.nome || '-'}</td>
        <td>${kit.localizacoes?.nome || '-'}</td>
        <td><span class="status-badge ${classeStatus}">${kit.status}</span></td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// CARREGAR TABELA DE TIPOS DE KIT (MOLDES)
// ==========================================
export async function carregarTabelaTiposKit() {
  const tbody = document.getElementById('tabela-tipos-kit');
  if (!tbody) return;

  const { data, error } = await supabase
    .from('tipos_kit')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao buscar tipos de kit:', error);
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Erro ao carregar dados.</td></tr>';
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--muted);">Nenhum tipo de kit cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(kit => `
    <tr>
      <td><strong>${kit.nome}</strong></td>
      <td>${kit.descricao || '-'}</td>
      <td>
        <button type="button" onclick="excluirTipoKit('${kit.id}', '${kit.nome}')" style="border:none; background:transparent; cursor:pointer; font-size:1.1rem;" title="Excluir Molde">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ==========================================
// EXCLUIR TIPO DE KIT
// ==========================================
export function excluirTipoKit(id, nome) {
  Swal.fire({
    title: 'Excluir Tipo de Kit?',
    text: `Atenção: Você está tentando excluir o molde "${nome}". Isso só será possível se não houver maletas ou receitas atreladas a ele.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sim, tentar excluir!',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const { error } = await supabase.from('tipos_kit').delete().eq('id', id);
      
      if (error) {
        // Se houver itens na tabela kit_itens ou kits_fisicos ligados a ele, o banco bloqueia a exclusão por segurança (Erro de Chave Estrangeira)
        Swal.fire('Não foi possível excluir', 'Existem medicamentos na receita ou maletas físicas atreladas a este tipo de kit. Remova-os primeiro.', 'error');
      } else {
        Swal.fire({ icon: 'success', title: 'Excluído!', timer: 1500, showConfirmButton: false });
        carregarTabelaTiposKit();
        carregarDadosTelaKits(); // Atualiza os selects da tela
      }
    }
  });
}

// Expor para o botão no HTML funcionar
window.excluirTipoKit = excluirTipoKit;
