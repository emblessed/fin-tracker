import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MemberCard } from './MemberCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type CurrentUser = {
  fullname?: string;
  login?: string;
  email?: string;
};

type CurrentUserResponse = {
  user?: CurrentUser;
};

const getDisplayName = (user?: CurrentUser) =>
  user?.fullname?.trim() || user?.login?.trim() || user?.email?.trim() || 'пользователя';

export function FamilySettingsSheet() {
  const [familyName, setFamilyName] = useState('Семья пользователя');

  useEffect(() => {
    const loadCurrentUser = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Не удалось получить данные пользователя');
        }

        const data: CurrentUserResponse = await response.json();
        setFamilyName(`Семья ${getDisplayName(data.user)}`);
      } catch (error) {
        console.error('Ошибка при загрузке пользователя для настроек семьи:', error);
      }
    };

    loadCurrentUser();
  }, []);

  return (
    <section className="sheet">
      <Link className="close-link" to="/family">
        ×
      </Link>

      <h1 className="sheet-title">Настройки семьи</h1>
      <p className="sheet-subtitle">Основные настройки и управление участниками</p>

      <h2 className="family-section-title">Основное</h2>

      <div className="soft-row">
        <span>Название семьи</span>
        <span>
          {familyName} <span className="blue-link">✎</span>
        </span>
      </div>

      <h2 className="family-section-title">Участники семьи</h2>

      <div className="member-list">
        <MemberCard name="Владелец аккаунта" email="owner@example.com" isOwner />
        <MemberCard name="Участник семьи" email="member@example.com" />
      </div>

      <Link className="mini-light-button" to="/family/prompt">
        ＋ Добавить участника
      </Link>

      <div className="bottom-save">
        <button className="primary-button" type="button">
          Сохранить изменения
        </button>
      </div>
    </section>
  );
}
