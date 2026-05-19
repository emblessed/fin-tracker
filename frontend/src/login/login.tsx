import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';

const saveAuthSession = (data: any) => {
  const token = data?.token || data?.accessToken;

  if (token) {
    localStorage.setItem('token', token);
  }

  if (data?.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  return Boolean(token);
};

export default function SignedUp() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    login: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await loginUser(formData);
      const hasToken = saveAuthSession(data);

      if (!hasToken) {
        throw new Error('Сервер не вернул токен авторизации');
      }

      window.dispatchEvent(new Event('profile:changed'));

      alert('Вход выполнен успешно!');
      navigate('/main');
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="form auth-form">
        <h1>Вход</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login">
              Логин или электронная почта <span className="warning">*</span>
            </label>
            <br />
            <input
              type="text"
              id="login"
              name="login"
              placeholder="login"
              value={formData.login}
              onChange={handleChange}
              required
            />
          </div>

          <div className="passwordField auth-password-field">
            <label htmlFor="password">
              Пароль <span className="warning">*</span>
            </label>
            <br />
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              className="passwordPadding"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              <span className={`eye-icon ${showPassword ? 'eye-closed' : 'eye-open'}`} />
            </button>
          </div>

          <label className="auth-checkbox-row" htmlFor="rememberMe">
            <input type="checkbox" id="rememberMe" name="rememberMe" />
            <span>Запомнить меня</span>
          </label>

          <div className="auth-actions">
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Проверка...' : 'Войти'}
            </button>

            <p className="smallLabel textCentered auth-link-row">
              Нет аккаунта?{' '}
              <Link className="auth-blue-link" to="/register">
                Зарегистрироваться
              </Link>
            </p>

            <button className="auth-back-button" type="button" onClick={() => navigate(-1)}>
              Назад
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
