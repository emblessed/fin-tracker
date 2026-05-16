import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { getCurrentUser, updateCurrentUser } from '../../../../api/auth';

type ProfileForm = {
  fullname: string;
  login: string;
  email: string;
  avatarUrl: string;
  currentPassword: string;
  newPassword: string;
  settings: {
    currency: string;
    language: string;
    theme: 'light' | 'dark';
    emailNotifications: boolean;
  };
};

const emptyForm: ProfileForm = {
  fullname: '',
  login: '',
  email: '',
  avatarUrl: '',
  currentPassword: '',
  newPassword: '',
  settings: {
    currency: 'RUB',
    language: 'ru',
    theme: 'light',
    emailNotifications: true,
  },
};

export function ProfileSettingsSheet() {
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordBlock, setShowPasswordBlock] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getCurrentUser();
        const user = data.user;

        setForm({
          fullname: user.fullname || '',
          login: user.login || '',
          email: user.email || '',
          avatarUrl: user.avatarUrl || '',
          currentPassword: '',
          newPassword: '',
          settings: {
            currency: user.settings?.currency || 'RUB',
            language: user.settings?.language || 'ru',
            theme: user.settings?.theme || 'light',
            emailNotifications: user.settings?.emailNotifications ?? true,
          },
        });
      } catch (loadError) {
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target;

    if (name.startsWith('settings.')) {
      const settingName = name.replace('settings.', '');

      setForm((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingName]:
            type === 'checkbox'
              ? (event.target as HTMLInputElement).checked
              : value,
        },
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setMessage('');
    setIsSaving(true);

    try {
      const payload = {
        fullname: form.fullname,
        login: form.login,
        email: form.email,
        avatarUrl: form.avatarUrl,
        settings: form.settings,
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword || undefined,
      };

      const data = await updateCurrentUser(payload);

      setForm((prev) => ({
        ...prev,
        fullname: data.user.fullname || '',
        login: data.user.login || '',
        email: data.user.email || '',
        avatarUrl: data.user.avatarUrl || '',
        currentPassword: '',
        newPassword: '',
        settings: {
          currency: data.user.settings?.currency || 'RUB',
          language: data.user.settings?.language || 'ru',
          theme: data.user.settings?.theme || 'light',
          emailNotifications: data.user.settings?.emailNotifications ?? true,
        },
      }));

      setShowPasswordBlock(false);
      setMessage('Изменения сохранены');
      window.dispatchEvent(new Event('profile:changed'));
    } catch (saveError: any) {
      setError(saveError.message || 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  if (isLoading) {
    return (
      <section className="sheet">
        <p>Загрузка профиля...</p>
      </section>
    );
  }

  return (
    <form className="sheet" onSubmit={handleSave}>
      <div className="profile-header">
        <h1>Настройки профиля</h1>
      </div>

      <div className="avatar-circle">
        {form.fullname ? form.fullname[0].toUpperCase() : 'U'}
      </div>

      <div className="stack-fields">
        <div>
          <label className="field-label large" htmlFor="fullname">
            ФИО
          </label>
          <input
            className="input-shell"
            id="fullname"
            name="fullname"
            value={form.fullname}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="field-label large" htmlFor="login">
            Логин
          </label>
          <input
            className="input-shell"
            id="login"
            name="login"
            value={form.login}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="field-label large" htmlFor="email">
            Электронная почта
          </label>
          <input
            className="input-shell"
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="field-label large" htmlFor="avatarUrl">
            Ссылка на фото профиля
          </label>
          <input
            className="input-shell"
            id="avatarUrl"
            name="avatarUrl"
            value={form.avatarUrl}
            onChange={handleChange}
            placeholder="https://example.com/avatar.png"
          />
        </div>

        <div>
          <label className="field-label large" htmlFor="currency">
            Валюта
          </label>
          <select
            className="input-shell"
            id="currency"
            name="settings.currency"
            value={form.settings.currency}
            onChange={handleChange}
          >
            <option value="RUB">RUB</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        <div>
          <label className="field-label large" htmlFor="language">
            Язык
          </label>
          <select
            className="input-shell"
            id="language"
            name="settings.language"
            value={form.settings.language}
            onChange={handleChange}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label className="field-label large" htmlFor="theme">
            Тема
          </label>
          <select
            className="input-shell"
            id="theme"
            name="settings.theme"
            value={form.settings.theme}
            onChange={handleChange}
          >
            <option value="light">Светлая</option>
            <option value="dark">Тёмная</option>
          </select>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            name="settings.emailNotifications"
            checked={form.settings.emailNotifications}
            onChange={handleChange}
          />
          Email-уведомления
        </label>

        <button
          className="inline-link"
          type="button"
          onClick={() => setShowPasswordBlock((value) => !value)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          {showPasswordBlock ? 'Не менять пароль' : 'Сменить пароль'}
        </button>

        {showPasswordBlock && (
          <>
            <div>
              <label className="field-label large" htmlFor="currentPassword">
                Текущий пароль
              </label>
              <input
                className="input-shell"
                id="currentPassword"
                name="currentPassword"
                type={showPassword ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="field-label large" htmlFor="newPassword">
                Новый пароль
              </label>
              <input
                className="input-shell"
                id="newPassword"
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={form.newPassword}
                onChange={handleChange}
              />
            </div>

            <button
              className="inline-link"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' }}
            >
              {showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            </button>
          </>
        )}
      </div>

      {error && <p style={{ color: '#d32f2f', margin: '12px 0 0', fontSize: 14 }}>{error}</p>}
      {message && <p style={{ color: '#2e7d32', margin: '12px 0 0', fontSize: 14 }}>{message}</p>}

      <div className="bottom-save">
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>

      <button
        className="danger-link"
        type="button"
        onClick={handleLogout}
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, textAlign: 'left' }}
      >
        Выйти из профиля
      </button>
    </form>
  );
}
