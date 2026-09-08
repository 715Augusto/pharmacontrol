// Importa o banco de dados e utilitários
import { supabase } from './supabase-client.js';
import { mostrarNotificacao } from './utils.js';

// ==========================================
// 5. TELA ESTOQUE DETALHADO (PRATELEIRA)====
// ==========================================

// Variáveis para guardar o estado dos dados na memória e facilitar os filtros
let dadosPrateleiraBrutos = [];
let dadosPrateleiraFiltrados = [];

export async function carregarEstoqueDetalhado() {
  const tbody = document.getElementById('tabela-prateleira');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Carregando prateleira...</td></tr>';

  // Busca os dados da View que criamos no Supabase
  const { data, error } = await supabase
    .from('vw_estoque_detalhado')
    .select('*');

  if (error) {
    console.error('Erro ao buscar estoque detalhado:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="status-critico" style="text-align: center;">Erro ao carregar dados. Verifique a conexão.</td></tr>';
    return;
  }

  // Salva os dados na memória para não precisar ir no banco a cada letra digitada no filtro
  dadosPrateleiraBrutos = data;
  dadosPrateleiraFiltrados = data;

  // Renderiza a tabela pela primeira vez
  renderizarTabelaPrateleira(dadosPrateleiraFiltrados);

  // Ativa os "escutadores" dos filtros
  const inputTexto = document.getElementById('filtro-texto');
  const selectSaldo = document.getElementById('filtro-saldo');
  
  if (inputTexto) {
    inputTexto.addEventListener('input', aplicarFiltrosPrateleira);
  }
  if (selectSaldo) {
    selectSaldo.addEventListener('change', aplicarFiltrosPrateleira);
  }

  const selectValidade = document.getElementById('filtro-validade');
  if (selectValidade) {
    selectValidade.addEventListener('change', aplicarFiltrosPrateleira);
  }
}

function renderizarTabelaPrateleira(dados) {
  const tbody = document.getElementById('tabela-prateleira');
  if (!tbody) return;

  if (dados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum lote encontrado com estes filtros.</td></tr>';
    return;
  }

  tbody.innerHTML = dados.map(item => {
    const validadeFmt = item.data_validade 
      ? new Date(item.data_validade + 'T00:00:00').toLocaleDateString('pt-BR') 
      : '-';

    // Formata a data da última movimentação (Novo)
    const ultimaMovFmt = item.ultima_movimentacao
      ? new Date(item.ultima_movimentacao).toLocaleDateString('pt-BR')
      : 'Sem histórico';

    let classeValidade = 'status-regular'; 
    if (item.status_validade === 'VENCIDO') classeValidade = 'status-critico'; 
    else if (item.status_validade === 'VENCE EM 30 DIAS') classeValidade = 'status-alerta'; 

    return `
      <tr>
        <td>
          <strong>${item.medicamento}</strong><br>
          <small style="color: var(--text-muted);">${item.principio_ativo || ''}</small>
        </td>
        <td>${item.numero_lote}</td>
        <td>${validadeFmt}</td>
        <td><strong>${item.quantidade_atual}</strong></td>
        <td>${ultimaMovFmt}</td>
        <td><span class="status ${classeValidade}">${item.status_validade}</span></td>
      </tr>
    `;
  }).join('');
}

function aplicarFiltrosPrateleira() {
  const texto = document.getElementById('filtro-texto').value.toLowerCase();
  const filtroSaldo = document.getElementById('filtro-saldo').value;
  const filtroValidade = document.getElementById('filtro-validade') ? document.getElementById('filtro-validade').value : 'todos';

  dadosPrateleiraFiltrados = dadosPrateleiraBrutos.filter(item => {
    // Busca por nome, lote E princípio ativo (Novo)
    const nome = item.medicamento ? item.medicamento.toLowerCase() : '';
    const lote = item.numero_lote ? item.numero_lote.toLowerCase() : '';
    const principio = item.principio_ativo ? item.principio_ativo.toLowerCase() : '';
    const matchTexto = nome.includes(texto) || lote.includes(texto) || principio.includes(texto);
    
    // Filtro de Saldo
    let matchSaldo = true;
    if (filtroSaldo === 'com_saldo') matchSaldo = item.quantidade_atual > 0;
    if (filtroSaldo === 'zerados') matchSaldo = item.quantidade_atual === 0;

    // Filtro de Validade (Novo)
    let matchValidade = true;
    if (filtroValidade === 'vencidos') matchValidade = item.status_validade === 'VENCIDO';
    if (filtroValidade === '30_dias') matchValidade = item.status_validade === 'VENCE EM 30 DIAS';
    if (filtroValidade === 'bom') matchValidade = item.status_validade === 'BOM';

    return matchTexto && matchSaldo && matchValidade;
  });

  renderizarTabelaPrateleira(dadosPrateleiraFiltrados);
}

export function exportarExcel() {
  if (dadosPrateleiraFiltrados.length === 0) {
    alert("Não há dados para exportar de acordo com os filtros atuais.");
    return;
  }

  // Adicionada a coluna de 'Última Movimentação' no cabeçalho
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
  csvContent += "Medicamento;Lote;Validade;Saldo;Última Movimentação;Status Validade\n";

  dadosPrateleiraFiltrados.forEach(row => {
    const nome = row.medicamento ? row.medicamento.replace(/;/g, ',') : '';
    const lote = row.numero_lote ? row.numero_lote.replace(/;/g, ',') : '';
    const validade = row.data_validade 
      ? new Date(row.data_validade + 'T00:00:00').toLocaleDateString('pt-BR') 
      : '-';
    
    // Formata a última movimentação para o Excel
    const ultimaMov = row.ultima_movimentacao
      ? new Date(row.ultima_movimentacao).toLocaleDateString('pt-BR')
      : 'Sem histórico';
    
    // Adicionada a variável ${ultimaMov} na linha
    csvContent += `${nome};${lote};${validade};${row.quantidade_atual};${ultimaMov};${row.status_validade}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  
  const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  link.setAttribute("download", `Inventario_Estoque_${dataHoje}.csv`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}