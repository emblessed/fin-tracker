import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { getFamilyStatus, type FamilyStatus } from '../api/family';
import { InvitationsModal } from './invitations/InvitationsModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DROPDOWN_WIDTH = 205;
const DROPDOWN_GAP = 8;
const SCREEN_PADDING = 12;

const highestLayerStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 2147483647,
};

type CurrentUser = {
  fullname?: string;
  login?: string;
  email?: string;
  avatarUrl?: string;
};

type CurrentUserResponse = {
  user?: CurrentUser;
};

interface HeaderProps {
  userName?: string;
  defaultMenuOpen?: boolean;
}

const initialFamilyStatus: FamilyStatus = {
  hasFamily: false,
  family: null,
  pendingInvitationsCount: 0,
};

const getDisplayName = (user?: CurrentUser) => {
  return user?.fullname?.trim() || user?.login?.trim() || user?.email?.trim() || 'Профиль';
};

const Header: React.FC<HeaderProps> = ({ userName = 'Профиль', defaultMenuOpen = false }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(defaultMenuOpen);
  const [isInvitationsModalOpen, setIsInvitationsModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState(userName || 'Профиль');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus>(initialFamilyStatus);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({
    ...highestLayerStyle,
    top: 0,
    left: 0,
    width: DROPDOWN_WIDTH,
    visibility: 'hidden',
  });

  const profileAreaRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateDropdownPosition = useCallback(() => {
    const button = profileButtonRef.current;

    if (!button) return;

    const rect = button.getBoundingClientRect();
    const dropdownWidth = Math.min(DROPDOWN_WIDTH, window.innerWidth - SCREEN_PADDING * 2);
    const left = Math.min(
      Math.max(SCREEN_PADDING, rect.right - dropdownWidth),
      window.innerWidth - dropdownWidth - SCREEN_PADDING
    );

    setDropdownStyle({
      ...highestLayerStyle,
      top: rect.bottom + DROPDOWN_GAP,
      left,
      right: 'auto',
      width: dropdownWidth,
      visibility: 'visible',
    });
  }, []);

  const loadCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setDisplayName(userName || 'Профиль');
      setAvatarUrl('');
      setFamilyStatus(initialFamilyStatus);
      return;
    }

    try {
      const [profileResponse, loadedFamilyStatus] = await Promise.all([
        fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        getFamilyStatus(),
      ]);

      if (!profileResponse.ok) {
        throw new Error('Не удалось получить данные пользователя');
      }

      const profileData: CurrentUserResponse = await profileResponse.json();
      setDisplayName(getDisplayName(profileData.user));
      setAvatarUrl(profileData.user?.avatarUrl || '');
      setFamilyStatus(loadedFamilyStatus);
    } catch (error) {
      console.error('Ошибка при загрузке пользователя:', error);
      localStorage.removeItem('token');
      navigate('/login', { replace: true });
    }
  }, [navigate, userName]);

  useEffect(() => {
    setIsOpen(defaultMenuOpen);
  }, [defaultMenuOpen]);

  useEffect(() => {
    setDisplayName(userName || 'Профиль');
  }, [userName]);

  useEffect(() => {
    loadCurrentUser();

    const handleDataChanged = () => {
      loadCurrentUser();
    };

    window.addEventListener('profile:changed', handleDataChanged);
    window.addEventListener('family:changed', handleDataChanged);
    window.addEventListener('invitations:changed', handleDataChanged);

    return () => {
      window.removeEventListener('profile:changed', handleDataChanged);
      window.removeEventListener('family:changed', handleDataChanged);
      window.removeEventListener('invitations:changed', handleDataChanged);
    };
  }, [loadCurrentUser]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickInsideProfile = profileAreaRef.current?.contains(target);
      const clickInsideDropdown = dropdownRef.current?.contains(target);

      if (!clickInsideProfile && !clickInsideDropdown) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsInvitationsModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;

    updateDropdownPosition();

    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const closeMenu = () => setIsOpen(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    closeMenu();
  };

  const handleOpenInvitations = () => {
    closeMenu();
    setIsInvitationsModalOpen(true);
  };

  const handleInvitationsChanged = () => {
    loadCurrentUser();
  };

  const handleProfileButtonClick = () => {
    updateDropdownPosition();
    setIsOpen((value) => !value);
  };

  const familyLink = familyStatus.hasFamily ? '/family' : '/family/create';
  const familyLabel = familyStatus.hasFamily ? 'Семья' : 'Создать семью';
  const invitationsCount = familyStatus.pendingInvitationsCount || 0;

  const dropdown = isOpen && typeof document !== 'undefined'
    ? createPortal(
        <div className="dropdown" ref={dropdownRef} role="menu" style={dropdownStyle}>
          <Link to={familyLink} onClick={closeMenu}>
            {familyLabel}
          </Link>
          <a
            href="/invitations"
            onClick={(event) => {
              event.preventDefault();
              handleOpenInvitations();
            }}
          >
            <span>Приглашения</span>
            {invitationsCount > 0 && <span className="small-badge">{invitationsCount}</span>}
          </a>
          <Link to="/profile/settings" onClick={closeMenu}>
            Настройки профиля
          </Link>
          <Link to="/main/analytics" onClick={closeMenu}>
            Аналитика
          </Link>
          <Link className="danger" to="/login" onClick={handleLogout}>
            Выйти
          </Link>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <header className="header">
        <Link to="/main" className="logo-title brand-lockup" aria-label="Баланс+">
          <span className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img" focusable="false" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" className="brand-logo__bg" />
              <path className="brand-logo__coin" d="M18.5 17.4a7.5 7.5 0 0 1 15 0v1.8h-15v-1.8Z" />
              <path
                className="brand-logo__wallet"
                d="M13.2 19.2h20.9c2.6 0 4.7 2.1 4.7 4.7v10.4c0 2.6-2.1 4.7-4.7 4.7H13.2a4 4 0 0 1-4-4V23.2a4 4 0 0 1 4-4Z"
              />
              <path className="brand-logo__wallet-line" d="M13.6 18.9h22.2c1.2 0 2.2 1 2.2 2.2v2.2" />
              <path className="brand-logo__pocket" d="M31.2 26.3h8v7.5h-8a3.75 3.75 0 0 1 0-7.5Z" />
              <circle cx="32.4" cy="30.05" r="1.45" className="brand-logo__dot" />
              <path className="brand-logo__plus" d="M36.5 35.1v7.2M32.9 38.7h7.2" />
            </svg>
          </span>
          <span className="brand-name">Баланс+</span>
        </Link>

        <div className="profile-area" ref={profileAreaRef}>
          <button
            className="profile-pill"
            type="button"
            ref={profileButtonRef}
            onClick={handleProfileButtonClick}
            aria-expanded={isOpen}
            aria-haspopup="menu"
          >
            <span className={`profile-dot ${avatarUrl ? 'profile-dot--image' : ''}`}>
              {avatarUrl && <img src={avatarUrl} alt="" />}
            </span>
            {displayName}
            <span className={`caret ${isOpen ? 'up' : ''}`} />
          </button>
        </div>
      </header>

      {dropdown}

      <InvitationsModal
        isOpen={isInvitationsModalOpen}
        onChanged={handleInvitationsChanged}
        onClose={() => setIsInvitationsModalOpen(false)}
      />
    </>
  );
};

export default Header;
