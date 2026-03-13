'use client';

import { FormEvent, useEffect, useState } from 'react';

interface ManagedUser {
  username: string;
  fullName: string | null;
  email: string | null;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface UserAdminPanelProps {
  currentUsername: string;
}

const formatDate = (value: string | null) => {
  if (!value) {
    return 'Nunca acessou';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

export default function UserAdminPanel({ currentUsername }: UserAdminPanelProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [replacementPassword, setReplacementPassword] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [deletingUsername, setDeletingUsername] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível carregar os usuários');
      }

      const loadedUsers = data.users as ManagedUser[];
      setUsers(loadedUsers);
      setSelectedUsername((current) => {
        if (current && loadedUsers.some((user) => user.username === current)) {
          return current;
        }

        return loadedUsers[0]?.username || '';
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os usuários');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmittingCreate(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newUsername,
          fullName: newFullName,
          email: newEmail,
          password: newPassword,
          isAdmin: newUserIsAdmin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível cadastrar o usuário');
      }

      setNewUsername('');
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewUserIsAdmin(false);
      setSuccessMessage(`Usuário ${data.user.username} cadastrado com sucesso.`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível cadastrar o usuário');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmittingPassword(true);

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(selectedUsername)}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: replacementPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível trocar a senha');
      }

      setReplacementPassword('');
      setSuccessMessage(`Senha atualizada para ${selectedUsername}.`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível trocar a senha');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    const confirmation = window.confirm(`Confirma a exclusão do usuário ${username}?`);

    if (!confirmation) {
      return;
    }

    setError('');
    setSuccessMessage('');
    setDeletingUsername(username);

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível excluir o usuário');
      }

      setSuccessMessage(`Usuário ${username} excluído com sucesso.`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível excluir o usuário');
    } finally {
      setDeletingUsername('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={handleCreateUser} className="bg-white border border-[#cfe0e8] rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#155b79]">Cadastrar usuário</h3>
            <p className="text-sm text-[#4b6573] mt-1">Crie novos acessos diretamente no PostgreSQL, com dados de perfil para identificação da conta.</p>
          </div>

          <div>
            <label htmlFor="new-username" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
              Usuário (login)
            </label>
            <input
              id="new-username"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              className="w-full px-4 py-3 text-sm border border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c]"
              placeholder="Ex.: profissional01"
              minLength={3}
              required
              disabled={isSubmittingCreate}
            />
          </div>

          <div>
            <label htmlFor="new-fullname" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
              Nome completo
            </label>
            <input
              id="new-fullname"
              value={newFullName}
              onChange={(event) => setNewFullName(event.target.value)}
              className="w-full px-4 py-3 text-sm border border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c]"
              placeholder="Ex.: Maria Oliveira"
              minLength={3}
              required
              disabled={isSubmittingCreate}
            />
          </div>

          <div>
            <label htmlFor="new-email" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
              E-mail
            </label>
            <input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="w-full px-4 py-3 text-sm border border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c]"
              placeholder="profissional@clinica.com"
              required
              disabled={isSubmittingCreate}
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
              Senha inicial
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full px-4 py-3 text-sm border border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c]"
              placeholder="Mínimo de 8 caracteres"
              minLength={8}
              required
              disabled={isSubmittingCreate}
            />
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] px-4 py-3 text-sm text-[#0c161c]">
            <input
              type="checkbox"
              checked={newUserIsAdmin}
              onChange={(event) => setNewUserIsAdmin(event.target.checked)}
              disabled={isSubmittingCreate}
              className="h-4 w-4 rounded border-[#cfe0e8] text-[#1a6a8d] focus:ring-[#1ea58c]"
            />
            Conceder acesso administrativo a este usuário
          </label>

          <button
            type="submit"
            disabled={isSubmittingCreate}
            className="w-full bg-[#1a6a8d] hover:bg-[#155b79] text-white text-sm font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {isSubmittingCreate ? 'Cadastrando...' : 'Cadastrar usuário'}
          </button>
        </form>

        <form onSubmit={handlePasswordUpdate} className="bg-white border border-[#cfe0e8] rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#155b79]">Trocar senha</h3>
            <p className="text-sm text-[#4b6573] mt-1">Atualize a senha de qualquer conta já cadastrada no banco.</p>
          </div>

          <div>
            <label htmlFor="selected-username" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
              Usuário alvo
            </label>
            <select
              id="selected-username"
              value={selectedUsername}
              onChange={(event) => setSelectedUsername(event.target.value)}
              className="w-full px-4 py-3 text-sm border border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c] bg-white"
              disabled={isSubmittingPassword || users.length === 0}
              required
            >
              {users.length === 0 && <option value="">Nenhum usuário disponível</option>}
              {users.map((user) => (
                <option key={user.username} value={user.username}>
                  {user.username}{user.username === currentUsername ? ' (você)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="replacement-password" className="block text-xs font-semibold text-[#4b6573] uppercase tracking-wide mb-2">
              Nova senha
            </label>
            <input
              id="replacement-password"
              type="password"
              value={replacementPassword}
              onChange={(event) => setReplacementPassword(event.target.value)}
              className="w-full px-4 py-3 text-sm border border-[#cfe0e8] rounded-lg focus:outline-none focus:border-[#1ea58c]"
              placeholder="Mínimo de 8 caracteres"
              minLength={8}
              required
              disabled={isSubmittingPassword || users.length === 0}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingPassword || users.length === 0}
            className="w-full bg-[#1ea58c] hover:bg-[#17866f] text-white text-sm font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {isSubmittingPassword ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>
      </div>

      {(error || successMessage) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || successMessage}
        </div>
      )}

      <div className="bg-white border border-[#cfe0e8] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#edf4f6] flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-[#155b79]">Usuários cadastrados</h4>
            <p className="text-sm text-[#4b6573] mt-1">Resumo das contas persistidas em banco.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="text-sm font-medium text-[#155b79] hover:text-[#1ea58c] transition"
            disabled={isLoading}
          >
            {isLoading ? 'Atualizando...' : 'Atualizar lista'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f7fbfc]">
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">E-mail</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Perfil</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider">Último acesso</th>
                <th className="px-6 py-3 text-xs font-semibold text-[#4b6573] uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf4f6]">
              {!isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-sm text-[#4b6573]">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}

              {users.map((user) => {
                const disableDelete = user.username === currentUsername;
                return (
                  <tr key={user.username} className="hover:bg-[#f7fbfc] transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-[#0c161c]">{user.username}</td>
                    <td className="px-6 py-4 text-sm text-[#4b6573]">{user.fullName || '-'}</td>
                    <td className="px-6 py-4 text-sm text-[#4b6573]">{user.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-[#4b6573]">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isAdmin ? 'bg-[#e5f4f8] text-[#155b79]' : 'bg-[#effaf7] text-[#1ea58c]'}`}>
                        {user.isAdmin ? 'Administrador' : 'Usuário padrão'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#4b6573]">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(user.username)}
                        disabled={disableDelete || deletingUsername === user.username}
                        className="text-sm font-semibold text-red-700 hover:text-red-800 disabled:text-[#96a8b2] disabled:cursor-not-allowed"
                      >
                        {deletingUsername === user.username ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
