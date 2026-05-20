import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, updateCurrentUser } from '../../../../api/auth';

type ProfileUser = {
  fullname?: string;
  login?: string;
  email?: string;
  avatarUrl?: string;
  settings?: {
    emailNotifications?: boolean;
  };
};

type ProfileForm = {
  fullname: string;
  login: string;
  email: string;
  avatarUrl: string;
  currentPassword: string;
  newPassword: string;
  settings: {
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
    emailNotifications: true,
  },
};

const getInitial = (form: ProfileForm) => {
  const source = form.fullname || form.login || form.email || 'U';
  return source.trim().charAt(0).toUpperCase();
};

const resizeAvatarFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Выберите файл изображения'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error('Не удалось обработать изображение'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 360;
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const sourceSize = Math.min(sourceWidth, sourceHeight);
        const sourceX = Math.max((sourceWidth - sourceSize) / 2, 0);
        const sourceY = Math.max((sourceHeight - sourceSize) / 2, 0);
        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('Браузер не поддерживает обработку изображения'));
          return;
        }

        canvas.width = size;
        canvas.height = size;
        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          size,
          size
        );

        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };

      image.src = String(reader.result || '');
    };

    reader.readAsDataURL(file);
  });
};

export function ProfileSettingsSheet() {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
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
        const user: ProfileUser = data.user || {};

        setForm({
          fullname: user.fullname || '',
          login: user.login || '',
          email: user.email || '',
          avatarUrl: user.avatarUrl || '',
          currentPassword: '',
          newPassword: '',
          settings: {
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

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;

if (name.startsWith('settings.')) {
      const settingName = name.replace('settings.', '') as keyof ProfileForm['settings'];
      setForm((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingName]: (type === 'checkbox' ? checked : value) as any,
        },
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError('');
    setMessage('');

    try {
      const avatarUrl = await resizeAvatarFile(file);
      setForm((prev) => ({
        ...prev,
        avatarUrl,
      }));
    } catch (avatarError: any) {
      setError(avatarError.message || 'Не удалось загрузить аватар');
    } finally {
      event.target.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({
      ...prev,
      avatarUrl: '',
    }));
  };

  const handleSave = async (event: FormEvent) => {
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
      const user: ProfileUser = data.user || {};

      setForm((prev) => ({
        ...prev,
        fullname: user.fullname || '',
        login: user.login || '',
        email: user.email || '',
        avatarUrl: user.avatarUrl || '',
        currentPassword: '',
        newPassword: '',
        settings: {
          emailNotifications: user.settings?.emailNotifications ?? true,
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
    return <div className="profile-settings-card">Загрузка профиля...</div>;
  }

  return (
    <section className="profile-settings-card">
      <form className="profile-settings-form" onSubmit={handleSave}>
        <div className="profile-settings-header">
          <h1>Настройки профиля</h1>
        </div>

        <div className="profile-avatar-upload-row">
          <div className="profile-avatar-preview" aria-hidden="true">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" />
            ) : (
              <span>{getInitial(form)}</span>
            )}
          </div>

          <div className="profile-avatar-controls">
            <strong>Фото профиля</strong>
            <span>Загрузите изображение — оно будет обрезано до квадратной аватарки.</span>

            <div className="profile-avatar-actions">
              <input
                ref={avatarInputRef}
                className="profile-avatar-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
              />
              <button
                className="secondary-button"
                type="button"
                onClick={() => avatarInputRef.current?.click()}
              >
                Загрузить аватар
              </button>
              {form.avatarUrl && (
                <button className="ghost-danger-button" type="button" onClick={handleRemoveAvatar}>
                  Удалить
                </button>
              )}
            </div>
          </div>
        </div>

        <label className="profile-field">
          <span>ФИО</span>
          <input name="fullname" value={form.fullname} onChange={handleChange} required />
        </label>

        <label className="profile-field">
          <span>Логин</span>
          <input name="login" value={form.login} onChange={handleChange} required />
        </label>

        <label className="profile-field">
          <span>Электронная почта</span>
          <input name="email" type="email" value={form.email} onChange={handleChange} required />
        </label>

        <label className="profile-checkbox-row">
          <input
            name="settings.emailNotifications"
            type="checkbox"
            checked={form.settings.emailNotifications}
            onChange={handleChange}
          />
          <span>Email-уведомления</span>
        </label>

        <button
          className="profile-link-button"
          type="button"
          onClick={() => setShowPasswordBlock((value) => !value)}
        >
          {showPasswordBlock ? 'Не менять пароль' : 'Сменить пароль'}
        </button>

        {showPasswordBlock && (
          <div className="profile-password-block">
            <label className="profile-field">
              <span>Текущий пароль</span>
              <input
                name="currentPassword"
                type={showPassword ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={handleChange}
              />
            </label>

            <label className="profile-field">
              <span>Новый пароль</span>
              <input
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={form.newPassword}
                onChange={handleChange}
              />
            </label>

            <button
              className="profile-link-button"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            </button>
          </div>
        )}

        {error && <div className="profile-message profile-message--error">{error}</div>}
        {message && <div className="profile-message profile-message--success">{message}</div>}

        <div className="profile-actions-row">
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button className="danger-outline-button" type="button" onClick={handleLogout}>
            Выйти из профиля
          </button>
        </div>
      </form>
    </section>
  );
}

export default ProfileSettingsSheet;
