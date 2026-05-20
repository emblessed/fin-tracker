import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

type OperationType = 'income' | 'expense';

type CreatedTransaction = {
  _id: string;
  amount: number;
  date: string;
  category?: string;
  categoryInfo?: string;
  bank?: string;
  commentary?: string;
};

type OperationFormProps = {
  onCreated?: (transaction: CreatedTransaction) => void;
};

const categoryOptions = [
  { value: 'salary', label: 'Зарплата' },
  { value: 'products', label: 'Продукты' },
  { value: 'transfers', label: 'Переводы' },
  { value: 'transport', label: 'Транспорт' },
  { value: 'restaurant', label: 'Рестораны' },
  { value: 'services', label: 'Услуги' },
  { value: 'cash', label: 'Наличные' },
  { value: 'pharmacy', label: 'Аптеки' },
  { value: 'automobile', label: 'Автомобиль' },
  { value: 'clothes', label: 'Одежда' },
  { value: 'entertainment', label: 'Развлечения' },
  { value: 'home', label: 'Дом' },
  { value: 'qr', label: 'QR' },
  { value: 'others', label: 'Другое' },
];

const today = () => new Date().toISOString().slice(0, 10);

const getDefaultCategory = (type: OperationType) =>
  type === 'income' ? 'salary' : 'products';

const OperationForm: React.FC<OperationFormProps> = ({ onCreated }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0');
  const [type, setType] = useState<OperationType>('income');
  const [categoryInfo, setCategoryInfo] = useState(getDefaultCategory('income'));
  const [date, setDate] = useState(today());
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const handleTypeChange = (nextType: OperationType) => {
    setType(nextType);

    if (
      (nextType === 'income' && categoryInfo !== 'salary') ||
      (nextType === 'expense' && categoryInfo === 'salary')
    ) {
      setCategoryInfo(getDefaultCategory(nextType));
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('0');
    setType('income');
    setCategoryInfo(getDefaultCategory('income'));
    setDate(today());
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');

    const token = localStorage.getItem('token');

    if (!token) {
      setNotice('Сессия не найдена. Войдите в аккаунт заново.');
      return;
    }

    const numericAmount = Number(String(amount).replace(',', '.'));

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setNotice('Введите сумму больше нуля');
      return;
    }

    const finalAmount = type === 'income' ? numericAmount : -numericAmount;
    const selectedCategoryLabel =
      categoryOptions.find((category) => category.value === categoryInfo)?.label ||
      'Операция';

    const payload = {
      date,
      amount: finalAmount,
      category: categoryInfo,
      categoryInfo: selectedCategoryLabel,
      bank: 'Ручная операция',
      commentary: description.trim() || selectedCategoryLabel,
    };

    setIsSaving(true);

    try {
      const response = await fetch(`${API_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => null);
        throw new Error(errorResult?.message || 'Не удалось добавить операцию');
      }

      const result = await response.json();
      const createdTransaction = result.data || result;

      setNotice('Операция добавлена');
      resetForm();

      if (createdTransaction?._id) {
        onCreated?.(createdTransaction);
      }

      window.dispatchEvent(
        new CustomEvent('transactions:changed', {
          detail: createdTransaction,
        }),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось добавить операцию');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel operation-form">
      <h2 className="operation-form__title">Новая операция</h2>

      <form className="operation-form__form" onSubmit={handleSubmit}>
        <div className="operation-form__fields">
          <label className="operation-form__field operation-form__field--description">
            <span>Описание</span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Например: Продукты, Зарплата"
            />
          </label>

          <label className="operation-form__field">
            <span>Сумма (₽)</span>
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="0"
              step="0.01"
              required
            />
          </label>

          <label className="operation-form__field">
            <span>Тип</span>
            <select
              value={type}
              onChange={(event) => handleTypeChange(event.target.value as OperationType)}
            >
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
          </label>

          <label className="operation-form__field">
            <span>Категория</span>
            <select
              value={categoryInfo}
              onChange={(event) => setCategoryInfo(event.target.value)}
            >
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="operation-form__field">
            <span>Дата</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
        </div>

        {notice && <p className="operation-form__notice">{notice}</p>}

        <button className="operation-form__submit" type="submit" disabled={isSaving}>
          + {isSaving ? 'Добавляем...' : 'Добавить операцию'}
        </button>
      </form>
    </section>
  );
};

export default OperationForm;
