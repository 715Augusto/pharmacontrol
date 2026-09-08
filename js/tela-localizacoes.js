import { supabase } from './supabase-client.js';

// ==========================================
// CARREGAR LOCALIZAÇÕES NA TABELA
// ==========================================
export async function carregarLocalizacoes() {
  const tbody = document.getElementById('lista-localizacoes');
  if (!tbody) return;

  const { data, error } = await supabase
    .from('localizacoes')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar locais:', error);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Erro ao carregar dados</td></tr>`;
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--muted); padding: 20px;">Nenhum local cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(loc => {
    // Cria as etiquetas visuais para o Tipo
    const tagTipo = loc.eh_kit 
      ? '<span style="background:#eab308; color:#0f172a; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">🚑 Kit Móvel</span>' 
      : '<span style="background:#e2e8f0; color:#475569; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">🏢 Base Fixa</span>';
    
    return `
      <tr>
        <td><strong>${loc.nome}</strong></td>
        <td>${loc.descricao || '-'}</td>
        <td>${tagTipo}</td>
        <td>
          <button type="button" onclick="prepararEdicaoLocalizacao('${loc.id}')" style="border:none; background:transparent; cursor:pointer; font-size:1.1rem;" title="Editar">✏️</button>
          <button type="button" onclick="excluirLocalizacao('${loc.id}', '${loc.nome}')" style="border:none; background:transparent; cursor:pointer; font-size:1.1rem;" title="Excluir">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// SALVAR LOCALIZAÇÃO (CADASTRO E EDIÇÃO)
// ==========================================
export async function salvarLocalizacao(event) {
  event.preventDefault();

  const idEl = document.getElementById('localizacao_id');
  const id = idEl ? idEl.value : '';
  
  const nome = document.getElementById('nome_local')?.value.trim();
  const descricao = document.getElementById('descricao_local')?.value.trim();
  const eh_kit = document.getElementById('eh_kit')?.checked || false;

  const payload = { nome, descricao, eh_kit };

  let error;
  if (id) {
    // O .select() previne a falha silenciosa de atualização sem permissão
    const res = await supabase.from('localizacoes').update(payload).eq('id', id).select();
    error = res.error;
    
    if (!error && res.data && res.data.length === 0) {
      Swal.fire({ icon: 'error', title: 'Edição Bloqueada', text: 'Sem permissão para atualizar.' });
      return;
    }
  } else {
    const res = await supabase.from('localizacoes').insert([payload]);
    error = res.error;
  }

  if (error) {
    Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao salvar: ' + error.message });
  } else {
    Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Localização salva!', timer: 1500, showConfirmButton: false });
    
    // Limpa o formulário e reseta o botão
    document.getElementById('form-localizacao').reset();
    if (idEl) idEl.value = '';
    
    const btnSubmit = document.querySelector('#form-localizacao button[type="submit"]');
    if (btnSubmit) btnSubmit.innerText = 'Salvar Localização';
    
    carregarLocalizacoes();
  }
}

// ==========================================
// PREPARAR EDIÇÃO E EXCLUSÃO
// ==========================================
export async function prepararEdicaoLocalizacao(id) {
  const { data, error } = await supabase.from('localizacoes').select('*').eq('id', id).single();
  if (error) {
    Swal.fire('Erro!', 'Não foi possível carregar os dados.', 'error');
    return;
  }

  document.getElementById('localizacao_id').value = data.id;
  document.getElementById('nome_local').value = data.nome || '';
  document.getElementById('descricao_local').value = data.descricao || '';
  document.getElementById('eh_kit').checked = data.eh_kit;

  const btnSubmit = document.querySelector('#form-localizacao button[type="submit"]');
  if (btnSubmit) btnSubmit.innerText = 'Salvar Alterações 💾';
}

export function excluirLocalizacao(id, nome) {
  Swal.fire({
    title: 'Excluir Localização?',
    text: `Deseja realmente excluir "${nome}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sim, excluir!',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const { error } = await supabase.from('localizacoes').delete().eq('id', id);
      
      if (error) {
        Swal.fire('Não foi possível excluir', 'Este local não pode ser excluído pois existem Maletas ou Movimentações vinculadas a ele. Tente alterar o nome.', 'error');
      } else {
        Swal.fire({ icon: 'success', title: 'Excluído!', timer: 1500, showConfirmButton: false });
        carregarLocalizacoes();
      }
    }
  });
}

// Expor para os botões gerados dinamicamente no HTML
window.prepararEdicaoLocalizacao = prepararEdicaoLocalizacao;
window.excluirLocalizacao = excluirLocalizacao;