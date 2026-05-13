const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/register',  async (req, res) => {
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
        });

        await newUser.save();
        res.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Ошибка сервера при регистрации' });
    }
});

router.post('/login',  async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) {
            return res.status(400).json({ message: 'Логин и пароль обязательны' });
        }

        const user = await User.findOne({ login: login.trim() });
        if (!user) {
            return res.status(400).json({ message: 'Неверный логин или пароль' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Неверный логин или пароль' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Ошибка сервера при входе' });
    }
});

module.exports = router;