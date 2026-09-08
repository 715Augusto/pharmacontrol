// Puxa a conexão centralizada
import { supabase } from './supabase-client.js';

// ==========================================
// GUARDA DE PROTEÇÃO DE ROTAS E DADOS DO USUÁRIO
// ==========================================
async function verificarAcesso() {
  const ePaginaLogin = window.location.pathname.endsWith('login.html');

  const { data: { session } } = await supabase.auth.getSession();

  // 1. Se não houver sessão ativa e não estiver no login, expulsa para o login
  if (!session && !ePaginaLogin) {
    window.location.href = 'login.html';
    return; // Para a execução aqui
  }

  // 2. Se houver sessão, atualiza o nome e aplica as permissões
  if (session && !ePaginaLogin) {
    const elNome = document.getElementById('nome-usuario-logado');
    if (elNome) {
      const metadata = session.user.user_metadata;
      const nomeOuEmail = metadata?.full_name || metadata?.name || session.user.email.split('@')[0];
      const nomeFormatado = nomeOuEmail.charAt(0).toUpperCase() + nomeOuEmail.slice(1);
      elNome.textContent = nomeFormatado;
    }

    // --- NOVA PARTE: BUSCA O PERFIL E APLICA REGRAS DE ACESSO ---
    try {
      const { data: perfil } = await supabase
        .from('perfis')
        .select('cargo')
        .eq('id', session.user.id)
        .single();
      
      const cargoDoUsuario = perfil?.cargo || 'auxiliar_1'; // Padrão mais restrito por segurança
      aplicarPermissoes(cargoDoUsuario);
    } catch (error) {
      console.error("Erro ao buscar perfil de acesso:", error);
    }
  }
}

// 3. Função que esconde menus baseados no Cargo
function aplicarPermissoes(cargo) {
  // Mapeia os elementos do menu e da tela
  const menuRelatorios = document.querySelector('a[href="relatorios.html"]')?.parentElement;
  const menusCadastros = document.querySelectorAll('a[href="medicamentos.html"], a[href="fornecedores.html"], a[href="kits.html"], a[href="localizacoes.html"]');
  const menuConfig = document.querySelector('a[href="configuracoes.html"]')?.parentElement;
  
  // Títulos das seções do menu (para esconder caso os itens de dentro sumam)
  const titulosSecoes = document.querySelectorAll('.menu-section');
  let tituloCadastros, tituloAjustes;
  titulosSecoes.forEach(el => {
    if (el.textContent.includes('Cadastros')) tituloCadastros = el;
    if (el.textContent.includes('Ajustes')) tituloAjustes = el;
  });

  const tabEntrada = document.getElementById('tab-entrada'); // Aba de Entrada de NF

  // --------------------------------------------------
  // APLICAÇÃO DAS REGRAS (DO MAIS RESTRITO AO ADMIN)
  // --------------------------------------------------

  // Auxiliar 1 (Dispensação) e Auxiliar 2 (Recebimento): Não veem Cadastros, Relatórios nem Configurações
  if (cargo === 'auxiliar_1' || cargo === 'auxiliar_2') {
    if (menuRelatorios) menuRelatorios.style.display = 'none';
    if (menuConfig) menuConfig.style.display = 'none';
    if (tituloAjustes) tituloAjustes.style.display = 'none';
    if (tituloCadastros) tituloCadastros.style.display = 'none';
    menusCadastros.forEach(el => { if (el.parentElement) el.parentElement.style.display = 'none'; });
  }

  // Especificidade do Auxiliar 1: NÃO vê a aba de dar entrada em NF
  if (cargo === 'auxiliar_1') {
    if (tabEntrada) tabEntrada.style.display = 'none';
    // Se estiver na tela de movimentações, força a aba de Saída como principal
    const tabSaida = document.getElementById('tab-saida');
    if (tabSaida && tabEntrada?.classList.contains('active')) {
       tabSaida.click(); // Simula o clique para abrir a aba certa
    }
  }

  // Farmacêutico: Vê quase tudo, exceto as Configurações Avançadas do sistema
  if (cargo === 'farmaceutico') {
    if (menuConfig) menuConfig.style.display = 'none';
    if (tituloAjustes) tituloAjustes.style.display = 'none';
  }

  // Gestor / Admin: Acesso total (nenhuma regra de ocultar é aplicada)
}

// Executa a verificação no momento do carregamento da tela
verificarAcesso();

// Monitora encerramento de sessão em tempo real
supabase.auth.onAuthStateChange((event, session) => {
  const ePaginaLogin = window.location.pathname.endsWith('login.html');
  if ((event === 'SIGNED_OUT' || !session) && !ePaginaLogin) {
    window.location.href = 'login.html';
  }
});