// Importa apenas a conexão com o banco de dados
import { supabase } from './supabase-client.js';

// ==========================================
// CARREGAR OPÇÕES DO FORMULÁRIO (GRUPOS E UNIDADES)
// ==========================================
export async function carregarOpcoesFormulario() {
  const selectGrupo = document.getElementById('grupo_id');
  const selectUnidade = document.getElementById('unidade_id');

  // 1. Carregar Grupos Farmacológicos (Coluna 'nome')
  if (selectGrupo) {
    const { data: grupos, error: errGrupos } = await supabase
      .from('grupos_farmacologicos') 
      .select('*')
      .order('nome', { ascending: true });

    if (!errGrupos && grupos) {
      selectGrupo.innerHTML = '<option value="">Selecione o grupo...</option>';
      grupos.forEach(grupo => {
        selectGrupo.innerHTML += `<option value="${grupo.id}">${grupo.nome}</option>`;
      });
    }
  }

  // 2. Carregar Unidades de Medida (Colunas 'sigla' e 'descricao')
  if (selectUnidade) {
    const { data: unidades, error: errUnidades } = await supabase
      .from('unidades_medida')
      .select('*')
      .order('descricao', { ascending: true }); 

    if (!errUnidades && unidades) {
      selectUnidade.innerHTML = '<option value="">Selecione a unidade...</option>';
      unidades.forEach(unidade => {
        selectUnidade.innerHTML += `<option value="${unidade.id}">${unidade.sigla} - ${unidade.descricao}</option>`;
      });
    }
  }
}

// ==========================================
// TELA DE MEDICAMENTOS (LISTAR, FILTRAR, SALVAR E DESATIVAR)
// ==========================================
export async function carregarMedicamentos() {
  const tbody = document.getElementById('tabela-medicamentos');
  if (!tbody) return;

  // 1. Verifica se o checkbox "Ver inativos" está marcado na tela
  const checkboxInativos = document.getElementById('check-inativos');
  const mostrarInativos = checkboxInativos ? checkboxInativos.checked : false;

  // 2. Busca no Supabase considerando a Lixeira ou Catálogo Normal
  const { data, error } = await supabase
    .from('medicamentos')
    .select('*')
    .eq('ativo', !mostrarInativos)
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar medicamentos:', error);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Erro ao carregar dados</td></tr>`;
    return;
  }

  if (data.length === 0) {
    const mensagem = mostrarInativos ? 'Nenhum medicamento na lixeira.' : 'Nenhum medicamento cadastrado.';
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${mensagem}</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  
  // 3. Desenha as linhas preservando as suas colunas exatas
  data.forEach(med => {
    let botoesAcao = '';

    if (mostrarInativos) {
      // Se for a lixeira, mostra apenas o botão de Reativar
      botoesAcao = `<button type="button" class="btn-reativar" onclick="reativarMedicamento('${med.id}', '${med.nome}')" style="border:none; background:transparent; cursor:pointer; font-size:1.1rem;" title="Reativar">♻️</button>`;
    } else {
      // Se for catálogo normal, mantém os botões originais
      botoesAcao = `
        <button type="button" class="btn-editar" onclick="prepararEdicaoMedicamento('${med.id}')" data-id="${med.id}" style="border:none; background:transparent; cursor:pointer; font-size:1.1rem;" title="Editar">✏️</button>
        <button type="button" class="btn-desativar" onclick="desativarMedicamento('${med.id}', '${med.nome}')" data-id="${med.id}" data-nome="${med.nome}" style="border:none; background:transparent; cursor:pointer; font-size:1.1rem;" title="Desativar">🚫</button>
      `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${med.nome}</td>
      <td>${med.principio_ativo || '-'}</td>
      <td>${med.codigo_barras || '-'}</td>
      <td>${med.estoque_minimo} / ${med.estoque_maximo}</td>
      <td>${med.medicamento_controlado ? 'Sim ⚠️' : 'Não'}</td>
      <td>${botoesAcao}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// SALVAR MEDICAMENTO (CADASTRO E EDIÇÃO)
// ==========================================
export async function salvarMedicamento(event) {
  event.preventDefault();

  const id = document.getElementById('medicamento_id').value;
  const nome = document.getElementById('nome').value;
  const principio_ativo = document.getElementById('principio_ativo').value;
  const codigo_barras = document.getElementById('codigo_barras').value;
  const estoque_minimo = document.getElementById('estoque_minimo').value;
  const estoque_maximo = document.getElementById('estoque_maximo').value;
  const grupo_id = document.getElementById('grupo_id').value;
  const unidade_id = document.getElementById('unidade_id').value;
  const controlado = document.getElementById('controlado').checked;

  const payload = {
    nome,
    principio_ativo,
    codigo_barras,
    estoque_minimo: parseInt(estoque_minimo),
    estoque_maximo: parseInt(estoque_maximo),
    medicamento_controlado: controlado,
    grupo_farmacologico_id: grupo_id ? grupo_id : null,
    unidade_medida_id: unidade_id ? unidade_id : null
  };

  let error;
  if (id) {
    // Modo Edição
    const res = await supabase.from('medicamentos').update(payload).eq('id', id);
    error = res.error;
  } else {
    // Modo Cadastro
    const res = await supabase.from('medicamentos').insert([payload]);
    error = res.error;
  }

  if (error) {
    Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: 'Erro ao salvar: ' + error.message,
      confirmButtonColor: '#0284c7'
    });
  } else {
    Swal.fire({
      icon: 'success',
      title: 'Sucesso!',
      text: id ? 'Medicamento atualizado!' : 'Medicamento cadastrado!',
      timer: 2000,
      showConfirmButton: false
    });
    
    resetarFormularioMedicamento();
    carregarMedicamentos();
  }
}

// ==========================================
// PREPARAR EDIÇÃO DE MEDICAMENTO
// ==========================================
export async function prepararEdicaoMedicamento(id) {
  const { data, error } = await supabase.from('medicamentos').select('*').eq('id', id).single();
  
  if (error) {
    alert('Erro ao carregar dados para edição: ' + error.message);
    return;
  }

  document.getElementById('medicamento_id').value = data.id;
  document.getElementById('nome').value = data.nome;
  document.getElementById('principio_ativo').value = data.principio_ativo || '';
  document.getElementById('codigo_barras').value = data.codigo_barras || '';
  document.getElementById('estoque_minimo').value = data.estoque_minimo;
  document.getElementById('estoque_maximo').value = data.estoque_maximo;
  document.getElementById('controlado').checked = data.medicamento_controlado;

  const btnSubmit = document.querySelector('#form-medicamento button[type="submit"]');
  if (btnSubmit) btnSubmit.innerText = 'Salvar Alterações 💾';
}

// ==========================================
// DESATIVAR MEDICAMENTO (SOFT DELETE)
// ==========================================
export function desativarMedicamento(id, nome) {
  Swal.fire({
    title: 'Tem certeza?',
    text: `Deseja realmente desativar o medicamento "${nome}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sim, desativar!',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const { error } = await supabase.from('medicamentos').update({ ativo: false }).eq('id', id);

      if (error) {
        Swal.fire({
          icon: 'error',
          title: 'Erro!',
          text: 'Não foi possível desativar: ' + error.message,
          confirmButtonColor: '#0284c7'
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Desativado!',
          text: 'O medicamento foi removido do catálogo ativo.',
          timer: 2000,
          showConfirmButton: false
        });
        carregarMedicamentos();
      }
    }
  });
}

// ==========================================
// REATIVAR MEDICAMENTO
// ==========================================
export function reativarMedicamento(id, nome) {
  Swal.fire({
    title: 'Reativar Medicamento?',
    text: `O medicamento "${nome}" voltará para o catálogo ativo.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#22c55e',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sim, reativar!',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const { error } = await supabase.from('medicamentos').update({ ativo: true }).eq('id', id);

      if (error) {
        Swal.fire('Erro!', 'Não foi possível reativar: ' + error.message, 'error');
      } else {
        Swal.fire({ icon: 'success', title: 'Reativado!', timer: 1500, showConfirmButton: false });
        carregarMedicamentos();
      }
    }
  });
}

// ==========================================
// EXPOR DO MÓDULO PARA O WINDOW (HTML LER)
// ==========================================
window.reativarMedicamento = reativarMedicamento;
window.desativarMedicamento = desativarMedicamento;
window.prepararEdicaoMedicamento = prepararEdicaoMedicamento;

// ==========================================
// AUXILIARES: RESETAR E FILTRAR
// ==========================================
function resetarFormularioMedicamento() {
  document.getElementById('form-medicamento').reset();
  document.getElementById('medicamento_id').value = '';
  const btnSubmit = document.querySelector('#form-medicamento button[type="submit"]');
  if (btnSubmit) btnSubmit.innerText = 'Cadastrar Medicamento';
}

export function filtrarMedicamentos() {
  const inputBusca = document.getElementById('input-busca');
  if (!inputBusca) return;

  const termo = inputBusca.value.toLowerCase();
  const linhas = document.querySelectorAll('#tabela-medicamentos tr');

  linhas.forEach(linha => {
    if (linha.cells.length === 1) return;
    const textoLinha = linha.innerText.toLowerCase();
    
    if (textoLinha.includes(termo)) {
      linha.style.display = '';
    } else {
      linha.style.display = 'none';
    }
  });
}