import React, { useState } from 'react';

// Тип данных из MongoDB (PFM проект)
interface ApiTransaction {
  _id: string;
  transactionNum: number;
  amount: number;
  date: string; 
  categoryInfo: string;
  bank?: string;
}

// Тип для отображения в верстке
type Operation = {
  id: string | number;
  title: string;
  tag: string;
  date: string;
  amount: string;
  color: 'green' | 'red';
};

interface OperationsListProps {
  transactions: ApiTransaction[]; 
}

const rowMenuStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '42px',
  width: '190px',
  zIndex: 20,
  padding: '8px',
};

const menuButtonStyle: React.CSSProperties = {
  width: '100%',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  padding: '10px 12px',
  textAlign: 'left',
  borderRadius: '12px',
  font: 'inherit',
};

const noticeStyle: React.CSSProperties = {
  marginTop: '12px',
  padding: '12px 14px',
  borderRadius: '16px',
  background: 'rgba(11, 79, 126, 0.08)',
  color: '#0b4f7e',
  fontSize: '14px',
  fontWeight: 700,
};

const OperationsList: React.FC<OperationsListProps> = ({ transactions }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeOperationId, setActiveOperationId] = useState<string | number | null>(null);
  const [notice, setNotice] = useState('');

  // Трансформируем ApiTransaction в Operation для верстки
  const mappedOperations: Operation[] = transactions.map((apiOp) => {
    const isIncome = apiOp.amount > 0;
    return {
      id: apiOp._id, // Используем MongoDB ID
      title: apiOp.categoryInfo || 'Без категории',
      tag: apiOp.bank || 'Общий счет',
      date: new Date(apiOp.date).toLocaleDateString('ru-RU'), // Формат 29.03.2026
      amount: `${isIncome ? '+' : ''}${apiOp.amount.toLocaleString()} ₽`,
      color: isIncome ? 'green' : 'red',
    };
  });

  // Логика "Показать больше"
  const visibleOperations = expanded ? mappedOperations : mappedOperations.slice(0, 4);

  const handleAction = (action: string, operation: Operation) => {
    setNotice(`${action}: ${operation.title}`);
    setActiveOperationId(null);
  };

  return (
    <section className="panel operations-panel">
      <div className="section-heading">
        <h2>Все операции</h2>
        <span className="list-count">{mappedOperations.length}</span>
      </div>

      <div className="operations-list">
        {mappedOperations.length > 0 ? (
          visibleOperations.map((op) => (
            <div className="operation-row" style={{ position: 'relative' }} key={op.id}>
              <div>
                <strong>{op.title}</strong>
                <span>{op.tag}</span>
              </div>

              <span>{op.date}</span>
              <strong className={op.color}>{op.amount}</strong>

              <button
                className="kebab"
                type="button"
                onClick={() => {
                  setActiveOperationId((current) => (current === op.id ? null : op.id));
                  setNotice('');
                }}
                aria-label={`Открыть действия для операции ${op.title}`}
              >
                ⋯
              </button>

              {activeOperationId === op.id && (
                <div className="dropdown" style={rowMenuStyle} role="menu">
                  <button type="button" style={menuButtonStyle} onClick={() => handleAction('Редактирование выбрано', op)}>
                    Редактировать
                  </button>
                  <button type="button" style={menuButtonStyle} onClick={() => handleAction('Повтор операции выбран', op)}>
                    Повторить
                  </button>
                  <button type="button" style={menuButtonStyle} onClick={() => handleAction('Удаление выбрано', op)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={noticeStyle}>За выбранный период операций не найдено</div>
        )}
      </div>

      {notice && <div style={noticeStyle}>{notice}</div>}

      {mappedOperations.length > 4 && (
        <button
          className="show-more"
          type="button"
          onClick={() => {
            setExpanded((value) => !value);
            setActiveOperationId(null);
            setNotice('');
          }}
        >
          {expanded ? 'Свернуть' : 'Показать больше'}
        </button>
      )}
    </section>
  );
};

export default OperationsList;