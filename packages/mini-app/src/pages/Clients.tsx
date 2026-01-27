import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import type { BotUser } from '../types';
import './Clients.css';

const WebApp = window.Telegram?.WebApp;

type BotUserStats = {
  total: number;
  newLast7Days: number;
  conversionRate: number;
};

type PaginationState = {
  nextCursor: string | null;
  hasMore: boolean;
};

type DateFilter = 'all' | '7d' | '30d';

export default function Clients() {
  const { id } = useParams<{ id: string }>();
  const [users, setUsers] = useState<BotUser[]>([]);
  const [stats, setStats] = useState<BotUserStats | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ nextCursor: null, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  useEffect(() => {
    if (!id) return;
    void loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [statsData, usersData] = await Promise.all([
        api.getBotUserStats(id),
        api.getBotUsers(id, { limit: 20 }),
      ]);
      setStats(statsData);
      setUsers(usersData.users);
      setPagination({ nextCursor: usersData.nextCursor, hasMore: usersData.hasMore });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить контакты';
      WebApp?.showAlert(message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!id || loadingMore || !pagination.hasMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const data = await api.getBotUsers(id, { limit: 20, cursor: pagination.nextCursor || undefined });
      setUsers((prev) => [...prev, ...data.users]);
      setPagination({ nextCursor: data.nextCursor, hasMore: data.hasMore });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить контакты';
      WebApp?.showAlert(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      setExporting(true);
      const blob = await api.exportBotUsers(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts-${id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось экспортировать контакты';
      WebApp?.showAlert(message);
    } finally {
      setExporting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const dateThreshold =
      dateFilter === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : dateFilter === '30d'
          ? now - 30 * 24 * 60 * 60 * 1000
          : null;

    return users.filter((user) => {
      const name = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
      const username = user.username ? `@${user.username}`.toLowerCase() : '';
      const matchesSearch = !term || name.includes(term) || username.includes(term);
      const firstInteraction = new Date(user.first_interaction_at).getTime();
      const matchesDate = dateThreshold ? firstInteraction >= dateThreshold : true;
      return matchesSearch && matchesDate;
    });
  }, [users, searchTerm, dateFilter]);

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page clients-page">
      <div className="page-header">
        <h1 className="page-title">Клиенты</h1>
        <p className="page-subtitle">Контакты пользователей, взаимодействующих с ботом</p>
      </div>

      <div className="clients-stats">
        <div className="card">
          <div className="clients-stat-label">Всего контактов</div>
          <div className="clients-stat-value">{stats?.total ?? 0}</div>
        </div>
        <div className="card">
          <div className="clients-stat-label">Новые за 7 дней</div>
          <div className="clients-stat-value">{stats?.newLast7Days ?? 0}</div>
        </div>
        <div className="card">
          <div className="clients-stat-label">Конверсия</div>
          <div className="clients-stat-value">
            {stats ? `${Math.round((stats.conversionRate || 0) * 100)}%` : '0%'}
          </div>
        </div>
      </div>

      <div className="clients-filters">
        <input
          className="input"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Поиск по имени или username"
        />
        <select
          className="input"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
        >
          <option value="all">Все время</option>
          <option value="7d">Последние 7 дней</option>
          <option value="30d">Последние 30 дней</option>
        </select>
        <button className="btn btn-secondary export-button" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Экспорт...' : 'Экспорт в CSV'}
        </button>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📇</div>
          <div className="empty-state-text">Контактов пока нет</div>
        </div>
      ) : (
        <div className="clients-table">
          <div className="clients-table-header">
            <span>Имя</span>
            <span>Username</span>
            <span>Телефон</span>
            <span>Email</span>
            <span>Первое взаимодействие</span>
            <span>Взаимодействия</span>
          </div>
          {filteredUsers.map((user) => {
            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—';
            const username = user.username ? `@${user.username}` : '—';
            return (
              <div key={user.id} className="clients-table-row">
                <span>{fullName}</span>
                <span>{username}</span>
                <span>{user.phone_number || '—'}</span>
                <span>{user.email || '—'}</span>
                <span>{new Date(user.first_interaction_at).toLocaleDateString()}</span>
                <span>{user.interaction_count}</span>
              </div>
            );
          })}
        </div>
      )}

      {pagination.hasMore ? (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
