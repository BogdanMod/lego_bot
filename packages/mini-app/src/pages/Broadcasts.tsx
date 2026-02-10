import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import type { Broadcast, BroadcastStats, CreateBroadcastData } from '../types';
import './Broadcasts.css';

const WebApp = window.Telegram?.WebApp;

type PaginationState = {
  nextCursor: string | null;
  hasMore: boolean;
};

type StatusFilter = 'all' | Broadcast['status'];

export default function Broadcasts() {
  const { id } = useParams<{ id: string }>();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({ nextCursor: null, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<(Broadcast & { stats: BroadcastStats }) | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [formName, setFormName] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formParseMode, setFormParseMode] = useState<'HTML' | 'Markdown' | 'MarkdownV2'>('HTML');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formMediaType, setFormMediaType] = useState<'none' | 'photo' | 'video' | 'document' | 'audio'>('none');
  const [formMediaUrl, setFormMediaUrl] = useState('');

  useEffect(() => {
    if (!id) return;
    void loadBroadcasts();
  }, [id]);

  const loadBroadcasts = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.getBroadcasts(id, { limit: 20 });
      setBroadcasts(data.broadcasts);
      setPagination({ nextCursor: data.nextCursor, hasMore: data.hasMore });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить рассылки';
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
      const data = await api.getBroadcasts(id, { limit: 20, cursor: pagination.nextCursor || undefined });
      setBroadcasts((prev) => [...prev, ...data.broadcasts]);
      setPagination({ nextCursor: data.nextCursor, hasMore: data.hasMore });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить рассылки';
      WebApp?.showAlert(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreate = async () => {
    if (!id) return;
    try {
      const media =
        formMediaType !== 'none' && formMediaUrl
          ? { type: formMediaType, url: formMediaUrl }
          : undefined;
      const payload: CreateBroadcastData = {
        name: formName,
        message: formMessage,
        media,
        parseMode: formParseMode,
        scheduledAt: formScheduledAt ? new Date(formScheduledAt).toISOString() : undefined,
      };
      await api.createBroadcast(id, payload);
      setFormName('');
      setFormMessage('');
      setFormMediaType('none');
      setFormMediaUrl('');
      setFormScheduledAt('');
      setFormParseMode('HTML');
      setShowCreateForm(false);
      await loadBroadcasts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать рассылку';
      WebApp?.showAlert(message);
    }
  };

  const handleStart = async (broadcastId: string) => {
    if (!id) return;
    try {
      await api.startBroadcast(id, broadcastId);
      await loadBroadcasts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось запустить рассылку';
      WebApp?.showAlert(message);
    }
  };

  const handleCancel = async (broadcastId: string) => {
    if (!id) return;
    try {
      await api.cancelBroadcast(id, broadcastId);
      await loadBroadcasts();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось отменить рассылку';
      WebApp?.showAlert(message);
    }
  };

  const handleView = async (broadcastId: string) => {
    if (!id) return;
    try {
      const data = await api.getBroadcastDetails(id, broadcastId);
      setSelectedBroadcast(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить детали';
      WebApp?.showAlert(message);
    }
  };

  const filteredBroadcasts = useMemo(() => {
    if (statusFilter === 'all') {
      return broadcasts;
    }
    return broadcasts.filter((broadcast) => broadcast.status === statusFilter);
  }, [broadcasts, statusFilter]);

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
    <div className="page broadcasts-page">
      <div className="page-header">
        <h1 className="page-title">Рассылки</h1>
        <p className="page-subtitle">Планирование и отправка сообщений вашим клиентам</p>
      </div>

      <div className="broadcasts-actions">
        <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
          Создать рассылку
        </button>
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="scheduled">Запланированные</option>
          <option value="processing">В процессе</option>
          <option value="completed">Завершенные</option>
          <option value="failed">С ошибкой</option>
          <option value="cancelled">Отмененные</option>
        </select>
      </div>

      {showCreateForm ? (
        <div className="broadcast-form">
          <div className="form-row">
            <label className="input-label">Название</label>
            <input
              className="input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Например: Новая акция"
            />
          </div>
          <div className="form-row">
            <label className="input-label">Сообщение</label>
            <textarea
              className="input textarea"
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              placeholder="Текст рассылки"
            />
          </div>
          <div className="form-row form-row-inline">
            <div>
              <label className="input-label">Parse mode</label>
              <select
                className="input"
                value={formParseMode}
                onChange={(e) => setFormParseMode(e.target.value as 'HTML' | 'Markdown' | 'MarkdownV2')}
              >
                <option value="HTML">HTML</option>
                <option value="Markdown">Markdown</option>
                <option value="MarkdownV2">MarkdownV2</option>
              </select>
            </div>
            <div>
              <label className="input-label">Запланировать</label>
              <input
                className="input"
                type="datetime-local"
                value={formScheduledAt}
                onChange={(e) => setFormScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <div className="form-row form-row-inline">
            <div>
              <label className="input-label">Медиа тип</label>
              <select
                className="input"
                value={formMediaType}
                onChange={(e) => setFormMediaType(e.target.value as 'none' | 'photo' | 'video' | 'document' | 'audio')}
              >
                <option value="none">Без медиа</option>
                <option value="photo">Фото</option>
                <option value="video">Видео</option>
                <option value="document">Документ</option>
                <option value="audio">Аудио</option>
              </select>
            </div>
            <div>
              <label className="input-label">URL</label>
              <input
                className="input"
                value={formMediaUrl}
                onChange={(e) => setFormMediaUrl(e.target.value)}
                placeholder="https://..."
                disabled={formMediaType === 'none'}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>
              Отмена
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!formName || !formMessage}
            >
              Сохранить
            </button>
          </div>
        </div>
      ) : null}

      {filteredBroadcasts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📣</div>
          <div className="empty-state-text">Рассылок пока нет</div>
        </div>
      ) : (
        <div className="broadcasts-list">
          {filteredBroadcasts.map((broadcast) => {
            const total = broadcast.total_recipients || 0;
            const progress =
              total > 0 ? Math.round(((broadcast.sent_count + broadcast.failed_count) / total) * 100) : 0;
            return (
              <div key={broadcast.id} className="broadcast-card">
                <div className="broadcast-card-header">
                  <div>
                    <div className="broadcast-name">{broadcast.name}</div>
                    <div className="broadcast-meta">
                      Создана: {new Date(broadcast.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`broadcast-status ${broadcast.status}`}>{broadcast.status}</span>
                </div>
                <div className="broadcast-stats">
                  <div>Получателей: {broadcast.total_recipients}</div>
                  <div>Отправлено: {broadcast.sent_count}</div>
                  <div>Ошибок: {broadcast.failed_count}</div>
                </div>
                <div className="broadcast-progress">
                  <div className="broadcast-progress-bar" style={{ width: `${progress}%` }} />
                </div>
                <div className="broadcast-actions">
                  {broadcast.status === 'draft' ? (
                    <button className="btn btn-primary" onClick={() => handleStart(broadcast.id)}>
                      Запустить
                    </button>
                  ) : null}
                  {broadcast.status === 'scheduled' || broadcast.status === 'draft' ? (
                    <button className="btn btn-secondary" onClick={() => handleCancel(broadcast.id)}>
                      Отменить
                    </button>
                  ) : null}
                  <button className="btn btn-secondary" onClick={() => handleView(broadcast.id)}>
                    Просмотр
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination.hasMore ? (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
          </button>
        </div>
      ) : null}

      {selectedBroadcast ? (
        <div className="broadcast-details">
          <div className="broadcast-details-header">
            <h3>{selectedBroadcast.name}</h3>
            <button className="btn btn-secondary" onClick={() => setSelectedBroadcast(null)}>
              Закрыть
            </button>
          </div>
          <div className="broadcast-details-stats">
            <div>Всего: {selectedBroadcast.stats.total}</div>
            <div>Ожидают: {selectedBroadcast.stats.pending}</div>
            <div>В процессе: {selectedBroadcast.stats.sending}</div>
            <div>Доставлено: {selectedBroadcast.stats.sent}</div>
            <div>Ошибок: {selectedBroadcast.stats.failed}</div>
            <div>Прочитано (proxy): {selectedBroadcast.stats.engaged}</div>
            <div>Кликнуто: {selectedBroadcast.stats.clicks}</div>
          </div>
          <div className="broadcast-progress">
            <div
              className="broadcast-progress-bar"
              style={{ width: `${selectedBroadcast.stats.progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
