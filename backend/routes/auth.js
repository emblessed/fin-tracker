const express = require('express');
const router = express.Router();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const auth = require('../middleware/auth');
const User = require('../models/User');
const Family = require('../models/Family');
const FamilyInvitation = require('../models/FamilyInvitation');

const DEFAULT_SETTINGS = {
  currency: 'RUB',
  language: 'ru',
  theme: 'light',
  emailNotifications: true,
};

function createToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
}

function normalizeSettings(settings = {}) {
  const normalized = {};

  if (['RUB', 'USD', 'EUR'].includes(settings.currency)) {
    normalized.currency = settings.currency;
  }

  if (['ru', 'en'].includes(settings.language)) {
    normalized.language = settings.language;
  }

  if (['light', 'dark'].includes(settings.theme)) {
    normalized.theme = settings.theme;
  }

  if (typeof settings.emailNotifications === 'boolean') {
    normalized.emailNotifications = settings.emailNotifications;
  }

  return normalized;
}

function getSettings(user) {
  const settings = user.settings?.toObject?.() || user.settings || {};

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
  };
}

function getUserDisplayName(user) {
  return user?.fullname?.trim() || user?.login?.trim() || user?.email?.trim() || 'пользователя';
}

function publicUser(user) {
  return {
    id: user._id,
    fullname: user.fullname,
    login: user.login,
    email: user.email,
    gender: user.gender,
    avatarUrl: user.avatarUrl || '',
    familyId: user.familyId || null,
    settings: getSettings(user),
  };
}

function publicFamily(family) {
  if (!family) {
    return null;
  }

  return {
    id: family._id,
    name: family.name,
    ownerId: family.owner?._id || family.owner,
    members: (family.members || []).map((member) => ({
      id: member.user?._id || member.user,
      fullname: member.user?.fullname || '',
      login: member.user?.login || '',
      email: member.user?.email || '',
      role: member.role,
      joinedAt: member.joinedAt,
    })),
    createdAt: family.createdAt,
    updatedAt: family.updatedAt,
  };
}

function publicInvitation(invitation) {
  return {
    id: invitation._id,
    familyId: invitation.family?._id || invitation.family,
    familyName: invitation.family?.name || 'Семья',
    inviter: {
      id: invitation.inviter?._id || invitation.inviter,
      fullname: invitation.inviter?.fullname || '',
      login: invitation.inviter?.login || '',
      email: invitation.inviter?.email || '',
    },
    invitedEmail: invitation.invitedEmail,
    status: invitation.status,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

async function getCurrentUser(req, res) {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ message: 'Пользователь не авторизован' });
    return null;
  }

  const user = await User.findById(userId);

  if (!user) {
    res.status(401).json({ message: 'Пользователь не найден' });
    return null;
  }

  return user;
}

async function getCurrentFamily(userId) {
  return Family.findOne({ 'members.user': userId })
    .populate('owner', 'fullname login email')
    .populate('members.user', 'fullname login email');
}

async function countPendingInvitations(user) {
  return FamilyInvitation.countDocuments({
    status: 'pending',
    $or: [
      { invitedUser: user._id },
      { invitedEmail: user.email },
    ],
  });
}

async function findUserPendingInvitation(user, invitationId) {
  return FamilyInvitation.findOne({
    _id: invitationId,
    status: 'pending',
    $or: [
      { invitedUser: user._id },
      { invitedEmail: user.email },
    ],
  })
    .populate('family')
    .populate('inviter', 'fullname login email');
}

router.post('/register', async (req, res) => {
  try {
    const { fullname, login, email, password, gender } = req.body;

    if (!fullname || !login || !email || !password || !gender) {
      return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    const cleanLogin = login.trim();
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      $or: [{ login: cleanLogin }, { email: cleanEmail }],
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Логин или email уже заняты' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullname: fullname.trim(),
      login: cleanLogin,
      email: cleanEmail,
      password: hashedPassword,
      gender,
      settings: DEFAULT_SETTINGS,
    });

    await newUser.save();

    const token = createToken(newUser);

    res.status(201).json({
      message: 'Пользователь успешно зарегистрирован',
      token,
      user: publicUser(newUser),
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при регистрации' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Логин и пароль обязательны' });
    }

    const cleanLogin = login.trim();
    const cleanEmail = login.toLowerCase().trim();

    const user = await User.findOne({
      $or: [{ login: cleanLogin }, { email: cleanEmail }],
    });

    if (!user) {
      return res.status(400).json({ message: 'Неверный логин или пароль' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Неверный логин или пароль' });
    }

    const token = createToken(user);

    res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при входе' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await getCurrentUser(req, res);

    if (!user) {
      return;
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Profile Load Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при загрузке профиля' });
  }
});

router.patch('/me', auth, async (req, res) => {
  try {
    const user = await getCurrentUser(req, res);

    if (!user) {
      return;
    }

    const {
      fullname,
      login,
      email,
      currentPassword,
      newPassword,
      avatarUrl,
      settings,
    } = req.body;

    if (!fullname || !login || !email) {
      return res.status(400).json({ message: 'ФИО, логин и email обязательны' });
    }

    const cleanLogin = login.trim();
    const cleanEmail = email.toLowerCase().trim();

    const duplicateUser = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ login: cleanLogin }, { email: cleanEmail }],
    });

    if (duplicateUser) {
      return res.status(400).json({ message: 'Логин или email уже заняты' });
    }

    user.fullname = fullname.trim();
    user.login = cleanLogin;
    user.email = cleanEmail;

    if (typeof avatarUrl === 'string') {
      user.avatarUrl = avatarUrl.trim();
    }

    if (settings && typeof settings === 'object') {
      user.settings = {
        ...getSettings(user),
        ...normalizeSettings(settings),
      };
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Введите текущий пароль' });
      }

      const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordCorrect) {
        return res.status(400).json({ message: 'Текущий пароль указан неверно' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Новый пароль должен быть не короче 6 символов' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    res.json({
      message: 'Профиль обновлён',
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Profile Update Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при обновлении профиля' });
  }
});

router.get('/family/status', auth, async (req, res) => {
  try {
    const user = await getCurrentUser(req, res);

    if (!user) {
      return;
    }

    const [family, pendingInvitationsCount] = await Promise.all([
      getCurrentFamily(user._id),
      countPendingInvitations(user),
    ]);

    if (family && String(user.familyId || '') !== String(family._id)) {
      user.familyId = family._id;
      await user.save();
    }

    res.json({
      hasFamily: Boolean(family),
      family: publicFamily(family),
      pendingInvitationsCount,
    });
  } catch (error) {
    console.error('Family Status Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при загрузке семейного доступа' });
  }
});

router.post('/family', auth, async (req, res) => {
  try {
    const user = await getCurrentUser(req, res);

    if (!user) {
      return;
    }

    const existingFamily = await getCurrentFamily(user._id);

    if (existingFamily) {
      return res.status(400).json({ message: 'У пользователя уже есть семья' });
    }

    const requestedName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const name = requestedName || `Семья ${getUserDisplayName(user)}`;

    const family = new Family({
      name,
      owner: user._id,
      members: [
        {
          user: user._id,
          role: 'owner',
        },
      ],
    });

    await family.save();

    user.familyId = family._id;
    await user.save();

    const populatedFamily = await getCurrentFamily(user._id);

    res.status(201).json({
      message: 'Семья создана',
      hasFamily: true,
      family: publicFamily(populatedFamily),
    });
  } catch (error) {
    console.error('Family Create Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при создании семьи' });
  }
});

router.get('/family/invitations', auth, async (req, res) => {
  try {
    const user = await getCurrentUser(req, res);

    if (!user) {
      return;
    }

    const invitations = await FamilyInvitation.find({
      status: 'pending',
      $or: [
        { invitedUser: user._id },
        { invitedEmail: user.email },
      ],
    })
      .sort({ createdAt: -1 })
      .populate('family')
      .populate('inviter', 'fullname login email');

    res.json({ invitations: invitations.map(publicInvitation) });
  } catch (error) {
    console.error('Family Invitations Load Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при загрузке приглашений' });
  }
});

router.post('/family/invitations', auth, async (req, res) => {
  try {
    const user = await getCurrentUser(req, res);

    if (!user) {
      return;
    }

    const family = await getCurrentFamily(user._id);

    if (!family) {
      return res.status(400).json({ message: 'Сначала создайте семью' });
    }

    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';

    if (!email) {
      return res.status(400).json({ message: 'Введите email участника' });
    }

    if (email === user.email) {
      return res.status(400).json({ message: 'Нельзя пригласить самого себя' });
    }

    const invitedUser = await User.findOne({ email });

    if (invitedUser?.familyId || (invitedUser && (await getCurrentFamily(invitedUser._id)))) {
      return res.status(400).json({ message: 'У этого пользователя уже есть семья' });
    }

    const existingInvitation = await FamilyInvitation.findOne({
      family: family._id,
      invitedEmail: email,
      status: 'pending',
    });

    if (existingInvitation) {
      return res.status(400).json({ message: 'Приглашение уже отправлено' });
    }

    const invitation = new FamilyInvitation({
      family: family._id,
      inviter: user._id,
      invitedUser: invitedUser?._id || null,
      invitedEmail: email,
    });

    await invitation.save();

    await invitation.populate('family');
    await invitation.populate('inviter', 'fullname login email');

    res.status(201).json({
      message: 'Приглашение отправлено',
      invitation: publicInvitation(invitation),
    });
  } catch (error) {
    console.error('Family Invitation Create Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при отправке приглашения' });
  }
});

router.patch('/family/invitations/:id/accept', auth, async (req, res) => {
  try {
    const user = await getCurrentUser(req, res);

    if (!user) {
      return;
    }

    const currentFamily = await getCurrentFamily(user._id);

    if (currentFamily) {
      return res.status(400).json({ message: 'У пользователя уже есть семья' });
    }

    const invitation = await findUserPendingInvitation(user, req.params.id);

    if (!invitation) {
      return res.status(404).json({ message: 'Приглашение не найдено' });
    }

    const family = invitation.family;
    const alreadyMember = family.members.some((member) => String(member.user) === String(user._id));

    if (!alreadyMember) {
      family.members.push({
        user: user._id,
        role: 'member',
      });
      await family.save();
    }

    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    await invitation.save();

    user.familyId = family._id;
    await user.save();

    await FamilyInvitation.updateMany(
      {
        _id: { $ne: invitation._id },
        status: 'pending',
        $or: [
          { invitedUser: user._id },
          { invitedEmail: user.email },
        ],
      },
      {
        $set: {
          status: 'cancelled',
          respondedAt: new Date(),
        },
      }
    );

    const populatedFamily = await getCurrentFamily(user._id);
    const pendingInvitationsCount = await countPendingInvitations(user);

    res.json({
      message: 'Приглашение принято',
      hasFamily: true,
      family: publicFamily(populatedFamily),
      pendingInvitationsCount,
    });
  } catch (error) {
    console.error('Family Invitation Accept Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при принятии приглашения' });
  }
});

router.patch('/family/invitations/:id/decline', auth, async (req, res) => {
  try {
    const user = await getCurrentUser(req, res);

    if (!user) {
      return;
    }

    const invitation = await findUserPendingInvitation(user, req.params.id);

    if (!invitation) {
      return res.status(404).json({ message: 'Приглашение не найдено' });
    }

    invitation.status = 'declined';
    invitation.respondedAt = new Date();
    await invitation.save();

    const pendingInvitationsCount = await countPendingInvitations(user);

    res.json({
      message: 'Приглашение отклонено',
      pendingInvitationsCount,
    });
  } catch (error) {
    console.error('Family Invitation Decline Error:', error);
    res.status(500).json({ message: 'Ошибка сервера при отклонении приглашения' });
  }
});

module.exports = router;
