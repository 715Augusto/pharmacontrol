// Importa o banco de dados e utilitários
import { supabase } from './supabase-client.js';

// ==========================================
// 1. TELA DE DASHBOARD (VISÃO EXECUTIVA)
// ==========================================
export async function carregarDashboard() {
  
  // ----------------------------------------------------
  // A. TABELA DE SALDOS E CARD DE STATUS
  // ----------------------------------------------------
  const { data: estoque, error: errEstoque } = await supabase
    .from('vw_saldo_medicamentos')
    .select('*');

  let qtdRegular = 0, qtdCritico = 0, qtdSemEstoque = 0;

  if (!errEstoque && estoque) {
    const tabela = document.getElementById('tabela-estoque');
    
    tabela.innerHTML = estoque.map(item => {
      let classeCSS = '';
      if (item.status_estoque.includes('CRÍTICO')) { classeCSS = 'status-critico'; qtdCritico++; }
      else if (item.status_estoque.includes('SEM ESTOQUE')) { classeCSS = 'status-sem-estoque'; qtdSemEstoque++; }
      else { classeCSS = 'status-regular'; qtdRegular++; }

      return `
        <tr>
          <td><strong>${item.medicamento}</strong></td>
          <td>${item.principio_ativo || '-'}</td>
          <td>${item.saldo_total}</td>
          <td><span class="status ${classeCSS}">${item.status_estoque}</span></td>
        </tr>
      `;
    }).join('');

    if (document.getElementById('total-critico')) document.getElementById('total-critico').textContent = qtdCritico;
    if (document.getElementById('total-itens')) document.getElementById('total-itens').textContent = estoque.length;
  }

  // ----------------------------------------------------
  // B. GRÁFICO 1: PIZZA (STATUS DO ESTOQUE)
  // ----------------------------------------------------
  const ctxStatus = document.getElementById('graficoStatus');
  if (ctxStatus && (qtdRegular > 0 || qtdCritico > 0 || qtdSemEstoque > 0)) {
    new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: ['Regular', 'Crítico (Falta)', 'Sem Estoque'],
        datasets: [{
          data: [qtdRegular, qtdCritico, qtdSemEstoque],
          backgroundColor: ['#16a34a', '#f59e0b', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // ----------------------------------------------------
  // C. MODAL DE VENCIMENTOS (< 90 DIAS)
  // ----------------------------------------------------
  const hoje = new Date();
  const dataLimite = new Date();
  dataLimite.setDate(hoje.getDate() + 90); // Soma 90 dias na data de hoje

  // Busca lotes que têm saldo e que vencem antes da data limite
  const { data: lotesVencendo } = await supabase
    .from('lotes_estoque')
    .select(`numero_lote, data_validade, quantidade_atual, medicamentos(nome)`)
    .gt('quantidade_atual', 0)
    .lte('data_validade', dataLimite.toISOString())
    .order('data_validade', { ascending: true });

  if (lotesVencendo) {
    if (document.getElementById('total-vencimento')) document.getElementById('total-vencimento').textContent = lotesVencendo.length;

    const tbodyVencimentos = document.getElementById('lista-lotes-vencendo');
    if (tbodyVencimentos) {
      if (lotesVencendo.length > 0) {
        tbodyVencimentos.innerHTML = lotesVencendo.map(l => {
          const validade = new Date(l.data_validade);
          const diffDias = Math.ceil(Math.abs(validade - hoje) / (1000 * 60 * 60 * 24));
          const cor = diffDias <= 30 ? '#ef4444' : '#ea580c'; // Vermelho se < 30, laranja se < 90

          return `
            <tr>
              <td><strong>${l.medicamentos?.nome || '-'}</strong></td>
              <td>${l.numero_lote}</td>
              <td style="text-align: center; color: ${cor}; font-weight: bold;">${diffDias} dias</td>
            </tr>
          `;
        }).join('');
      } else {
        tbodyVencimentos.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum lote em risco.</td></tr>';
      }
    }
  }

  // ----------------------------------------------------
  // D. FINANCEIRO E GRÁFICO 2: TOP 5 CONSUMO
  // ----------------------------------------------------
  // Busca as movimentações para calcularmos para onde o dinheiro foi
  const { data: movs } = await supabase
    .from('movimentacoes_estoque')
    .select(`tipo_movimentacao, quantidade, valor_total_item, lotes_estoque( medicamentos(nome) )`);

  if (movs) {
    let saldoFinanceiro = 0;
    const rankingConsumo = {};

    movs.forEach(m => {
      // Cálculo Financeiro (Entradas - Saídas)
      if (m.tipo_movimentacao === 'ENTRADA') {
        saldoFinanceiro += (m.valor_total_item || 0);
      } else if (m.tipo_movimentacao === 'SAIDA') {
        saldoFinanceiro -= (m.valor_total_item || 0);
        
        // Agrupando para o Gráfico de Top 5
        const nomeRemedio = m.lotes_estoque?.medicamentos?.nome || 'Desconhecido';
        if (!rankingConsumo[nomeRemedio]) rankingConsumo[nomeRemedio] = 0;
        rankingConsumo[nomeRemedio] += (m.quantidade || 0);
      }
    });

    // Atualiza o Card Financeiro (evita números negativos por erro de teste passado)
    if (document.getElementById('total-financeiro')) {
      document.getElementById('total-financeiro').textContent = (saldoFinanceiro > 0 ? saldoFinanceiro : 0)
        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Prepara os dados para o Gráfico de Barras
    // Transforma o objeto em lista, ordena do maior para o menor e corta os 5 primeiros
    const top5 = Object.entries(rankingConsumo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const labelsTop = top5.map(t => t[0]); // Nomes
    const dadosTop = top5.map(t => t[1]);  // Quantidades

    const ctxTop = document.getElementById('graficoTopConsumo');
    if (ctxTop && labelsTop.length > 0) {
      new Chart(ctxTop, {
        type: 'bar',
        data: {
          labels: labelsTop,
          datasets: [{
            label: 'Unidades Consumidas (Histórico)',
            data: dadosTop,
            backgroundColor: '#0284c7',
            borderRadius: 4
          }]
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }
  }
}