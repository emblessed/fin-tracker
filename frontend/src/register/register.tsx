import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api/auth';

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

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullname: '',
    login: '',
    email: '',
    password: '',
    gender: 'male',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      const data = await registerUser(formData);
      const hasToken = saveAuthSession(data);

      window.dispatchEvent(new Event('profile:changed'));

      alert('Регистрация прошла успешно!');
      navigate(hasToken ? '/main' : '/login');
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="form auth-form">
        <h1>Регистрация</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="fullName">
              ФИО <span className="warning">*</span>
            </label>
            <br />
            <input
              type="text"
              id="fullName"
              name="fullname"
              placeholder="Фамилия Имя Отчество"
              value={formData.fullname}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label htmlFor="login">
              Логин <span className="warning">*</span>
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

          <div>
            <label htmlFor="email">
              Электронная почта <span className="warning">*</span>
            </label>
            <br />
            <input
              type="email"
              id="email"
              name="email"
              placeholder="example@email.com"
              value={formData.email}
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

          <div>
            <label htmlFor="gender">
              Пол <span className="warning">*</span>
            </label>
            <br />
            <select id="gender" name="gender" value={formData.gender} onChange={handleChange}>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>

          <label className="auth-checkbox-row" htmlFor="tosConfirm">
            <input type="checkbox" id="tosConfirm" name="tosConfirm" required />
            <span>
              Я согласен с <a href="/tos.html">политикой обработки данных</a>
            </span>
          </label>

          <div className="auth-actions">
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>

            <p className="smallLabel textCentered auth-link-row">
              Уже есть аккаунт?{' '}
              <Link className="auth-blue-link" to="/login">
                Войти
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
