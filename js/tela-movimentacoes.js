// Importa o banco de dados
import { supabase } from './supabase-client.js';

// ==========================================
// 3. TELA DE MOVIMENTAÇÕES (REGISTRAR ENTRADA)
// ==========================================
// Array global para guardar temporariamente os itens adicionados na tela
let itensNotaFiscal = [];

export async function carregarMedicamentosSelect() {
  const select = document.getElementById('select_medicamento');
  if (!select) return;

  const { data: medicamentos, error } = await supabase
    .from('medicamentos')
    .select('id, nome, principio_ativo')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar medicamentos no select:', error);
    return;
  }

  select.innerHTML = '<option value="">Selecione o medicamento...</option>';
  medicamentos.forEach(med => {
    select.innerHTML += `<option value="${med.id}">${med.nome} (${med.principio_ativo || 'Sem princípio ativo'})</option>`;
  });
}

export async function carregarFornecedoresSelect() {
  const select = document.getElementById('select_fornecedor');
  if (!select) return;

  const { data: fornecedores, error } = await supabase
    .from('fornecedores')
    .select('id, nome_fantasia, razao_social')
    .or('ativo.eq.true,ativo.is.null')
    .order('nome_fantasia', { ascending: true });

  if (error) {
    console.error('Erro ao carregar fornecedores:', error);
    select.innerHTML = '<option value="">Erro ao carregar fornecedores</option>';
    return;
  }

  if (!fornecedores || fornecedores.length === 0) {
    select.innerHTML = '<option value="">Nenhum fornecedor cadastrado</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecione o fornecedor...</option>';
  fornecedores.forEach(f => {
    const nomeExibicao = f.nome_fantasia || f.razao_social;
    select.innerHTML += `<option value="${nomeExibicao}">${nomeExibicao}</option>`;
  });
}

export function adicionarItemNota() {
  const selectMed = document.getElementById('select_medicamento');
  const medicamentoId = selectMed ? selectMed.value : '';
  const medicamentoNome = selectMed ? selectMed.options[selectMed.selectedIndex].text : '';
  
  const numeroLote = document.getElementById('item_lote').value.trim();
  const dataValidade = document.getElementById('item_validade').value;
  const quantidade = parseInt(document.getElementById('item_quantidade').value);
  const valorUnitario = parseFloat(document.getElementById('item_valor_unitario').value);

  if (!medicamentoId || !numeroLote || !dataValidade || isNaN(quantidade) || quantidade <= 0 || isNaN(valorUnitario) || valorUnitario < 0) {
    Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Preencha todos os campos do medicamento corretamente!' });
    return;
  }

  const subtotal = quantidade * valorUnitario;

  itensNotaFiscal.push({
    medicamento_id: medicamentoId,
    medicamento_nome: medicamentoNome,
    numero_lote: numeroLote,
    data_validade: dataValidade,
    quantidade: quantidade,
    valor_unitario: valorUnitario,
    subtotal: subtotal
  });

  document.getElementById('item_lote').value = '';
  document.getElementById('item_validade').value = '';
  document.getElementById('item_quantidade').value = '';
  document.getElementById('item_valor_unitario').value = '';
  selectMed.value = '';

  renderizarTabelaItens();
}

function renderizarTabelaItens() {
  const tbody = document.getElementById('tbody-itens-nota');
  const txtTotal = document.getElementById('txt-valor-total');
  if (!tbody) return;

  if (itensNotaFiscal.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">Nenhum item adicionado à nota fiscal ainda.</td></tr>`;
    if (txtTotal) txtTotal.textContent = 'R$ 0,00';
    return;
  }

  tbody.innerHTML = '';
  let totalNota = 0;

  itensNotaFiscal.forEach((item, index) => {
    totalNota += item.subtotal;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.medicamento_nome}</td>
      <td>${item.numero_lote}</td>
      <td>${new Date(item.data_validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
      <td>${item.quantidade}</td>
      <td>R$ ${item.valor_unitario.toFixed(2)}</td>
      <td><strong>R$ ${item.subtotal.toFixed(2)}</strong></td>
      <td><button type="button" onclick="removerItemNota(${index})" class="btn-remover">🗑️</button></td>
    `;
    tbody.appendChild(tr);
  });

  if (txtTotal) {
    txtTotal.textContent = `R$ ${totalNota.toFixed(2)}`;
  }
}

export function removerItemNota(index) {
  itensNotaFiscal.splice(index, 1);
  renderizarTabelaItens();
}
export async function finalizarNotaFiscal() {
  if (itensNotaFiscal.length === 0) {
    Swal.fire({ icon: 'warning', title: 'Nota Vazia', text: 'Adicione pelo menos um medicamento à nota fiscal antes de salvar!' });
    return;
  }

  const tipo = 'ENTRADA';
  const numeroNF = document.getElementById('numero_nota_fiscal')?.value.trim() || '';
  const fornecedor = document.getElementById('select_fornecedor')?.value.trim() || '';
  const observacao = document.getElementById('observacao_nota')?.value.trim() || '';
  
  // MUDANÇA: Pegando o valor total real digitado pela farmacêutica
  const valorTotalDigitado = parseFloat(document.getElementById('valor_total_documento')?.value) || 0;

  // TRAVA DE SEGURANÇA: Exige que o valor total da nota seja informado
  if (valorTotalDigitado <= 0) {
    Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe o Valor Total da Nota Fiscal conforme impresso no documento!' });
    return;
  }

  const inputArquivo = document.getElementById('arquivo_nota');
  const arquivo = inputArquivo?.files ? inputArquivo.files[0] : null;

  Swal.fire({
    title: 'Processando...',
    text: 'Registrando nota fiscal e atualizando estoque.',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    if (numeroNF && fornecedor) {
      const { data: notaDuplicada } = await supabase
        .from('movimentacoes')
        .select('id')
        .eq('numero_nota_fiscal', numeroNF)
        .eq('fornecedor', fornecedor)
        .maybeSingle();

      if (notaDuplicada) {
        Swal.fire({
          icon: 'warning',
          title: 'Nota Já Cadastrada',
          text: `A Nota Fiscal "${numeroNF}" do fornecedor "${fornecedor}" já foi lançada anteriormente!`,
          confirmButtonColor: '#0284c7'
        });
        return;
      }
    }

    let urlNotaFiscal = null;

    if (arquivo) {
      const extensao = arquivo.name.split('.').pop();
      const nomeArquivo = `${Date.now()}_${Math.random().toString(36).substring(2)}.${extensao}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('notas_fiscais')
        .upload(nomeArquivo, arquivo);

      if (uploadError) {
        throw new Error(`Erro ao enviar o anexo: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('notas_fiscais')
        .getPublicUrl(nomeArquivo);

      urlNotaFiscal = urlData.publicUrl;
    }

    const { data: notaCriada, error: errNota } = await supabase
      .from('movimentacoes')
      .insert([{
        tipo: tipo,
        numero_nota_fiscal: numeroNF,
        fornecedor: fornecedor,
        valor_total_nota: valorTotalDigitado, // <-- SALVANDO O VALOR REAL DA NOTA AQUI
        observacao: observacao,
        url_nota_fiscal: urlNotaFiscal
      }])
      .select()
      .single();

    if (errNota) throw errNota;

    const { data: { session } } = await supabase.auth.getSession();
    const usuarioId = session?.user?.id || null;

    for (const item of itensNotaFiscal) {
      let { data: loteExistente } = await supabase
        .from('lotes_estoque')
        .select('id')
        .eq('medicamento_id', item.medicamento_id)
        .eq('numero_lote', item.numero_lote)
        .maybeSingle();

      let loteId = null;

      if (loteExistente) {
        loteId = loteExistente.id;
      } else {
        const { data: novoLote, error: errLote } = await supabase
          .from('lotes_estoque')
          .insert([{
            medicamento_id: item.medicamento_id,
            numero_lote: item.numero_lote,
            data_validade: item.data_validade,
            quantidade_atual: 0 
          }])
          .select()
          .single();

        if (errLote) throw errLote;
        loteId = novoLote.id;
      }

      const { error: errItem } = await supabase
        .from('movimentacoes_estoque')
        .insert([{
          movimentacao_id: notaCriada.id,
          lote_id: loteId,
          tipo_movimentacao: 'ENTRADA',
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total_item: item.subtotal,
          observacao: observacao,
          responsavel_id: usuarioId
        }]);

      if (errItem) throw errItem;
    }

    Swal.fire({
      icon: 'success',
      title: 'Nota Fiscal Registrada!',
      text: 'Movimentação gravada e estoques atualizados com sucesso.',
      confirmButtonColor: '#0284c7'
    });

    itensNotaFiscal = [];
    renderizarTabelaItens();
    
    // Limpeza dos campos
    document.getElementById('numero_nota_fiscal').value = '';
    document.getElementById('valor_total_documento').value = ''; // Limpa o novo campo
    
    const selectForn = document.getElementById('select_fornecedor');
    if (selectForn) selectForn.value = '';
    
    document.getElementById('observacao_nota').value = '';
    if (inputArquivo) inputArquivo.value = '';

  } catch (err) {
    console.error('Erro na gravação da nota fiscal:', err);
    Swal.fire({ icon: 'error', title: 'Erro ao Salvar', text: err.message });
  }
}

// ==========================================
// 4. TELA DE MOVIMENTAÇÕES (REGISTRAR SAÍDAS)
// ==========================================

export async function carregarMedicamentosSaidaSelect() {
  const select = document.getElementById('select_medicamento_saida');
  if (!select) return;

  const { data: medicamentos, error } = await supabase
    .from('medicamentos')
    .select('id, nome, principio_ativo')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar medicamentos de saída:', error);
    return;
  }

  select.innerHTML = '<option value="">Selecione o medicamento...</option>';
  medicamentos.forEach(med => {
    select.innerHTML += `<option value="${med.id}">${med.nome} (${med.principio_ativo || 'Sem princípio ativo'})</option>`;
  });
}

export async function carregarLocalizacoesSelect() {
  const select = document.getElementById('select_localizacao_destino');
  if (!select) return;

  const { data: localizacoes, error } = await supabase
    .from('localizacoes')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao buscar localizações:', error);
    select.innerHTML = '<option value="">Erro ao carregar localizações</option>';
    return;
  }

  if (!localizacoes || localizacoes.length === 0) {
    select.innerHTML = '<option value="">Nenhuma localização cadastrada</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecione a localização de destino...</option>';
  localizacoes.forEach(loc => {
    const nomeExibicao = loc.nome || loc.descricao || `Localização #${loc.id}`;
    select.innerHTML += `<option value="${nomeExibicao}">${nomeExibicao}</option>`;
  });
}

// ==========================================
// MÓDULO INTELIGENTE DE KITS
// ==========================================

export async function carregarTiposKitSaida() {
  const select = document.getElementById('select_tipo_kit_transferencia');
  if (!select) return;

  const { data: tipos, error } = await supabase
    .from('tipos_kit')
    .select('id, nome')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar tipos de kit:', error);
    return;
  }

  select.innerHTML = '<option value="">Selecione para filtrar a receita...</option>';
  tipos.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
  });
}

export async function carregarLacresDoKitSelecionado(tipoKitId) {
  const select = document.getElementById('select_lacre_transferencia');
  if (!select) return;

  if (!tipoKitId) {
    select.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = '<option value="">Buscando lacres...</option>';

  const { data: lacres, error } = await supabase
    .from('kits_fisicos')
    .select('numero_lacre, localizacoes(nome)')
    .eq('tipo_kit_id', tipoKitId)
    .order('numero_lacre', { ascending: true });

  if (error) {
    console.error('Erro ao carregar lacres:', error);
    select.innerHTML = '<option value="">Erro ao carregar lacres</option>';
    return;
  }

  if (!lacres || lacres.length === 0) {
    select.innerHTML = '<option value="">Nenhuma maleta deste tipo cadastrada.</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecione o Lacre / Maleta...</option>';
  lacres.forEach(l => {
    const localAtual = l.localizacoes?.nome || 'Local Desconhecido';
    select.innerHTML += `<option value="${l.numero_lacre}">Lacre: ${l.numero_lacre} (Atual: ${localAtual})</option>`;
  });
}

export async function filtrarMedicamentosPeloKit(tipoKitId) {
  const select = document.getElementById('select_medicamento_saida');
  if (!select) return;

  if (!tipoKitId) {
    carregarMedicamentosSaidaSelect(); 
    return;
  }

  select.innerHTML = '<option value="">Lendo receita do Kit...</option>';

  const { data: itens, error } = await supabase
    .from('kit_itens')
    .select(`
      quantidade_padrao,
      medicamentos (id, nome, principio_ativo)
    `)
    .eq('kit_id', tipoKitId);

  if (error) {
    console.error('Erro ao buscar receita do kit:', error);
    select.innerHTML = '<option value="">Erro ao filtrar medicamentos</option>';
    return;
  }

  if (!itens || itens.length === 0) {
    select.innerHTML = '<option value="">Este kit não possui receita.</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecione o medicamento...</option>';
  itens.forEach(item => {
    const med = item.medicamentos;
    if (med) {
      select.innerHTML += `<option value="${med.id}" data-padrao="${item.quantidade_padrao}">
        ${med.nome} (${med.principio_ativo || 'Sem princípio'}) [Padrão: ${item.quantidade_padrao} un]
      </option>`;
    }
  });
}

export async function carregarLotesSaida(medicamentoId) {
  const selectLote = document.getElementById('select_lote_saida');
  if (!selectLote) return;

  if (!medicamentoId) {
    selectLote.innerHTML = '<option value="">Selecione o medicamento primeiro...</option>';
    return;
  }

  selectLote.innerHTML = '<option value="">Carregando lotes...</option>';

  const hoje = new Date().toISOString().split('T')[0];

  const { data: lotes, error } = await supabase
    .from('lotes_estoque')
    .select('id, numero_lote, data_validade, quantidade_atual')
    .eq('medicamento_id', medicamentoId)
    .gt('quantidade_atual', 0)
    .gte('data_validade', hoje) 
    .order('data_validade', { ascending: true }); 

  if (error) {
    console.error('Erro ao buscar lotes:', error);
    selectLote.innerHTML = '<option value="">Erro ao carregar lotes</option>';
    return;
  }

  if (!lotes || lotes.length === 0) {
    selectLote.innerHTML = '<option value="">⚠️ Sem lotes VÁLIDOS com saldo disponível</option>';
    return;
  }

  let htmlOpcoes = '<option value="">Selecione o lote desejado...</option>';

  lotes.forEach((lote, index) => {
    const [ano, mes, dia] = lote.data_validade.substring(0, 10).split('-');
    const validadeFmt = `${dia}/${mes}/${ano}`;
    const tagSugerido = index === 0 ? ' ⭐ [Sugerido - Vence Primeiro]' : '';

    htmlOpcoes += `
      <option value="${lote.id}" data-qtd="${lote.quantidade_atual}">
        Lote: ${lote.numero_lote} | Vence: ${validadeFmt} | Saldo: ${lote.quantidade_atual} unid.${tagSugerido}
      </option>`;
  });

  selectLote.innerHTML = htmlOpcoes;
}

export async function finalizarSaidaEstoque() {
  const motivo = document.getElementById('saida_motivo').value;
  const medSelect = document.getElementById('select_medicamento_saida');
  const medicamentoId = medSelect.value;
  const loteSelect = document.getElementById('select_lote_saida');
  const loteId = loteSelect.value;
  const quantidadeRetirar = parseInt(document.getElementById('saida_quantidade').value);
  const observacaoGeral = document.getElementById('saida_observacao').value.trim();

  let destinoOuMotivo = '';
  
  if (motivo === 'CONSUMO') {
    destinoOuMotivo = document.getElementById('saida_destino_consumo').value.trim();
    if (!destinoOuMotivo) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe o Paciente, Leito ou Setor de destino!' });
      return;
    }
  } 
  else if (motivo === 'TRANSFERENCIA') {
    destinoOuMotivo = document.getElementById('select_localizacao_destino').value;
    if (!destinoOuMotivo) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione a Localização de Destino!' });
      return;
    }
  } 
  else if (motivo === 'ABASTECIMENTO_KIT') { 
    const lacre = document.getElementById('select_lacre_transferencia').value;
    if (!lacre) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione a Maleta / Lacre que será abastecida!' });
      return;
    }
    
    const opcaoMedSelecionada = medSelect.options[medSelect.selectedIndex];
    const maxPermitido = parseInt(opcaoMedSelecionada.getAttribute('data-padrao') || '999999');
    
    if (quantidadeRetirar > maxPermitido) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Quantidade Acima da Receita', 
        text: `O protocolo deste kit exige no máximo ${maxPermitido} unidade(s) deste medicamento.` 
      });
      return;
    }

    destinoOuMotivo = `Lacre / Kit Físico: ${lacre}`;
  } 
  else if (motivo === 'DESCARTE') {
    destinoOuMotivo = document.getElementById('saida_motivo_descarte').value;
  }

  if (!medicamentoId || !loteId || isNaN(quantidadeRetirar) || quantidadeRetirar <= 0) {
    Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Preencha o medicamento, lote e quantidade a retirar corretamente!' });
    return;
  }

  const opcaoSelecionada = loteSelect.options[loteSelect.selectedIndex];
  const saldoAtualLote = parseInt(opcaoSelecionada.getAttribute('data-qtd') || '0');

  if (quantidadeRetirar > saldoAtualLote) {
    Swal.fire({ 
      icon: 'error', 
      title: 'Saldo Insuficiente', 
      text: `O lote selecionado possui apenas ${saldoAtualLote} unidade(s) disponíveis!` 
    });
    return;
  }

  Swal.fire({
    title: 'Processando Saída...',
    text: 'Atualizando estoque e registrando movimentação.',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const usuarioId = session?.user?.id || null;

    const { data: movCriada, error: errMov } = await supabase
      .from('movimentacoes')
      .insert([{
        tipo: 'SAIDA',
        numero_nota_fiscal: `SAIDA-${motivo}`,
        fornecedor: destinoOuMotivo, 
        valor_total_nota: 0,
        observacao: `[${motivo}] ${observacaoGeral}`.trim()
      }])
      .select()
      .single();

    if (errMov) throw errMov;

    const { error: errItem } = await supabase
      .from('movimentacoes_estoque')
      .insert([{
        movimentacao_id: movCriada.id,
        lote_id: loteId,
        tipo_movimentacao: 'SAIDA',
        quantidade: quantidadeRetirar,
        valor_unitario: 0,
        valor_total_item: 0,
        observacao: `Destino/Motivo: ${destinoOuMotivo}`,
        responsavel_id: usuarioId
      }]);

    if (errItem) throw errItem;

    Swal.fire({
      icon: 'success',
      title: 'Saída Registrada!',
      text: 'Baixa no estoque realizada com sucesso.',
      confirmButtonColor: '#22c55e'
    });

    document.getElementById('saida_quantidade').value = '';
    document.getElementById('saida_destino_consumo').value = '';
    document.getElementById('saida_observacao').value = '';
    
    if (motivo !== 'ABASTECIMENTO_KIT') {
      document.getElementById('select_medicamento_saida').value = '';
      loteSelect.innerHTML = '<option value="">Selecione o medicamento primeiro...</option>';
    } else {
      loteSelect.innerHTML = '<option value="">Selecione o medicamento primeiro...</option>';
      document.getElementById('select_medicamento_saida').value = '';
    }

  } catch (err) {
    console.error('Erro ao registrar saída:', err);
    Swal.fire({ icon: 'error', title: 'Erro na Saída', text: err.message });
  }
}

// ==========================================
// EXPOR FUNÇÕES PARA O HTML
// ==========================================
window.finalizarSaidaEstoque = finalizarSaidaEstoque;
window.removerItemNota = removerItemNota; // <-- ADICIONADO PARA O BOTÃO DA LIXEIRA FUNCIONAR

// ==========================================
// CARREGAR HISTÓRICO DA TABELA (COM FILTROS)
// ==========================================
export async function carregarHistorico() {
  const tbody = document.getElementById('lista-historico');
  const thead = document.getElementById('cabecalho-historico');
  
  const modo = document.getElementById('filtro_modo_view')?.value || 'ITENS';
  const dtInicio = document.getElementById('filtro_hist_inicio')?.value;
  const dtFim = document.getElementById('filtro_hist_fim')?.value;

  if (!tbody || !thead) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Buscando dados...</td></tr>';

  try {
    // ----------------------------------------------------
    // VISUALIZAÇÃO 1: ITENS INDIVIDUAIS
    // ----------------------------------------------------
    if (modo === 'ITENS') {
      thead.innerHTML = `
        <tr>
          <th>Data / Hora</th>
          <th>Tipo</th>
          <th>Medicamento</th>
          <th>Lote</th>
          <th>Qtd.</th>
          <th>Usuário</th>
        </tr>`;

      let query = supabase
        .from('movimentacoes_estoque')
        .select(`
          id, tipo_movimentacao, quantidade, criado_em, 
          lotes_estoque ( numero_lote, medicamentos ( nome ) ),
          perfis ( nome )
        `)
        .order('criado_em', { ascending: false });

      if (dtInicio) query = query.gte('criado_em', `${dtInicio}T00:00:00.000Z`);
      if (dtFim) query = query.lte('criado_em', `${dtFim}T23:59:59.999Z`);

      const { data, error } = await query.limit(100);
      if (error) throw error;

      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma movimentação encontrada.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(mov => {
        const dataF = new Date(mov.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const tipoBadge = mov.tipo_movimentacao === 'ENTRADA' ? '🟢 Entrada' : '🔴 Saída';
        const medNome = mov.lotes_estoque?.medicamentos?.nome || '-';
        const lote = mov.lotes_estoque?.numero_lote || '-';
        const usuario = mov.perfis?.nome || 'Sistema';

        return `<tr><td>${dataF}</td><td>${tipoBadge}</td><td><strong>${medNome}</strong></td><td>${lote}</td><td>${mov.quantidade}</td><td>${usuario}</td></tr>`;
      }).join('');
    
    // ----------------------------------------------------
    // VISUALIZAÇÃO 2: NOTAS FISCAIS
    // ----------------------------------------------------
    } else {
      thead.innerHTML = `
        <tr>
          <th>Data de Lançamento</th>
          <th>Nº da Nota</th>
          <th>Fornecedor</th>
          <th>Valor Total</th>
          <th>Observação</th>
          <th>Ações</th>
        </tr>`;

      let query = supabase
        .from('movimentacoes')
        .select('*')
        .eq('tipo', 'ENTRADA') // <-- A MÁGICA DO FILTRO AQUI!
        .order('criado_em', { ascending: false });

      if (dtInicio) query = query.gte('criado_em', `${dtInicio}T00:00:00.000Z`);
      if (dtFim) query = query.lte('criado_em', `${dtFim}T23:59:59.999Z`);

      const { data, error } = await query.limit(50);
      if (error) throw error;

      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma nota fiscal encontrada no período.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(nf => {
        const dataF = new Date(nf.criado_em).toLocaleDateString('pt-BR');
        const valor = nf.valor_total_nota ? `R$ ${nf.valor_total_nota.toFixed(2)}` : 'R$ 0,00';
        
        return `
          <tr>
            <td>${dataF}</td>
            <td><strong>${nf.numero_nota_fiscal || '-'}</strong></td>
            <td>${nf.fornecedor || '-'}</td>
            <td><strong>${valor}</strong></td>
            <td>${nf.observacao || '-'}</td>
            <td>
              <button class="btn-remover" style="background:#0ea5e9; color:white;" onclick="window.abrirDetalhesNota('${nf.id}')">Ver Detalhes</button>
            </td>
          </tr>`;
      }).join('');
    }

  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: red;">Erro ao buscar dados.</td></tr>`;
  }
}

// ==========================================
// 🪟 MODAL DA NOTA FISCAL E AUDITORIA
// ==========================================
export async function abrirDetalhesNota(movimentacaoId) {
  const modal = document.getElementById('modal-nota-fiscal');
  if(modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex'; 
  }

  document.getElementById('modal-txt-numero').innerText = 'Carregando...';
  document.getElementById('modal-txt-total').innerText = 'Calculando...'; 
  
  const btnAnexo = document.getElementById('btn-baixar-anexo');
  if(btnAnexo) {
     btnAnexo.style.display = 'none'; 
     const novoBtn = btnAnexo.cloneNode(true); 
     btnAnexo.parentNode.replaceChild(novoBtn, btnAnexo);
  }

  try {
    // 1. Busca os dados do cabeçalho da Nota
    const { data: nf, error: errNf } = await supabase
      .from('movimentacoes')
      .select('*') 
      .eq('id', movimentacaoId)
      .single();

    if (errNf) throw errNf;

    document.getElementById('modal-txt-numero').innerText = nf.numero_nota_fiscal || '-';
    document.getElementById('modal-txt-fornecedor').innerText = nf.fornecedor || '-';
    document.getElementById('modal-txt-data').innerText = new Date(nf.criado_em).toLocaleDateString('pt-BR');
    
    // VERIFICAÇÃO DO ANEXO 
    const btnAnexoAtualizado = document.getElementById('btn-baixar-anexo');
    if (nf.url_nota_fiscal && btnAnexoAtualizado) {
       btnAnexoAtualizado.style.display = 'flex'; 
       btnAnexoAtualizado.addEventListener('click', () => {
          window.open(nf.url_nota_fiscal, '_blank'); 
       });
    }

    // 1.5 Busca quem lançou a nota 
    const { data: itemOriginal } = await supabase
      .from('movimentacoes_estoque')
      .select('responsavel_id')
      .eq('movimentacao_id', movimentacaoId)
      .limit(1)
      .maybeSingle();

    if (itemOriginal && itemOriginal.responsavel_id) {
       const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', itemOriginal.responsavel_id).single();
       document.getElementById('modal-txt-usuario').innerText = perfil?.nome || 'Sistema';
    } else {
       document.getElementById('modal-txt-usuario').innerText = 'Sistema';
    }

    // 2. Aciona o carregamento dos itens e da auditoria
    await carregarItensDaNota(movimentacaoId);
    await carregarAuditoria(movimentacaoId);

  } catch (error) {
    console.error('Erro ao abrir nota:', error);
    Swal.fire('Erro', 'Não foi possível carregar os dados da nota.', 'error');
  }
}

async function carregarItensDaNota(movimentacaoId) {
  const tbody = document.getElementById('modal-nf-itens');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Buscando itens na prateleira...</td></tr>';

  const { data, error } = await supabase
    .from('movimentacoes_estoque')
    .select(`
      id, quantidade, valor_unitario,
      lotes_estoque ( numero_lote, medicamentos ( nome ) )
    `)
    .eq('movimentacao_id', movimentacaoId);

  if (error) {
    console.error('Erro ao buscar itens da NF:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Erro ao buscar itens. Veja F12.</td></tr>';
    document.getElementById('modal-txt-total').innerText = 'Erro';
    return;
  }

  let totalNota = 0; 

  tbody.innerHTML = data.map(item => {
    const medNome = item.lotes_estoque?.medicamentos?.nome || 'Desconhecido';
    const lote = item.lotes_estoque?.numero_lote || '-';
    const unitario = item.valor_unitario || 0;
    
    // Calcula o subtotal do item
    const subtotal = item.quantidade * unitario;
    totalNota += subtotal; 

    return `
      <tr>
        <td><strong>${medNome}</strong></td>
        <td>${lote}</td>
        <td>
          <input type="number" id="edit-qtd-${item.id}" value="${item.quantidade}" style="width: 70px; padding: 4px; border: 1px solid var(--muted); border-radius: 4px; background: transparent; color: var(--text);" min="1">
        </td>
        <td>
          <input type="number" id="edit-val-${item.id}" value="${unitario}" step="0.01" style="width: 90px; padding: 4px; border: 1px solid var(--muted); border-radius: 4px; background: transparent; color: var(--text);" min="0">
        </td>
        <td style="font-weight:bold; color:var(--primary);">R$ ${subtotal.toFixed(2)}</td>
        <td style="text-align: center;">
          <button class="btn-salvar" style="padding: 4px 12px; font-size: 0.8rem; width: auto; background: #eab308; color: #0f172a;"
            onclick="window.salvarEdicaoItem('${item.id}', '${movimentacaoId}', ${item.quantidade}, ${unitario}, '${medNome}')">
            💾 Salvar
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('modal-txt-total').innerText = `R$ ${totalNota.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function carregarAuditoria(movimentacaoId) {
  const tbody = document.getElementById('modal-nf-auditoria');
  
  const { data, error } = await supabase
    .from('auditoria_notas')
    .select('*, perfis(nome)')
    .eq('movimentacao_id', movimentacaoId)
    .order('criado_em', { ascending: false });

  if (error || !data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: #b45309;">Nenhuma alteração registrada. (Nota Original)</td></tr>';
    if (error) console.error("Erro ao buscar auditoria:", error);
    return;
  }

  tbody.innerHTML = data.map(log => `
    <tr>
      <td style="color: var(--text);">${new Date(log.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td style="color: var(--text);"><strong>${log.perfis?.nome || 'Sistema'}</strong></td>
      <td style="color: var(--text);">${log.detalhes_alteracao}</td>
    </tr>
  `).join('');
}

// ==========================================
// A MÁGICA DA AUDITORIA, EDIÇÃO E TRAVA DE ESTOQUE
// ==========================================
export async function salvarEdicaoItem(itemId, movimentacaoId, qtdAntiga, valorAntigo, medNome) {
  if (document.activeElement) document.activeElement.blur();

  const novaQtd = parseInt(document.getElementById(`edit-qtd-${itemId}`).value);
  const novoValor = parseFloat(document.getElementById(`edit-val-${itemId}`).value);

  if (novaQtd === qtdAntiga && novoValor === valorAntigo) {
    Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Nenhuma alteração feita.', showConfirmButton: false, timer: 2000 });
    return;
  }

  const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false });
  Toast.fire({ icon: 'info', title: 'Calculando estoque...' });

  try {
    const { data: userAuth } = await supabase.auth.getUser();
    const userId = userAuth?.user?.id || null; 

    // ---------------------------------------------------------
    // 1. TRAVA DE SEGURANÇA FÍSICA (LÓGICA DE ESTOQUE)
    // ---------------------------------------------------------
    const diferencaQtd = novaQtd - qtdAntiga;
    
    // Busca o ID do lote atrelado a este item da nota
    const { data: itemBd, error: errItem } = await supabase
      .from('movimentacoes_estoque')
      .select('lote_id')
      .eq('id', itemId)
      .single();
    if (errItem) throw new Error("Não foi possível encontrar o lote deste item.");

    // Se houve mudança na quantidade (se a diferença não for zero)
    if (diferencaQtd !== 0) {
      const { data: loteBd, error: errLote } = await supabase
        .from('lotes_estoque')
        .select('quantidade_atual')
        .eq('id', itemBd.lote_id)
        .single();
      if (errLote) throw new Error("Erro ao consultar o estoque atual do lote.");

      const novaQtdPrateleira = loteBd.quantidade_atual + diferencaQtd;

      // O GRANDE BLOQUEIO!
      if (novaQtdPrateleira < 0) {
        throw new Error(`Bloqueio: Você tentou remover ${Math.abs(diferencaQtd)} unidades, mas só restam ${loteBd.quantidade_atual} na prateleira. (O restante já foi consumido).`);
      }

      // Se passou pela trava, atualiza a prateleira física
      await supabase
        .from('lotes_estoque')
        .update({ quantidade_atual: novaQtdPrateleira })
        .eq('id', itemBd.lote_id);
    }
    // ---------------------------------------------------------

    // 2. Atualiza o item da nota fiscal
    const novoSubtotal = novaQtd * novoValor;
    const { data: itemAtualizado, error: errUpdate } = await supabase
      .from('movimentacoes_estoque')
      .update({ quantidade: novaQtd, valor_unitario: novoValor, valor_total_item: novoSubtotal })
      .eq('id', itemId)
      .select(); 

    if (errUpdate) throw errUpdate;
    if (!itemAtualizado || itemAtualizado.length === 0) throw new Error("Bloqueio de segurança no banco (RLS).");

    // 3. Registra na Auditoria
    const detalhes = `Editou "${medNome}": Qtd de [${qtdAntiga}] para [${novaQtd}] | Valor de R$[${valorAntigo}] para R$[${novoValor}].`;
    await supabase.from('auditoria_notas').insert([{
      movimentacao_id: movimentacaoId, usuario_id: userId, detalhes_alteracao: detalhes
    }]);

    // 4. Recalcula o valor total da Nota Fiscal
    const { data: todosOsItens } = await supabase
      .from('movimentacoes_estoque')
      .select('valor_total_item')
      .eq('movimentacao_id', movimentacaoId);

    let somaTotalDaNota = 0;
    if (todosOsItens) {
      todosOsItens.forEach(i => somaTotalDaNota += Number(i.valor_total_item || 0));
    }

    await supabase
      .from('movimentacoes')
      .update({ valor_total_nota: somaTotalDaNota })
      .eq('id', movimentacaoId);

    // 5. Atualiza tudo na tela
    await carregarItensDaNota(movimentacaoId);
    await carregarAuditoria(movimentacaoId);
    
    if (typeof carregarHistorico === 'function') {
      await carregarHistorico(); 
    }

    Toast.fire({ icon: 'success', title: 'Salvo e estoque atualizado!', timer: 2500 });

  } catch (err) {
    console.error(err);
    Swal.fire('Atenção', err.message || 'Falha ao processar a alteração.', 'warning');
  }
}

// ----------------------------------------------------
// EXPONDO AS FUNÇÕES PARA O HTML CONSEGUIR LER OS CLIQUES
// ----------------------------------------------------
window.abrirDetalhesNota = abrirDetalhesNota;
window.salvarEdicaoItem = salvarEdicaoItem;

window.fecharModalNF = () => {
  const modal = document.getElementById('modal-nota-fiscal');
  if(modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};