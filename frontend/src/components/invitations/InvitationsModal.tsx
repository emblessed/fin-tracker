import { useCallback, useEffect, useState } from 'react';

import {
  acceptFamilyInvitation,
  declineFamilyInvitation,
  getFamilyInvitations,
  type FamilyInvitation,
} from '../../api/family';

type InvitationsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
};

const getInviterName = (invitation: FamilyInvitation) =>
  invitation.inviter.fullname?.trim() ||
  invitation.inviter.login?.trim() ||
  invitation.inviter.email?.trim() ||
  'Пользователь';

const formatDate = (value?: string) => {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
};

export function InvitationsModal({ isOpen, onClose, onChanged }: InvitationsModalProps) {
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadInvitations = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await getFamilyInvitations();
      setInvitations(data.invitations);
    } catch (loadError: any) {
      setError(loadError.message || 'Не удалось загрузить приглашения');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMessage('');
    loadInvitations();
  }, [isOpen, loadInvitations]);

  const notifyInvitationsChanged = () => {
    window.dispatchEvent(new Event('invitations:changed'));
    window.dispatchEvent(new Event('family:changed'));
    onChanged?.();
  };

  const handleAccept = async (invitationId: string) => {
    setProcessingId(invitationId);
    setMessage('');
    setError('');

    try {
      await acceptFamilyInvitation(invitationId);
      setMessage('Приглашение принято');
      await loadInvitations();
      notifyInvitationsChanged();
    } catch (acceptError: any) {
      setError(acceptError.message || 'Не удалось принять приглашение');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessingId(invitationId);
    setMessage('');
    setError('');

    try {
      await declineFamilyInvitation(invitationId);
      setMessage('Приглашение отклонено');
      await loadInvitations();
      notifyInvitationsChanged();
    } catch (declineError: any) {
      setError(declineError.message || 'Не удалось отклонить приглашение');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitationsModalTitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="close-link"
          type="button"
          onClick={onClose}
          aria-label="Закрыть приглашения"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          ×
        </button>

        <p className="stat-label">Приглашения</p>
        <h2 className="modal-title" id="invitationsModalTitle">
          Приглашения в семью
        </h2>
        <p className="modal-text">
          Здесь отображаются только реальные активные приглашения из базы данных.
        </p>

        {isLoading && <p className="member-mail" style={{ marginTop: 20 }}>Загрузка приглашений...</p>}
        {error && <p className="profile-error">{error}</p>}
        {message && <p className="profile-success">{message}</p>}

        {!isLoading && invitations.length === 0 && (
          <div className="invite-card" style={{ marginTop: 24 }}>
            <strong>Активных приглашений нет</strong>
            <p className="member-mail">
              Когда кто-то пригласит тебя в семейный бюджет, приглашение появится здесь.
            </p>
          </div>
        )}

        <div className="member-list" style={{ marginTop: 24 }}>
          {invitations.map((invitation) => {
            const isProcessing = processingId === invitation.id;

            return (
              <article className="invite-card" key={invitation.id}>
                <div className="chips-row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{invitation.familyName}</strong>
                    <p className="member-mail">
                      Пригласил: {getInviterName(invitation)}
                      {invitation.createdAt ? ` · ${formatDate(invitation.createdAt)}` : ''}
                    </p>
                  </div>

                  <span className="small-badge">Новое</span>
                </div>

                <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleAccept(invitation.id)}
                  >
                    {isProcessing ? 'Обработка...' : 'Принять'}
                  </button>

                  <button
                    className="action-light"
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleDecline(invitation.id)}
                  >
                    Отклонить
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default InvitationsModal;
