import { supabase } from './supabase-client.js';

// ==========================================
// CARREGAR MEDICAMENTOS NO FILTRO
// ==========================================
export async function carregarFiltroMedicamentos() {
  const select = document.getElementById('filtro_medicamento');
  if (!select) return;

  const { data, error } = await supabase
    .from('medicamentos')
    .select('id, nome')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar medicamentos no filtro:', error);
    return;
  }

  select.innerHTML = '<option value="">Todos os Medicamentos</option>';
  data.forEach(med => {
    select.innerHTML += `<option value="${med.id}">${med.nome}</option>`;
  });
}

// ==========================================
// APLICAR FILTROS (DADOS REAIS DO BANCO)
// ==========================================
export async function aplicarFiltros(event) {
  event.preventDefault();

  const dataInicio = document.getElementById('filtro_data_inicio').value;
  const dataFim = document.getElementById('filtro_data_fim').value;
  const tipoFiltro = document.getElementById('filtro_tipo').value;
  const medicamentoId = document.getElementById('filtro_medicamento').value;
  const plantaoFiltro = document.getElementById('filtro_plantao')?.value;
  const apenasControlados = document.getElementById('filtro_controlados')?.checked;

  Swal.fire({
    title: 'Analisando dados...',
    text: 'Cruzando informações do estoque...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    // 1. Busca turbinada! Trazendo dados do lote, medicamento, ficha e evento.
    let query = supabase
      .from('movimentacoes_estoque')
      .select(`
        id,
        tipo_movimentacao,
        quantidade,
        valor_unitario,
        valor_total_item,
        criado_em,
        observacao,
        ficha_atendimento,
        evento_destino,
        responsavel_id,
        perfis ( nome ),
        lotes_estoque ( 
            numero_lote,
            data_validade,
            medicamento_id,
            medicamentos ( nome, controlado )
        )
      `);

    // 2. Filtros de Data Direto no Banco
    if (dataInicio) query = query.gte('criado_em', `${dataInicio}T00:00:00.000Z`);
    if (dataFim) query = query.lte('criado_em', `${dataFim}T23:59:59.999Z`);

    const { data: registros, error } = await query;
    if (error) throw error;

    // 3. Filtros Complexos (Memória do Navegador)
    let filtrados = registros || [];

    // Filtro por Medicamento
    if (medicamentoId) {
      filtrados = filtrados.filter(reg => reg.lotes_estoque?.medicamento_id === medicamentoId);
    }

    // Filtro por Medicamento Controlado
    if (apenasControlados) {
      filtrados = filtrados.filter(reg => reg.lotes_estoque?.medicamentos?.controlado === true);
    }

    // Filtro por Tipo de Operação
    if (tipoFiltro !== 'TODOS') {
      filtrados = filtrados.filter(reg => {
        if (tipoFiltro === 'ENTRADA') return reg.tipo_movimentacao === 'ENTRADA';
        
        // Aqui lemos o motivo exato que foi salvo na observacao ou na tela de saída
        const obs = reg.observacao || '';
        
        if (tipoFiltro === 'CONSUMO') return reg.ficha_atendimento != null || obs.includes('Paciente');
        if (tipoFiltro === 'EVENTO') return reg.evento_destino != null;
        if (tipoFiltro === 'DESCARTE') return obs.includes('Descarte') || obs.includes('Vencimento') || obs.includes('Avaria');
        if (tipoFiltro === 'ABASTECIMENTO_KIT') return obs.includes('Kit') || obs.includes('Maleta');
        if (tipoFiltro === 'TRANSFERENCIA') return obs.includes('Transferência');
        
        return false;
      });
    }

    // Filtro por Plantão (A Mágica do Horário)
    if (plantaoFiltro) {
        filtrados = filtrados.filter(reg => {
            const dataHora = new Date(reg.criado_em);
            const hora = dataHora.getHours();
            
            if (plantaoFiltro === 'DIURNO') {
                return hora >= 7 && hora < 19; // 07:00 as 18:59
            } else if (plantaoFiltro === 'NOTURNO') {
                return hora >= 19 || hora < 7; // 19:00 as 06:59
            }
            return true;
        });
    }

    // 4. Somatórios dos Dashboards
    let totalEntradas = 0;
    let custoEntradas = 0;
    let totalSaidas = 0;
    let totalDescartes = 0;

    filtrados.forEach(reg => {
      if (reg.tipo_movimentacao === 'ENTRADA') {
        totalEntradas += reg.quantidade || 0;
        custoEntradas += reg.valor_total_item || 0;
      } else if (reg.tipo_movimentacao === 'SAIDA') {
        const obs = reg.observacao || '';
        if (obs.includes('Descarte') || obs.includes('Vencimento') || obs.includes('Avaria')) {
          totalDescartes += reg.quantidade || 0;
        } else {
          totalSaidas += reg.quantidade || 0;
        }
      }
    });

    // 5. Atualiza os Dashboards
    document.getElementById('dash-entradas').innerText = `${totalEntradas} unid.`;
    document.getElementById('dash-custo').innerText = custoEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('dash-saidas').innerText = `${totalSaidas} unid.`;
    document.getElementById('dash-descartes').innerText = `${totalDescartes} unid.`;

    document.getElementById('btn-limpar-filtros').style.display = 'block';

    // 6. SALVA O RESULTADO NA MEMÓRIA GLOBAL PARA O PDF GERAR DEPOIS
    window.dadosRelatorioAtual = filtrados;
    window.totaisRelatorioAtual = { totalEntradas, custoEntradas, totalSaidas, totalDescartes };

    Swal.fire({
      icon: 'success',
      title: 'Filtros Aplicados',
      text: `Foram encontrados ${filtrados.length} registros no período.`,
      timer: 2000,
      showConfirmButton: false
    });

  } catch (err) {
    console.error('Erro detalhado:', err);
    Swal.fire('Erro', 'Falha ao processar filtros.', 'error');
  }
}

// ==========================================
// LIMPAR FILTROS
// ==========================================
export function limparFiltros() {
  document.getElementById('form-filtros').reset();
  document.getElementById('btn-limpar-filtros').style.display = 'none';

  // Zerando os Dashboards
  document.getElementById('dash-entradas').innerText = '0 unid.';
  document.getElementById('dash-custo').innerText = 'R$ 0,00';
  document.getElementById('dash-saidas').innerText = '0 unid.';
  document.getElementById('dash-descartes').innerText = '0 unid.';
}

// ==========================================
// EMITIR RELATÓRIO (PDF e EXCEL)
// ==========================================
export function exportarRelatorio(tipoExportacao) {
  const dashChecked = document.getElementById('check-export-dash').checked;
  const listChecked = document.getElementById('check-export-list').checked;

  if (!dashChecked && !listChecked) {
    Swal.fire('Atenção', 'Selecione pelo menos uma opção (Resumo ou Listagem) para exportar.', 'warning');
    return;
  }

  // Pega os dados que nós salvamos na memória na hora que aplicou o filtro
  const dados = window.dadosRelatorioAtual;
  const totais = window.totaisRelatorioAtual;

  if (!dados || dados.length === 0) {
    Swal.fire('Atenção', 'Não há dados para exportar. Aplique os filtros primeiro para buscar os dados.', 'warning');
    return;
  }

  if (tipoExportacao === 'PDF') {
    gerarPDF(dados, totais, dashChecked, listChecked);
  } else if (tipoExportacao === 'EXCEL') {
    gerarExcel(dados);
  }
}

// ----------------------------------------------------
// MOTOR 1: GERADOR DE PDF (jsPDF + autoTable)
// ----------------------------------------------------
function gerarPDF(dados, totais, incluirResumo, incluirLista) {
  // Puxa a biblioteca do HTML
  const { jsPDF } = window.jspdf;
  // Paisagem (landscape) para caber bastante coluna
  const doc = new jsPDF('landscape'); 

  // Cabeçalho do Documento
  doc.setFontSize(18);
  doc.text('Relatório de Movimentações - PharmaControl', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Documento gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

  let linhaAtualY = 40; // Controla a altura na página

  // Bloco do Resumo (Dashboards)
  if (incluirResumo && totais) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo do Período (Dashboards):', 14, linhaAtualY);
    linhaAtualY += 8;
    
    doc.setFontSize(10);
    doc.text(`Entradas Totais: ${totais.totalEntradas} unid.   |   Custo Financeiro: ${totais.custoEntradas.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`, 14, linhaAtualY);
    linhaAtualY += 6;
    doc.text(`Consumo/Saídas: ${totais.totalSaidas} unid.     |   Descartes e Perdas: ${totais.totalDescartes} unid.`, 14, linhaAtualY);
    
    linhaAtualY += 15; // Dá um espaço para a tabela
  }

  // Bloco da Tabela Detalhada
  if (incluirLista) {
    const colunas = ["Data/Hora", "Tipo", "Medicamento", "Lote", "Qtd", "R$ Unit.", "R$ Total", "Detalhes e Destino"];

    // Transforma nossos dados JSON numa matriz que a tabela entende
    const linhas = dados.map(reg => {
      const dataStr = new Date(reg.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      const tipo = reg.tipo_movimentacao;
      const nomeMed = reg.lotes_estoque?.medicamentos?.nome || 'Desconhecido';
      const lote = reg.lotes_estoque?.numero_lote || '-';
      const qtd = reg.quantidade;
      const valorU = reg.valor_unitario ? reg.valor_unitario.toFixed(2) : '0.00';
      const valorT = reg.valor_total_item ? reg.valor_total_item.toFixed(2) : '0.00';
      
      // Concatena as informações vitais para a farmacêutica
      let detalhes = reg.observacao || '';
      if (reg.ficha_atendimento) detalhes = `[Ficha: ${reg.ficha_atendimento}] ` + detalhes;
      if (reg.evento_destino) detalhes = `[Evento: ${reg.evento_destino}] ` + detalhes;
      if (reg.lotes_estoque?.medicamentos?.controlado) detalhes = `⚠️ CONTROLADO - ` + detalhes;

      return [dataStr, tipo, nomeMed, lote, qtd, valorU, valorT, detalhes];
    });

    // Manda desenhar a tabela
    doc.autoTable({
      startY: linhaAtualY,
      head: [colunas],
      body: linhas,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] }, // Cor azul-marinho do PharmaControl
      styles: { fontSize: 8 },
      columnStyles: {
        7: { cellWidth: 70 } // Coluna de detalhes fica mais larga
      }
    });
  }

  // Salva no computador
  doc.save('PharmaControl_Relatorio.pdf');
}

// ----------------------------------------------------
// MOTOR 2: GERADOR DE EXCEL (SheetJS)
// ----------------------------------------------------
function gerarExcel(dados) {
  // Transforma os dados numa tabela perfeita para análise no Excel
  const dadosExcel = dados.map(reg => ({
    "Data/Hora": new Date(reg.criado_em).toLocaleString('pt-BR'),
    "Tipo Operação": reg.tipo_movimentacao,
    "Medicamento": reg.lotes_estoque?.medicamentos?.nome || '-',
    "Controlado?": reg.lotes_estoque?.medicamentos?.controlado ? 'SIM' : 'NÃO',
    "Lote": reg.lotes_estoque?.numero_lote || '-',
    "Quantidade": reg.quantidade || 0,
    "Valor Unit. (R$)": reg.valor_unitario || 0,
    "Valor Total (R$)": reg.valor_total_item || 0,
    "Ficha (Paciente)": reg.ficha_atendimento || '-',
    "Evento (Destino)": reg.evento_destino || '-',
    "Responsável": reg.perfis?.nome || 'Sistema',
    "Observação": reg.observacao || '-'
  }));

  // Monta o arquivo
  const worksheet = window.XLSX.utils.json_to_sheet(dadosExcel);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Movimentações");

  // Baixa o arquivo
  window.XLSX.writeFile(workbook, 'PharmaControl_Dados_Brutos.xlsx');
}