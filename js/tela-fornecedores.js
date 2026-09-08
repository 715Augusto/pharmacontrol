import { supabase } from './supabase-client.js';

// ==========================================
// CARREGAR FORNECEDORES NA TABELA
// ==========================================
export async function carregarFornecedores() {
  const tbody = document.getElementById('lista-fornecedores');
  if (!tbody) return;

  // AJUSTE: Só busca os fornecedores ativos (ou os antigos que estão com valor nulo)
  const { data, error } = await supabase
    .from('fornecedores')
    .select('*')
    .or('ativo.eq.true,ativo.is.null') 
    .order('nome_fantasia', { ascending: true });

  if (error) {
    console.error('Erro ao carregar fornecedores:', error);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Erro ao carregar dados</td></tr>`;
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Nenhum fornecedor cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  
  data.forEach(forn => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${forn.razao_social || '-'}</td>
      <td><strong>${forn.nome_fantasia || '-'}</strong></td>
      <td>${forn.cnpj || '-'}</td>
      <td>${forn.telefone || '-'}</td>
      <td>${forn.email || '-'}</td>
      <td>
        <button type="button" onclick="prepararEdicaoFornecedor('${forn.id}')" style="border:none; background:transparent; cursor:pointer; font-size:1.1rem;" title="Editar">✏️</button>
        <button type="button" onclick="excluirFornecedor('${forn.id}', '${forn.nome_fantasia || forn.razao_social}')" style="border:none; background:transparent; cursor:pointer; font-size:1.1rem;" title="Desativar">🚫</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// SALVAR FORNECEDOR (CADASTRO E EDIÇÃO)
// ==========================================
export async function salvarFornecedor(event) {
  event.preventDefault();

  const idEl = document.getElementById('fornecedor_id');
  const id = idEl ? idEl.value : '';
  
  const razao_social = document.getElementById('razao_social')?.value.trim();
  const nome_fantasia = document.getElementById('nome_fantasia')?.value.trim();
  const cnpj = document.getElementById('cnpj')?.value.trim();
  const telefone = document.getElementById('telefone')?.value.trim();
  const email = document.getElementById('email')?.value.trim();

  const payload = { razao_social, nome_fantasia, cnpj, telefone, email, ativo: true };

  let error;
  
  if (id) {
    // AJUSTE: Adicionamos o .select() no final. Isso obriga o banco a devolver a linha alterada.
    const res = await supabase.from('fornecedores').update(payload).eq('id', id).select();
    error = res.error;
    
    // TRAVA DE SEGURANÇA: Se não deu erro, mas o banco não alterou nenhuma linha
    if (!error && res.data && res.data.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Edição Bloqueada',
        text: 'O banco não salvou a alteração. Verifique as permissões (RLS) no Supabase.'
      });
      return; // Para a execução aqui!
    }
  } else {
    // Modo Inserir (Novo Fornecedor)
    const res = await supabase.from('fornecedores').insert([payload]);
    error = res.error;
  }

  if (error) {
    if (error.code === '23505') {
      Swal.fire({ icon: 'warning', title: 'CNPJ Duplicado', text: 'Já existe um fornecedor com este CNPJ!' });
    } else {
      Swal.fire({ icon: 'error', title: 'Oops...', text: 'Erro ao salvar: ' + error.message });
    }
  } else {
    Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Fornecedor salvo com sucesso!', timer: 2000, showConfirmButton: false });
    
    document.getElementById('form-fornecedor').reset();
    if (idEl) idEl.value = '';
    
    const btnSubmit = document.querySelector('#form-fornecedor button[type="submit"]');
    if (btnSubmit) btnSubmit.innerText = 'Cadastrar Fornecedor';
    
    carregarFornecedores();
  }
}

// ==========================================
// PREPARAR EDIÇÃO E EXCLUSÃO (DESATIVAÇÃO)
// ==========================================
export async function prepararEdicaoFornecedor(id) {
  const { data, error } = await supabase.from('fornecedores').select('*').eq('id', id).single();
  if (error) {
    Swal.fire('Erro!', 'Não foi possível carregar os dados.', 'error');
    return;
  }

  const idEl = document.getElementById('fornecedor_id');
  if (!idEl) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.id = 'fornecedor_id';
    document.getElementById('form-fornecedor').appendChild(input);
  }
  
  document.getElementById('fornecedor_id').value = data.id;
  if (document.getElementById('razao_social')) document.getElementById('razao_social').value = data.razao_social || '';
  if (document.getElementById('nome_fantasia')) document.getElementById('nome_fantasia').value = data.nome_fantasia || '';
  if (document.getElementById('cnpj')) document.getElementById('cnpj').value = data.cnpj || '';
  if (document.getElementById('telefone')) document.getElementById('telefone').value = data.telefone || '';
  if (document.getElementById('email')) document.getElementById('email').value = data.email || '';

  const btnSubmit = document.querySelector('#form-fornecedor button[type="submit"]');
  if (btnSubmit) btnSubmit.innerText = 'Salvar Alterações 💾';
}

export function excluirFornecedor(id, nome) {
  Swal.fire({
    title: 'Desativar Fornecedor?',
    text: `Deseja remover "${nome}" da lista ativa? O histórico de notas fiscais será mantido.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sim, desativar!',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      // AJUSTE: Faz o Soft Delete (Apenas altera a coluna ativo para false)
      const { error } = await supabase.from('fornecedores').update({ ativo: false }).eq('id', id);
      
      if (error) {
        Swal.fire('Erro!', 'Não foi possível desativar: ' + error.message, 'error');
      } else {
        Swal.fire({ icon: 'success', title: 'Desativado!', timer: 1500, showConfirmButton: false });
        carregarFornecedores();
      }
    }
  });
}

window.prepararEdicaoFornecedor = prepararEdicaoFornecedor;
window.excluirFornecedor = excluirFornecedor;