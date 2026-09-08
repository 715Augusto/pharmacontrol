import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-client.js';

// ==========================================
// CARREGAR USUÁRIOS
// ==========================================
export async function carregarUsuarios() {
  const tbody = document.getElementById('lista-usuarios');
  if (!tbody) return;

  // Busca todos os perfis diretamente (Admin tem acesso total via RLS)
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao buscar usuários:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Erro ao carregar dados.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(user => {
    // MAPEAMENTO DAS BADGES DOS NOVOS 4 CARGOS
    let badgeNivel = '';
    const cargo = user.cargo || user.nivel_acesso; // Compatibilidade com registros antigos
    
    if (cargo === 'admin') {
      badgeNivel = '<span style="background:#dc2626; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">👑 Admin (Gestor)</span>';
    } else if (cargo === 'farmaceutico') {
      badgeNivel = '<span style="background:#0284c7; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">💊 Farmacêutico</span>';
    } else if (cargo === 'auxiliar_2') {
      badgeNivel = '<span style="background:#eab308; color:#1e293b; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">📦 Auxiliar 2 (Entradas)</span>';
    } else {
      badgeNivel = '<span style="background:#94a3b8; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">🤝 Auxiliar 1 (Dispensação)</span>';
    }
    
    // MAPEAMENTO DOS STATUS
    let badgeStatus = '';
    let acaoTexto = '';
    let novoStatus = '';

    if (user.status === 'ATIVO') {
      badgeStatus = '<span style="color:#16a34a; font-weight:bold;">✅ Ativo</span>';
      acaoTexto = '🚫 Inativar';
      novoStatus = 'INATIVO';
    } else if (user.status === 'INATIVO') {
      badgeStatus = '<span style="color:#ef4444; font-weight:bold;">❌ Inativo</span>';
      acaoTexto = '✅ Ativar';
      novoStatus = 'ATIVO';
    } else {
      badgeStatus = '<span style="color:#f59e0b; font-weight:bold;">⏳ Pendente</span>';
      acaoTexto = '🚫 Cancelar Convite';
      novoStatus = 'INATIVO';
    }

    // FORMATAÇÃO DO ÚLTIMO ACESSO
    let dataAcesso = '<span style="color: var(--muted);">Nunca acessou</span>';
    if (user.ultimo_acesso) {
      const dataObj = new Date(user.ultimo_acesso);
      dataAcesso = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    return `
      <tr>
        <td><strong>${user.nome || 'Sem Nome'}</strong></td>
        <td>${user.email}</td>
        <td>${badgeNivel}</td>
        <td>${badgeStatus}</td>
        <td>${dataAcesso}</td>
        <td>
          <button type="button" onclick="alterarStatusUsuario('${user.id}', '${novoStatus}')" class="btn-remover" style="width: auto; padding: 4px 8px; border-radius: 4px; font-size: 0.9rem;">
            ${acaoTexto}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// CADASTRAR NOVO USUÁRIO (CONVITE)
// ==========================================
export async function cadastrarUsuario(event) {
  event.preventDefault();

  const nome = document.getElementById('usuario_nome').value.trim();
  const email = document.getElementById('usuario_email').value.trim();
  const cargoEscolhido = document.getElementById('usuario_nivel').value; // 'admin', 'farmaceutico', etc.

  Swal.fire({
    title: 'Criando conta...',
    text: 'Enviando convite para o e-mail...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const senhaTemporaria = Math.random().toString(36).slice(-8) + "A!1a";

    // Dispara a criação no Auth
    const resAuth = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email, password: senhaTemporaria })
    });

    const authData = await resAuth.json();

    if (!resAuth.ok) {
      if (authData.msg?.includes('already registered')) throw new Error('Este e-mail já está cadastrado no sistema.');
      throw new Error(authData.msg || authData.message || 'Erro ao criar conta no cofre de segurança.');
    }

    const userId = authData.user?.id || authData.id;

    // GRAVA O PERFIL PENDENTE COM O NOVO CARGO
    const { error: dbError } = await supabase
      .from('perfis')
      .insert([{ 
        id: userId, 
        nome: nome, 
        email: email, 
        cargo: cargoEscolhido, // <-- MÁGICA AQUI
        status: 'PENDENTE' 
      }]);

    if (dbError) {
       console.error("Erro no DB:", dbError);
       throw new Error("Erro ao salvar o perfil. Contate o suporte.");
    }

    // ENVIA O E-MAIL DE RESET (VAI SERVIR COMO CONVITE)
    await supabase.auth.resetPasswordForEmail(email);

    Swal.fire({
      icon: 'success',
      title: 'Convite Enviado!',
      text: `O e-mail foi disparado para ${email}. O acesso ficará PENDENTE até ele criar a senha definitiva.`,
      confirmButtonColor: '#0284c7'
    });

    document.getElementById('form-usuario').reset();
    carregarUsuarios();

  } catch (error) {
    console.error('Erro:', error);
    Swal.fire({ icon: 'error', title: 'Falha no Cadastro', text: error.message });
  }
}

// ==========================================
// ALTERAR STATUS (Ativar / Inativar)
// ==========================================
export async function alterarStatusUsuario(id, novoStatus) {
  const acao = novoStatus === 'ATIVO' ? 'ativar' : 'inativar';
  const corBtn = novoStatus === 'ATIVO' ? '#16a34a' : '#ef4444';

  const confirmacao = await Swal.fire({
    title: `Deseja ${acao} este usuário?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: corBtn,
    confirmButtonText: `Sim, ${acao}!`,
    cancelButtonText: 'Cancelar'
  });

  if (confirmacao.isConfirmed) {
    const { error } = await supabase
      .from('perfis')
      .update({ status: novoStatus })
      .eq('id', id);

    if (error) {
      Swal.fire('Erro!', 'Não foi possível alterar o status.', 'error');
    } else {
      Swal.fire({ icon: 'success', title: 'Status Atualizado!', timer: 1500, showConfirmButton: false });
      carregarUsuarios();
    }
  }
}

window.alterarStatusUsuario = alterarStatusUsuario;