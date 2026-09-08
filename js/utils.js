import { supabase } from './supabase-client.js';

// ==========================================
// FUNÇÃO GLOBAL DE NOTIFICAÇÕES (TOAST)
// ==========================================
export function mostrarNotificacao(mensagem, tipo = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  
  let icone = '✅';
  if (tipo === 'error') icone = '❌';
  if (tipo === 'warning') icone = '⚠️';

  toast.innerHTML = `<span>${icone}</span> <span>${mensagem}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// FUNÇÃO GLOBAL DE LOGOUT
// ==========================================
export async function fazerLogout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// ==========================================
// AUTO-INICIALIZAÇÃO GLOBAL (TEMA E BOTOES)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Inicialização do Tema (Modo Escuro)
  const btnTema = document.getElementById('btn-tema');
  const temaSalvo = localStorage.getItem('temaFarmacia');
  
  // Aplica o tema salvo imediatamente ao carregar a página
  if (temaSalvo === 'dark') {
    document.body.classList.add('dark-mode');
    if (btnTema) btnTema.innerText = '☀️ Modo Claro';
  } else {
    if (btnTema) btnTema.innerText = '🌓 Modo Escuro';
  }

  // Vincula o clique do botão de tema
  if (btnTema) {
    btnTema.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      
      const isDark = document.body.classList.contains('dark-mode');
      
      // Salva no navegador para não perder ao mudar de página
      localStorage.setItem('temaFarmacia', isDark ? 'dark' : 'light');
      
      // Altera o texto do botão instantaneamente
      btnTema.innerText = isDark ? '☀️ Modo Claro' : '🌓 Modo Escuro';
    });
  }

  // 2. Vincula o clique do botão de sair em todas as telas
  const btnSair = document.getElementById('btn-sair');
  if (btnSair) {
    btnSair.addEventListener('click', fazerLogout);
  }
});