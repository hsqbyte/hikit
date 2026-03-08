import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    CheckSquareOutlined, PlusOutlined, DeleteOutlined,
    LeftOutlined, RightOutlined,
    CalendarOutlined, UnorderedListOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import {
    GetItems as GetTodoItems,
    CreateItem as CreateTodoItem,
    ToggleItem as ToggleTodoItem,
    UpdateItem as UpdateTodoItem,
    DeleteItem as DeleteTodoItem,
} from '../../../wailsjs/go/todo/TodoService';
import './TodoView.css';

interface TodoItem {
    id: string;
    listId: string;
    title: string;
    completed: boolean;
    dueDate: string; // YYYY-MM-DD
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

interface TodoViewProps {
    name: string;
    assetId: string;
}

type FilterType = 'all' | 'active' | 'completed';
type DateViewMode = 'all' | 'date'; // 'all' shows all items, 'date' filters by selected date

// ========== Date Helpers ==========
const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const todayStr = () => fmt(new Date());

const isSameDay = (a: string, b: string) => a === b;

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const TodoView: React.FC<TodoViewProps> = ({ name, assetId }) => {
    const [items, setItems] = useState<TodoItem[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const editRef = useRef<HTMLInputElement>(null);

    // Calendar state
    const today = new Date();
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<string>(todayStr());
    const [dateViewMode, setDateViewMode] = useState<DateViewMode>('date');

    // Load items
    const loadItems = useCallback(async () => {
        try {
            const result = await GetTodoItems(assetId);
            setItems(result || []);
        } catch (err) {
            console.error('Failed to load todo items:', err);
        }
    }, [assetId]);

    useEffect(() => { loadItems(); }, [loadItems]);

    useEffect(() => {
        if (editingId && editRef.current) {
            editRef.current.focus();
            editRef.current.select();
        }
    }, [editingId]);

    // Build a set of dates that have tasks for dot indicators
    const taskDateMap = useMemo(() => {
        const map: Record<string, { total: number; incomplete: number }> = {};
        items.forEach(item => {
            const d = item.dueDate || '';
            if (!d) return;
            if (!map[d]) map[d] = { total: 0, incomplete: 0 };
            map[d].total++;
            if (!item.completed) map[d].incomplete++;
        });
        return map;
    }, [items]);

    // Items without date
    const noDateCount = useMemo(() => items.filter(i => !i.dueDate).length, [items]);

    // Add item (assign to selected date)
    const handleAdd = async () => {
        const title = newTitle.trim();
        if (!title) return;
        try {
            await CreateTodoItem({
                listId: assetId,
                title,
                completed: false,
                dueDate: dateViewMode === 'date' ? selectedDate : '',
                sortOrder: 0,
            } as any);
            setNewTitle('');
            await loadItems();
            inputRef.current?.focus();
        } catch (err) {
            console.error('Failed to create todo item:', err);
        }
    };

    const handleToggle = async (id: string) => {
        try { await ToggleTodoItem(id); await loadItems(); } catch (err) { console.error(err); }
    };

    const handleStartEdit = (item: TodoItem) => {
        setEditingId(item.id);
        setEditValue(item.title);
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        const title = editValue.trim();
        if (!title) { setEditingId(null); return; }
        try {
            const item = items.find(i => i.id === editingId);
            if (item && item.title !== title) {
                await UpdateTodoItem({ ...item, title } as any);
                await loadItems();
            }
        } catch (err) { console.error(err); }
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        try { await DeleteTodoItem(id); await loadItems(); } catch (err) { console.error(err); }
    };

    const handleClearCompleted = async () => {
        const completed = filteredItems.filter(i => i.completed);
        for (const item of completed) await DeleteTodoItem(item.id);
        await loadItems();
    };

    // Filter items by date + status
    const filteredItems = useMemo(() => {
        let pool = items;
        if (dateViewMode === 'date') {
            pool = pool.filter(i => isSameDay(i.dueDate || '', selectedDate));
        }
        if (filter === 'active') return pool.filter(i => !i.completed);
        if (filter === 'completed') return pool.filter(i => i.completed);
        return pool;
    }, [items, dateViewMode, selectedDate, filter]);

    const activeCount = filteredItems.filter(i => !i.completed).length;
    const completedCount = filteredItems.filter(i => i.completed).length;

    // Calendar navigation
    const prevMonth = () => {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    };
    const goToday = () => {
        const t = new Date();
        setCalYear(t.getFullYear()); setCalMonth(t.getMonth());
        setSelectedDate(todayStr()); setDateViewMode('date');
    };

    // Build calendar grid
    const calendarDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(calYear, calMonth);
        const firstDay = getFirstDayOfMonth(calYear, calMonth);
        const prevMonthDays = getDaysInMonth(calYear, calMonth === 0 ? 11 : calMonth - 1);
        const days: { date: string; day: number; otherMonth: boolean }[] = [];

        // Previous month padding
        for (let i = firstDay - 1; i >= 0; i--) {
            const pm = calMonth === 0 ? 11 : calMonth - 1;
            const py = calMonth === 0 ? calYear - 1 : calYear;
            const d = prevMonthDays - i;
            days.push({ date: fmt(new Date(py, pm, d)), day: d, otherMonth: true });
        }
        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            days.push({ date: fmt(new Date(calYear, calMonth, d)), day: d, otherMonth: false });
        }
        // Next month padding
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            const nm = calMonth === 11 ? 0 : calMonth + 1;
            const ny = calMonth === 11 ? calYear + 1 : calYear;
            days.push({ date: fmt(new Date(ny, nm, d)), day: d, otherMonth: true });
        }
        return days;
    }, [calYear, calMonth]);

    // Display date label
    const dateLabel = useMemo(() => {
        if (dateViewMode === 'all') return '所有日期';
        if (isSameDay(selectedDate, todayStr())) return '今天';
        const d = new Date(selectedDate + 'T00:00:00');
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        if (isSameDay(selectedDate, fmt(tomorrow))) return '明天';
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        if (isSameDay(selectedDate, fmt(yesterday))) return '昨天';
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }, [dateViewMode, selectedDate]);

    return (
        <div className="todo-view">
            {/* ===== Calendar Sidebar ===== */}
            <div className="todo-calendar-sidebar">
                {/* Month navigation */}
                <div className="todo-calendar-header">
                    <span className="todo-calendar-month">{calYear}年 {MONTH_NAMES[calMonth]}</span>
                    <div className="todo-calendar-nav">
                        <button onClick={prevMonth}><LeftOutlined /></button>
                        <button onClick={goToday} title="回到今天"><CalendarOutlined /></button>
                        <button onClick={nextMonth}><RightOutlined /></button>
                    </div>
                </div>

                {/* Calendar grid */}
                <div className="todo-calendar-grid">
                    <div className="todo-calendar-weekdays">
                        {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
                    </div>
                    <div className="todo-calendar-days">
                        {calendarDays.map((cd, idx) => {
                            const isToday = isSameDay(cd.date, todayStr());
                            const isSelected = dateViewMode === 'date' && isSameDay(cd.date, selectedDate);
                            const dateInfo = taskDateMap[cd.date];
                            const hasTasks = !!dateInfo;
                            const hasIncomplete = dateInfo?.incomplete > 0;
                            return (
                                <button
                                    key={idx}
                                    className={[
                                        'todo-cal-day',
                                        cd.otherMonth ? 'other-month' : '',
                                        isToday ? 'today' : '',
                                        isSelected ? 'selected' : '',
                                        hasTasks ? 'has-tasks' : '',
                                        hasIncomplete ? 'has-incomplete' : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => {
                                        setSelectedDate(cd.date);
                                        setDateViewMode('date');
                                    }}
                                >
                                    {cd.day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Quick shortcuts */}
                <div className="todo-date-shortcuts">
                    <button
                        className={`todo-date-shortcut ${dateViewMode === 'all' ? 'active' : ''}`}
                        onClick={() => setDateViewMode('all')}
                    >
                        <span><UnorderedListOutlined style={{ marginRight: 6 }} />全部任务</span>
                        <span className="todo-date-shortcut-count">{items.length}</span>
                    </button>
                    <button
                        className={`todo-date-shortcut ${dateViewMode === 'date' && isSameDay(selectedDate, todayStr()) ? 'active' : ''}`}
                        onClick={goToday}
                    >
                        <span><CalendarOutlined style={{ marginRight: 6 }} />今天</span>
                        <span className="todo-date-shortcut-count">{taskDateMap[todayStr()]?.total || 0}</span>
                    </button>
                    {noDateCount > 0 && (
                        <button
                            className="todo-date-shortcut"
                            style={{ color: '#faad14' }}
                        >
                            <span><ClockCircleOutlined style={{ marginRight: 6 }} />无日期</span>
                            <span className="todo-date-shortcut-count">{noDateCount}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ===== Task Panel ===== */}
            <div className="todo-main">
                {/* Header */}
                <div className="todo-header">
                    <div className="todo-header-left">
                        <CheckSquareOutlined className="todo-header-icon" />
                        <span className="todo-header-title">{name}</span>
                        <span className="todo-header-date">· {dateLabel}</span>
                        <span className="todo-header-count">{activeCount} 项待完成</span>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="todo-filter-bar">
                    <button className={`todo-filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}>
                        全部 ({filteredItems.length})
                    </button>
                    <button className={`todo-filter-btn ${filter === 'active' ? 'active' : ''}`}
                        onClick={() => setFilter('active')}>
                        未完成 ({activeCount})
                    </button>
                    <button className={`todo-filter-btn ${filter === 'completed' ? 'active' : ''}`}
                        onClick={() => setFilter('completed')}>
                        已完成 ({completedCount})
                    </button>
                </div>

                {/* Add input */}
                <div className="todo-add-bar">
                    <input ref={inputRef} className="todo-add-input" type="text"
                        placeholder={dateViewMode === 'date' ? `添加任务到 ${dateLabel}，按回车提交...` : '添加新任务，按回车提交...'}
                        value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                    />
                    <button className="todo-add-btn" onClick={handleAdd}><PlusOutlined /></button>
                </div>

                {/* List */}
                <div className="todo-list">
                    {filteredItems.length === 0 ? (
                        <div className="todo-empty">
                            <CheckSquareOutlined className="todo-empty-icon" />
                            <span className="todo-empty-text">
                                {filter === 'all' ? `${dateLabel} 暂无任务` :
                                    filter === 'active' ? '所有任务已完成 🎉' :
                                        '暂无已完成任务'}
                            </span>
                        </div>
                    ) : (
                        filteredItems.map(item => {
                            const isOverdue = item.dueDate && !item.completed && item.dueDate < todayStr();
                            return (
                                <div key={item.id}
                                    className={`todo-item ${item.completed ? 'completed' : ''}`}>
                                    <div className={`todo-checkbox ${item.completed ? 'checked' : ''}`}
                                        onClick={() => handleToggle(item.id)} />
                                    {editingId === item.id ? (
                                        <input ref={editRef} className="todo-edit-input"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleSaveEdit}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEdit();
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                        />
                                    ) : (
                                        <span className="todo-item-title"
                                            onDoubleClick={() => handleStartEdit(item)}>
                                            {item.title}
                                        </span>
                                    )}
                                    {dateViewMode === 'all' && item.dueDate && (
                                        <span className={`todo-item-date ${isOverdue ? 'overdue' : ''}`}>
                                            {item.dueDate.slice(5)}
                                        </span>
                                    )}
                                    <button className="todo-delete-btn"
                                        onClick={() => handleDelete(item.id)} title="删除">
                                        <DeleteOutlined />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {filteredItems.length > 0 && (
                    <div className="todo-footer">
                        <span>{activeCount} 项未完成</span>
                        {completedCount > 0 && (
                            <button className="todo-clear-btn" onClick={handleClearCompleted}>
                                清除已完成 ({completedCount})
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TodoView;
