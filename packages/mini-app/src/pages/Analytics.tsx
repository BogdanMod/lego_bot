import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { api } from '../utils/api';
import type { AnalyticsEvent, AnalyticsStats, PopularPath, FunnelStep, TimeSeriesData } from '../types';
import './Analytics.css';

const WebApp = window.Telegram?.WebApp;

type PaginationState = {
  nextCursor: string | null;
  hasMore: boolean;
};

type DateFilter = '1d' | '7d' | '30d' | 'custom';

export default function Analytics() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [timeseries, setTimeseries] = useState<TimeSeriesData[]>([]);
  const [paths, setPaths] = useState<PopularPath[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({ nextCursor: null, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = useMemo(() => {
    const now = new Date();
    const end = now.toISOString();
    if (dateFilter === '1d') {
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      return { dateFrom: start, dateTo: end, granularity: 'hour' as const };
    }
    if (dateFilter === '7d') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return { dateFrom: start, dateTo: end, granularity: 'day' as const };
    }
    if (dateFilter === '30d') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      return { dateFrom: start, dateTo: end, granularity: 'day' as const };
    }
    return {
      dateFrom: customFrom ? new Date(customFrom).toISOString() : undefined,
      dateTo: customTo ? new Date(customTo).toISOString() : undefined,
      granularity: 'day' as const,
    };
  }, [dateFilter, customFrom, customTo]);

  useEffect(() => {
    if (!id) return;
    void loadAnalytics();
  }, [id, dateRange.dateFrom, dateRange.dateTo, dateRange.granularity]);

  const loadAnalytics = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const schemaData = await api.getBotSchema(id);
      const stateKeys = Object.keys(schemaData.schema?.states ?? {});

      const [statsData, timeseriesData, pathsData, eventsData] = await Promise.all([
        api.getAnalyticsStats(id, dateRange.dateFrom, dateRange.dateTo),
        api.getTimeSeriesData(id, 'button_click', dateRange.dateFrom, dateRange.dateTo, dateRange.granularity),
        api.getPopularPaths(id, 10, dateRange.dateFrom, dateRange.dateTo),
        api.getAnalyticsEvents(id, {
          limit: 20,
          dateFrom: dateRange.dateFrom,
          dateTo: dateRange.dateTo,
        }),
      ]);

      setStats(statsData);
      setTimeseries(timeseriesData.data);
      setPaths(pathsData.paths);
      setEvents(eventsData.events);
      setPagination({ nextCursor: eventsData.nextCursor, hasMore: eventsData.hasMore });

      if (stateKeys.length > 0) {
        const funnelData = await api.getFunnelData(
          id,
          stateKeys,
          dateRange.dateFrom,
          dateRange.dateTo
        );
        setFunnel(funnelData.steps);
      } else {
        setFunnel([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить аналитику';
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
      const data = await api.getAnalyticsEvents(id, {
        limit: 20,
        cursor: pagination.nextCursor || undefined,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
      });
      setEvents((prev) => [...prev, ...data.events]);
      setPagination({ nextCursor: data.nextCursor, hasMore: data.hasMore });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить события';
      WebApp?.showAlert(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      setExporting(true);
      const blob = await api.exportAnalytics(id, dateRange.dateFrom, dateRange.dateTo);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось экспортировать отчёт';
      WebApp?.showAlert(message);
    } finally {
      setExporting(false);
    }
  };

  const pathRows = useMemo(() => paths.slice(0, 10), [paths]);

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
    <div className="page analytics-page">
      <div className="page-header">
        <h1 className="page-title">Аналитика</h1>
        <p className="page-subtitle">Статистика взаимодействий и пути пользователей</p>
      </div>

      <div className="analytics-filters">
        <select
          className="input"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
        >
          <option value="1d">Последние 24 часа</option>
          <option value="7d">Последние 7 дней</option>
          <option value="30d">Последние 30 дней</option>
          <option value="custom">Кастомный период</option>
        </select>
        {dateFilter === 'custom' ? (
          <>
            <input
              className="input"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <input
              className="input"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </>
        ) : null}
        <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Экспорт...' : 'Экспорт отчёта'}
        </button>
      </div>

      <div className="analytics-stats">
        <div className="card">
          <div className="analytics-stat-label">Всего пользователей</div>
          <div className="analytics-stat-value">{stats?.totalUsers ?? 0}</div>
        </div>
        <div className="card">
          <div className="analytics-stat-label">Всего событий</div>
          <div className="analytics-stat-value">{stats?.totalEvents ?? 0}</div>
        </div>
        <div className="card">
          <div className="analytics-stat-label">Уникальных пользователей</div>
          <div className="analytics-stat-value">{stats?.uniqueUsers ?? 0}</div>
        </div>
        <div className="card">
          <div className="analytics-stat-label">Средняя активность (сек.)</div>
          <div className="analytics-stat-value">{Math.round(stats?.avgActiveSpan ?? 0)}</div>
        </div>
      </div>

      <div className="analytics-section">
        <h3>Активность</h3>
        {timeseries.length === 0 ? (
          <div className="empty-hint">Данных по активности пока нет</div>
        ) : (
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeseries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#4e8cff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="analytics-section">
        <h3>Популярные пути</h3>
        {pathRows.length === 0 ? (
          <div className="empty-hint">Нет данных о переходах</div>
        ) : (
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pathRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stateFrom" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#7ad3ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="analytics-section">
        <h3>Воронка конверсии</h3>
        {funnel.length === 0 ? (
          <div className="empty-hint">Нет данных для построения воронки</div>
        ) : (
          <div className="analytics-table">
            <div className="analytics-table-header">
              <span>Состояние</span>
              <span>Вошли</span>
              <span>Вышли</span>
              <span>Конверсия</span>
            </div>
            {funnel.map((step) => (
              <div key={step.stateName} className="analytics-table-row">
                <span>{step.stateName}</span>
                <span>{step.usersEntered}</span>
                <span>{step.usersExited}</span>
                <span>{Math.round(step.conversionRate * 100)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="analytics-section">
        <h3>События</h3>
        {events.length === 0 ? (
          <div className="empty-hint">Событий пока нет</div>
        ) : (
          <div className="analytics-table">
            <div className="analytics-table-header">
              <span>Тип</span>
              <span>User ID</span>
              <span>Состояние</span>
              <span>Время</span>
            </div>
            {events.map((event) => (
              <div key={event.id} className="analytics-table-row">
                <span>{event.event_type}</span>
                <span>{event.telegram_user_id}</span>
                <span>{event.state_to || event.state_from || '—'}</span>
                <span>{new Date(event.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        {pagination.hasMore ? (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
